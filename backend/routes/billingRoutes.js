const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");

const { PLAN_LIMITS, PLAN_PRICES_MONTHLY } = Subscription;

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Payment gateway not configured");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

router.get("/plans", (req, res) => {
  res.json({
    success: true,
    data: {
      starter: {
        name: "Starter",
        priceMonthly: 99900,
        priceYearly: 95904,
        currency: "INR",
        limits: PLAN_LIMITS.starter,
        features: [
          "500 leads/month",
          "2 team members",
          "IndiaMART integration",
          "Follow-up reminders",
        ],
      },
      growth: {
        name: "Growth",
        priceMonthly: 249900,
        priceYearly: 239904,
        currency: "INR",
        limits: PLAN_LIMITS.growth,
        features: [
          "5,000 leads/month",
          "10 team members",
          "All integrations",
          "Priority support",
          "Calendar & visits",
        ],
        popular: true,
      },
      enterprise: {
        name: "Enterprise",
        priceMonthly: 699900,
        priceYearly: 671904,
        currency: "INR",
        limits: PLAN_LIMITS.enterprise,
        features: [
          "Unlimited leads",
          "Unlimited members",
          "Dedicated support",
          "API access",
          "Custom workflows",
        ],
      },
    },
  });
});

router.get(
  "/subscription",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant)
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });

    const subscription = await Subscription.findOne({ tenant: tenant._id });
    res.json({ success: true, data: { tenant, subscription } });
  }),
);

router.post(
  "/create-order",
  protect,
  asyncHandler(async (req, res) => {
    const { plan, billingCycle = "monthly" } = req.body;

    if (!["starter", "growth", "enterprise"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid billing cycle" });
    }

    const razorpay = getRazorpay();
    const basePrice = PLAN_PRICES_MONTHLY[plan];
    const amount =
      billingCycle === "yearly" ? Math.round(basePrice * 12 * 0.8) : basePrice;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        tenantId: req.user.tenantId?.toString(),
        plan,
        billingCycle,
      },
    });

    res.json({
      success: true,
      data: { orderId: order.id, amount, currency: "INR" },
    });
  }),
);

router.post(
  "/verify-payment",
  protect,
  asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billingCycle,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !plan ||
      !billingCycle
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!["starter", "growth", "enterprise"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res
        .status(500)
        .json({ success: false, message: "Payment gateway not configured" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(razorpay_signature),
      )
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    const periodEnd = new Date();
    if (billingCycle === "yearly")
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const tenant = await Tenant.findByIdAndUpdate(
      req.user.tenantId,
      {
        plan,
        planExpiresAt: periodEnd,
        status: "active",
        limits: PLAN_LIMITS[plan],
      },
      { new: true },
    );

    await Subscription.findOneAndUpdate(
      { tenant: tenant._id },
      {
        plan,
        billingCycle,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        $push: {
          invoices: {
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            amount: PLAN_PRICES_MONTHLY[plan],
            status: "paid",
            paidAt: new Date(),
          },
        },
      },
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      message: "Plan activated",
      data: { plan, expiresAt: periodEnd },
    });
  }),
);

router.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return res.status(400).send("Missing signature");
    }

    const digest = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body);

    if (event.event === "subscription.cancelled") {
      const sub = event.payload.subscription.entity;
      const notes = sub.notes || {};
      if (notes.tenantId) {
        await Tenant.findByIdAndUpdate(notes.tenantId, {
          plan: "trial",
          status: "active",
        });
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: sub.id },
          { status: "cancelled", cancelledAt: new Date() },
        );
      }
    }

    res.json({ success: true });
  }),
);

module.exports = router;
