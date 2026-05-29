const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");

const { PLAN_LIMITS, PLAN_PRICES_MONTHLY } = Subscription;

// ── HDFC Smart Gateway helpers ────────────────────────────────────────────────

function hdfcEncrypt(plainText, workingKey) {
  const keyBytes = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv("aes-128-cbc", keyBytes, iv);
  return cipher.update(plainText, "utf8", "hex") + cipher.final("hex");
}

function hdfcDecrypt(encText, workingKey) {
  const keyBytes = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.alloc(16, 0);
  const decipher = crypto.createDecipheriv("aes-128-cbc", keyBytes, iv);
  return decipher.update(encText, "hex", "utf8") + decipher.final("utf8");
}

function getHdfcConfig() {
  const merchantId = process.env.HDFC_MERCHANT_ID;
  const workingKey = process.env.HDFC_WORKING_KEY;
  const accessCode = process.env.HDFC_ACCESS_CODE;
  if (!merchantId || !workingKey || !accessCode) {
    throw new Error("HDFC Payment Gateway not configured");
  }
  const isProduction = process.env.NODE_ENV === "production";
  const gatewayUrl = isProduction
    ? "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"
    : "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
  return { merchantId, workingKey, accessCode, gatewayUrl };
}

// ── Plans (public) ────────────────────────────────────────────────────────────

router.get("/plans", (req, res) => {
  res.json({
    success: true,
    data: {
      starter: {
        name: "Starter",
        priceMonthly: PLAN_PRICES_MONTHLY.starter,
        priceYearly: Math.round(PLAN_PRICES_MONTHLY.starter * 12 * 0.8),
        currency: "INR",
        limits: PLAN_LIMITS.starter,
        features: [
          "500 leads/month",
          "2 team members",
          "IndiaMART integration",
          "Follow-up reminders",
          "Email support",
        ],
      },
      growth: {
        name: "Growth",
        priceMonthly: PLAN_PRICES_MONTHLY.growth,
        priceYearly: Math.round(PLAN_PRICES_MONTHLY.growth * 12 * 0.8),
        currency: "INR",
        limits: PLAN_LIMITS.growth,
        features: [
          "5,000 leads/month",
          "10 team members",
          "IndiaMART + Facebook Ads",
          "Advanced follow-up workflows",
          "Calendar & visit tracking",
          "Priority support",
          "CSV export",
        ],
        popular: true,
      },
      enterprise: {
        name: "Enterprise",
        priceMonthly: PLAN_PRICES_MONTHLY.enterprise,
        priceYearly: Math.round(PLAN_PRICES_MONTHLY.enterprise * 12 * 0.8),
        currency: "INR",
        limits: PLAN_LIMITS.enterprise,
        features: [
          "Unlimited leads",
          "Unlimited team members",
          "All integrations",
          "Custom workflows",
          "Dedicated account manager",
          "SLA guarantee",
          "Custom reporting",
          "API access",
        ],
      },
    },
  });
});

// ── Current subscription ──────────────────────────────────────────────────────

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

// ── Invoice list ──────────────────────────────────────────────────────────────

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
        invoiceNumber: `INV-${String(arr.length - i).padStart(4, "0")}`,
        plan: inv.plan,
        billingCycle: inv.billingCycle,
        amount: inv.amount,
        currency: inv.currency || "INR",
        status: inv.status,
        paidAt: inv.paidAt,
        hdfcPaymentId: inv.hdfcPaymentId,
        hdfcTrackingId: inv.hdfcTrackingId,
      }));

    res.json({ success: true, data: invoices });
  }),
);

// ── HDFC: create order ────────────────────────────────────────────────────────

router.post(
  "/hdfc/create-order",
  protect,
  asyncHandler(async (req, res) => {
    const { plan, billingCycle = "monthly" } = req.body;

    if (!["starter", "growth", "enterprise"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const { merchantId, workingKey, accessCode, gatewayUrl } = getHdfcConfig();

    const basePrice = PLAN_PRICES_MONTHLY[plan];
    const amountPaise =
      billingCycle === "yearly" ? Math.round(basePrice * 12 * 0.8) : basePrice;
    const amountRupees = (amountPaise / 100).toFixed(2);

    const orderId = `ORD_${req.user.tenantId}_${Date.now()}`;
    const backendUrl =
      process.env.BACKEND_URL || `https://leads-backend.pixelatenest.com`;
    const frontendUrl =
      process.env.CLIENT_URL || `https://leads.pixelatenest.com`;

    const tenant = await Tenant.findById(req.user.tenantId);
    const billingName = tenant?.name || req.user.name || "Customer";
    const billingEmail = tenant?.email || req.user.email || "";
    const billingPhone = tenant?.phone || "";

    const params = [
      `merchant_id=${merchantId}`,
      `order_id=${orderId}`,
      `amount=${amountRupees}`,
      `currency=INR`,
      `language=EN`,
      `billing_name=${billingName}`,
      `billing_tel=${billingPhone}`,
      `billing_email=${billingEmail}`,
      `billing_address=NA`,
      `billing_city=NA`,
      `billing_state=NA`,
      `billing_zip=000000`,
      `billing_country=India`,
      `delivery_name=${billingName}`,
      `delivery_address=NA`,
      `delivery_city=NA`,
      `delivery_state=NA`,
      `delivery_zip=000000`,
      `delivery_country=India`,
      `merchant_param1=${plan}`,
      `merchant_param2=${billingCycle}`,
      `merchant_param3=${req.user.tenantId}`,
      `redirect_url=${backendUrl}/api/billing/hdfc/response`,
      `cancel_url=${frontendUrl}/billing?payment=cancelled`,
    ].join("&");

    const encRequest = hdfcEncrypt(params, workingKey);

    res.json({
      success: true,
      data: { encRequest, accessCode, gatewayUrl, orderId },
    });
  }),
);

// ── HDFC: payment response (redirect from HDFC) ───────────────────────────────

router.post(
  "/hdfc/response",
  asyncHandler(async (req, res) => {
    const { encResp } = req.body;
    const frontendUrl =
      process.env.CLIENT_URL || "https://leads.pixelatenest.com";

    if (!encResp) {
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=no_response`,
      );
    }

    let workingKey;
    try {
      workingKey = process.env.HDFC_WORKING_KEY;
      if (!workingKey) throw new Error("no key");
    } catch {
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=config_error`,
      );
    }

    let orderStatus, plan, billingCycle, tenantId, trackingId, orderId, amount;
    try {
      const decrypted = hdfcDecrypt(encResp, workingKey);
      const params = Object.fromEntries(
        decrypted.split("&").map((pair) => {
          const [k, ...v] = pair.split("=");
          return [k, v.join("=")];
        }),
      );
      orderStatus = params.order_status;
      plan = params.merchant_param1;
      billingCycle = params.merchant_param2;
      tenantId = params.merchant_param3;
      trackingId = params.tracking_id;
      orderId = params.order_id;
      amount = parseFloat(params.amount) * 100; // convert back to paise
    } catch {
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=decrypt_error`,
      );
    }

    if (orderStatus !== "Success") {
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=${encodeURIComponent(orderStatus || "unknown")}`,
      );
    }

    if (!["starter", "growth", "enterprise"].includes(plan)) {
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=invalid_plan`,
      );
    }

    try {
      const periodEnd = new Date();
      if (billingCycle === "yearly")
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const tenant = await Tenant.findByIdAndUpdate(
        tenantId,
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
              hdfcPaymentId: orderId,
              hdfcTrackingId: trackingId,
              amount: Math.round(amount),
              plan,
              billingCycle,
              status: "paid",
              paidAt: new Date(),
            },
          },
        },
        { upsert: true, new: true },
      );
    } catch (err) {
      console.error("HDFC response DB error:", err);
      return res.redirect(
        `${frontendUrl}/billing?payment=failed&reason=db_error`,
      );
    }

    return res.redirect(
      `${frontendUrl}/billing?payment=success&plan=${plan}&billingCycle=${billingCycle}`,
    );
  }),
);

// ── Cancel subscription ───────────────────────────────────────────────────────

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

module.exports = router;
