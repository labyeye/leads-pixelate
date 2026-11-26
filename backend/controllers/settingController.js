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
  sanitizeCustomLeadCategories,
  sanitizeHiddenStatuses,
} = require("../utils/leadStatuses");

const getSettings = asyncHandler(async (req, res) => {
  const tenantFilter = { tenantId: req.user.tenantId || null };
  let setting = await Setting.findOne(tenantFilter);

  for (const f of ["lostReasonOptions", "remarkPresets"]) {
    if (!(f in body)) continue;
    const seen = new Set();
    body[f] = (Array.isArray(body[f]) ? body[f] : [])
      .map((v) => String(v || "").trim().slice(0, f === "remarkPresets" ? 200 : 80))
      .filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))
      .slice(0, 30);
  }

  if ("contactTagColors" in body) {
    const c = body.contactTagColors || {};
    const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : "");
    body.contactTagColors = { HOT: hex(c.HOT), WARM: hex(c.WARM), COLD: hex(c.COLD) };
  }

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
      autoSend: {
        enabled: qa.autoSend?.enabled === true && /^[0-9a-f]{24}$/i.test(String(qa.autoSend?.templateId || "")),
        templateId: /^[0-9a-f]{24}$/i.test(String(qa.autoSend?.templateId || "")) ? qa.autoSend.templateId : null,
        phoneNumberId: String(qa.autoSend?.phoneNumberId || "").slice(0, 64),
        variableMapping: (Array.isArray(qa.autoSend?.variableMapping) ? qa.autoSend.variableMapping : [])
          .slice(0, 20)
          .map((m) => ({
            position: Math.round(Number(m?.position)) || 0,
            fieldKey: ["name", "company", "phone", "location", "requirement", "quotationNumber", "total", "custom"].includes(m?.fieldKey)
              ? m.fieldKey
              : "custom",
            customValue: String(m?.customValue || "").slice(0, 200),
          }))
          .filter((m) => m.position >= 1),
      },
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

  // The lead pipeline (stages, groups, labels) is the account owner's to change. Other admins save
  // the rest of the settings page; these fields are dropped rather than rejected so that works.
  if (!(await isOwner(req.user))) {
    for (const f of ["customLeadStatuses", "customLeadCategories", "hiddenLeadStatuses", "leadStatusLabels"])
      delete body[f];
  }

  let setting = await Setting.findOne(tenantFilter);

  if ("salesTargets" in body) {
    const t = body.salesTargets || {};
    const num = (v, max = 1e12) => Math.min(Math.max(Number(v) || 0, 0), max);
    const rows = (arr, key) =>
      (Array.isArray(arr) ? arr : [])
        .slice(0, 40)
        .map((r) => ({ [key]: String(r?.[key] || "").trim().slice(0, 60), amount: num(r?.amount) }))
        .filter((r) => r[key]);
    body.salesTargets = {
      monthlyRevenue: num(t.monthlyRevenue),
      marginPct: num(t.marginPct, 100),
      fixedExpenses: rows(t.fixedExpenses, "label"),
      sourceCosts: rows(t.sourceCosts, "source"),
    };
  }

  if ("hiddenLeadStatuses" in body)
    body.hiddenLeadStatuses = sanitizeHiddenStatuses(body.hiddenLeadStatuses);

  if ("customLeadCategories" in body || "customLeadStatuses" in body) {
    const cats =
      "customLeadCategories" in body
        ? sanitizeCustomLeadCategories(body.customLeadCategories)
        : setting?.customLeadCategories || [];
    body.customLeadCategories = cats;
    // Stages whose group was removed are dropped along with it.
    body.customLeadStatuses = sanitizeCustomLeadStatuses(
      "customLeadStatuses" in body
        ? body.customLeadStatuses
        : setting?.customLeadStatuses || [],
      setting?.customLeadStatuses || [],
      cats,
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
