const mongoose = require("mongoose");

const socialPostSchema = new mongoose.Schema(
  {
    caption: {
      type: String,
      required: [true, "Caption is required"],
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    platforms: {
      type: [String],
      enum: ["facebook", "instagram"],
      required: true,
    },
    // ── Scheduling ──────────────────────────────────────────────
    scheduledAt: {
      type: Date,
      required: true,
    },
    // ── Status workflow ─────────────────────────────────────────
    // DRAFT → PENDING_APPROVAL → APPROVED / REJECTED → SCHEDULED → POSTING → POSTED / FAILED
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "SCHEDULED",
        "POSTING",
        "POSTED",
        "FAILED",
      ],
      default: "DRAFT",
    },
    // ── Approval ─────────────────────────────────────────────────
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    approvalNote: { type: String, default: "" },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    // ── Post results ─────────────────────────────────────────────
    facebookPostId: { type: String, default: "" },
    instagramPostId: { type: String, default: "" },
    postedAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },
    // ── Author ───────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
  },
  { timestamps: true },
);

socialPostSchema.index({ status: 1 });
socialPostSchema.index({ scheduledAt: 1 });
socialPostSchema.index({ createdAt: -1 });
socialPostSchema.index({ tenantId: 1 });

module.exports = mongoose.model("SocialPost", socialPostSchema);
