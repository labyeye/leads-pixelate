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
      enum: ["trial", "starter", "growth", "pro", "enterprise"],
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
  starter: { leadsPerMonth: 500, teamMembers: 2 },
  growth: { leadsPerMonth: 5000, teamMembers: 10 },
  pro: { leadsPerMonth: 99999, teamMembers: 999 },
  enterprise: { leadsPerMonth: 99999, teamMembers: 999 }, // legacy alias
};

const PLAN_PRICES_MONTHLY = {
  starter: 49900,  // ₹499
  growth: 124900,  // ₹1,249
  pro: 399900,     // ₹3,999
  enterprise: 399900, // legacy alias
};

const PLAN_PRICES_YEARLY = {
  starter: 499900,   // ₹4,999  (2 months free)
  growth: 1249900,   // ₹12,499 (2 months free)
  pro: 3999900,      // ₹39,999 (2 months free)
  enterprise: 3999900, // legacy alias
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.PLAN_PRICES_MONTHLY = PLAN_PRICES_MONTHLY;
module.exports.PLAN_PRICES_YEARLY = PLAN_PRICES_YEARLY;
