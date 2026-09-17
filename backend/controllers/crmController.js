const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");
const OfferCode = require("../models/OfferCode");

// API key guard — every request must carry x-api-key matching NESTLEADS_SECRET
const checkApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!process.env.NESTLEADS_SECRET || key !== process.env.NESTLEADS_SECRET) {
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

// GET /api/crm/offers — list all offer codes with stats
const getCrmOffers = async (req, res) => {
  try {
    const offers = await OfferCode.find()
      .select("-usages")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/crm/offers/:id — single offer with full usage list
const getCrmOfferById = async (req, res) => {
  try {
    const offer = await OfferCode.findById(req.params.id).lean();
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/crm/offers — create a new offer code
const createCrmOffer = async (req, res) => {
  try {
    const { code, description, bonusMonths, maxUses, expiresAt, createdByEmail } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "code is required" });
    if (!bonusMonths || bonusMonths < 1) {
      return res.status(400).json({ success: false, message: "bonusMonths must be >= 1" });
    }

    const offer = await OfferCode.create({
      code: code.toUpperCase().trim(),
      description: description || "",
      bonusMonths,
      maxUses: maxUses || 200,
      expiresAt: expiresAt || null,
      createdByEmail: createdByEmail || "",
    });

    res.status(201).json({ success: true, offer });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Offer code already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/offers/:id — update offer (activate/deactivate, change limits)
const updateCrmOffer = async (req, res) => {
  try {
    const allowed = ["description", "bonusMonths", "maxUses", "isActive", "expiresAt"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const offer = await OfferCode.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-usages");
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/crm/offers/:id — hard delete
const deleteCrmOffer = async (req, res) => {
  try {
    const offer = await OfferCode.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    res.json({ success: true, message: "Offer code deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  checkApiKey,
  updateTenantSubscription,
  getCrmInvoices,
  getCrmOffers,
  getCrmOfferById,
  createCrmOffer,
  updateCrmOffer,
  deleteCrmOffer,
};
