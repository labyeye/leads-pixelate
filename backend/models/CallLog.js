const mongoose = require("mongoose");
const { Schema } = mongoose;

const UtteranceSchema = new Schema({
  role: { type: String, enum: ["agent", "user", "system"], required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const CallLogSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null, // null if automated AI call
    },
    callType: {
      type: String,
      enum: ["automated_ai", "manual_in_app", "manual_call"], // manual_call = a person calling through Twilio click-to-call
      default: "automated_ai",
    },
    status: {
      type: String,
      enum: ["initiated", "ringing", "in_progress", "completed", "failed", "no_answer", "busy"],
      default: "initiated",
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    recordingUrl: {
      type: String,
      default: "",
    },
    conversationId: {
      type: String, // ElevenLabs conversation_id or Twilio callSid
      default: "",
    },
    transcript: [UtteranceSchema],
    aiSummary: {
      type: String,
      default: "",
    },
    extractedAnswers: {
      type: Map,
      of: String,
      default: {},
    },
    sentiment: {
      type: String,
      enum: ["Positive", "Neutral", "Negative", "Unresponsive", "Unknown"],
      default: "Unknown",
    },
    errorReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CallLog", CallLogSchema);
