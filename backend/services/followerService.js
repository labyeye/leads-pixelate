const SocialAccount = require("../models/SocialAccount");
const FollowerSnapshot = require("../models/FollowerSnapshot");

const GRAPH = "https://graph.facebook.com/v18.0";
const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

async function graph(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`,
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Request to ${path} failed`);
  }
  return data;
}

async function currentFollowers(account) {
  if (account.platform === "facebook") {
    const d = await graph(
      `${account.accountId}?fields=followers_count,fan_count`,
      account.accessToken,
    );
    return d.followers_count ?? d.fan_count ?? null;
  }
  const igId = account.instagramBusinessAccountId || account.accountId;
  const d = await graph(`${igId}?fields=followers_count`, account.accessToken);
  return d.followers_count ?? null;
}

// Best effort: page_fans gives the daily total for Facebook pages (≤93 days per call).
async function backfillFacebook(account) {
  try {
    const until = Math.floor(Date.now() / 1000);
    for (let chunk = 0; chunk < 2; chunk++) {
      const end = until - chunk * 90 * 86400;
      const start = end - 90 * 86400;
      const d = await graph(
        `${account.accountId}/insights?metric=page_fans&period=day&since=${start}&until=${end}`,
        account.accessToken,
      );
      const values = d?.data?.[0]?.values || [];
      const ops = values
        .filter((v) => typeof v.value === "number")
        .map((v) => ({
          updateOne: {
            filter: { accountId: account._id, date: dayKey(v.end_time) },
            update: {
              $setOnInsert: {
                accountId: account._id,
                platform: "facebook",
                date: dayKey(v.end_time),
                followers: v.value,
                tenantId: account.tenantId || null,
              },
            },
            upsert: true,
          },
        }));
      if (ops.length) await FollowerSnapshot.bulkWrite(ops, { ordered: false });
    }
  } catch {
    /* metric unavailable — history just starts from today's snapshot */
  }
}

async function snapshotAccount(account) {
  try {
    const followers = await currentFollowers(account);
    if (typeof followers !== "number") return;
    const first = !(await FollowerSnapshot.exists({ accountId: account._id }));
    const date = dayKey(Date.now());
    await FollowerSnapshot.updateOne(
      { accountId: account._id, date },
      {
        $set: { followers },
        $setOnInsert: {
          accountId: account._id,
          platform: account.platform,
          date,
          tenantId: account.tenantId || null,
        },
      },
      { upsert: true },
    );
    if (first && account.platform === "facebook") await backfillFacebook(account);
  } catch {
    /* expired token etc. — skip this account until next run */
  }
}

async function snapshotAll(filter = {}) {
  const accounts = await SocialAccount.find({
    ...filter,
    isActive: true,
    platform: { $in: ["facebook", "instagram"] },
  });
  await Promise.allSettled(accounts.map(snapshotAccount));
}

/**
 * Daily follower series for a tenant (all connected accounts combined).
 * Returns total followers per day and the net new followers vs the day before.
 */
async function getFollowerSeries(tenantFilter, days) {
  await snapshotAll(tenantFilter);
  const from = dayKey(Date.now() - days * DAY);
  const rows = await FollowerSnapshot.find({
    ...tenantFilter,
    date: { $gte: dayKey(Date.now() - (days + 1) * DAY) },
  }).sort({ date: 1 });

  // Per account carry the last known total forward so gaps don't read as drops.
  const byAccount = {};
  for (const r of rows) (byAccount[r.accountId] ||= {})[r.date] = r.followers;
  const series = [];
  const last = {};
  for (let i = days; i >= 0; i--) {
    const date = dayKey(Date.now() - i * DAY);
    let total = 0;
    let known = false;
    for (const id of Object.keys(byAccount)) {
      if (byAccount[id][date] !== undefined) last[id] = byAccount[id][date];
      if (last[id] !== undefined) {
        total += last[id];
        known = true;
      }
    }
    series.push({ date, total: known ? total : null });
  }
  const points = series.map((p, i) => ({
    date: p.date,
    total: p.total,
    gained:
      p.total !== null && i > 0 && series[i - 1].total !== null
        ? p.total - series[i - 1].total
        : 0,
  }));
  const withData = points.filter((p) => p.total !== null);
  return {
    from,
    current: withData.length ? withData[withData.length - 1].total : 0,
    gainedInRange: points.reduce((a, p) => a + p.gained, 0),
    points: points.slice(1),
  };
}

module.exports = { snapshotAll, getFollowerSeries };
