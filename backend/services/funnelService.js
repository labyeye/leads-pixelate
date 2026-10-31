// Automatic WhatsApp message funnels. Lead events call enroll()/onStatusChange(); a cron calls
// processDue() every minute to send what is due. Everything here is best-effort: it must never
// break the lead save that triggered it.
const MessageFunnel = require("../models/MessageFunnel");
const FunnelJob = require("../models/FunnelJob");
const Lead = require("../models/Lead");
const User = require("../models/User");
const CallLog = require("../models/CallLog");
const Setting = require("../models/Setting");
const { statusEvents, countByUser } = require("../utils/performanceMetrics");
const log = require("../utils/logger").scope("Funnel");

const STUCK_MS = 10 * 60 * 1000;

// Funnels of this tenant that start on this event, for this lead.
async function enroll(tenantId, event, lead, { status } = {}) {
  try {
    if (!tenantId || !lead?._id) return;
    const funnels = await MessageFunnel.find({ tenantId, enabled: true, "trigger.event": event }).lean();
    for (const f of funnels) {
      if (event === "status_changed" && f.trigger.status && f.trigger.status !== status) continue;
      if (f.trigger.sources?.length && !f.trigger.sources.includes(lead.source)) continue;
      // Already running for this lead (e.g. status flipped back and forth): don't start a second run.
      const running = await FunnelJob.exists({
        funnelId: f._id,
        leadId: lead._id,
        status: { $in: ["pending", "processing"] },
      });
      if (running) continue;
      let at = Date.now();
      const jobs = f.steps.map((s, i) => {
        at += (s.delayMinutes || 0) * 60000;
        return {
          tenantId,
          funnelId: f._id,
          leadId: lead._id,
          stepIndex: i,
          runAt: new Date(at),
        };
      });
      await FunnelJob.insertMany(jobs);
      await MessageFunnel.updateOne({ _id: f._id }, { $inc: { "stats.enrolled": 1 } });
    }
  } catch (err) {
    log.error("Could not enroll lead", { event, message: err.message });
  }
}

// A lead moved to a new status: stop funnels that end there, then start funnels that begin there.
async function onStatusChange(tenantId, lead, newStatus) {
  try {
    if (!tenantId || !lead?._id || !newStatus) return;
    const stopping = await MessageFunnel.find({ tenantId, stopStatuses: newStatus }).select("_id trigger").lean();
    // A funnel that starts on the very status it stops on keeps running.
    const ids = stopping.filter((f) => f.trigger?.status !== newStatus).map((f) => f._id);
    if (ids.length)
      await FunnelJob.updateMany(
        { leadId: lead._id, funnelId: { $in: ids }, status: "pending" },
        { $set: { status: "cancelled", note: `Lead reached ${newStatus}` } },
      );
  } catch (err) {
    log.error("Could not stop funnels", { message: err.message });
  }
  await enroll(tenantId, "status_changed", lead, { status: newStatus });
}

// ---- staff funnels (e.g. a performance report sent to the team) ----
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function periodOf(frequency, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (frequency === "weekly") start.setDate(start.getDate() - 6);
  if (frequency === "monthly") start.setDate(1);
  const label =
    frequency === "weekly" ? "last 7 days" : frequency === "monthly" ? "this month" : "today";
  return { start, label };
}

// Everyone's calls / conversations / quotations / visits over the period, ranked. Worked out once per
// tenant and period and reused for a minute, since every recipient of a run needs the same table.
// Points decide the rank: call 1, conversation 2, quotation 3, visit 3.
const teamCache = new Map();
async function teamBoard(tenantId, frequency) {
  const key = `${tenantId}:${frequency}`;
  const hit = teamCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.board;

  const { start } = periodOf(frequency);
  const tf = { tenantId };
  const [setting, members, events] = await Promise.all([
    Setting.findOne({ tenantId }).select("callTargets").lean(),
    User.find({ ...tf, status: "active", role: { $in: ["admin", "super_admin", "sales_executive"] } }).select("name").lean(),
    statusEvents(tf, start),
  ]);
  const per = countByUser(events);
  // Same rule as the live dashboard: count status updates, or real call logs when the tenant chose so.
  const callLogs = new Map();
  const byCallLog = setting?.callTargets?.countBy === "calls";
  if (byCallLog) {
    const rows = await CallLog.aggregate([
      { $match: { ...tf, initiatedBy: { $ne: null }, createdAt: { $gte: start } } },
      { $group: { _id: "$initiatedBy", n: { $sum: 1 } } },
    ]);
    rows.forEach((r) => callLogs.set(String(r._id), r.n));
  }
  const rows = members.map((u) => {
    const m = per.get(String(u._id)) || { calls: 0, conversations: 0, quotations: 0, visits: 0 };
    const calls = byCallLog ? callLogs.get(String(u._id)) || 0 : m.calls;
    return {
      id: String(u._id),
      name: u.name,
      calls,
      conversations: m.conversations,
      quotations: m.quotations,
      visits: m.visits,
      points: calls + m.conversations * 2 + m.quotations * 3 + m.visits * 3,
    };
  });
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1));
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const board = {
    rows,
    totals: { calls: sum("calls"), conversations: sum("conversations"), quotations: sum("quotations"), visits: sum("visits") },
  };
  teamCache.set(key, { at: Date.now(), board });
  return board;
}

// Meta rejects newlines, tabs and long gaps inside a template value, so the table is one line.
const leaderboardText = (rows) =>
  rows
    .slice(0, 10)
    .map((r) => `${r.rank}. ${r.name} - ${r.calls} calls, ${r.conversations} talks, ${r.quotations} quotes, ${r.visits} visits`)
    .join(" | ")
    .slice(0, 900);

// Numbers for one team member over the period; they fill the {{n}} of the template (perf_* fields).
async function performanceOf(tenantId, user, frequency) {
  const { start, label } = periodOf(frequency);
  const base = { tenantId, assignedTo: user._id, deletedAt: null };
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  const moved = (status) => ({ ...base, statusHistory: { $elemMatch: { status, timestamp: { $gte: start } } } });
  const [fresh, won, dropped, pending, active, followups] = await Promise.all([
    Lead.countDocuments({ ...base, createdAt: { $gte: start } }),
    Lead.countDocuments(moved("WON")),
    Lead.countDocuments(moved("DROP")),
    Lead.countDocuments({ ...base, status: "PENDING CONTACT" }),
    Lead.countDocuments({ ...base, status: { $nin: ["WON", "DROP"] } }),
    Lead.countDocuments({ ...base, status: { $nin: ["WON", "DROP"] }, followUpDate: { $lte: endToday } }),
  ]);
  const closed = won + dropped;
  const board = await teamBoard(tenantId, frequency);
  const mine = board.rows.find((r) => r.id === String(user._id));
  const top = board.rows[0];
  return {
    // you
    perf_calls: String(mine?.calls ?? 0),
    perf_conversations: String(mine?.conversations ?? 0),
    perf_quotations: String(mine?.quotations ?? 0),
    perf_visits: String(mine?.visits ?? 0),
    perf_points: String(mine?.points ?? 0),
    perf_rank: mine ? `${mine.rank} of ${board.rows.length}` : "-",
    // whole team (for the owner's summary)
    perf_team_calls: String(board.totals.calls),
    perf_team_conversations: String(board.totals.conversations),
    perf_team_quotations: String(board.totals.quotations),
    perf_team_visits: String(board.totals.visits),
    perf_team_size: String(board.rows.length),
    perf_top: top && top.points > 0 ? top.name : "-",
    perf_leaderboard: board.rows.length ? leaderboardText(board.rows) : "-",
    perf_period: label,
    perf_new: String(fresh),
    perf_won: String(won),
    perf_dropped: String(dropped),
    perf_pending: String(pending),
    perf_active: String(active),
    perf_followups: String(followups),
    perf_winrate: `${closed ? Math.round((won / closed) * 100) : 0}%`,
  };
}

async function staffOf(funnel) {
  const q = { tenantId: funnel.tenantId, status: "active", phone: { $exists: true, $ne: "" } };
  const s = funnel.staff || {};
  if (s.target === "selected") q._id = { $in: s.userIds || [] };
  else if (s.target === "roles") q.role = { $in: s.roles || [] };
  return User.find(q).select("name phone").lean();
}

// Queues the messages of a staff funnel for everyone it targets. Returns how many people.
async function enrollStaff(funnel) {
  const people = await staffOf(funnel);
  let at = Date.now();
  const steps = funnel.steps || [];
  const jobs = [];
  for (const u of people)
    steps.forEach((s, i) => {
      at = (i === 0 ? Date.now() : at) + (s.delayMinutes || 0) * 60000;
      jobs.push({
        tenantId: funnel.tenantId,
        funnelId: funnel._id,
        userId: u._id,
        audience: "staff",
        recipientName: u.name,
        recipientPhone: u.phone,
        stepIndex: i,
        runAt: new Date(at),
      });
    });
  if (jobs.length) {
    await FunnelJob.insertMany(jobs);
    await MessageFunnel.updateOne({ _id: funnel._id }, { $inc: { "stats.enrolled": people.length } });
  }
  return people.length;
}

// True when a schedule is due right now and has not already run for this day.
function scheduleKey(f, now = new Date()) {
  const sc = f.schedule || {};
  if (now.getHours() * 60 + now.getMinutes() < (sc.hour ?? 9) * 60 + (sc.minute ?? 0)) return null;
  if (sc.frequency === "weekly" && now.getDay() !== (sc.weekday ?? 1)) return null;
  if (sc.frequency === "monthly" && now.getDate() !== (sc.dayOfMonth ?? 1)) return null;
  return dayKey(now);
}

async function runSchedules() {
  try {
    const funnels = await MessageFunnel.find({ enabled: true, audience: "staff", "trigger.event": "schedule" }).lean();
    for (const f of funnels) {
      const key = scheduleKey(f);
      if (!key || f.lastRunKey === key) continue;
      // Claim the day first so two servers / overlapping ticks cannot both send.
      const claimed = await MessageFunnel.updateOne({ _id: f._id, lastRunKey: { $ne: key } }, { $set: { lastRunKey: key } });
      if (claimed.modifiedCount) await enrollStaff(f);
    }
  } catch (err) {
    log.error("Could not run staff schedules", { message: err.message });
  }
}

async function runStaffJob(job, funnel) {
  const step = funnel.steps[job.stepIndex];
  if (!step) return finish(job, { status: "cancelled", note: "Step no longer exists" });
  const user = await User.findById(job.userId).select("name phone status").lean();
  if (!user || user.status !== "active") return finish(job, { status: "cancelled", note: "Team member is inactive" });
  try {
    const perf = await performanceOf(funnel.tenantId, user, funnel.schedule?.frequency || "daily");
    const id = await require("../controllers/whatsappController").sendFunnelMessage(
      funnel.tenantId,
      step,
      { name: user.name, phone: user.phone, ...perf },
      funnel.phoneNumberId,
    );
    await finish(job, { status: "sent", sentAt: new Date(), waMessageId: id }, "sent");
  } catch (err) {
    await finish(job, { status: "failed", note: String(err.message || err).slice(0, 300) }, "failed");
  }
}

async function finish(job, patch, statKey) {
  await FunnelJob.updateOne({ _id: job._id }, { $set: patch });
  if (statKey) await MessageFunnel.updateOne({ _id: job.funnelId }, { $inc: { [`stats.${statKey}`]: 1 } });
}

async function runJob(job) {
  const funnel = await MessageFunnel.findById(job.funnelId).lean();
  if (!funnel || !funnel.enabled) return finish(job, { status: "cancelled", note: "Funnel is off" });
  if (job.audience === "staff") return runStaffJob(job, funnel);
  const lead = await Lead.findOne({ _id: job.leadId }).lean();
  if (!lead || lead.deletedAt) return finish(job, { status: "cancelled", note: "Lead was deleted" });

  const step = funnel.steps[job.stepIndex];
  if (!step) return finish(job, { status: "cancelled", note: "Step no longer exists" });
  const stops = (funnel.stopStatuses || []).filter((s) => s !== funnel.trigger?.status);
  if (stops.includes(lead.status)) return finish(job, { status: "cancelled", note: `Lead is ${lead.status}` });
  if (step.onlyIfStatus && lead.status !== step.onlyIfStatus)
    return finish(job, { status: "skipped", note: `Lead is no longer ${step.onlyIfStatus}` });

  try {
    const id = await require("../controllers/whatsappController").sendFunnelMessage(
      funnel.tenantId,
      step,
      lead,
      funnel.phoneNumberId,
    );
    await finish(job, { status: "sent", sentAt: new Date(), waMessageId: id }, "sent");
  } catch (err) {
    await finish(job, { status: "failed", note: String(err.message || err).slice(0, 300) }, "failed");
  }
}

// Sends everything due. Safe to run while a previous tick is still going: each job is claimed atomically.
async function processDue() {
  try {
    await FunnelJob.updateMany(
      { status: "processing", startedAt: { $lt: new Date(Date.now() - STUCK_MS) } },
      { $set: { status: "pending" } },
    );
    for (let i = 0; i < 300; i++) {
      const job = await FunnelJob.findOneAndUpdate(
        { status: "pending", runAt: { $lte: new Date() } },
        { $set: { status: "processing", startedAt: new Date() } },
        { sort: { runAt: 1 }, new: true },
      );
      if (!job) break;
      try {
        await runJob(job);
      } catch (err) {
        await finish(job, { status: "failed", note: String(err.message).slice(0, 300) }, "failed");
      }
    }
  } catch (err) {
    log.error("Funnel run failed", { message: err.message });
  }
}

module.exports = { enroll, onStatusChange, processDue, runSchedules, enrollStaff, performanceOf };
