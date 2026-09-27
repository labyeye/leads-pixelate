// Auto-reply to Facebook/Instagram comments and DMs: Claude drafts the reply
// in the brand's tone (reusing the same brand profile Autopilot's onboarding
// scan built), and either sends it straight away or queues it for approval —
// same trust model as post-autopilot: review first, auto once you trust it.
const AutopilotCampaign = require("../models/AutopilotCampaign");
const Product = require("../models/Product");
const Setting = require("../models/Setting");
const SocialReply = require("../models/SocialReply");
const svc = require("./autopilotService");
const log = require("../utils/logger").scope("Social Reply");

const FB_API = "https://graph.facebook.com/v20.0";
const MAX_LEN = 600; // a reply is a sentence or two, not a caption

async function brandContext(tenantId) {
  const [campaign, setting, products] = await Promise.all([
    AutopilotCampaign.findOne({ tenantId, "brandProfile.summary": { $ne: "" } }).sort({ updatedAt: -1 }).lean(),
    Setting.findOne({ tenantId }).select("companyName").lean(),
    Product.find({ tenantId, status: "Active" }).sort({ updatedAt: -1 }).limit(15).select("name category description").lean(),
  ]);
  const p = campaign?.brandProfile || {};
  return {
    brandName: setting?.companyName || "the business",
    tone: svc.clean(p.tone || campaign?.tone, 200),
    summary: svc.clean(p.summary, 500),
    doList: (p.doList || []).slice(0, 8).map((x) => svc.clean(x, 80)),
    avoidList: (p.avoidList || []).slice(0, 8).map((x) => svc.clean(x, 80)),
    products: products.map((x) => ({ name: svc.clean(x.name, 80), category: x.category, description: svc.clean(x.description, 150) })),
  };
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    skip: { type: "boolean" }, // true if this shouldn't get an automated reply at all (spam, abuse, needs a human)
  },
  required: ["reply", "skip"],
  additionalProperties: false,
};

async function draftReply({ tenantId, kind, authorName, incomingText }) {
  const brand = await brandContext(tenantId);
  const system =
    `You write ${kind === "dm" ? "direct message" : "public comment"} replies for ${brand.brandName} on social media, ` +
    `in this tone: ${brand.tone || "friendly, helpful"}. Business summary: ${brand.summary || "n/a"}. ` +
    `Do: ${brand.doList.join("; ") || "n/a"}. Avoid: ${brand.avoidList.join("; ") || "n/a"}. ` +
    `Known products/prices you may quote: ${JSON.stringify(brand.products)}. ` +
    `Set skip=true instead of replying if the message is spam, abusive, or needs a human (a complaint, a refund request, ` +
    `anything you're not confident quoting a price or policy on). Keep replies short — one or two sentences.`;
  const content = `Author: ${svc.clean(authorName, 100) || "someone"}\nMessage: ${svc.clean(incomingText, 1000)}`;
  const out = await svc.claudeJson({ system, content, schema: REPLY_SCHEMA, effort: "low" });
  return { reply: svc.clean(out.reply, MAX_LEN), skip: !!out.skip };
}

async function sendCommentReply(commentId, message, pageToken) {
  const res = await fetch(`${FB_API}/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: pageToken }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to post comment reply");
  return data;
}

async function sendDmReply(pageId, recipientId, message, pageToken) {
  const res = await fetch(`${FB_API}/${pageId}/messages?access_token=${pageToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to send DM reply");
  return data;
}

// Called from the webhook for both comments (kind="comment") and DMs (kind="dm").
// pageConfig is the tenant's integrations.facebook.pages entry for this page.
async function handleIncoming({ tenant, pageConfig, platform, kind, externalId, authorName, incomingText }) {
  if (!incomingText?.trim()) return;
  const existing = await SocialReply.findOne({ tenantId: tenant._id, pageId: pageConfig.pageId, kind, externalId });
  if (existing) return; // webhook retries/duplicates

  const row = await SocialReply.create({
    tenantId: tenant._id,
    platform,
    pageId: pageConfig.pageId,
    kind,
    externalId,
    authorName: authorName || "",
    incomingText,
    status: "PENDING_APPROVAL",
  });

  try {
    const { reply, skip } = await draftReply({ tenantId: tenant._id, kind, authorName, incomingText });
    if (skip || !reply) {
      row.status = "SKIPPED";
      await row.save();
      return;
    }
    row.draftText = reply;
    if (pageConfig.autoReply?.mode === "auto") {
      await sendNow(row, pageConfig.accessToken);
    } else {
      await row.save();
    }
  } catch (err) {
    log.error("Draft failed", { tenantId: String(tenant._id), kind, message: err.message });
    row.status = "FAILED";
    row.error = svc.clean(err.message, 300);
    await row.save();
  }
}

async function sendNow(row, pageToken) {
  try {
    if (row.kind === "comment") await sendCommentReply(row.externalId, row.draftText, pageToken);
    else await sendDmReply(row.pageId, row.externalId, row.draftText, pageToken);
    row.status = "SENT";
    row.sentAt = new Date();
    row.error = "";
  } catch (err) {
    row.status = "FAILED";
    row.error = svc.clean(err.message, 300);
  }
  await row.save();
}

module.exports = { handleIncoming, draftReply, sendCommentReply, sendDmReply, sendNow };
