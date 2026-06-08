const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    hdfcPaymentId: { type: String },
    hdfcOrderId: { type: String },
    hdfcTrackingId: { type: String },

    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    amount: { type: Number },
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
    amount: { type: Number },
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
  pro: { leadsPerMonth: 50000, teamMembers: 100 },
};

const PLAN_PRICES_MONTHLY = {
  starter: 49900,
  growth: 99900,
  professional: 199900,
  business: 449900,
  enterprise: 0,
  pro: 199900,
};

const PLAN_PRICES_YEARLY = {
  starter: 499900,
  growth: 999900,
  professional: 1999900,
  business: 4499900,
  enterprise: 0,
  pro: 1999900,
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.PLAN_PRICES_MONTHLY = PLAN_PRICES_MONTHLY;
module.exports.PLAN_PRICES_YEARLY = PLAN_PRICES_YEARLY;
