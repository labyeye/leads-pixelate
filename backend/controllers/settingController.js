const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");
const { invalidatePermissionsCache } = require("../middleware/checkPermission");
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
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const tenantFilter = { tenantId: req.user.tenantId || null };
  const body = { ...req.body };
  if ("leadStatusLabels" in body) {
    body.leadStatusLabels = sanitizeLeadStatusLabels(body.leadStatusLabels);
  }

  let setting = await Setting.findOne(tenantFilter);

  if ("customLeadStatuses" in body) {
    body.customLeadStatuses = sanitizeCustomLeadStatuses(
      body.customLeadStatuses,
      setting?.customLeadStatuses || [],
    );
  }

  if (!setting) {
    setting = await Setting.create({ ...body, ...tenantFilter });
  } else {
    setting = await Setting.findOneAndUpdate(tenantFilter, body, {
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

module.exports = {
  getSettings,
  updateSettings,
};
