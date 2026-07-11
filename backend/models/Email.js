const mongoose = require("mongoose");

// One row per email message tied to a lead's thread. Populated either by
// an outbound send from the CRM or by the Gmail polling sync picking up
// a message that matches a lead's email address / a thread we already
// know about (see backend/services/gmailService.js).
const emailSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      enum: ["gmail"],
      default: "gmail",
    },
    providerMessageId: { type: String, required: true },
    providerThreadId: { type: String, default: "" },
    direction: {
      type: String,
      enum: ["outbound", "inbound"],
      required: true,
    },
    from: { type: String, default: "" },
    to: { type: [String], default: [] },
    subject: { type: String, default: "" },
    bodyHtml: { type: String, default: "" },
    bodyText: { type: String, default: "" },
    snippet: { type: String, default: "" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

emailSchema.index({ leadId: 1, sentAt: 1 });
emailSchema.index(
  { provider: 1, providerMessageId: 1 },
  { unique: true },
);

module.exports = mongoose.model("Email", emailSchema);
