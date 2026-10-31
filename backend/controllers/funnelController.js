const asyncHandler = require("express-async-handler");
const MessageFunnel = require("../models/MessageFunnel");
const FunnelJob = require("../models/FunnelJob");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const logActivity = require("../utils/activityLogger");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));
const FIELD_KEYS = [
  "name", "company", "phone", "location", "requirement", "budget", "custom",
  "perf_period", "perf_new", "perf_won", "perf_dropped", "perf_pending", "perf_active", "perf_followups", "perf_winrate",
];
const ROLES = ["admin", "sales_executive", "service_manager", "accountant"];
const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d;
};
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Validates and cleans a funnel from the request. Throws a 400 with a readable reason.
async function clean(body, tenantId, res) {
  const bad = (m) => {
    res.status(400);
    throw new Error(m);
  };
  const name = str(body.name, 80);
  if (!name) bad("Give the funnel a name");

  const audience = body.audience === "staff" ? "staff" : "leads";
  const t = body.trigger || {};
  const events = audience === "staff" ? ["schedule", "manual"] : ["lead_created", "status_changed"];
  if (!events.includes(t.event)) bad("Choose when the funnel starts");
  const trigger = {
    event: t.event,
    status: audience === "leads" && t.event === "status_changed" ? str(t.status, 40) : "",
    sources: audience === "staff" ? [] : (Array.isArray(t.sources) ? t.sources : []).map((s) => str(s, 30)).filter(Boolean).slice(0, 12),
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

  const st = body.staff || {};
  const staff = {
    target: ["all", "roles", "selected"].includes(st.target) ? st.target : "all",
    roles: (Array.isArray(st.roles) ? st.roles : []).filter((r) => ROLES.includes(r)),
    userIds: (Array.isArray(st.userIds) ? st.userIds : []).filter(isId).slice(0, 200),
  };
  if (audience === "staff") {
    if (staff.target === "roles" && !staff.roles.length) bad("Pick at least one role");
    if (staff.target === "selected" && !staff.userIds.length) bad("Pick at least one team member");
  }
  const sc = body.schedule || {};
  const schedule = {
    frequency: ["daily", "weekly", "monthly"].includes(sc.frequency) ? sc.frequency : "daily",
    hour: int(sc.hour, 0, 23, 9),
    minute: int(sc.minute, 0, 59, 0),
    weekday: int(sc.weekday, 0, 6, 1),
    dayOfMonth: int(sc.dayOfMonth, 1, 28, 1),
  };

  return {
    name,
    enabled: body.enabled === true,
    audience,
    staff,
    schedule,
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
  res.json({ success: true, data: rows.map((j) => shape(j)) });
});

function shape(j, funnel) {
  return {
    _id: j._id,
    funnelId: funnel?._id || j.funnelId?._id || j.funnelId,
    funnelName: funnel?.name || j.funnelId?.name || "",
    audience: j.audience || "leads",
    stepIndex: j.stepIndex,
    status: j.status,
    note: j.note,
    runAt: j.runAt,
    sentAt: j.sentAt,
    recipient: j.audience === "staff" ? j.recipientName || "Team member" : j.leadId?.name || "Deleted lead",
    phone: j.audience === "staff" ? j.recipientPhone : j.leadId?.phone || "",
    lead: j.leadId ? { _id: j.leadId._id, name: j.leadId.name, phone: j.leadId.phone } : null,
  };
}

// Cards + the latest messages across every funnel.
const overview = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [funnels, byStatus, today, byAudience, recent] = await Promise.all([
    MessageFunnel.find({ tenantId }).select("enabled audience").lean(),
    FunnelJob.aggregate([{ $match: { tenantId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    FunnelJob.countDocuments({ tenantId, status: "sent", sentAt: { $gte: startOfDay } }),
    FunnelJob.aggregate([{ $match: { tenantId, status: "sent" } }, { $group: { _id: "$audience", n: { $sum: 1 } } }]),
    FunnelJob.find({ tenantId, status: { $in: ["sent", "failed", "skipped", "cancelled"] } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate("leadId", "name phone")
      .populate("funnelId", "name")
      .lean(),
  ]);
  const n = (s) => byStatus.find((r) => r._id === s)?.n || 0;
  const aud = (a) => byAudience.find((r) => (r._id || "leads") === a)?.n || 0;
  const sent = n("sent");
  const failed = n("failed");
  res.json({
    success: true,
    data: {
      cards: {
        funnels: funnels.length,
        active: funnels.filter((f) => f.enabled).length,
        sent,
        sentToday: today,
        failed,
        waiting: n("pending") + n("processing"),
        toStaff: aud("staff"),
        toLeads: aud("leads"),
        deliveryRate: sent + failed ? Math.round((sent / (sent + failed)) * 100) : 0,
      },
      recent: recent.map((j) => shape(j)),
    },
  });
});

// "Send now" for a staff funnel: queues it for everyone it targets.
const runNow = asyncHandler(async (req, res) => {
  const f = await MessageFunnel.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean();
  if (!f) {
    res.status(404);
    throw new Error("Funnel not found");
  }
  if (f.audience !== "staff") {
    res.status(400);
    throw new Error("Only team funnels can be sent manually");
  }
  const people = await require("../services/funnelService").enrollStaff(f);
  if (!people) {
    res.status(400);
    throw new Error("No team members with a phone number match this funnel");
  }
  logActivity({ user: req.user, action: "UPDATE", module: "Lead", description: `Sent team funnel "${f.name}" to ${people} people`, targetId: f._id, ip: req.ip });
  res.json({ success: true, data: { people } });
});

module.exports = { list, create, update, remove, jobs, overview, runNow };
