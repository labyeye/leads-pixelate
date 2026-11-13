// Follow-ups and site visits that are about to start become a notification for the person they belong to.
// Runs every few minutes; each reminder is sent once (checked against the inbox), so overlapping runs are safe.
const Lead = require("../models/Lead");
const Notification = require("../models/Notification");
const { notify } = require("./notifyService");
const log = require("../utils/logger").scope("Reminders");

const WINDOW_MIN = 30; // remind this long before the time
const CLOSED = ["WON", "DROP"];

const timeOf = (d) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

async function remind({ field, type, title }) {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MIN * 60 * 1000);
  const leads = await Lead.find({
    deletedAt: null,
    status: { $nin: CLOSED },
    assignedTo: { $ne: null },
    [field]: { $gt: now, $lte: until },
  })
    .select("name company assignedTo tenantId " + field)
    .limit(500)
    .lean();
  if (!leads.length) return;

  // What was already reminded: same lead, same time slot.
  const sent = await Notification.find({
    type,
    "data.id": { $in: leads.map((l) => String(l._id)) },
    createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  })
    .select("data.id data.at")
    .lean();
  const done = new Set(sent.map((n) => `${n.data.id}|${n.data.at}`));

  for (const l of leads) {
    const at = new Date(l[field]).toISOString();
    if (done.has(`${l._id}|${at}`)) continue;
    notify([l.assignedTo], {
      tenantId: l.tenantId || null,
      type,
      title: `${title} at ${timeOf(l[field])}`,
      body: `${l.name}${l.company ? ` · ${l.company}` : ""}`,
      data: { screen: "LeadDetail", id: String(l._id), at },
    });
  }
}

async function runReminders() {
  try {
    await remind({ field: "followUpDate", type: "followup_due", title: "Follow-up" });
    await remind({ field: "visitScheduledDate", type: "visit_due", title: "Site visit" });
  } catch (e) {
    log.error("Reminder run failed", { message: e.message });
  }
}

module.exports = { runReminders };
