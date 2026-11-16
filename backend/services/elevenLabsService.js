const AICallSettings = require("../models/AICallSettings");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const log = require("../utils/logger").scope("ElevenLabsService");

/**
 * Build dynamic system prompt and dynamic variables for ElevenLabs Voice Agent
 */
function buildAgentPrompt(settings, lead, tenantName) {
  const greeting = (
    settings.agentGreeting ||
    "Hello {lead_name}, I am calling from {company_name}!"
  )
    .replace(/{lead_name}/g, lead.name || "Client")
    .replace(/{company_name}/g, tenantName || "our company");

  const questionsList = settings.questions
    .map((q, idx) => {
      const opts = (q.options || []).filter(Boolean);
      return `${idx + 1}. ${q.questionText}${opts.length ? ` (offer these choices: ${opts.join(" / ")}; if the client picks one, use it exactly, otherwise note their own words)` : ""}`;
    })
    .join("\n");

  const systemPrompt = `
${settings.agentPersona || "You are a professional sales assistant."}

Company Name: ${tenantName || "NestLeads CRM"}
Client Name: ${lead.name || "Client"}
Client Phone: ${lead.phone || ""}
Inquired Requirement: ${lead.requirement || "General Inquiry"}

Your mandatory objective is to ask the following ${settings.questions.length} qualification questions during the conversation:
${questionsList}

Rules:
- Be warm, concise, and natural.
- Greet the client with: "${greeting}"
- Ask one question at a time and wait for their response.
- If the client gives an answer, acknowledge it politely and move to the next question.
- At the end of the call, thank them for their time and mention that an executive will follow up with them shortly.
`.trim();

  return { greeting, systemPrompt };
}

const ELEVENLABS_API = "https://api.elevenlabs.io/v1/convai";

function apiErrorReason(body, status) {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e.msg).join("; ");
  return d?.message || body?.message || `ElevenLabs API error (${status})`;
}

/**
 * Number (imported into ElevenLabs) the agent dials out from: the one assigned to this agent, else the first.
 */
async function resolveAgentPhoneNumberId(apiKey, agentId) {
  const res = await fetch(`${ELEVENLABS_API}/phone-numbers`, {
    headers: { "xi-api-key": apiKey },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiErrorReason(body, res.status));
  const numbers = Array.isArray(body) ? body : body.phone_numbers || [];
  if (!numbers.length) {
    throw new Error(
      "No phone number found in ElevenLabs. Import a Twilio/SIP (Exotel) number in ElevenLabs -> Agents -> Phone Numbers first.",
    );
  }
  const n =
    numbers.find((x) => x.assigned_agent?.agent_id === agentId) || numbers[0];
  // provider: "twilio" | "sip_trunk" | "exotel" -> matching outbound-call endpoint
  return {
    id: n.phone_number_id,
    route:
      n.provider === "sip_trunk"
        ? "sip-trunk"
        : n.provider === "exotel"
          ? "exotel"
          : "twilio",
  };
}

/**
 * Digits only with country code, or "" when the number can't be a real phone number.
 * A bare 10-digit number (or one with a leading 0) is treated as Indian.
 */
function normalizePhoneDigits(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
}

/**
 * Trigger an outbound call to a lead through ElevenLabs Conversational AI:
 * over a phone number (Twilio / SIP / Exotel) or as a WhatsApp call.
 */
async function triggerElevenLabsOutboundCall(lead, settings, userId = null) {
  const apiKey = settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
  const agentId = settings.agentId || process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    throw new Error(
      "ElevenLabs API key is missing. Please configure it in Settings -> AI Calling.",
    );
  }
  if (!agentId) {
    throw new Error(
      "ElevenLabs Agent ID is missing. Please configure it in Settings -> AI Calling.",
    );
  }
  if (!lead.phone) {
    throw new Error(`Lead "${lead.name}" does not have a valid phone number.`);
  }

  // Leads store bare 10-digit Indian numbers; add the country code.
  const digits = normalizePhoneDigits(lead.phone);
  if (!digits) {
    throw new Error(
      `Lead "${lead.name}" has an invalid phone number (${lead.phone}).`,
    );
  }
  const isWhatsApp = settings.callChannel === "whatsapp";

  // Channel-specific part of the request: who we call and from which number.
  let route;
  let target;
  if (isWhatsApp) {
    const whatsappPhoneNumberId =
      settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName =
      settings.whatsappPermissionTemplateName ||
      process.env.WHATSAPP_PERMISSION_TEMPLATE_NAME;
    if (!whatsappPhoneNumberId) {
      throw new Error(
        "WhatsApp phone number ID is missing. Copy it from ElevenLabs -> WhatsApp and add it in Settings -> AI Calling.",
      );
    }
    if (!templateName) {
      throw new Error(
        "WhatsApp call permission template name is missing. Add it in Settings -> AI Calling.",
      );
    }
    route = "whatsapp";
    target = {
      whatsapp_phone_number_id: whatsappPhoneNumberId,
      // WhatsApp wants digits only: country code + number, no "+".
      whatsapp_user_id: digits,
      whatsapp_call_permission_request_template_name: templateName,
      whatsapp_call_permission_request_template_language_code:
        settings.whatsappPermissionTemplateLang ||
        process.env.WHATSAPP_PERMISSION_TEMPLATE_LANG ||
        "en",
    };
  } else {
    const number = await resolveAgentPhoneNumberId(apiKey, agentId);
    route = number.route;
    // Twilio/SIP need E.164.
    target = { agent_phone_number_id: number.id, to_number: `+${digits}` };
  }

  // Get Tenant Name
  let tenantName = "NestLeads";
  if (lead.tenantId) {
    const tenant = await Tenant.findById(lead.tenantId);
    if (tenant && tenant.name) tenantName = tenant.name;
  }

  const { greeting, systemPrompt } = buildAgentPrompt(
    settings,
    lead,
    tenantName,
  );

  // Create CallLog in initiated status
  const callLog = await CallLog.create({
    tenantId: lead.tenantId,
    leadId: lead._id,
    initiatedBy: userId,
    callType: userId ? "manual_in_app" : "automated_ai",
    status: "initiated",
    phoneNumber: lead.phone,
    channel: isWhatsApp ? "whatsapp" : "phone",
  });

  log.info("Initiating ElevenLabs Outbound Call", {
    leadId: lead._id,
    callLogId: callLog._id,
    phone: lead.phone,
    channel: isWhatsApp ? "whatsapp" : "phone",
  });

  try {
    // Prompt/first_message overrides must be enabled in the agent's Security tab on ElevenLabs
    const response = await fetch(`${ELEVENLABS_API}/${route}/outbound-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
        ...target,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: systemPrompt,
              },
              // Not allowed on ElevenLabs' free plan; the greeting still goes out as {{greeting}} below.
              ...(settings.overrideFirstMessage !== false && {
                first_message: greeting,
              }),
            },
          },
          custom_llm_extra_body: {
            lead_id: lead._id.toString(),
            call_log_id: callLog._id.toString(),
            tenant_id: lead.tenantId?.toString() || "",
          },
          // Echoed back in the post-call webhook, so the call can be matched even when
          // no conversation_id is returned yet (WhatsApp waiting for call permission).
          dynamic_variables: {
            lead_id: lead._id.toString(),
            call_log_id: callLog._id.toString(),
            lead_name: lead.name || "",
            company_name: tenantName,
            greeting,
          },
        },
      }),
    });

    const resData = await response.json().catch(() => ({}));

    if (!response.ok || resData.success === false) {
      log.error("ElevenLabs Outbound Call API failed", {
        status: response.status,
        resData,
      });

      throw new Error(apiErrorReason(resData, response.status));
    }

    const conversationId =
      resData.conversation_id || resData.call_id || resData.id || "";

    await CallLog.findByIdAndUpdate(callLog._id, {
      // No conversation yet = WhatsApp sent the call-permission request and is waiting for the lead.
      status: conversationId ? "ringing" : "initiated",
      conversationId: conversationId,
    });

    log.info("ElevenLabs Call Initiated Successfully", {
      callLogId: callLog._id,
      conversationId,
    });

    // Don't depend on the post-call webhook alone (it can't reach a local/dev server).
    if (conversationId) {
      watchConversation(conversationId, apiKey, {
        lead_id: lead._id.toString(),
        call_log_id: callLog._id.toString(),
      });
    }

    return {
      success: true,
      callLogId: callLog._id,
      conversationId,
    };
  } catch (error) {
    log.error("Trigger ElevenLabs call error", { message: error.message });
    await CallLog.findByIdAndUpdate(callLog._id, {
      status: "failed",
      errorReason: error.message,
    });
    throw error;
  }
}

const POLL_EVERY_MS = 20 * 1000;
const RING_TIMEOUT_MS = 3 * 60 * 1000; // never connected by then = not answered
const POLL_MAX_MS = 45 * 60 * 1000;

/**
 * Poll ElevenLabs until the call is over, then update the lead (status + remark) from the result.
 * Same handler as the post-call webhook; whichever reports first wins.
 */
function watchConversation(conversationId, apiKey, ids) {
  const { processCallWebhookData } = require("./aiSummarizerService");
  const startedAt = Date.now();

  const finish = (data) =>
    processCallWebhookData({ type: "poll", data }).catch((err) =>
      log.error("Applying polled call result failed", {
        conversationId,
        error: err.message,
      }),
    );

  const tick = async () => {
    const elapsed = Date.now() - startedAt;
    try {
      const log_ = await CallLog.findById(ids.call_log_id).select("status");
      // Already handled by the webhook.
      if (
        !log_ ||
        !["initiated", "ringing", "in_progress"].includes(log_.status)
      )
        return;

      const res = await fetch(
        `${ELEVENLABS_API}/conversations/${conversationId}`,
        { headers: { "xi-api-key": apiKey } },
      );
      const body = await res.json().catch(() => ({}));
      const status = res.ok ? String(body.status || "") : "";

      if (status === "done" || status === "failed") {
        return finish({
          ...body,
          conversation_id: conversationId,
          custom_llm_extra_body: ids,
        });
      }
      const connected = status === "in-progress" || status === "processing";
      if (!connected && elapsed > RING_TIMEOUT_MS) {
        return finish({
          conversation_id: conversationId,
          status: "no_answer",
          failure_reason: "No answer",
          custom_llm_extra_body: ids,
        });
      }
    } catch (err) {
      log.warn("Polling call status failed", {
        conversationId,
        error: err.message,
      });
    }
    if (elapsed < POLL_MAX_MS) setTimeout(tick, POLL_EVERY_MS).unref();
  };

  setTimeout(tick, POLL_EVERY_MS).unref();
}

/**
 * Auto-trigger call on new lead creation if calling is enabled for tenant
 */
async function autoCallNewLeadIfEnabled(lead) {
  try {
    if (!lead || !lead.tenantId || !lead.phone) return;

    const settings = await AICallSettings.findOne({
      tenantId: lead.tenantId,
      enabled: true,
    });

    if (!settings || !settings.enabled) return;

    // Check calling hours
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    if (
      settings.callingHoursStart &&
      settings.callingHoursEnd &&
      (currentTimeStr < settings.callingHoursStart ||
        currentTimeStr > settings.callingHoursEnd)
    ) {
      log.info("Skipping auto-call: outside allowed calling hours", {
        currentTimeStr,
        start: settings.callingHoursStart,
        end: settings.callingHoursEnd,
      });
      return;
    }

    // 0 = call straight away.
    const delayMs = Math.max(0, settings.callDelayMinutes ?? 1) * 60 * 1000;

    log.info("Scheduling automated AI outbound call for new lead", {
      leadId: lead._id,
      delayMinutes: settings.callDelayMinutes,
    });

    setTimeout(async () => {
      try {
        const refreshedLead = await Lead.findById(lead._id);
        if (!refreshedLead) return;
        await triggerElevenLabsOutboundCall(refreshedLead, settings);
      } catch (err) {
        log.error("Scheduled auto-call execution failed", {
          leadId: lead._id,
          error: err.message,
        });
      }
    }, delayMs);
  } catch (err) {
    log.error("autoCallNewLeadIfEnabled error", { message: err.message });
  }
}

module.exports = {
  buildAgentPrompt,
  normalizePhoneDigits,
  triggerElevenLabsOutboundCall,
  autoCallNewLeadIfEnabled,
};
