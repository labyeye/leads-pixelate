const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    hdfcPaymentId: { type: String },
    hdfcOrderId: { type: String },
    hdfcTrackingId: { type: String },
    // kept for backward compat with old Razorpay records
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    amount: { type: Number }, // in paise
    currency: { type: String, default: "INR" },
    plan: { type: String },
    billingCycle: { type: String },
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
      enum: [
        "trial",
        "starter",
        "growth",
        "professional",
        "business",
        "enterprise",
        "pro",
      ],
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
    startDate: { type: Date },
    nextBillingDate: { type: Date },
    amount: { type: Number }, // amount in rupees
    paymentMethod: {
      type: String,
      enum: ["hdfc", "razorpay"],
      default: null,
    },
    paymentDetails: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      status: { type: String },
    },
    pendingOrder: {
      razorpayOrderId: { type: String },
      plan: { type: String },
      billingCycle: { type: String },
      amount: { type: Number },
      createdAt: { type: Date },
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date, default: null },
    invoices: [invoiceSchema],
  },
  { timestamps: true },
);

const PLAN_LIMITS = {
  trial: { leadsPerMonth: 100, teamMembers: 2 },
  starter: { leadsPerMonth: 2000, teamMembers: 25 },
  growth: { leadsPerMonth: 10000, teamMembers: 50 },
  professional: { leadsPerMonth: 50000, teamMembers: 100 },
  business: { leadsPerMonth: 200000, teamMembers: 250 },
  enterprise: { leadsPerMonth: 999999, teamMembers: 999 },
  pro: { leadsPerMonth: 50000, teamMembers: 100 }, // legacy alias → professional
};

const PLAN_PRICES_MONTHLY = {
  starter: 49900, // ₹499
  growth: 99900, // ₹999
  professional: 199900, // ₹1,999
  business: 449900, // ₹4,499
  enterprise: 0, // custom
  pro: 199900, // legacy alias → professional pricing
};

const PLAN_PRICES_YEARLY = {
  starter: 499900, // ₹4,999  (2 months free)
  growth: 999900, // ₹9,999  (2 months free)
  professional: 1999900, // ₹19,999 (2 months free)
  business: 4499900, // ₹44,999 (2 months free)
  enterprise: 0, // custom
  pro: 1999900, // legacy alias → professional pricing
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.PLAN_PRICES_MONTHLY = PLAN_PRICES_MONTHLY;
module.exports.PLAN_PRICES_YEARLY = PLAN_PRICES_YEARLY;
