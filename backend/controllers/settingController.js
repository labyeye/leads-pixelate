const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");

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
  let setting = await Setting.findOne(tenantFilter);

  if (!setting) {
    setting = await Setting.create({ ...req.body, ...tenantFilter });
  } else {
    setting = await Setting.findOneAndUpdate(tenantFilter, req.body, {
      new: true,
      runValidators: true,
    });
  }

  res.json({
    success: true,
    data: setting,
  });
});

module.exports = {
  getSettings,
  updateSettings,
};
