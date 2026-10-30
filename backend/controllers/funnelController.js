const asyncHandler = require("express-async-handler");
const MessageFunnel = require("../models/MessageFunnel");
const FunnelJob = require("../models/FunnelJob");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const logActivity = require("../utils/activityLogger");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));
const FIELD_KEYS = ["name", "company", "phone", "location", "requirement", "budget", "custom"];
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Validates and cleans a funnel from the request. Throws a 400 with a readable reason.
async function clean(body, tenantId, res) {
  const bad = (m) => {
    res.status(400);
    throw new Error(m);
  };
  const name = str(body.name, 80);
  if (!name) bad("Give the funnel a name");

  const t = body.trigger || {};
  if (!["lead_created", "status_changed"].includes(t.event)) bad("Choose when the funnel starts");
  const trigger = {
    event: t.event,
    status: t.event === "status_changed" ? str(t.status, 40) : "",
    sources: (Array.isArray(t.sources) ? t.sources : []).map((s) => str(s, 30)).filter(Boolean).slice(0, 12),
  };

  const rawSteps = Array.isArray(body.steps) ? body.steps : [];
  if (rawSteps.length < 1 || rawSteps.length > 8) bad("A funnel needs 1 to 8 steps");
  const ids = rawSteps.map((s) => s?.templateId);
  if (!ids.every(isId)) bad("Pick a template for every step");
  const found = await WhatsappTemplate.find({ _id: { $in: ids }, tenantId }).select("_id").lean();
  const have = new Set(found.map((x) => String(x._id)));
  const steps = rawSteps.map((s) => {
    if (!have.has(String(s.templateId))) bad("One of the templates no longer exists");
    const d = Math.round(Number(s.delayMinutes));
    return {
      delayMinutes: Number.isFinite(d) ? Math.min(Math.max(d, 0), 43200) : 0,
      templateId: s.templateId,
      variableMapping: (Array.isArray(s.variableMapping) ? s.variableMapping : [])
        .filter((v) => Number.isInteger(v?.position) && FIELD_KEYS.includes(v.fieldKey))
        .slice(0, 20)
        .map((v) => ({ position: v.position, fieldKey: v.fieldKey, customValue: str(v.customValue, 200) })),
      onlyIfStatus: str(s.onlyIfStatus, 40),
    };
  });

  return {
    name,
    enabled: body.enabled === true,
    trigger,
    steps,
    stopStatuses: (Array.isArray(body.stopStatuses) ? body.stopStatuses : [])
      .map((s) => str(s, 40))
      .filter(Boolean)
      .slice(0, 10),
    phoneNumberId: str(body.phoneNumberId, 40),
  };
}

const list = asyncHandler(async (req, res) => {
  const funnels = await MessageFunnel.find({ tenantId: req.user.tenantId }).sort("-createdAt").lean();
  const queued = await FunnelJob.aggregate([
    { $match: { tenantId: req.user.tenantId, status: "pending" } },
    { $group: { _id: "$funnelId", n: { $sum: 1 } } },
  ]);
  const q = new Map(queued.map((r) => [String(r._id), r.n]));
  res.json({
    success: true,
    data: funnels.map((f) => ({ ...f, queued: q.get(String(f._id)) || 0 })),
  });
});

const create = asyncHandler(async (req, res) => {
  if (!req.user.tenantId) {
    res.status(400);
    throw new Error("Funnels need a company account");
  }
  const data = await clean(req.body || {}, req.user.tenantId, res);
  const f = await MessageFunnel.create({ ...data, tenantId: req.user.tenantId, createdBy: req.user._id });
  logActivity({ user: req.user, action: "CREATE", module: "Lead", description: `Created message funnel "${f.name}"`, targetId: f._id, ip: req.ip });
  res.status(201).json({ success: true, data: f });
});

const update = asyncHandler(async (req, res) => {
  const f = await MessageFunnel.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!f) {
    res.status(404);
    throw new Error("Funnel not found");
  }
  const data = await clean({ ...req.body }, req.user.tenantId, res);
  Object.assign(f, data);
  await f.save();
  logActivity({ user: req.user, action: "UPDATE", module: "Lead", description: `Updated message funnel "${f.name}" (${f.enabled ? "on" : "off"})`, targetId: f._id, ip: req.ip });
  res.json({ success: true, data: f });
});

const remove = asyncHandler(async (req, res) => {
  const f = await MessageFunnel.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!f) {
    res.status(404);
    throw new Error("Funnel not found");
  }
  await FunnelJob.updateMany(
    { funnelId: f._id, status: "pending" },
    { $set: { status: "cancelled", note: "Funnel was deleted" } },
  );
  logActivity({ user: req.user, action: "DELETE", module: "Lead", description: `Deleted message funnel "${f.name}"`, targetId: f._id, ip: req.ip });
  res.json({ success: true });
});

// Recent messages of one funnel: who got what, and whether it went.
const jobs = asyncHandler(async (req, res) => {
  const f = await MessageFunnel.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).select("_id").lean();
  if (!f) {
    res.status(404);
    throw new Error("Funnel not found");
  }
  const rows = await FunnelJob.find({ funnelId: f._id })
    .sort({ runAt: -1 })
    .limit(60)
    .populate("leadId", "name phone")
    .lean();
  res.json({
    success: true,
    data: rows.map((j) => ({
      _id: j._id,
      stepIndex: j.stepIndex,
      status: j.status,
      note: j.note,
      runAt: j.runAt,
      sentAt: j.sentAt,
      lead: j.leadId ? { _id: j.leadId._id, name: j.leadId.name, phone: j.leadId.phone } : null,
    })),
  });
});

module.exports = { list, create, update, remove, jobs };
