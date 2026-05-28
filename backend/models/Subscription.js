const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    amount: { type: Number }, // in paise
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
    paidAt: { type: Date },
    invoiceUrl: { type: String },
  },
  { timestamps: true },
);

const subscriptionSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: ["trial", "starter", "growth", "enterprise"],
      default: "trial",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "past_due", "trialing"],
      default: "trialing",
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date, default: null },
    razorpaySubscriptionId: { type: String, default: null },
    invoices: [invoiceSchema],
  },
  { timestamps: true },
);

const PLAN_LIMITS = {
  trial: { leadsPerMonth: 100, teamMembers: 2 },
  starter: { leadsPerMonth: 500, teamMembers: 2 },
  growth: { leadsPerMonth: 5000, teamMembers: 10 },
  enterprise: { leadsPerMonth: 99999, teamMembers: 999 },
};

const PLAN_PRICES_MONTHLY = {
  starter: 99900, // ₹999
  growth: 249900, // ₹2,499
  enterprise: 699900, // ₹6,999
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.PLAN_PRICES_MONTHLY = PLAN_PRICES_MONTHLY;
