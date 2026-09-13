const mongoose = require("mongoose");

// Meta/LinkedIn have no concept of "which of our employees owns this
// campaign" — this is purely internal bookkeeping layered on top of the
// external campaign id, one row per (tenant, platform, campaign).
const campaignAssignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    platform: {
      type: String,
      enum: ["facebook", "linkedin"],
      required: true,
    },
    campaignId: {
      type: String,
      required: true,
    },
    campaignName: {
      type: String,
      trim: true,
    },
    adAccountId: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

campaignAssignmentSchema.index(
  { tenantId: 1, ownerUser: 1, platform: 1, campaignId: 1 },
  { unique: true },
);

module.exports = mongoose.model("CampaignAssignment", campaignAssignmentSchema);
