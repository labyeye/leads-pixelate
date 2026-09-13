const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const CampaignAssignment = require("../models/CampaignAssignment");

function ownerFilter(req) {
  return req.user.tenantId
    ? { tenantId: req.user.tenantId }
    : { ownerUser: req.user._id };
}

router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const { platform } = req.query;
    const query = { ...ownerFilter(req) };
    if (platform) query.platform = platform;

    const assignments = await CampaignAssignment.find(query)
      .populate("assignedTo", "name email avatar role")
      .sort("-updatedAt");

    res.json({ success: true, count: assignments.length, data: assignments });
  }),
);

// Upsert — one row per (tenant/owner, platform, campaignId). Assigning a
// campaign that already has a row just reassigns it.
router.put(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const { platform, campaignId, campaignName, adAccountId, assignedTo, notes } =
      req.body;

    if (!platform || !campaignId) {
      res.status(400);
      throw new Error("platform and campaignId are required");
    }

    const filter = {
      ...ownerFilter(req),
      platform,
      campaignId,
    };

    const update = {
      ...filter,
      campaignName,
      adAccountId,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
      ...(notes !== undefined ? { notes } : {}),
    };

    const assignment = await CampaignAssignment.findOneAndUpdate(
      filter,
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).populate("assignedTo", "name email avatar role");

    res.json({ success: true, data: assignment });
  }),
);

router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const assignment = await CampaignAssignment.findOne({
      _id: req.params.id,
      ...ownerFilter(req),
    });
    if (!assignment) {
      res.status(404);
      throw new Error("Assignment not found");
    }
    await assignment.deleteOne();
    res.json({ success: true, message: "Assignment removed" });
  }),
);

module.exports = router;
