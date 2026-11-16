const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const AICallSettings = require("../models/AICallSettings");
const ActivityLog = require("../models/ActivityLog");
const { AI_NAME } = require("../utils/performanceMetrics");
const { ALL_STATUSES } = require("../utils/leadStatuses");
const log = require("../utils/logger").scope("AISummarizerService");

/**
 * Process post-call transcription & analysis from ElevenLabs Webhook
 */
async function processCallWebhookData(rawPayload) {
  // ElevenLabs wraps the call in { type, event_timestamp, data }; older/test payloads are flat.
  const eventType = rawPayload.type || rawPayload.event || "";
  const payload =
    rawPayload.data && typeof rawPayload.data === "object"
      ? rawPayload.data
      : rawPayload;
  log.info("Received ElevenLabs Webhook Payload", {
    eventType,
    conversationId: payload.conversation_id,
    callId: payload.call_id,
  });

  const conversationId = payload.conversation_id || payload.call_id;
  const clientData = payload.conversation_initiation_client_data || {};
  const customData = {
    ...(clientData.dynamic_variables || {}),
    ...(clientData.custom_llm_extra_body || {}),
    ...(payload.custom_llm_extra_body || payload.client_data || {}),
  };
  const leadId = customData.lead_id || payload.lead_id;

  let callLog = null;

  if (conversationId) {
    callLog = await CallLog.findOne({ conversationId });
  }

  if (!callLog && customData.call_log_id) {
    callLog = await CallLog.findById(customData.call_log_id).catch(() => null);
  }

  if (!callLog && leadId) {
    callLog = await CallLog.findOne({
      leadId,
      status: { $in: ["initiated", "ringing", "in_progress"] },
    }).sort({ createdAt: -1 });
  }

  if (!callLog) {
    log.warn("No matching CallLog found for webhook payload", {
      conversationId,
      leadId,
    });
    return { success: false, message: "No matching CallLog found" };
  }

  // The webhook and the status poll can both report the same call; apply it once.
  if (FINAL_CALL_STATUSES.includes(callLog.status)) {
    return { success: true, alreadyProcessed: true, callLogId: callLog._id };
  }

  const lead = await Lead.findById(callLog.leadId);
  if (!lead) {
    log.warn("Lead not found for callLog", { leadId: callLog.leadId });
    return { success: false, message: "Lead not found" };
  }

  const settings = await AICallSettings.findOne({ tenantId: callLog.tenantId });

  // Extract Transcript
  let rawTranscript =
    payload.transcript || payload.conversation_transcript || [];
  let formattedTranscript = [];

  if (Array.isArray(rawTranscript)) {
    // Tool-call turns have no spoken text; skip them.
    formattedTranscript = rawTranscript
      .filter((t) => t && (t.message || t.text))
      .map((t) => ({
        role: t.role === "agent" || t.speaker === "agent" ? "agent" : "user",
        message: t.message || t.text || "",
        timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
      }));
  }

  const durationSeconds =
    payload.metadata?.call_duration_secs ||
    payload.duration_seconds ||
    payload.call_duration ||
    0;
  const recordingUrl = payload.recording_url || payload.audio_url || "";
  // Why the call never connected: declined / missed / busy / WhatsApp permission declined or expired.
  const failureReason = String(
    payload.failure_reason ||
      payload.metadata?.termination_reason ||
      payload.metadata?.error?.reason ||
      "",
  );
  const callStatus = normalizeCallStatus(
    eventType,
    payload,
    failureReason,
    formattedTranscript.length,
  );

  // Build full transcript text for summarization
  const fullTranscriptText = formattedTranscript
    .map((t) => `${t.role.toUpperCase()}: ${t.message}`)
    .join("\n");

  // Extract answers to custom questions and sentiment using rules / regex / simple parser
  const extractedAnswers = {};
  let aiSummary = "";
  let sentiment = "Neutral";

  // Parse ElevenLabs analysis criteria if present
  if (payload.analysis) {
    aiSummary =
      payload.analysis.transcript_summary || payload.analysis.summary || "";
    sentiment = [true, "success"].includes(payload.analysis.call_successful)
      ? "Positive"
      : "Neutral";
  }

  // Fallback summary generation if analysis is not present
  if (!aiSummary && fullTranscriptText) {
    aiSummary = `AI Call finished (${durationSeconds}s). Customer responded to automated qualification questions.`;
  }

  if (!aiSummary && callStatus !== "completed") {
    aiSummary = `Call not connected${failureReason ? `: ${failureReason}` : ""}.`;
    sentiment = "Unresponsive";
  }

  // Map answers to Lead fields if configured
  const updateData = {};
  const newRemarks = [];

  if (settings && settings.questions && settings.questions.length > 0) {
    settings.questions.forEach((q) => {
      // Find matching user utterance after agent asks question
      const answer = findAnswerForQuestion(q.questionText, formattedTranscript);
      if (answer) {
        extractedAnswers[q.id || q.questionText] = answer;
        newRemarks.push(`- ${q.questionText}: ${answer}`);

        // Update lead fields dynamically if fieldKey exists
        if (q.fieldKey && answer) {
          if (q.fieldKey === "budget") updateData.budget = answer;
          if (q.fieldKey === "interestedProducts")
            updateData.interestedProducts = answer;
          if (q.fieldKey === "requirement") updateData.requirement = answer;
        }
      }
    });
  }

  const remarksHeader = `[🤖 ElevenLabs AI Voice Call Notes - ${new Date().toLocaleDateString()}]`;
  const formattedRemarksText = `${remarksHeader}\nSummary: ${aiSummary}\n${newRemarks.length > 0 ? "Extracted Details:\n" + newRemarks.join("\n") : ""}`;

  // Update CallLog record
  callLog.status = callStatus;
  if (conversationId && !callLog.conversationId)
    callLog.conversationId = conversationId;
  if (callStatus !== "completed" && failureReason)
    callLog.errorReason = failureReason.slice(0, 300);
  callLog.durationSeconds = durationSeconds;
  callLog.recordingUrl = recordingUrl;
  callLog.transcript = formattedTranscript;
  callLog.aiSummary = aiSummary;
  callLog.extractedAnswers = extractedAnswers;
  callLog.sentiment = sentiment;
  await callLog.save();

  // Append to Lead's remarks & status
  const existingRemarks = lead.remarks ? `${lead.remarks}\n\n` : "";
  updateData.remarks = `${existingRemarks}${formattedRemarksText}`;

  // Move the lead along the pipeline the same way a salesperson would after a call.
  const answered = callStatus === "completed" && formattedTranscript.length > 2;
  const nextStatus = nextStatusAfterCall(lead.status, answered, settings);
  if (nextStatus) updateData.status = nextStatus;
  // Not picked up: come back to this lead tomorrow.
  if (!answered && nextStatus) {
    updateData.followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  // Add to status history
  if (updateData.status && updateData.status !== lead.status) {
    lead.statusHistory.push({
      status: updateData.status,
      timestamp: new Date(),
      byAI: true,
      remarks:
        `AI call: ${aiSummary || (answered ? "Spoke with the lead." : "Call not connected.")}`.slice(
          0,
          500,
        ),
    });
  }

  const movedTo = updateData.status && updateData.status !== lead.status ? updateData.status : "";
  Object.assign(lead, updateData);
  await lead.save();

  // Show the call in the team's activity feed, like any other update to a lead.
  ActivityLog.create({
    userName: AI_NAME,
    userRole: "ai_agent",
    action: movedTo ? "STATUS_UPDATED" : "NOTE_ADDED",
    module: "Lead",
    description: `${answered ? "Spoke with" : "Called"} ${lead.name || "lead"}${answered ? "" : " (not answered)"}${movedTo ? ` · moved to ${movedTo}` : ""}`,
    targetId: String(lead._id),
    tenantId: lead.tenantId || null,
  }).catch((e) => log.warn("Could not log AI call activity", { error: e.message }));

  log.info("Successfully updated lead with ElevenLabs AI Call analysis", {
    leadId: lead._id,
    callLogId: callLog._id,
  });

  return {
    success: true,
    callLogId: callLog._id,
    leadId: lead._id,
  };
}

const FINAL_CALL_STATUSES = ["completed", "failed", "no_answer", "busy"];

// No-pickup ladder of the "New Lead" stage (same steps as the Leads page's "No pickup" action).
const NO_PICKUP_NEXT = {
  "PENDING CONTACT": "1",
  1: "2",
  2: "3",
  3: "COMPLETED",
};
const NEW_LEAD_STATUSES = ["PENDING CONTACT", "1", "2", "3", "COMPLETED"];

/**
 * Status a lead moves to after an AI call, or null to leave it where it is.
 * Answered: a lead still in the New Lead stage moves to DISCUSSION.
 * Not answered: it steps down the no-pickup ladder.
 * Leads already past New Lead (discussion, quotation, won...) are never moved.
 * A status chosen in AI Calling settings wins when it is a real pipeline status.
 */
function nextStatusAfterCall(current, answered, settings) {
  if (!NEW_LEAD_STATUSES.includes(current)) return null;
  const mapping = settings?.autoStatusMapping || {};
  const custom = answered ? mapping.qualifiedStatus : mapping.noAnswerStatus;
  if (custom && ALL_STATUSES.includes(custom)) return custom;
  if (answered) return "DISCUSSION";
  return NO_PICKUP_NEXT[current] || null;
}

/**
 * Map an ElevenLabs post-call event to a CallLog status
 * (completed / no_answer / busy / failed).
 */
function normalizeCallStatus(eventType, payload, failureReason, turns) {
  const status = String(payload.status || "").toLowerCase();
  const reason = failureReason.toLowerCase();
  const neverConnected =
    eventType === "call_initiation_failure" ||
    ["failed", "error", "no_answer", "no-answer", "busy"].includes(status);
  if (neverConnected) {
    if (status === "busy" || reason.includes("busy")) return "busy";
    if (
      status.replace("-", "_") === "no_answer" ||
      /no.?answer|unanswered|missed|timeout|timed out/.test(reason)
    )
      return "no_answer";
    return "failed";
  }
  // "done" is ElevenLabs' word for a finished conversation.
  if (["done", "completed", "success"].includes(status) || payload.successful)
    return "completed";
  return turns > 0 ? "completed" : "failed";
}

/**
 * Helper to match transcript answer following a question phrase
 */
function findAnswerForQuestion(questionText, transcript) {
  if (!transcript || transcript.length === 0) return null;
  const qLower = questionText.toLowerCase().slice(0, 15);

  for (let i = 0; i < transcript.length; i++) {
    const item = transcript[i];
    if (item.role === "agent" && item.message.toLowerCase().includes(qLower)) {
      // Return next user response
      if (i + 1 < transcript.length && transcript[i + 1].role === "user") {
        return transcript[i + 1].message;
      }
    }
  }
  return null;
}

module.exports = {
  processCallWebhookData,
};
