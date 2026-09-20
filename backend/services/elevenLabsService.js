const AICallSettings = require("../models/AICallSettings");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const log = require("../utils/logger").scope("ElevenLabsService");

/**
 * Build dynamic system prompt and dynamic variables for ElevenLabs Voice Agent
 */
function buildAgentPrompt(settings, lead, tenantName) {
  const greeting = (settings.agentGreeting || "Hello {lead_name}, I am calling from {company_name}!")
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
  const res = await fetch(`${ELEVENLABS_API}/phone-numbers`, { headers: { "xi-api-key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiErrorReason(body, res.status));
  const numbers = Array.isArray(body) ? body : body.phone_numbers || [];
  if (!numbers.length) {
    throw new Error(
      "No phone number found in ElevenLabs. Import a Twilio/SIP (Exotel) number in ElevenLabs -> Agents -> Phone Numbers first."
    );
  }
  const n = numbers.find((x) => x.assigned_agent?.agent_id === agentId) || numbers[0];
  // provider: "twilio" | "sip_trunk" | "exotel" -> matching outbound-call endpoint
  return { id: n.phone_number_id, route: n.provider === "sip_trunk" ? "sip-trunk" : n.provider === "exotel" ? "exotel" : "twilio" };
}

/**
 * Trigger an outbound call to a lead via the ElevenLabs Conversational AI Twilio outbound-call API
 */
async function triggerElevenLabsOutboundCall(lead, settings, userId = null) {
  const apiKey = settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
  const agentId = settings.agentId || process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    throw new Error("ElevenLabs API key is missing. Please configure it in Settings -> AI Calling.");
  }
  if (!agentId) {
    throw new Error("ElevenLabs Agent ID is missing. Please configure it in Settings -> AI Calling.");
  }
  if (!lead.phone) {
    throw new Error(`Lead "${lead.name}" does not have a valid phone number.`);
  }

  // Twilio needs E.164; leads store bare 10-digit Indian numbers
  const digits = String(lead.phone).replace(/\D/g, "");
  const toNumber = `+${digits.length === 10 ? `91${digits}` : digits}`;
  const { id: agentPhoneNumberId, route } = await resolveAgentPhoneNumberId(apiKey, agentId);

  // Get Tenant Name
  let tenantName = "NestLeads";
  if (lead.tenantId) {
    const tenant = await Tenant.findById(lead.tenantId);
    if (tenant && tenant.name) tenantName = tenant.name;
  }

  const { greeting, systemPrompt } = buildAgentPrompt(settings, lead, tenantName);

  // Create CallLog in initiated status
  const callLog = await CallLog.create({
    tenantId: lead.tenantId,
    leadId: lead._id,
    initiatedBy: userId,
    callType: userId ? "manual_in_app" : "automated_ai",
    status: "initiated",
    phoneNumber: lead.phone,
  });

  log.info("Initiating ElevenLabs Outbound Call", {
    leadId: lead._id,
    callLogId: callLog._id,
    phone: lead.phone,
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
        agent_phone_number_id: agentPhoneNumberId,
        to_number: toNumber,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: systemPrompt,
              },
              first_message: greeting,
            },
          },
          custom_llm_extra_body: {
            lead_id: lead._id.toString(),
            call_log_id: callLog._id.toString(),
            tenant_id: lead.tenantId?.toString() || "",
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

    const conversationId = resData.conversation_id || resData.call_id || resData.id || "";

    await CallLog.findByIdAndUpdate(callLog._id, {
      status: "ringing",
      conversationId: conversationId,
    });

    log.info("ElevenLabs Call Initiated Successfully", {
      callLogId: callLog._id,
      conversationId,
    });

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
      (currentTimeStr < settings.callingHoursStart || currentTimeStr > settings.callingHoursEnd)
    ) {
      log.info("Skipping auto-call: outside allowed calling hours", {
        currentTimeStr,
        start: settings.callingHoursStart,
        end: settings.callingHoursEnd,
      });
      return;
    }

    const delayMs = (settings.callDelayMinutes || 1) * 60 * 1000;

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
  triggerElevenLabsOutboundCall,
  autoCallNewLeadIfEnabled,
};
