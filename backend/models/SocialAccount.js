const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["facebook", "instagram"],
      required: true,
    },
    // Human-readable name (page name or IG username)
    accountName: { type: String, required: true, trim: true },
    // Facebook Page ID or Instagram Business Account ID
    accountId: { type: String, required: true },
    // Page Access Token (for FB pages) or User Access Token (for IG via FB)
    accessToken: { type: String, required: true },
    tokenExpiry: { type: Date, default: null },
    profilePicture: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Instagram-specific: the IG Business Account ID linked to a FB page
    instagramBusinessAccountId: { type: String, default: "" },
    // Store the raw FB user token for refreshing page tokens
    userAccessToken: { type: String, default: "" },
  },
  { timestamps: true },
);

socialAccountSchema.index({ platform: 1, accountId: 1 }, { unique: true });

module.exports = mongoose.model("SocialAccount", socialAccountSchema);
