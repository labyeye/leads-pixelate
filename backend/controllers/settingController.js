const asyncHandler = require("express-async-handler");
const { safeBody } = require("../utils/tenantScope");
const Setting = require("../models/Setting");
const { invalidatePermissionsCache } = require("../middleware/checkPermission");
const { sanitizeInvoiceTemplate } = require("../utils/invoiceTemplate");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Quotation = require("../models/Quotation");
const TradeDoc = require("../models/TradeDoc");
const { TYPES, checkFormat } = require("../utils/docNumber");
const {
  sanitizeLeadStatusLabels,
  sanitizeCustomLeadStatuses,
} = require("../utils/leadStatuses");

const getSettings = asyncHandler(async (req, res) => {
  const tenantFilter = { tenantId: req.user.tenantId || null };
  let setting = await Setting.findOne(tenantFilter);

  if (!setting) {
    setting = await Setting.create(tenantFilter);
  }

  res.json({
    success: true,
    data: setting,
    isOwner: await isOwner(req.user),
  });
});

const isOwner = async (user) => {
  const tenant = user.tenantId
    ? await Tenant.findById(user.tenantId).select("ownerUser")
    : null;
  return tenant
    ? String(tenant.ownerUser) === String(user._id)
    : user.role === "super_admin";
};

const updateSettings = asyncHandler(async (req, res) => {
  const tenantFilter = { tenantId: req.user.tenantId || null };
  const body = { ...req.body };
  delete body.numbering; // only PUT /numbering (owner) may change it
  if ("leadStatusLabels" in body) {
    body.leadStatusLabels = sanitizeLeadStatusLabels(body.leadStatusLabels);
  }

  if ("quotationApproval" in body) {
    const qa = body.quotationApproval || {};
    const ids = [...new Set((Array.isArray(qa.approvers) ? qa.approvers : []).map(String))].filter((v) =>
      /^[0-9a-f]{24}$/i.test(v),
    );
    // Only active people of this account can be approvers.
    const valid = ids.length
      ? await User.find({ _id: { $in: ids }, status: "active", ...tenantFilter }).select("_id").lean()
      : [];
    body.quotationApproval = {
      enabled: qa.enabled === true,
      minTotal: Math.min(Math.max(Number(qa.minTotal) || 0, 0), 1e9),
      approvers: valid.map((u) => u._id),
    };
  }

  for (const field of ["invoiceTemplate", "quotationTemplate"]) {
    if (body[field] == null) continue;
    try {
      body[field] = sanitizeInvoiceTemplate(body[field]);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  let setting = await Setting.findOne(tenantFilter);

  if ("customLeadStatuses" in body) {
    body.customLeadStatuses = sanitizeCustomLeadStatuses(
      body.customLeadStatuses,
      setting?.customLeadStatuses || [],
    );
  }

  if (!setting) {
    setting = await Setting.create({ ...safeBody(body), ...tenantFilter });
  } else {
    setting = await Setting.findOneAndUpdate(tenantFilter, safeBody(body), {
      new: true,
      runValidators: true,
    });
  }

  invalidatePermissionsCache(req.user.tenantId);

  res.json({
    success: true,
    data: setting,
  });
});

// Body: { invoice: { format, next? }, quotation: {...}, ... }. `next` is the number the next
// document gets; leave it out to keep counting (first time it starts after the existing documents).
const saveNumbering = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId || null;
  const set = {};
  for (const [type, cfg] of Object.entries(req.body || {})) {
    if (!TYPES[type] || !cfg) continue;
    let format;
    try {
      format = checkFormat(cfg.format);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
    const current = (await Setting.findOne({ tenantId }).lean())?.numbering?.[
      type
    ];
    let next =
      Number.isInteger(cfg.next) && cfg.next >= 1 && cfg.next <= 99999999
        ? cfg.next
        : current?.next;
    if (!next) {
      const count =
        type === "quotation"
          ? await Quotation.countDocuments({ tenantId })
          : await TradeDoc.countDocuments({ tenantId, type });
      next = count + 1;
    }
    set[`numbering.${type}`] = { format, next };
  }
  const setting = await Setting.findOneAndUpdate(
    { tenantId },
    { $set: set },
    { new: true, upsert: true },
  );
  res.json({ success: true, data: setting.numbering });
});

module.exports = {
  saveNumbering,
  getSettings,
  updateSettings,
};
