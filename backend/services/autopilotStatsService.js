// Numbers behind the Autopilot dashboard and report (web + mobile): how many posts were
// made, posted, waiting for approval, rejected, how they trend day by day, and how well the
// review loop works. One $facet aggregation over the tenant's autopilot posts.
const mongoose = require("mongoose");
const SocialPost = require("../models/SocialPost");

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const RANGES = [7, 30, 90];

// "YYYY-MM-DD" of the India calendar day a moment falls on.
const istDay = (d) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

// One row per India calendar day in the range, oldest first, zero where nothing happened.
function buildSeries({ created, posted, rejected }, days, now = new Date()) {
  const map = (rows) => Object.fromEntries((rows || []).map((r) => [r._id, r.n]));
  const c = map(created);
  const p = map(posted);
  const r = map(rejected);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = istDay(new Date(now.getTime() - i * DAY_MS));
    out.push({ date, generated: c[date] || 0, posted: p[date] || 0, rejected: r[date] || 0 });
  }
  return out;
}

// Status buckets the UI talks about. "done" = it reached the audience (fully or partly).
function totalsFrom(statusRows) {
  const n = Object.fromEntries((statusRows || []).map((r) => [r._id, r.n]));
  const sum = (...keys) => keys.reduce((a, k) => a + (n[k] || 0), 0);
  const known = ["POSTED", "PARTIALLY_POSTED", "PENDING_APPROVAL", "SCHEDULED", "APPROVED", "POSTING", "REJECTED", "FAILED"];
  const all = Object.values(n).reduce((a, b) => a + b, 0);
  return {
    generated: all,
    posted: sum("POSTED", "PARTIALLY_POSTED"),
    pending: sum("PENDING_APPROVAL"),
    scheduled: sum("SCHEDULED", "APPROVED", "POSTING"),
    rejected: sum("REJECTED"),
    failed: sum("FAILED"),
    other: all - sum(...known), // drafts (e.g. Autopilot paused)
  };
}

async function getStats(tenantId, days = 30, now = new Date()) {
  const range = RANGES.includes(days) ? days : 30;
  // Whole India days, so "last 7 days" is exactly the 7 bars shown.
  const since = new Date(now.getTime() - (range - 1) * DAY_MS);
  since.setTime(Math.floor((since.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
  const created = { createdAt: { $gte: since } };
  const byDay = (field) => [
    { $match: { [field]: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
  ];
  const revisions = { $ifNull: ["$autopilotMeta.revisions", 0] };

  const [f] = await SocialPost.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), source: "autopilot" } },
    {
      $facet: {
        status: [{ $match: created }, { $group: { _id: "$status", n: { $sum: 1 } } }],
        created: byDay("createdAt"),
        posted: byDay("postedAt"),
        rejected: byDay("rejectedAt"),
        platforms: [{ $match: created }, { $unwind: "$platforms" }, { $group: { _id: "$platforms", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
        topics: [
          { $match: { ...created, "autopilotMeta.topic": { $nin: ["", null] } } },
          { $group: { _id: "$autopilotMeta.topic", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
          { $limit: 5 },
        ],
        approval: [
          { $match: { approvedAt: { $gte: since } } },
          { $group: { _id: null, n: { $sum: 1 }, avgMs: { $avg: { $subtract: ["$approvedAt", "$createdAt"] } } } },
        ],
        revised: [
          { $match: created },
          { $group: { _id: null, total: { $sum: revisions }, posts: { $sum: { $cond: [{ $gt: [revisions, 0] }, 1, 0] } } } },
        ],
        next: [
          { $match: { status: { $in: ["SCHEDULED", "APPROVED", "PENDING_APPROVAL"] }, scheduledAt: { $gt: now } } },
          { $sort: { scheduledAt: 1 } },
          { $limit: 1 },
          { $project: { scheduledAt: 1, status: 1, caption: 1, platforms: 1 } },
        ],
      },
    },
  ]);
  const facet = f || {};

  const totals = totalsFrom(facet.status);
  const approved = facet.approval?.[0]?.n || 0;
  const decided = approved + totals.rejected;
  const rev = facet.revised?.[0] || { total: 0, posts: 0 };
  return {
    range: { days: range, since },
    totals,
    rates: {
      // share of reviewed posts the owner approved (null until anything was reviewed)
      approvalRate: decided ? Math.round((approved / decided) * 100) : null,
      avgApprovalHours: approved ? Math.round((facet.approval[0].avgMs / 3_600_000) * 10) / 10 : null,
      revisedPosts: rev.posts,
      revisions: rev.total,
    },
    series: buildSeries(facet, range, now),
    platforms: (facet.platforms || []).map((r) => ({ platform: r._id, count: r.n })),
    topics: (facet.topics || []).map((r) => ({ topic: r._id, count: r.n })),
    next: facet.next?.[0] || null,
  };
}

module.exports = { getStats, buildSeries, totalsFrom, RANGES };
