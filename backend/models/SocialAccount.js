const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["facebook", "instagram"],
      required: true,
    },

    accountName: { type: String, required: true, trim: true },

    accountId: { type: String, required: true },

    accessToken: { type: String, required: true },
    tokenExpiry: { type: Date, default: null },
    profilePicture: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    instagramBusinessAccountId: { type: String, default: "" },

    userAccessToken: { type: String, default: "" },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
  },
  { timestamps: true },
);

socialAccountSchema.index({ platform: 1, accountId: 1 }, { unique: true });

module.exports = mongoose.model("SocialAccount", socialAccountSchema);
