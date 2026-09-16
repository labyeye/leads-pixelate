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
const ALLOWED_INVOICE_STATUS = ["paid", "unpaid", "overdue"];

// GET /api/crm/invoices — flattened list of every subscription's embedded
// invoices across all tenants, for the external CRM dashboard's invoice list.
const getCrmInvoices = async (req, res) => {
  try {
    if (req.query.status && !ALLOWED_INVOICE_STATUS.includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use ${ALLOWED_INVOICE_STATUS.join(", ")}.`,
      });
    }

    const subs = await Subscription.find({ "invoices.0": { $exists: true } })
      .populate({
        path: "tenant",
        select: "name ownerUser",
        populate: { path: "ownerUser", select: "email phone" },
      })
      .lean();

    let invoices = [];
    for (const sub of subs) {
      for (const inv of sub.invoices || []) {
        const status = inv.status === "paid" ? "paid" : inv.status === "failed" ? "overdue" : "unpaid";
        invoices.push({
          invoiceNumber:
            inv.razorpayOrderId || inv.hdfcOrderId || `NL-${String(inv._id).slice(-8).toUpperCase()}`,
          clientName: sub.tenant?.name || "Unknown",
          clientEmail: sub.tenant?.ownerUser?.email || "",
          amount: Math.round((inv.amount || 0) / 100), // stored in paise
          currency: inv.currency || "INR",
          status,
          issuedDate: inv.createdAt,
          dueDate: inv.paidAt || inv.createdAt,
          subscriptionPlan: inv.plan || sub.plan,
        });
      }
    }

    if (req.query.status) {
      invoices = invoices.filter((i) => i.status === req.query.status);
    }
    invoices.sort((a, b) => new Date(b.issuedDate) - new Date(a.issuedDate));

    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

module.exports = { checkApiKey, updateTenantSubscription, getCrmInvoices };
