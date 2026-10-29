// Team performance, worked out from each lead's status history (one entry per status change).
//   calls          every status change someone makes (a call attempt plus its outcome)
//   conversations  a lead moved OUT of "New Lead" (to Discussion, Quotation, Dropped...)
//   quotations     a lead moved INTO the "Quotation" stage
//   visits         a lead moved to "VISIT SCHEDULED"
// Tenant custom stages count through the category they were added to.
const Lead = require("../models/Lead");
const Setting = require("../models/Setting");
const { buildCategoriesWithCustom } = require("./leadStatuses");

const METRICS = [
  { key: "calls", label: "Calls" },
  { key: "conversations", label: "Conversations" },
  { key: "quotations", label: "Quotations sent" },
  { key: "visits", label: "Visits scheduled" },
];

async function categoryMap(tenantId) {
  const s = await Setting.findOne({ tenantId: tenantId || null }).select("customLeadStatuses").lean();
  const map = new Map();
  for (const [cat, values] of Object.entries(buildCategoriesWithCustom(s?.customLeadStatuses || [])))
    for (const v of values) map.set(v, cat);
  return map;
}

// Status changes since `since` as events { userId, leadId, at, from, to, conversation, quotation, visit }.
// Pass userId to look at one person only.
async function statusEvents(tf, since, userId) {
  const cat = await categoryMap(tf.tenantId);
  const match = userId
    ? { $elemMatch: { timestamp: { $gte: since }, changedBy: userId } }
    : { $elemMatch: { timestamp: { $gte: since } } };
  const leads = await Lead.find({ ...tf, statusHistory: match }).select("statusHistory").limit(5000).lean();
  const out = [];
  for (const l of leads) {
    const h = l.statusHistory || [];
    h.forEach((e, i) => {
      if (!e.timestamp || new Date(e.timestamp) < since || !e.changedBy) return;
      if (userId && String(e.changedBy) !== String(userId)) return;
      // A hand-made lead starts with a "PENDING CONTACT" creation entry; integration leads have an
      // empty history, so their first entry is a real change from PENDING CONTACT.
      if (i === 0 && e.status === "PENDING CONTACT") return;
      const from = i === 0 ? "PENDING CONTACT" : h[i - 1].status;
      const fromCat = cat.get(from);
      const toCat = cat.get(e.status);
      out.push({
        userId: String(e.changedBy),
        leadId: l._id,
        at: e.timestamp,
        from,
        to: e.status,
        conversation: fromCat === "New Lead" && !!toCat && toCat !== "New Lead",
        quotation: toCat === "Quotation",
        visit: e.status === "VISIT SCHEDULED",
      });
    });
  }
  return out;
}

// { userId: { calls, conversations, quotations, visits } }
function countByUser(events) {
  const per = new Map();
  for (const e of events) {
    const r = per.get(e.userId) || { calls: 0, conversations: 0, quotations: 0, visits: 0 };
    r.calls++;
    if (e.conversation) r.conversations++;
    if (e.quotation) r.quotations++;
    if (e.visit) r.visits++;
    per.set(e.userId, r);
  }
  return per;
}

// Target for one metric: { count, perMinutes }. calls keeps its older top-level fields.
function targetOf(ct, key) {
  if (!ct) return { count: 0, perMinutes: 60 };
  if (key === "calls") return { count: Number(ct.calls) || 0, perMinutes: Number(ct.perMinutes) || 60 };
  const t = ct[key] || {};
  return { count: Number(t.count) || 0, perMinutes: Number(t.perMinutes) || 1440 };
}

module.exports = { METRICS, statusEvents, countByUser, targetOf };
