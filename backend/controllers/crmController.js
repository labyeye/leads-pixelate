const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");

// API key guard — every request must carry x-api-key matching CRM_API_SECRET
const checkApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!process.env.CRM_API_SECRET || key !== process.env.CRM_API_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

const ALLOWED_TENANT_STATUS = ["active", "suspended", "cancelled"];
const ALLOWED_SUBSCRIPTION_STATUS = ["active", "cancelled", "past_due", "trialing"];

// PATCH /internal/tenants/:tenantId/subscription — activate/extend/deactivate a
// tenant's subscription from the external CRM dashboard on payment/expiry events.
const updateTenantSubscription = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, renewalDate } = req.body;

    if (status !== undefined && !ALLOWED_TENANT_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${ALLOWED_TENANT_STATUS.join(", ")}`,
      });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (status !== undefined) tenant.status = status;
    if (renewalDate !== undefined) tenant.planExpiresAt = new Date(renewalDate);
    await tenant.save();

    const subscription = await Subscription.findOne({ tenant: tenant._id });
    if (subscription) {
      if (status !== undefined) {
        subscription.status =
          status === "active" ? "active" : status === "suspended" ? "past_due" : "cancelled";
      }
      if (renewalDate !== undefined) subscription.currentPeriodEnd = new Date(renewalDate);
      await subscription.save();
    }

    res.json({ success: true, tenant, subscription: subscription || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkApiKey, updateTenantSubscription };
