const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect, authorize } = require("../middleware/auth");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");
const { Saga, refundAfterFailure } = require("../utils/paymentSaga");

const { PLAN_LIMITS, PLAN_PRICES_MONTHLY, PLAN_PRICES_YEARLY } = Subscription;
const { sendWelcomeEmail } = require("../utils/emailService");
const log = require("../utils/logger").scope("Billing");

// INV-LEADS-0001, 0002, ... one above the paid invoices issued so far, across all tenants.
async function nextInvoiceNumber() {
  const [r] = await Subscription.aggregate([
    { $unwind: "$invoices" },
    { $match: { "invoices.status": "paid" } },
    { $count: "total" },
  ]);
  return `INV-LEADS-${String((r?.total || 0) + 1).padStart(4, "0")}`;
}

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay not configured");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

// The three plans on sale. Business / enterprise / pro remain valid for tenants already on them.
const SOLD_PLANS = ["starter", "growth", "professional"];

const planCard = (id, name, employees, features, extra = {}) => ({
  name,
  priceMonthly: PLAN_PRICES_MONTHLY[id],
  priceYearly: PLAN_PRICES_YEARLY[id],
  currency: "INR",
  limits: PLAN_LIMITS[id],
  employees,
  features,
  ...extra,
});

// Every plan includes Social Autopilot; its posts/week and posts/month come from PLAN_LIMITS.
router.get("/plans", (req, res) => {
  res.json({
    success: true,
    data: {
      starter: planCard("starter", "Starter", 25, [
        "Up to 25 employees",
        "2,000 leads/month",
        "50 AI voice calls/month",
        "Social Autopilot: 1 post/week, 1 campaign",
        "IndiaMART integration",
        "Follow-up reminders",
        "Email support",
      ]),
      growth: planCard(
        "growth",
        "Growth",
        50,
        [
          "Up to 50 employees",
          "10,000 leads/month",
          "500 AI voice calls/month",
          "Social Autopilot: 3 posts/week, 3 campaigns",
          "IndiaMART + Facebook Ads",
          "Advanced follow-up workflows",
          "Calendar & visit tracking",
          "Priority support",
          "CSV export",
        ],
        { popular: true },
      ),
      professional: planCard("professional", "Professional", 100, [
        "Up to 100 employees",
        "50,000 leads/month",
        "2,500 AI voice calls/month",
        "Social Autopilot: 5 posts/week, 5 campaigns",
        "All integrations",
        "Advanced analytics",
        "Custom workflows",
        "Dedicated support",
        "API access",
      ]),
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

router.get(
  "/invoices",
  protect,
  asyncHandler(async (req, res) => {
    const subscription = await Subscription.findOne({
      tenant: req.user.tenantId,
    });
    if (!subscription) return res.json({ success: true, data: [] });

    const invoices = (subscription.invoices || [])
      .filter((inv) => inv.status === "paid")
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
      .slice(0, 24)
      .map((inv, i, arr) => ({
        _id: inv._id,
        invoiceNumber:
          inv.invoiceNumber ||
          `INV-LEADS-${String(arr.length - i).padStart(4, "0")}`,
        plan: inv.plan,
        billingCycle: inv.billingCycle,
        amount: inv.amount,
        currency: inv.currency || "INR",
        status: inv.status,
        paidAt: inv.paidAt,
      }));

    res.json({ success: true, data: invoices });
  }),
);

router.post(
  "/razorpay/create-order",
  protect,
  asyncHandler(async (req, res) => {
    const { plan, billingCycle = "monthly" } = req.body;

    if (!SOLD_PLANS.includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const razorpay = getRazorpayInstance();
    const basePrice = PLAN_PRICES_MONTHLY[plan];
    const amountPaise =
      billingCycle === "yearly" ? Math.round(basePrice * 12 * 0.8) : basePrice;

    const tenant = await Tenant.findById(req.user.tenantId);
    const customerName = tenant?.name || req.user.name || "Customer";
    const customerEmail = tenant?.email || req.user.email || "";
    const customerPhone = tenant?.phone || "";

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `ORD_${req.user.tenantId.toString().slice(-10)}_${Date.now()}`,
        notes: {
          plan,
          billingCycle,
          tenantId: req.user.tenantId.toString(),
          customerName,
          customerEmail,
        },
      });

      const subscription = await Subscription.findOneAndUpdate(
        { tenant: req.user.tenantId },
        {
          pendingOrder: {
            razorpayOrderId: order.id,
            plan,
            billingCycle,
            amount: amountPaise / 100,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      res.json({
        success: true,
        data: {
          orderId: order.id,
          amount: amountPaise,
          currency: "INR",
          customerEmail,
          customerPhone,
          customerName,
          key: process.env.RAZORPAY_KEY_ID,
        },
      });
    } catch (err) {
      const errMsg =
        err?.error?.description || err?.message || JSON.stringify(err);
      log.error("Razorpay create-order failed", { message: errMsg });
      res.status(400).json({
        success: false,
        message: "Failed to create order",
        error: errMsg,
      });
    }
  }),
);

router.post(
  "/razorpay/verify",
  protect,
  asyncHandler(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    const isSignatureValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    try {
      const razorpay = getRazorpayInstance();
      const payment = await razorpay.payments.fetch(razorpayPaymentId);

      if (payment.status === "captured") {
        // money is taken: from here on, any failure undoes our writes and refunds the customer
        const saga = new Saga();
        saga.amount = payment.amount / 100;
        try {
        const subscription = await Subscription.findOne({
          tenant: req.user.tenantId,
        });

        if (!subscription?.pendingOrder) {
          throw new Error("Order not found for this payment");
        }

        const { plan, billingCycle, amount } = subscription.pendingOrder;
        saga.amount = amount;
        const beforeSub = subscription.toObject();
        saga.onRollback("restore subscription", () => Subscription.replaceOne({ _id: subscription._id }, beforeSub));
        const amountPaise = Math.round(amount * 100);

        const periodEnd =
          billingCycle === "yearly"
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const invoiceNumber = await nextInvoiceNumber();

        const updatedSubscription = await Subscription.findOneAndUpdate(
          { tenant: req.user.tenantId },
          {
            plan,
            billingCycle,
            status: "active",
            startDate: new Date(),
            nextBillingDate: periodEnd,
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            amount,
            paymentMethod: "razorpay",
            paymentDetails: {
              razorpayOrderId,
              razorpayPaymentId,
              status: payment.status,
            },
            $unset: { pendingOrder: 1 },
            $push: {
              invoices: {
                invoiceNumber,
                razorpayPaymentId,
                razorpayOrderId,
                amount: amountPaise,
                plan,
                billingCycle,
                status: "paid",
                paidAt: new Date(),
              },
            },
          },
          { new: true },
        );

        const beforeTenant = await Tenant.findById(req.user.tenantId).lean();
        saga.onRollback("restore tenant", () => Tenant.replaceOne({ _id: req.user.tenantId }, beforeTenant));
        const updatedTenant = await Tenant.findByIdAndUpdate(
          req.user.tenantId,
          {
            plan,
            planStartDate: new Date(),
            planExpiresAt: periodEnd,
            status: "active",
            limits: PLAN_LIMITS[plan],
          },
          { new: true },
        );

        sendWelcomeEmail({
          to: updatedTenant?.email || req.user.email,
          companyName: updatedTenant?.name || req.user.name || "Team",
          userName: req.user.name || "there",
          plan,
          billingCycle,
          amountRupees: amount,
          paymentId: razorpayPaymentId,
          invoiceNumber,
        }).catch((err) =>
          log.error("Welcome email failed", { message: err.message }),
        );

        res.json({
          success: true,
          message: "Payment successful",
          data: {
            plan,
            billingCycle,
            status: updatedSubscription.status,
          },
        });
        } catch (err) {
          const undone = await saga.rollback();
          try {
            await refundAfterFailure(
              {
                gateway: "razorpay",
                paymentId: razorpayPaymentId,
                orderId: razorpayOrderId,
                amount: saga.amount,
                product: "NestLeads subscription",
                ownerId: req.user.tenantId,
                userId: req.user._id,
              },
              err,
              undone,
            );
          } catch (e) {
            if (e.refund) return res.status(409).json({ success: false, refund: true, message: e.message });
            throw e;
          }
        }
      } else {
        res.status(400).json({
          success: false,
          message: `Payment ${payment.status}`,
        });
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Verification failed",
        error: err.message,
      });
    }
  }),
);

router.post(
  "/cancel",
  protect,
  asyncHandler(async (req, res) => {
    await Subscription.findOneAndUpdate(
      { tenant: req.user.tenantId },
      { status: "cancelled", cancelledAt: new Date() },
    );
    res.json({ success: true, message: "Subscription cancelled" });
  }),
);

// Activates a paid Razorpay order without a signed-in browser (used when only the webhook told us about the payment).
// Same steps and the same refund protection as the browser's verify call above.
async function provisionRazorpay({ orderId, paymentId }) {
  const subscription = await Subscription.findOne({ "pendingOrder.razorpayOrderId": orderId });
  if (!subscription) throw new Error(`No pending order for ${orderId}`);
  const tenantId = subscription.tenant;
  const { plan, billingCycle, amount } = subscription.pendingOrder;
  const amountPaise = Math.round(amount * 100);
  const saga = new Saga();
  saga.amount = amount;
  try {
    const beforeSub = subscription.toObject();
    saga.onRollback("restore subscription", () => Subscription.replaceOne({ _id: subscription._id }, beforeSub));
    const periodEnd = new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000);
    const invoiceNumber = await nextInvoiceNumber();
    await Subscription.findOneAndUpdate(
      { tenant: tenantId },
      {
        plan,
        billingCycle,
        status: "active",
        startDate: new Date(),
        nextBillingDate: periodEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        amount,
        paymentMethod: "razorpay",
        paymentDetails: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, status: "captured" },
        $unset: { pendingOrder: 1 },
        $push: { invoices: { invoiceNumber, razorpayPaymentId: paymentId, razorpayOrderId: orderId, amount: amountPaise, plan, billingCycle, status: "paid", paidAt: new Date() } },
      },
      { new: true },
    );
    const beforeTenant = await Tenant.findById(tenantId).lean();
    saga.onRollback("restore tenant", () => Tenant.replaceOne({ _id: tenantId }, beforeTenant));
    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { plan, planStartDate: new Date(), planExpiresAt: periodEnd, status: "active", limits: PLAN_LIMITS[plan] },
      { new: true },
    );
    sendWelcomeEmail({
      to: tenant?.email,
      companyName: tenant?.name || "Team",
      userName: tenant?.name || "there",
      plan,
      billingCycle,
      amountRupees: amount,
      paymentId,
      invoiceNumber,
    }).catch((err) => log.error("Welcome email failed", { message: err.message }));
  } catch (err) {
    const undone = await saga.rollback();
    await refundAfterFailure({ gateway: "razorpay", paymentId, orderId, amount, product: "NestLeads subscription", ownerId: tenantId }, err, undone);
  }
}

module.exports = router;
module.exports.provisionRazorpay = provisionRazorpay;

