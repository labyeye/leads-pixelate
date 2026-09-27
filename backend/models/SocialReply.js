const mongoose = require("mongoose");

// One row per incoming comment or DM that autopilot drafted (or sent) a reply to.
const socialReplySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    platform: { type: String, enum: ["facebook", "instagram"], required: true },
    pageId: { type: String, required: true },
    kind: { type: String, enum: ["comment", "dm"], required: true },
    // The comment id (kind=comment) or the sender's PSID/IGSID (kind=dm) — dedupe key together with kind+pageId.
    externalId: { type: String, required: true },
    authorName: { type: String, default: "" },
    incomingText: { type: String, default: "" },
    draftText: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "SENT", "REJECTED", "FAILED", "SKIPPED"],
      default: "PENDING_APPROVAL",
    },
    error: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

socialReplySchema.index({ tenantId: 1, pageId: 1, kind: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model("SocialReply", socialReplySchema);
