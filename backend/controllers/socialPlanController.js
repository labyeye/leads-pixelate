const asyncHandler = require("express-async-handler");
const SocialPlan = require("../models/SocialPlan");
const SocialPost = require("../models/SocialPost");
const SocialAccount = require("../models/SocialAccount");

const tenantOf = (req) => (req.user.tenantId ? { tenantId: req.user.tenantId } : {});
const POPULATE = [
  { path: "assignedTo", select: "name" },
  { path: "createdBy", select: "name" },
  { path: "approvedBy", select: "name" },
  { path: "rejectedBy", select: "name" },
  { path: "postId", select: "status scheduledAt postedAt failureReason" },
];

const EDITABLE = [
  "title",
  "brief",
  "platforms",
  "postType",
  "plannedDate",
  "plannedTime",
  "references",
  "referenceNotes",
  "caption",
  "hashtags",
  "assignedTo",
];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.assignedTo === "") out.assignedTo = null;
  if (Array.isArray(out.references)) {
    out.references = out.references
      .map((r) => ({ label: String(r.label || "").trim(), url: String(r.url || "").trim() }))
      .filter((r) => r.url || r.label);
  }
  if (out.plannedTime && !/^\d{2}:\d{2}$/.test(out.plannedTime)) {
    throw new Error("Time must be HH:mm");
  }
  return out;
}

async function findPlan(req, res) {
  const plan = await SocialPlan.findOne({ _id: req.params.id, ...tenantOf(req) });
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  return plan;
}

const send = async (res, plan, code = 200) => {
  await plan.populate(POPULATE);
  res.status(code).json({ success: true, data: plan });
};

exports.getPlans = asyncHandler(async (req, res) => {
  const q = { ...tenantOf(req) };
  const { status, from, to } = req.query;
  if (status) q.status = status;
  if (from || to) {
    q.plannedDate = {};
    if (from) q.plannedDate.$gte = new Date(from);
    if (to) q.plannedDate.$lte = new Date(to);
  }
  const plans = await SocialPlan.find(q)
    .sort({ plannedDate: 1, plannedTime: 1 })
    .populate(POPULATE);
  res.json({ success: true, count: plans.length, data: plans });
});

exports.createPlan = asyncHandler(async (req, res) => {
  let data;
  try {
    data = pick(req.body);
  } catch (e) {
    res.status(400);
    throw e;
  }
  const plan = await SocialPlan.create({
    ...data,
    createdBy: req.user._id,
    tenantId: req.user.tenantId || null,
  });
  await send(res, plan, 201);
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (plan.status === "SCHEDULED" || plan.status === "PENDING_APPROVAL") {
    res.status(400);
    throw new Error(`A ${plan.status === "SCHEDULED" ? "scheduled" : "pending"} plan can't be edited`);
  }
  try {
    plan.set(pick(req.body));
  } catch (e) {
    res.status(400);
    throw e;
  }
  // Editing an approved/rejected plan sends it back to the start of the approval flow.
  if (plan.status !== "PLANNED") {
    plan.status = "PLANNED";
    plan.approvedBy = plan.approvedAt = plan.rejectedBy = plan.rejectedAt = null;
    plan.approvalNote = plan.rejectionReason = "";
  }
  await plan.save();
  await send(res, plan);
});

exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (plan.status === "SCHEDULED") {
    res.status(400);
    throw new Error("Delete the scheduled post first, or leave the plan as a record");
  }
  await plan.deleteOne();
  res.json({ success: true });
});

exports.submitPlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (!["PLANNED", "REJECTED"].includes(plan.status)) {
    res.status(400);
    throw new Error("Only planned or rejected plans can be sent for approval");
  }
  plan.status = "PENDING_APPROVAL";
  plan.rejectionReason = "";
  await plan.save();
  await send(res, plan);
});

exports.approvePlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (plan.status !== "PENDING_APPROVAL") {
    res.status(400);
    throw new Error("Only plans pending approval can be approved");
  }
  plan.status = "APPROVED";
  plan.approvedBy = req.user._id;
  plan.approvedAt = new Date();
  plan.approvalNote = req.body.note || "";
  await plan.save();
  await send(res, plan);
});

exports.rejectPlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (plan.status !== "PENDING_APPROVAL") {
    res.status(400);
    throw new Error("Only plans pending approval can be rejected");
  }
  plan.status = "REJECTED";
  plan.rejectedBy = req.user._id;
  plan.rejectedAt = new Date();
  plan.rejectionReason = req.body.reason || "";
  await plan.save();
  await send(res, plan);
});

// Approved plan -> real SocialPost, queued for the scheduler (status SCHEDULED).
exports.schedulePlan = asyncHandler(async (req, res) => {
  const plan = await findPlan(req, res);
  if (plan.status !== "APPROVED") {
    res.status(400);
    throw new Error("Only approved plans can be scheduled");
  }
  const {
    accountIds,
    caption,
    hashtags,
    postType,
    imageUrl,
    mediaUrls,
    videoUrl,
    coverImageUrl,
    scheduledAt,
  } = req.body;

  const when = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(when.getTime()) || when <= new Date()) {
    res.status(400);
    throw new Error("Pick a date and time in the future");
  }
  if (!caption || !String(caption).trim()) {
    res.status(400);
    throw new Error("Caption is required");
  }
  if (!Array.isArray(accountIds) || !accountIds.length) {
    res.status(400);
    throw new Error("Select at least one account to post to");
  }
  const accounts = await SocialAccount.find({
    _id: { $in: accountIds },
    isActive: true,
    ...tenantOf(req),
  }).select("platform");
  if (accounts.length !== accountIds.length) {
    res.status(400);
    throw new Error("One or more selected accounts are not available");
  }

  const type = postType || plan.postType;
  if (type === "carousel" && (!mediaUrls || mediaUrls.length < 2)) {
    res.status(400);
    throw new Error("Carousel posts need at least 2 media files");
  }
  if (type === "reel" && !videoUrl) {
    res.status(400);
    throw new Error("Reel posts need a video");
  }
  if (type === "image" && !imageUrl) {
    res.status(400);
    throw new Error("Image posts need an image");
  }

  const post = await SocialPost.create({
    caption: String(caption).trim(),
    imageUrl: type === "image" ? imageUrl : "",
    hashtags: hashtags || [],
    platforms: [...new Set(accounts.map((a) => a.platform))],
    accountIds: accounts.map((a) => String(a._id)),
    postType: type,
    mediaUrls: type === "carousel" ? mediaUrls : [],
    videoUrl: type === "reel" ? videoUrl : "",
    coverImageUrl: type === "reel" ? coverImageUrl || "" : "",
    scheduledAt: when,
    scheduledBy: plan.assignedTo || req.user._id,
    status: "SCHEDULED",
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt,
    approvalNote: plan.approvalNote,
    createdBy: plan.createdBy,
    tenantId: req.user.tenantId || null,
  });

  plan.status = "SCHEDULED";
  plan.postId = post._id;
  plan.caption = post.caption;
  plan.hashtags = post.hashtags;
  plan.platforms = post.platforms;
  plan.postType = type;
  plan.plannedDate = when;
  plan.plannedTime = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  await plan.save();
  await send(res, plan);
});
