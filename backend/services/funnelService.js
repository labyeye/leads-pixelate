// Automatic WhatsApp message funnels. Lead events call enroll()/onStatusChange(); a cron calls
// processDue() every minute to send what is due. Everything here is best-effort: it must never
// break the lead save that triggered it.
const MessageFunnel = require("../models/MessageFunnel");
const FunnelJob = require("../models/FunnelJob");
const Lead = require("../models/Lead");
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

async function finish(job, patch, statKey) {
  await FunnelJob.updateOne({ _id: job._id }, { $set: patch });
  if (statKey) await MessageFunnel.updateOne({ _id: job.funnelId }, { $inc: { [`stats.${statKey}`]: 1 } });
}

async function runJob(job) {
  const funnel = await MessageFunnel.findById(job.funnelId).lean();
  if (!funnel || !funnel.enabled) return finish(job, { status: "cancelled", note: "Funnel is off" });
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

module.exports = { enroll, onStatusChange, processDue };
