const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { protect, authorize } = require("../middleware/auth");
const Tenant = require("../models/Tenant");
const SocialPost = require("../models/SocialPost");
const SocialAccount = require("../models/SocialAccount");
const svc = require("../services/autopilotService");
const brand = require("../services/brandAnalysisService");
const stats = require("../services/autopilotStatsService");
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
    const a = svc.effectiveAutopilot(tenant);
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
        plan: svc.entitlement(a).state === "paid" ? svc.planLimits(a).plan : "",
        limits: svc.planLimits(a),
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
          schedule: { days: a.schedule?.days || [], times: a.schedule?.times || [] },
          contentTypes: a.contentTypes || [],
          lessons: a.lessons || [],
        },
        contentTypes: svc.CONTENT_TYPES,
        intro: { text: a.brandIntro?.text || "", pdfName: a.brandIntro?.hasPdf ? a.brandIntro.pdfName : "" },
        running: !!a.runningSince && Date.now() - a.runningSince < svc.LOCK_MS,
        progress: a.progress?.stage ? { stage: a.progress.stage, at: a.progress.at } : null,
        onboarded: !!(a.onboardedAt || a.enabled || a.firstApprovedAt),
        firstApproved: !!a.firstApprovedAt,
        analysis: {
          status: a.analysis?.status || "idle",
          stage: a.analysis?.stage || "",
          error: a.analysis?.error || "",
          note: a.analysis?.note || "",
          at: a.analysis?.at || null,
        },
        brandProfile: a.brandProfile,
        brandKit: {
          logos: (a.brandKit?.logos || []).map((l) => ({ id: l.id, name: l.name, url: l.url })),
          logoId: a.brandKit?.logoId || "",
          logoEnabled: a.brandKit?.logoEnabled !== false,
          logoMode: a.brandKit?.logoMode || "fixed",
          logoPosition: a.brandKit?.logoPosition || "bottom-right",
          colors: a.brandKit?.colors || [],
        },
        lastRunAt: a.lastRunAt,
        lastError: a.lastError,
        monthCount,
        monthlyCap: svc.planLimits(a).monthlyPosts,
        accounts,
      },
    });
  }),
);

// Dashboard + report numbers: ?days=7|30|90
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    res.json({ success: true, data: await stats.getStats(tenant._id, Number(req.query.days) || 30) });
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const patch = svc.sanitizeSettings(req.body);

    // The plan sets how many posting days a week are allowed.
    if (patch.schedule) {
      const limit = svc.planLimits(svc.effectiveAutopilot(tenant)).daysPerWeek;
      const picked = patch.schedule.days.length || 7;
      if (picked > limit) {
        res.status(400);
        throw new Error(
          `Your plan allows ${limit} posting day${limit === 1 ? "" : "s"} a week. Pick fewer days, or upgrade your plan.`,
        );
      }
    }

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
    if (patch.enabled) {
      Object.assign($set, svc.trialPatch(svc.effectiveAutopilot(tenant)));
      if (!tenant.autopilot.onboardedAt) $set["autopilot.onboardedAt"] = new Date();
    }
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
    const a = svc.effectiveAutopilot(tenant);

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

// ------------------------------------------------- onboarding: scan + brand kit

const ANALYZE_COOLDOWN_MS = 60 * 1000;
const HEX = /^#[0-9a-f]{6}$/i;
const POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"];
const MAX_LOGOS = 5;

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new Error("Logo must be a PNG, JPG or WebP image")),
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("The brand document must be a PDF")),
});

// The owner's own words about the brand: typed text and/or one PDF. Read by the next scan.
router.post(
  "/intro",
  pdfUpload.single("file"),
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const $set = { "autopilot.brandIntro.updatedAt": new Date() };
    if (typeof req.body?.text === "string") $set["autopilot.brandIntro.text"] = req.body.text.trim().slice(0, 4000);

    if (req.file) {
      if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
        res.status(400);
        throw new Error("That file isn't a valid PDF");
      }
      const file = brand.introPdfPath(tenant._id);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, req.file.buffer);
      $set["autopilot.brandIntro.hasPdf"] = true;
      $set["autopilot.brandIntro.pdfName"] = svc.clean(path.basename(req.file.originalname), 200);
    }
    await Tenant.updateOne({ _id: tenant._id }, { $set });
    res.json({ success: true });
  }),
);

router.delete(
  "/intro/pdf",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    fs.rm(brand.introPdfPath(tenant._id), { force: true }, () => {});
    await Tenant.updateOne(
      { _id: tenant._id },
      { $set: { "autopilot.brandIntro.hasPdf": false, "autopilot.brandIntro.pdfName": "" } },
    );
    res.json({ success: true });
  }),
);

// "Fix this": rewrite a post that is waiting for approval from the owner's feedback.
router.post(
  "/posts/:id/revise",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const feedback = svc.clean(req.body?.feedback, 500);
    if (!feedback) {
      res.status(400);
      throw new Error("Tell us what to change");
    }
    if (!svc.isConfigured()) {
      res.status(503);
      throw new Error("Autopilot is not configured on the server yet");
    }
    if (!/^[0-9a-f]{24}$/i.test(req.params.id)) {
      res.status(404);
      throw new Error("Post not found");
    }
    const post = await svc.startRevision(tenant._id, req.params.id);
    if (!post) {
      res.status(409);
      throw new Error(`This post can't be revised right now (already being fixed, no longer waiting for approval, or ${svc.MAX_REVISIONS} changes used)`);
    }
    res.status(202).json({ success: true });
    svc.runRevision(post, feedback);
  }),
);

router.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    if (!svc.isConfigured()) {
      res.status(503);
      throw new Error("Autopilot is not configured on the server yet");
    }
    const at = tenant.autopilot.analysis?.at;
    if (tenant.autopilot.analysis?.status !== "running" && at && Date.now() - at < ANALYZE_COOLDOWN_MS) {
      res.status(429);
      throw new Error("Scan just ran. Try again in a minute.");
    }
    const accountId = /^[0-9a-f]{24}$/i.test(req.body?.accountId || "") ? req.body.accountId : undefined;
    const started = await brand.startAnalysis(tenant._id, accountId);
    res.status(202).json({ success: true, started });
  }),
);

router.put(
  "/brand-profile",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    await Tenant.updateOne({ _id: tenant._id }, { $set: { "autopilot.brandProfile": brand.sanitizeProfile(req.body) } });
    res.json({ success: true });
  }),
);

router.put(
  "/brand",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const b = req.body || {};
    const kit = tenant.autopilot.brandKit;
    const $set = {};

    if (Array.isArray(b.logos)) {
      const names = new Map(b.logos.map((l) => [l?.id, svc.clean(l?.name, 60)]));
      $set["autopilot.brandKit.logos"] = kit.logos.map((l) => ({
        id: l.id,
        file: l.file,
        url: l.url,
        name: names.get(l.id) || l.name,
      }));
    }
    if (typeof b.logoId === "string" && kit.logos.some((l) => l.id === b.logoId)) {
      $set["autopilot.brandKit.logoId"] = b.logoId;
    }
    if (typeof b.logoEnabled === "boolean") $set["autopilot.brandKit.logoEnabled"] = b.logoEnabled;
    if (["fixed", "auto"].includes(b.logoMode)) $set["autopilot.brandKit.logoMode"] = b.logoMode;
    if (POSITIONS.includes(b.logoPosition)) $set["autopilot.brandKit.logoPosition"] = b.logoPosition;
    if (Array.isArray(b.colors)) $set["autopilot.brandKit.colors"] = b.colors.filter((c) => HEX.test(c)).slice(0, 4);

    if (Object.keys($set).length) await Tenant.updateOne({ _id: tenant._id }, { $set });
    res.json({ success: true });
  }),
);

router.post(
  "/logos",
  logoUpload.single("file"),
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    if (!req.file) {
      res.status(400);
      throw new Error("No logo uploaded");
    }
    if (tenant.autopilot.brandKit.logos.length >= MAX_LOGOS) {
      res.status(400);
      throw new Error(`You can keep up to ${MAX_LOGOS} logos`);
    }

    // Re-encode: proves it is a real image and strips anything odd, whatever the extension said.
    let png;
    try {
      png = await sharp(req.file.buffer).resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    } catch {
      res.status(400);
      throw new Error("That file isn't a valid image");
    }

    const id = crypto.randomBytes(8).toString("hex");
    const dir = svc.brandDir(tenant._id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.png`), png);

    const name = svc.clean(req.body?.name, 60) || svc.clean(path.parse(req.file.originalname).name, 60) || "Logo";
    const logo = { id, name, file: `${id}.png`, url: `${svc.publicBase()}/uploads/autopilot/${tenant._id}/brand/${id}.png` };
    const update = { $push: { "autopilot.brandKit.logos": logo } };
    if (!tenant.autopilot.brandKit.logoId) update.$set = { "autopilot.brandKit.logoId": id };
    await Tenant.updateOne({ _id: tenant._id }, update);
    res.status(201).json({ success: true, data: { id, name, url: logo.url } });
  }),
);

router.delete(
  "/logos/:id",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const logo = tenant.autopilot.brandKit.logos.find((l) => l.id === req.params.id);
    if (!logo) {
      res.status(404);
      throw new Error("Logo not found");
    }
    const rest = tenant.autopilot.brandKit.logos.filter((l) => l.id !== logo.id);
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $pull: { "autopilot.brandKit.logos": { id: logo.id } },
        $set: { "autopilot.brandKit.logoId": tenant.autopilot.brandKit.logoId === logo.id ? rest[0]?.id || "" : tenant.autopilot.brandKit.logoId },
      },
    );
    fs.rm(path.join(svc.brandDir(tenant._id), path.basename(logo.file)), { force: true }, () => {});
    res.json({ success: true });
  }),
);

module.exports = router;
