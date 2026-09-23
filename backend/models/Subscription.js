const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String },
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

// One place for every plan limit. Social Autopilot is part of the plan, not an add-on:
//   aiCalls                 AI voice calls a month
//   autopilotDaysPerWeek    posting days a week
//   autopilotMonthlyPosts   posts Autopilot may generate a month, shared by all campaigns (plan's posts + one spare)
//   autopilotCampaigns      how many Autopilot campaigns (each with its own accounts and brand)
// Only starter / growth / professional are sold; business, enterprise and pro stay so
// tenants already on them keep working.
const PLAN_LIMITS = {
  trial: { leadsPerMonth: 100, teamMembers: 2, aiCalls: 10, autopilotDaysPerWeek: 3, autopilotMonthlyPosts: 14, autopilotCampaigns: 3 },
  starter: { leadsPerMonth: 2000, teamMembers: 25, aiCalls: 50, autopilotDaysPerWeek: 1, autopilotMonthlyPosts: 5, autopilotCampaigns: 1 },
  growth: { leadsPerMonth: 10000, teamMembers: 50, aiCalls: 500, autopilotDaysPerWeek: 3, autopilotMonthlyPosts: 14, autopilotCampaigns: 3 },
  professional: { leadsPerMonth: 50000, teamMembers: 100, aiCalls: 2500, autopilotDaysPerWeek: 5, autopilotMonthlyPosts: 23, autopilotCampaigns: 5 },
  business: { leadsPerMonth: 200000, teamMembers: 250, aiCalls: 10000, autopilotDaysPerWeek: 5, autopilotMonthlyPosts: 23, autopilotCampaigns: 5 },
  enterprise: { leadsPerMonth: 999999, teamMembers: 999, aiCalls: 999999, autopilotDaysPerWeek: 7, autopilotMonthlyPosts: 31, autopilotCampaigns: 10 },
  pro: { leadsPerMonth: 50000, teamMembers: 100, aiCalls: 2500, autopilotDaysPerWeek: 5, autopilotMonthlyPosts: 23, autopilotCampaigns: 5 },
};

// Prices include Social Autopilot (CRM + Autopilot).
const PLAN_PRICES_MONTHLY = {
  starter: 299900,
  growth: 599900,
  professional: 999900,
  business: 449900,
  enterprise: 0,
  pro: 199900,
};

const PLAN_PRICES_YEARLY = {
  starter: 2999000,
  growth: 5999000,
  professional: 9999000,
  business: 4499900,
  enterprise: 0,
  pro: 1999900,
};


module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.PLAN_PRICES_MONTHLY = PLAN_PRICES_MONTHLY;
module.exports.PLAN_PRICES_YEARLY = PLAN_PRICES_YEARLY;
