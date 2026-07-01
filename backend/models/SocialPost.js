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

    accountIds: {
      type: [String],
      default: [],
    },

    postType: {
      type: String,
      enum: ["image", "carousel", "reel"],
      default: "image",
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    videoUrl: { type: String, default: "" },
    coverImageUrl: { type: String, default: "" },

    scheduledAt: {
      type: Date,
      required: true,
    },
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

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
        "PARTIALLY_POSTED",
        "FAILED",
      ],
      default: "DRAFT",
    },

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

    facebookPostId: { type: String, default: "" },
    instagramPostId: { type: String, default: "" },
    postedAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },

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
