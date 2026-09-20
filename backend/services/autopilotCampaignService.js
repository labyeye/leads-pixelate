// Campaign bookkeeping for Social Autopilot: the one-time move from the old single setup on
// Tenant.autopilot to campaigns, the account-exclusivity rule, and the summaries the UI lists.
const fs = require("fs");
const path = require("path");
const AutopilotCampaign = require("../models/AutopilotCampaign");
const SocialAccount = require("../models/SocialAccount");
const SocialPost = require("../models/SocialPost");
const svc = require("./autopilotService");
const log = require("../utils/logger").scope("AutopilotCampaign");

const MAX_COMPETITORS = 5;
const MAX_REFERENCES = 8;
const LEGACY_NAME = "Main";

const privateDir = (tenantId, campaignId) =>
  path.join(__dirname, "../private/autopilot", String(tenantId), ...(campaignId ? [String(campaignId)] : []));

// Before campaigns a tenant had one setup on Tenant.autopilot (accounts empty = "all connected").
// On first look, turn that into a campaign called "Main": copy the settings, move its logo files and
// brand PDF into the campaign's folders and attach the existing Autopilot posts. Does nothing when
// the tenant already has campaigns or never configured Autopilot. Safe to call on every request.
async function ensureDefaultCampaign(tenant) {
  if (await AutopilotCampaign.exists({ tenantId: tenant._id })) return null;
  const raw = (tenant.toObject ? tenant.toObject().autopilot : tenant.autopilot) || {};
  const configured =
    raw.enabled ||
    raw.onboardedAt ||
    raw.brandProfile?.summary ||
    raw.brandIntro?.text ||
    raw.brandIntro?.hasPdf ||
    raw.brandKit?.logos?.length ||
    raw.accountIds?.length;
  if (!configured) return null;

  const accountIds = raw.accountIds?.length
    ? raw.accountIds
    : (await SocialAccount.find({ tenantId: tenant._id, isActive: true }).select("_id").lean()).map((x) => String(x._id));

  const { competitive, ...profile } = raw.brandProfile || {};
  const campaign = await AutopilotCampaign.create({
    tenantId: tenant._id,
    name: LEGACY_NAME,
    enabled: !!raw.enabled,
    accountIds,
    postsPerDay: raw.postsPerDay,
    tone: raw.tone,
    language: raw.language,
    notes: raw.notes,
    reviewFirst: raw.reviewFirst,
    runningSince: raw.runningSince,
    lastRunAt: raw.lastRunAt,
    lastError: raw.lastError,
    onboardedAt: raw.onboardedAt,
    firstApprovedAt: raw.firstApprovedAt,
    brandIntro: raw.brandIntro,
    schedule: raw.schedule,
    contentTypes: raw.contentTypes,
    lessons: raw.lessons,
    progress: raw.progress,
    analysis: raw.analysis,
    brandProfile: profile,
    brandKit: raw.brandKit,
  });

  // Logo files: uploads/autopilot/<tenant>/brand/<file> -> .../brand/<campaign>/<file>
  try {
    const from = svc.brandDir(tenant._id);
    const to = svc.brandDir(tenant._id, campaign._id);
    const logos = (raw.brandKit?.logos || []).map((l) => ({ ...l }));
    if (logos.length) fs.mkdirSync(to, { recursive: true });
    for (const l of logos) {
      const name = path.basename(l.file);
      if (fs.existsSync(path.join(from, name))) fs.renameSync(path.join(from, name), path.join(to, name));
      l.url = `${svc.publicBase()}/uploads/autopilot/${tenant._id}/brand/${campaign._id}/${name}`;
    }
    if (logos.length) await AutopilotCampaign.updateOne({ _id: campaign._id }, { $set: { "brandKit.logos": logos } });
    // Brand PDF (private): <tenant>/intro.pdf -> <tenant>/<campaign>/intro.pdf
    const pdf = path.join(privateDir(tenant._id), "intro.pdf");
    if (raw.brandIntro?.hasPdf && fs.existsSync(pdf)) {
      fs.mkdirSync(privateDir(tenant._id, campaign._id), { recursive: true });
      fs.renameSync(pdf, path.join(privateDir(tenant._id, campaign._id), "intro.pdf"));
    }
  } catch (err) {
    log.warn("Moving legacy Autopilot files failed", { tenantId: String(tenant._id), message: err.message });
  }

  await SocialPost.updateMany({ tenantId: tenant._id, source: "autopilot", campaignId: null }, { $set: { campaignId: campaign._id } });
  return campaign;
}

// An account can belong to one campaign only (otherwise both would post to it).
// Returns { accountId, campaignName } for the first account already used elsewhere, else null.
async function findAccountConflict(tenantId, accountIds, exceptCampaignId) {
  if (!accountIds?.length) return null;
  const others = await AutopilotCampaign.find({
    tenantId,
    ...(exceptCampaignId ? { _id: { $ne: exceptCampaignId } } : {}),
  });
  for (const c of others) {
    const hit = (c.accountIds || []).find((id) => accountIds.includes(String(id)));
    if (hit) return { accountId: String(hit), campaignName: c.name };
  }
  return null;
}

// One row of the campaign list.
function campaignSummary(c, { monthPosts = 0, next = null, now = new Date() } = {}) {
  return {
    id: String(c._id),
    name: c.name,
    enabled: !!c.enabled,
    accountIds: (c.accountIds || []).map(String),
    onboarded: !!(c.onboardedAt || c.enabled || c.firstApprovedAt),
    running: !!c.runningSince && now - c.runningSince < svc.LOCK_MS,
    lastError: c.lastError || "",
    monthPosts,
    next,
  };
}

module.exports = {
  ensureDefaultCampaign,
  findAccountConflict,
  campaignSummary,
  privateDir,
  MAX_COMPETITORS,
  MAX_REFERENCES,
};
