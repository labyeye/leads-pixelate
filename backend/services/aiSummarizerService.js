const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const AICallSettings = require("../models/AICallSettings");
const log = require("../utils/logger").scope("AISummarizerService");

/**
 * Process post-call transcription & analysis from ElevenLabs Webhook
 */
async function processCallWebhookData(payload) {
  log.info("Received ElevenLabs Webhook Payload", {
    conversationId: payload.conversation_id,
    callId: payload.call_id,
  });

  const conversationId = payload.conversation_id || payload.call_id;
  const customData = payload.custom_llm_extra_body || payload.client_data || {};
  const leadId = customData.lead_id || payload.lead_id;

  let callLog = null;

  if (conversationId) {
    callLog = await CallLog.findOne({ conversationId });
  }

  if (!callLog && leadId) {
    callLog = await CallLog.findOne({ leadId, status: { $in: ["initiated", "ringing", "in_progress"] } }).sort({ createdAt: -1 });
  }

  if (!callLog) {
    log.warn("No matching CallLog found for webhook payload", { conversationId, leadId });
    return { success: false, message: "No matching CallLog found" };
  }

  const lead = await Lead.findById(callLog.leadId);
  if (!lead) {
    log.warn("Lead not found for callLog", { leadId: callLog.leadId });
    return { success: false, message: "Lead not found" };
  }

  const settings = await AICallSettings.findOne({ tenantId: callLog.tenantId });

  // Extract Transcript
  let rawTranscript = payload.transcript || payload.conversation_transcript || [];
  let formattedTranscript = [];

  if (Array.isArray(rawTranscript)) {
    formattedTranscript = rawTranscript.map((t) => ({
      role: t.role === "agent" || t.speaker === "agent" ? "agent" : "user",
      message: t.message || t.text || "",
      timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
    }));
  }

  const durationSeconds = payload.duration_seconds || payload.call_duration || 0;
  const recordingUrl = payload.recording_url || payload.audio_url || "";
  const callStatus = payload.status === "completed" || payload.successful ? "completed" : payload.status || "completed";

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
    aiSummary = payload.analysis.transcript_summary || payload.analysis.summary || "";
    sentiment = payload.analysis.call_successful ? "Positive" : "Neutral";
  }

  // Fallback summary generation if analysis is not present
  if (!aiSummary && fullTranscriptText) {
    aiSummary = `AI Call finished (${durationSeconds}s). Customer responded to automated qualification questions.`;
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
          if (q.fieldKey === "interestedProducts") updateData.interestedProducts = answer;
          if (q.fieldKey === "requirement") updateData.requirement = answer;
        }
      }
    });
  }

  const remarksHeader = `[🤖 ElevenLabs AI Voice Call Notes - ${new Date().toLocaleDateString()}]`;
  const formattedRemarksText = `${remarksHeader}\nSummary: ${aiSummary}\n${newRemarks.length > 0 ? "Extracted Details:\n" + newRemarks.join("\n") : ""}`;

  // Update CallLog record
  callLog.status = callStatus;
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

  // Auto-status update based on settings
  if (settings && settings.autoStatusMapping) {
    if (callStatus === "completed" && formattedTranscript.length > 2) {
      updateData.status = settings.autoStatusMapping.qualifiedStatus || "QUALIFIED";
    } else if (callStatus === "no_answer" || callStatus === "failed") {
      updateData.status = settings.autoStatusMapping.noAnswerStatus || "ATTEMPTED CONTACT";
    }
  }

  // Add to status history
  if (updateData.status && updateData.status !== lead.status) {
    lead.statusHistory.push({
      status: updateData.status,
      timestamp: new Date(),
      remarks: "Updated automatically by ElevenLabs AI Calling Assistant",
    });
  }

  Object.assign(lead, updateData);
  await lead.save();

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
