const mongoose = require("mongoose");

// One row per connected account per day: the follower total at that day.
const followerSnapshotSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialAccount",
      required: true,
    },
    platform: { type: String, enum: ["facebook", "instagram"], required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (UTC)
    followers: { type: Number, required: true },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
  },
  { timestamps: true },
);

followerSnapshotSchema.index({ accountId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("FollowerSnapshot", followerSnapshotSchema);
