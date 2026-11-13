const express = require("express");
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const Notification = require("../models/Notification");
const PushDevice = require("../models/PushDevice");

const router = express.Router();
router.use(protect);

// GET /notifications?page=1&limit=30 -> newest first, plus the unread count for the bell badge
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = { user: req.user._id };
    const [data, total, unread] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    res.json({ success: true, data, total, unread, page });
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const unread = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, unread });
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ success: true });
  }),
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ success: true });
  }),
);

// ── Phone registration for push ─────────────────────────────────────────────
router.post(
  "/devices",
  asyncHandler(async (req, res) => {
    const { fcmToken, platform } = req.body || {};
    if (typeof fcmToken !== "string" || fcmToken.length < 20 || fcmToken.length > 4096) {
      res.status(400);
      throw new Error("fcmToken is required");
    }
    await PushDevice.findOneAndUpdate(
      { fcmToken },
      {
        user: req.user._id,
        tenantId: req.user.tenantId || null,
        platform: ["ios", "android"].includes(platform) ? platform : "unknown",
      },
      { upsert: true },
    );
    res.json({ success: true });
  }),
);

// Signing out on one phone: drop only that device.
router.delete(
  "/devices",
  asyncHandler(async (req, res) => {
    const { fcmToken } = req.body || {};
    if (fcmToken) await PushDevice.deleteOne({ fcmToken, user: req.user._id });
    else await PushDevice.deleteMany({ user: req.user._id });
    res.json({ success: true });
  }),
);

module.exports = router;
