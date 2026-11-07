const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["facebook", "instagram", "linkedin"],
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

// Per tenant: the same page can be connected by more than one tenant.
socialAccountSchema.index(
  { tenantId: 1, platform: 1, accountId: 1 },
  { unique: true },
);

const SocialAccount = mongoose.model("SocialAccount", socialAccountSchema);

// Older databases still carry the pre-multi-tenant index { platform, accountId } (unique across ALL tenants), which
// makes a second tenant connecting the same page fail with E11000. Mongoose never drops old indexes, so do it here.
// Commands are buffered until the connection is up; "index not found" (27) just means it is already gone.
SocialAccount.collection.dropIndex("platform_1_accountId_1").catch((e) => {
  if (e.code !== 27 && e.codeName !== "IndexNotFound" && e.code !== 26) console.error("SocialAccount: dropping stale index failed:", e.message);
});

module.exports = SocialAccount;
