const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    tenantName: { type: String },
    userEmail: { type: String },
    invoiceNumber: { type: String },
    usedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const offerCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: "" },
    discountType: {
      type: String,
      enum: ["bonus_months", "flat_rate", "percent_off"],
      required: true,
      default: "bonus_months",
    },
    bonusMonths: { type: Number, min: 1 },
    flatRate: { type: Number, min: 0 },
    percentOff: { type: Number, min: 1, max: 100 },
    maxUses: { type: Number, required: true, default: 200 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdByEmail: { type: String, default: "" },
    usages: [usageSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("OfferCode", offerCodeSchema);
