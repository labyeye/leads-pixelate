const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { protect, authorize } = require("../middleware/auth");
const Tenant = require("../models/Tenant");
const AutopilotCampaign = require("../models/AutopilotCampaign");
const SocialPost = require("../models/SocialPost");
const SocialAccount = require("../models/SocialAccount");
const svc = require("../services/autopilotService");
const brand = require("../services/brandAnalysisService");
const stats = require("../services/autopilotStatsService");
const campaigns = require("../services/autopilotCampaignService");
const log = require("../utils/logger").scope("Autopilot");

const router = express.Router();
router.use(protect, authorize("super_admin", "admin"));

const RUN_COOLDOWN_MS = 10 * 1000; // TEMP local testing: restore to 10 * 60 * 1000
const ANALYZE_COOLDOWN_MS = 60 * 1000;
const HEX = /^#[0-9a-f]{6}$/i;
const POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"];
const MAX_LOGOS = 5;
const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));

async function getTenant(req, res) {
  const tenant = req.user.tenantId ? await Tenant.findById(req.user.tenantId) : null;
  if (!tenant) {
    res.status(400);
    throw new Error("No organisation found for this account");
  }
  return tenant;
}

// The tenant's monthly count is shared by all campaigns; each campaign also shows its own.
const monthCounts = async (tenantId) => {
  const rows = await SocialPost.aggregate([
    { $match: { tenantId, source: "autopilot", createdAt: { $gte: svc.monthStart() } } },
    { $group: { _id: "$campaignId", n: { $sum: 1 } } },
  ]);
  return { byCampaign: Object.fromEntries(rows.map((r) => [String(r._id), r.n])), total: rows.reduce((n, r) => n + r.n, 0) };
};

// ------------------------------------------------------------------ overview + campaigns

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    await campaigns.ensureDefaultCampaign(tenant); // one-time move of the old single setup
    const [list, accounts, counts] = await Promise.all([
      AutopilotCampaign.find({ tenantId: tenant._id }).sort({ createdAt: 1 }),
      SocialAccount.find({ tenantId: tenant._id, isActive: true }).select("platform accountName profilePicture").lean(),
      monthCounts(tenant._id),
    ]);
    const owner = {};
    for (const c of list) for (const id of c.accountIds || []) owner[String(id)] = { id: String(c._id), name: c.name };
    const eff = svc.effectiveAutopilot(tenant);
    res.json({
      success: true,
      data: {
        configured: svc.isConfigured(),
        trialDays: svc.TRIAL_DAYS,
        entitlement: svc.entitlement(eff),
        plan: svc.entitlement(eff).state === "paid" ? svc.planLimits(eff).plan : "",
        limits: svc.planLimits(eff),
        monthCount: counts.total,
        monthlyCap: svc.planLimits(eff).monthlyPosts,
        campaigns: list.map((c) => campaigns.campaignSummary(c, { monthPosts: counts.byCampaign[String(c._id)] || 0 })),
        accounts: accounts.map((a) => ({ ...a, campaign: owner[String(a._id)] || null })),
      },
    });
  }),
);

router.post(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const name = svc.clean(req.body?.name, 60);
    if (!name) {
      res.status(400);
      throw new Error("Give the campaign a name");
    }
    const limit = svc.planLimits(svc.effectiveAutopilot(tenant)).campaigns;
    if ((await AutopilotCampaign.countDocuments({ tenantId: tenant._id })) >= limit) {
      res.status(403);
      throw new Error(`Your plan allows ${limit} Autopilot campaign${limit === 1 ? "" : "s"}. Upgrade your plan to add more.`);
    }
    const c = await AutopilotCampaign.create({ tenantId: tenant._id, name });
    res.status(201).json({ success: true, data: { id: String(c._id), name: c.name } });
  }),
);

// Everything below /campaigns/:cid belongs to one campaign of the caller's tenant.
const one = express.Router({ mergeParams: true });
router.use(
  "/campaigns/:cid",
  asyncHandler(async (req, res, next) => {
    req.tenant = await getTenant(req, res);
    req.campaign = isId(req.params.cid)
      ? await AutopilotCampaign.findOne({ _id: req.params.cid, tenantId: req.tenant._id })
      : null;
    if (!req.campaign) {
      res.status(404);
      throw new Error("Campaign not found");
    }
    next();
  }),
  one,
);

// Full state of one campaign (what the wizard, dashboard and setup screens read).
async function campaignStatus(tenant, campaign) {
  const a = svc.campaignView(tenant, campaign);
  const [all, accounts, counts] = await Promise.all([
    AutopilotCampaign.find({ tenantId: tenant._id }).select("name accountIds"),
    SocialAccount.find({ tenantId: tenant._id, isActive: true }).select("platform accountName profilePicture").lean(),
    monthCounts(tenant._id),
  ]);
  const owner = {};
  for (const c of all) for (const id of c.accountIds || []) owner[String(id)] = { id: String(c._id), name: c.name };
  const lim = svc.planLimits(a);
  return {
    campaign: { id: String(campaign._id), name: campaign.name },
    configured: svc.isConfigured(),
    plan: svc.entitlement(a).state === "paid" ? lim.plan : "",
    limits: lim,
    trialDays: svc.TRIAL_DAYS,
    entitlement: svc.entitlement(a),
    settings: {
      enabled: !!a.enabled,
      postsPerDay: a.postsPerDay,
      tone: a.tone,
      language: a.language,
      notes: a.notes,
      reviewFirst: a.reviewFirst,
      accountIds: (a.accountIds || []).map(String),
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
    competitors: (a.competitors || []).map((c) => ({
      id: c.id,
      username: c.username,
      notes: c.notes,
      followers: c.followers ?? null,
      summary: c.summary,
      error: c.error,
      readAt: c.readAt || null,
    })),
    references: (a.references || []).map((r) => ({ id: r.id, url: r.url, note: r.note })),
    lastRunAt: a.lastRunAt,
    lastError: a.lastError,
    monthCount: counts.total,
    campaignMonthCount: counts.byCampaign[String(campaign._id)] || 0,
    monthlyCap: lim.monthlyPosts,
    accounts: accounts.map((x) => ({ ...x, campaign: owner[String(x._id)] || null })),
  };
}

one.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await campaignStatus(req.tenant, req.campaign) });
  }),
);

one.put(
  "/",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    const patch = svc.sanitizeSettings(req.body);
    const name = svc.clean(req.body?.name, 60);
    if (name) patch.name = name;

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

    // Accounts: the caller's own, and each account belongs to one campaign only.
    if (patch.accountIds) {
      const own = await SocialAccount.find({ _id: { $in: patch.accountIds }, tenantId: tenant._id }).select("_id").lean();
      patch.accountIds = own.map((x) => String(x._id));
      const clash = await campaigns.findAccountConflict(tenant._id, patch.accountIds, campaign._id);
      if (clash) {
        res.status(409);
        throw new Error(`That account already posts for the campaign "${clash.campaignName}". Remove it there first.`);
      }
    }

    // Enabling starts the one-time trial, so don't let it burn with nowhere to post.
    if (patch.enabled === true) {
      const ids = patch.accountIds ?? (campaign.accountIds || []).map(String);
      if (!ids.length || !(await SocialAccount.exists({ tenantId: tenant._id, isActive: true, _id: { $in: ids } }))) {
        res.status(400);
        throw new Error("Choose a connected Facebook, Instagram or LinkedIn account for this campaign first");
      }
    }

    const turningOn = patch.enabled === true && !campaign.enabled;
    const $set = { ...patch };
    if (patch.enabled && !campaign.onboardedAt) $set.onboardedAt = new Date();
    if (Object.keys($set).length) await AutopilotCampaign.updateOne({ _id: campaign._id }, { $set });
    if (patch.enabled) {
      const trial = svc.trialPatch(svc.effectiveAutopilot(tenant));
      if (Object.keys(trial).length) await Tenant.updateOne({ _id: tenant._id }, { $set: trial });
    }

    // Pausing stops everything already queued for this campaign, not just new generation.
    if (patch.enabled === false) await svc.revertScheduled(tenant._id, campaign._id);

    // First look right away: fill the calendar instead of waiting for the hourly tick.
    if (turningOn && svc.isConfigured()) {
      svc
        .runForTenant(tenant._id, { manual: true, campaignId: campaign._id })
        .catch((err) => log.error("Autopilot first run failed", { message: err.message }));
    }

    res.json({ success: true });
  }),
);

one.delete(
  "/",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    await svc.revertScheduled(tenant._id, campaign._id);
    for (const dir of [svc.brandDir(tenant._id, campaign._id), campaigns.privateDir(tenant._id, campaign._id)]) {
      fs.rm(dir, { recursive: true, force: true }, () => {});
    }
    await AutopilotCampaign.deleteOne({ _id: campaign._id });
    res.json({ success: true });
  }),
);

one.post(
  "/run",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    const a = svc.campaignView(tenant, campaign);

    if (!svc.isConfigured()) {
      res.status(503);
      throw new Error("Autopilot is not configured on the server yet");
    }
    if (!a.enabled) {
      res.status(400);
      throw new Error("Turn this campaign on first");
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
      .runForTenant(tenant._id, { manual: true, campaignId: campaign._id })
      .catch((err) => log.error("Autopilot manual run failed", { message: err.message }));
  }),
);

// ------------------------------------------------- onboarding: scan, brand, intro, logos

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

one.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    if (!svc.isConfigured()) {
      res.status(503);
      throw new Error("Autopilot is not configured on the server yet");
    }
    const at = campaign.analysis?.at;
    if (campaign.analysis?.status !== "running" && at && Date.now() - at < ANALYZE_COOLDOWN_MS) {
      res.status(429);
      throw new Error("Scan just ran. Try again in a minute.");
    }
    const accountId = isId(req.body?.accountId) ? req.body.accountId : undefined;
    const started = await brand.startAnalysis(tenant._id, campaign._id, accountId);
    res.status(202).json({ success: true, started });
  }),
);

one.put(
  "/brand-profile",
  asyncHandler(async (req, res) => {
    await AutopilotCampaign.updateOne({ _id: req.campaign._id }, { $set: { brandProfile: brand.sanitizeProfile(req.body) } });
    res.json({ success: true });
  }),
);

one.put(
  "/brand",
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const kit = req.campaign.brandKit;
    const $set = {};

    if (Array.isArray(b.logos)) {
      const names = new Map(b.logos.map((l) => [l?.id, svc.clean(l?.name, 60)]));
      $set["brandKit.logos"] = kit.logos.map((l) => ({ id: l.id, file: l.file, url: l.url, name: names.get(l.id) || l.name }));
    }
    if (typeof b.logoId === "string" && kit.logos.some((l) => l.id === b.logoId)) $set["brandKit.logoId"] = b.logoId;
    if (typeof b.logoEnabled === "boolean") $set["brandKit.logoEnabled"] = b.logoEnabled;
    if (["fixed", "auto"].includes(b.logoMode)) $set["brandKit.logoMode"] = b.logoMode;
    if (POSITIONS.includes(b.logoPosition)) $set["brandKit.logoPosition"] = b.logoPosition;
    if (Array.isArray(b.colors)) $set["brandKit.colors"] = b.colors.filter((c) => HEX.test(c)).slice(0, 4);

    if (Object.keys($set).length) await AutopilotCampaign.updateOne({ _id: req.campaign._id }, { $set });
    res.json({ success: true });
  }),
);

// The owner's own words about the brand: typed text and/or one PDF. Read by the next scan.
one.post(
  "/intro",
  pdfUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    const $set = { "brandIntro.updatedAt": new Date() };
    if (typeof req.body?.text === "string") $set["brandIntro.text"] = req.body.text.trim().slice(0, 4000);

    if (req.file) {
      if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
        res.status(400);
        throw new Error("That file isn't a valid PDF");
      }
      const file = brand.introPdfPath(tenant._id, campaign._id);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, req.file.buffer);
      $set["brandIntro.hasPdf"] = true;
      $set["brandIntro.pdfName"] = svc.clean(path.basename(req.file.originalname), 200);
    }
    await AutopilotCampaign.updateOne({ _id: campaign._id }, { $set });
    res.json({ success: true });
  }),
);

one.delete(
  "/intro/pdf",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    fs.rm(brand.introPdfPath(tenant._id, campaign._id), { force: true }, () => {});
    await AutopilotCampaign.updateOne({ _id: campaign._id }, { $set: { "brandIntro.hasPdf": false, "brandIntro.pdfName": "" } });
    res.json({ success: true });
  }),
);

one.post(
  "/logos",
  logoUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    if (!req.file) {
      res.status(400);
      throw new Error("No logo uploaded");
    }
    if (campaign.brandKit.logos.length >= MAX_LOGOS) {
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
    const dir = svc.brandDir(tenant._id, campaign._id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.png`), png);

    const name = svc.clean(req.body?.name, 60) || svc.clean(path.parse(req.file.originalname).name, 60) || "Logo";
    const logo = { id, name, file: `${id}.png`, url: `${svc.publicBase()}/uploads/autopilot/${tenant._id}/brand/${campaign._id}/${id}.png` };
    const update = { $push: { "brandKit.logos": logo } };
    if (!campaign.brandKit.logoId) update.$set = { "brandKit.logoId": id };
    await AutopilotCampaign.updateOne({ _id: campaign._id }, update);
    res.status(201).json({ success: true, data: { id, name, url: logo.url } });
  }),
);

one.delete(
  "/logos/:id",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    const logo = campaign.brandKit.logos.find((l) => l.id === req.params.id);
    if (!logo) {
      res.status(404);
      throw new Error("Logo not found");
    }
    const rest = campaign.brandKit.logos.filter((l) => l.id !== logo.id);
    await AutopilotCampaign.updateOne(
      { _id: campaign._id },
      {
        $pull: { "brandKit.logos": { id: logo.id } },
        $set: { "brandKit.logoId": campaign.brandKit.logoId === logo.id ? rest[0]?.id || "" : campaign.brandKit.logoId },
      },
    );
    fs.rm(path.join(svc.brandDir(tenant._id, campaign._id), path.basename(logo.file)), { force: true }, () => {});
    res.json({ success: true });
  }),
);

// ------------------------------------------------- competitors and reference images

one.post(
  "/competitors",
  asyncHandler(async (req, res) => {
    const { campaign } = req;
    const username = svc.clean(req.body?.username, 60).replace(/^@+/, "");
    const notes = svc.clean(req.body?.notes, 500);
    if (!username && !notes) {
      res.status(400);
      throw new Error("Add an Instagram username or a note about the competitor");
    }
    if (username && !brand.HANDLE.test(username)) {
      res.status(400);
      throw new Error("That doesn't look like an Instagram username (letters, numbers, dots and underscores)");
    }
    if ((campaign.competitors || []).length >= campaigns.MAX_COMPETITORS) {
      res.status(400);
      throw new Error(`You can add up to ${campaigns.MAX_COMPETITORS} competitors`);
    }
    if (username && (campaign.competitors || []).some((c) => c.username.toLowerCase() === username.toLowerCase())) {
      res.status(409);
      throw new Error("That competitor is already added");
    }
    const entry = { id: crypto.randomBytes(6).toString("hex"), username, notes };
    await AutopilotCampaign.updateOne({ _id: campaign._id }, { $push: { competitors: entry } });
    res.status(201).json({ success: true, data: entry });
  }),
);

one.delete(
  "/competitors/:id",
  asyncHandler(async (req, res) => {
    await AutopilotCampaign.updateOne({ _id: req.campaign._id }, { $pull: { competitors: { id: req.params.id } } });
    res.json({ success: true });
  }),
);

one.post(
  "/references",
  logoUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    if (!req.file) {
      res.status(400);
      throw new Error("No image uploaded");
    }
    if ((campaign.references || []).length >= campaigns.MAX_REFERENCES) {
      res.status(400);
      throw new Error(`You can keep up to ${campaigns.MAX_REFERENCES} reference images`);
    }
    let jpeg;
    try {
      jpeg = await sharp(req.file.buffer).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    } catch {
      res.status(400);
      throw new Error("That file isn't a valid image");
    }
    const id = crypto.randomBytes(8).toString("hex");
    const dir = brand.refsDir(tenant._id, campaign._id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.jpg`), jpeg);
    const ref = {
      id,
      file: `${id}.jpg`,
      url: `${svc.publicBase()}/uploads/autopilot/${tenant._id}/brand/${campaign._id}/refs/${id}.jpg`,
      note: svc.clean(req.body?.note, 200),
    };
    await AutopilotCampaign.updateOne({ _id: campaign._id }, { $push: { references: ref } });
    res.status(201).json({ success: true, data: { id, url: ref.url, note: ref.note } });
  }),
);

one.delete(
  "/references/:id",
  asyncHandler(async (req, res) => {
    const { tenant, campaign } = req;
    const ref = (campaign.references || []).find((r) => r.id === req.params.id);
    if (!ref) {
      res.status(404);
      throw new Error("Reference not found");
    }
    await AutopilotCampaign.updateOne({ _id: campaign._id }, { $pull: { references: { id: ref.id } } });
    fs.rm(path.join(brand.refsDir(tenant._id, campaign._id), path.basename(ref.file)), { force: true }, () => {});
    res.json({ success: true });
  }),
);

// ------------------------------------------------- numbers, and change requests on a post

// Dashboard + report numbers: ?days=7|30|90 and optionally ?campaignId= (omit = all campaigns)
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const tenant = await getTenant(req, res);
    const campaignId = isId(req.query.campaignId) ? req.query.campaignId : undefined;
    const data = await stats.getStats(tenant._id, Number(req.query.days) || 30, new Date(), campaignId);
    const names = Object.fromEntries((await AutopilotCampaign.find({ tenantId: tenant._id }).select("name")).map((c) => [String(c._id), c.name]));
    data.byCampaign = (data.byCampaign || []).map((r) => ({ ...r, name: (r.campaignId === "null" ? "Not in a campaign" : names[r.campaignId] || "Deleted campaign") }));
    res.json({ success: true, data });
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
    if (!isId(req.params.id)) {
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

module.exports = router;
