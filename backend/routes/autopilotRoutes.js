const express = require("express");
const asyncHandler = require("express-async-handler");
const { protect, authorize } = require("../middleware/auth");
const Tenant = require("../models/Tenant");
const SocialPost = require("../models/SocialPost");
const SocialAccount = require("../models/SocialAccount");
const { ADDON_PRICES } = require("../models/Subscription");
const svc = require("../services/autopilotService");
const log = require("../utils/logger").scope("Autopilot");

const router = express.Router();
router.use(protect, authorize("super_admin", "admin"));

const RUN_COOLDOWN_MS = 10 * 1000; // TEMP local testing: restore to 10 * 60 * 1000

async function getTenant(req, res) {
  const tenant = req.user.tenantId ? await Tenant.findById(req.user.tenantId) : null;
  if (!tenant) {
    res.status(400);
    throw new Error("No organisation found for this account");
  }
  return tenant;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const a = tenant.autopilot;
    const [accounts, monthCount] = await Promise.all([
      SocialAccount.find({ tenantId: tenant._id, isActive: true })
        .select("platform accountName profilePicture")
        .lean(),
      SocialPost.countDocuments({
        tenantId: tenant._id,
        source: "autopilot",
        createdAt: { $gte: svc.monthStart() },
      }),
    ]);
    res.json({
      success: true,
      data: {
        configured: svc.isConfigured(),
        price: ADDON_PRICES.autopilot,
        trialDays: svc.TRIAL_DAYS,
        entitlement: svc.entitlement(a),
        settings: {
          enabled: a.enabled,
          postsPerDay: a.postsPerDay,
          tone: a.tone,
          language: a.language,
          notes: a.notes,
          reviewFirst: a.reviewFirst,
          accountIds: a.accountIds,
        },
        running: !!a.runningSince && Date.now() - a.runningSince < svc.LOCK_MS,
        lastRunAt: a.lastRunAt,
        lastError: a.lastError,
        monthCount,
        monthlyCap: svc.MONTHLY_CAP,
        accounts,
      },
    });
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const patch = svc.sanitizeSettings(req.body);

    // Enabling starts the one-time trial, so don't let it burn with nowhere to post.
    if (patch.enabled === true && !(await SocialAccount.exists({ tenantId: tenant._id, isActive: true }))) {
      res.status(400);
      throw new Error("Connect a Facebook, Instagram or LinkedIn account first");
    }

    if (patch.accountIds) {
      const own = await SocialAccount.find({ _id: { $in: patch.accountIds }, tenantId: tenant._id })
        .select("_id")
        .lean();
      patch.accountIds = own.map((x) => String(x._id));
    }

    const $set = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`autopilot.${k}`, v]));
    const turningOn = patch.enabled === true && !tenant.autopilot.enabled;
    if (patch.enabled) Object.assign($set, svc.trialPatch(tenant.autopilot));
    if (Object.keys($set).length) await Tenant.updateOne({ _id: tenant._id }, { $set });

    // Pausing stops everything already queued, not just new generation.
    if (patch.enabled === false) await svc.revertScheduled(tenant._id);

    // First look right away: fill the calendar instead of waiting for the hourly tick.
    if (turningOn && svc.isConfigured()) {
      svc
        .runForTenant(tenant._id, { manual: true })
        .catch((err) => log.error("Autopilot first run failed", { message: err.message }));
    }

    res.json({ success: true });
  }),
);

router.post(
  "/run",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const a = tenant.autopilot;

    if (!svc.isConfigured()) {
      res.status(503);
      throw new Error("Autopilot is not configured on the server yet");
    }
    if (!a.enabled) {
      res.status(400);
      throw new Error("Turn Autopilot on first");
    }
    if (!svc.isEntitled(a)) {
      res.status(402);
      throw new Error("Your Autopilot trial has ended. Subscribe to continue.");
    }
    if (a.lastRunAt && Date.now() - a.lastRunAt < RUN_COOLDOWN_MS) {
      res.status(429);
      throw new Error("Autopilot just ran. Try again in a few minutes.");
    }

    res.status(202).json({ success: true, message: "Started" });
    svc
      .runForTenant(tenant._id, { manual: true })
      .catch((err) => log.error("Autopilot manual run failed", { message: err.message }));
  }),
);

module.exports = router;
