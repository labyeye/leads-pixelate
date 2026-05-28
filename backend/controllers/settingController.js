const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");

const getSettings = asyncHandler(async (req, res) => {
  let setting = await Setting.findOne();

  if (!setting) {
    setting = await Setting.create({});
  }

  res.json({
    success: true,
    data: setting,
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  let setting = await Setting.findOne();

  if (!setting) {
    setting = await Setting.create(req.body);
  } else {
    setting = await Setting.findOneAndUpdate({}, req.body, {
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
