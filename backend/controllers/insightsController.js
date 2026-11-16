// Owner-facing numbers: money targets & break-even, funnel, sources, machines, lost leads, speed.
// Everything is computed from the leads already in the CRM plus Settings → salesTargets.
const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Setting = require("../models/Setting");
const { buildCategoriesWithCustom } = require("../utils/leadStatuses");

const DAY = 24 * 60 * 60 * 1000;
const tenantFilter = (req) => (req.user.tenantId ? { tenantId: req.user.tenantId } : {});

// WON date: when the lead entered WON (falls back to its last update).
function wonAtOf(l) {
  const w = (l.statusHistory || []).filter((h) => h.status === "WON").map((h) => new Date(h.timestamp).getTime());
  return w.length ? Math.max(...w) : new Date(l.updatedAt).getTime();
}
const money = (l) => Number(l.expectedValue) || 0;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

async function loadSetting(req) {
  return (await Setting.findOne({ tenantId: req.user.tenantId || null }).lean()) || {};
}

// ---------- Targets & break-even ----------
const getTargets = asyncHandler(async (req, res) => {
  const tf = tenantFilter(req);
  const setting = await loadSetting(req);
  const t = setting.salesTargets || {};
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const histStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
  const since180 = Date.now() - 180 * DAY;

  const leads = await Lead.find({ ...tf, deletedAt: null, $or: [{ createdAt: { $gte: new Date(since180) } }, { status: "WON" }, { status: { $nin: ["WON", "DROP"] } }] })
    .select("status expectedValue createdAt updatedAt statusHistory assignedTo")
    .limit(30000)
    .lean();

  // Month-by-month won value, last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { start: d.getTime(), label: d.toLocaleString("en-IN", { month: "short" }), won: 0, orders: 0 };
  });
  let wonThisMonth = 0;
  let ordersThisMonth = 0;
  let wonCount180 = 0;
  let wonValue180 = 0;
  let lostCount180 = 0;
  let created180 = 0;
  let pipelineValue = 0;
  let pipelineCount = 0;
  const daysInMonthN = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayWon = Array.from({ length: daysInMonthN }, () => 0);
  const agentWon = new Map();

  for (const l of leads) {
    if (new Date(l.createdAt).getTime() >= since180) created180++;
    if (l.status === "WON") {
      const at = wonAtOf(l);
      const m = months.findIndex((x, i) => at >= x.start && (i === 5 || at < months[i + 1].start));
      if (m >= 0 && at >= histStart) {
        months[m].won += money(l);
        months[m].orders++;
      }
      if (at >= monthStart) {
        wonThisMonth += money(l);
        ordersThisMonth++;
        dayWon[Math.min(daysInMonthN, new Date(at).getDate()) - 1] += money(l);
        const k = String(l.assignedTo || "");
        const r = agentWon.get(k) || { orders: 0, value: 0 };
        r.orders++;
        r.value += money(l);
        agentWon.set(k, r);
      }
      if (at >= since180) {
        wonCount180++;
        wonValue180 += money(l);
      }
    } else if (l.status === "DROP") {
      if (new Date(l.updatedAt).getTime() >= since180) lostCount180++;
    } else {
      pipelineCount++;
      pipelineValue += money(l);
    }
  }

  const fixedTotal = (t.fixedExpenses || []).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const margin = (Number(t.marginPct) || 0) / 100;
  const breakEven = margin > 0 ? Math.round(fixedTotal / margin) : 0;
  const target = Number(t.monthlyRevenue) || 0;
  const closeRate = wonCount180 + lostCount180 ? wonCount180 / (wonCount180 + lostCount180) : 0;
  const avgDeal = wonCount180 ? wonValue180 / wonCount180 : 0;
  const leadToWon = created180 ? wonCount180 / created180 : 0;
  const ordersNeeded = target && avgDeal ? Math.ceil(target / avgDeal) : 0;
  const leadsNeeded = ordersNeeded && leadToWon ? Math.ceil(ordersNeeded / leadToWon) : 0;
  const daysInMonth = daysInMonthN;
  // Running total of won value through this month, against a straight-line pace to the target.
  let run = 0;
  const daily = dayWon.map((v, i) => {
    run += v;
    return {
      day: i + 1,
      won: i + 1 <= now.getDate() ? run : null,
      pace: target ? Math.round((target * (i + 1)) / daysInMonth) : null,
      breakEven: breakEven || null,
    };
  });
  const names = new Map((await User.find({ ...tf }).select("name").lean()).map((u) => [String(u._id), u.name]));
  const byAgent = [...agentWon.entries()]
    .map(([id, r]) => ({ name: names.get(id) || "Unassigned", orders: r.orders, value: r.value }))
    .sort((a, b) => b.value - a.value || b.orders - a.orders);

  res.json({
    success: true,
    data: {
      settings: { monthlyRevenue: target, marginPct: Number(t.marginPct) || 0, fixedExpenses: t.fixedExpenses || [], sourceCosts: t.sourceCosts || [] },
      month: { won: wonThisMonth, orders: ordersThisMonth, daysLeft: daysInMonth - now.getDate() },
      fixedTotal,
      breakEven,
      target,
      pipeline: { value: pipelineValue, count: pipelineCount, forecast: Math.round(pipelineValue * closeRate) },
      closeRate: Math.round(closeRate * 1000) / 10,
      avgDeal: Math.round(avgDeal),
      ordersNeeded,
      leadsNeeded,
      leadToWonPct: Math.round(leadToWon * 1000) / 10,
      daily,
      byAgent,
      history: months.map((m) => ({ month: m.label, won: m.won, orders: m.orders, target })),
    },
  });
});

// ---------- Insights: funnel, sources, machines, lost, speed ----------
const getInsights = asyncHandler(async (req, res) => {
  const tf = tenantFilter(req);
  const days = [30, 90, 180, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  const since = new Date(Date.now() - days * DAY);
  const setting = await loadSetting(req);
  const cats = buildCategoriesWithCustom(setting.customLeadStatuses || [], setting.customLeadCategories || [], setting.hiddenLeadStatuses || []);
  const setOf = (name) => new Set(cats[name] || []);
  const discussion = setOf("Discussion/Requirement");
  const quotation = setOf("Quotation");
  const visit = new Set([...setOf("Visit Scheduled"), ...setOf("Visited")]);

  const leads = await Lead.find({ ...tf, deletedAt: null, createdAt: { $gte: since } })
    .select("name source status stagePath createdAt updatedAt assignedTo interestedProducts expectedValue lostReason competitor statusHistory visitScheduledDate visitActualDate")
    .limit(30000)
    .lean();

  const reached = (l, set) => (l.stagePath || []).some((s) => set.has(s)) || set.has(l.status);
  const flags = (l) => {
    const contacted = l.status !== "PENDING CONTACT";
    const disc = reached(l, discussion) || (l.stagePath || []).some((s) => discussion.has(s));
    const vis = reached(l, visit) || !!l.visitScheduledDate || !!l.visitActualDate;
    const quo = reached(l, quotation) || (l.stagePath || []).some((s) => /QUOTATION/i.test(s));
    const won = l.status === "WON";
    return { contacted: contacted || disc || vis || quo || won, disc, vis, quo, won };
  };

  const funnel = { leads: leads.length, contacted: 0, discussion: 0, visit: 0, quotation: 0, won: 0 };
  const bySource = new Map();
  const byMachine = new Map();
  const lostReasons = new Map();
  const competitors = new Map();
  let lostCount = 0;
  let lostValue = 0;
  const bump = (map, key, fn) => {
    if (!map.has(key)) map.set(key, { name: key, leads: 0, quotations: 0, won: 0, wonValue: 0 });
    fn(map.get(key));
  };

  for (const l of leads) {
    const f = flags(l);
    if (f.contacted) funnel.contacted++;
    if (f.disc) funnel.discussion++;
    if (f.vis) funnel.visit++;
    if (f.quo) funnel.quotation++;
    if (f.won) funnel.won++;
    bump(bySource, l.source || "Unknown", (r) => {
      r.leads++;
      if (f.quo) r.quotations++;
      if (f.won) {
        r.won++;
        r.wonValue += money(l);
      }
    });
    for (const m of l.interestedProducts?.length ? l.interestedProducts : ["Not specified"]) {
      bump(byMachine, m, (r) => {
        r.leads++;
        if (f.quo) r.quotations++;
        if (f.won) {
          r.won++;
          r.wonValue += money(l);
        }
      });
    }
    if (l.status === "DROP") {
      lostCount++;
      lostValue += money(l);
      const reason = l.lostReason || "No reason recorded";
      lostReasons.set(reason, (lostReasons.get(reason) || 0) + 1);
      if (l.competitor) competitors.set(l.competitor, (competitors.get(l.competitor) || 0) + 1);
    }
  }

  const costOf = new Map((setting.salesTargets?.sourceCosts || []).map((c) => [c.source, Number(c.amount) || 0]));
  const sources = [...bySource.values()]
    .map((r) => {
      const spend = Math.round(((costOf.get(r.name) || 0) * days) / 30);
      return {
        ...r,
        convPct: pct(r.won, r.leads),
        spend,
        costPerLead: r.leads && spend ? Math.round(spend / r.leads) : 0,
        costPerOrder: r.won && spend ? Math.round(spend / r.won) : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);
  const machines = [...byMachine.values()].map((r) => ({ ...r, convPct: pct(r.won, r.leads) })).sort((a, b) => b.leads - a.leads).slice(0, 15);

  // Speed: lead created → first status change away from PENDING CONTACT.
  const agentName = new Map((await User.find({ ...tf }).select("name").lean()).map((u) => [String(u._id), u.name]));
  const mins = [];
  const perAgent = new Map();
  const dayMap = new Map();
  for (const l of leads) {
    const first = (l.statusHistory || [])
      .filter((h) => h.status !== "PENDING CONTACT")
      .map((h) => new Date(h.timestamp).getTime())
      .sort((a, b) => a - b)[0];
    const cd = new Date(l.createdAt);
    const dk = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
    if (!dayMap.has(dk)) dayMap.set(dk, { mins: [], total: 0, ontime: 0 });
    const day = dayMap.get(dk);
    // Every lead counts toward the day; unworked leads older than 1h count as a miss.
    day.total++;
    if (!first) continue;
    const m = Math.max(0, Math.round((first - new Date(l.createdAt).getTime()) / 60000));
    mins.push(m);
    day.mins.push(m);
    if (m <= 60) day.ontime++;
    const k = String(l.assignedTo || "");
    if (!perAgent.has(k)) perAgent.set(k, []);
    perAgent.get(k).push(m);
  }
  const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const bucketDefs = [
    ["Under 15 min", 0, 15],
    ["15–60 min", 15, 60],
    ["1–4 hours", 60, 240],
    ["4–24 hours", 240, 1440],
    ["Over 1 day", 1440, Infinity],
  ];
  const response = {
    buckets: bucketDefs.map(([name, lo, hi]) => ({ name, count: mins.filter((m) => m >= lo && m < hi).length })),
    worked: mins.length,
    total: leads.length,
    avgMinutes: avg(mins),
    medianMinutes: median(mins),
    within1hPct: pct(mins.filter((m) => m <= 60).length, mins.length),
    daily: [...dayMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, d]) => ({
        label: new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        leads: d.total,
        worked: d.mins.length,
        within1hPct: pct(d.ontime, d.total),
        avgMinutes: avg(d.mins),
        medianMinutes: median(d.mins),
      })),
    perAgent: [...perAgent.entries()]
      .map(([id, a]) => ({ name: agentName.get(id) || "Unassigned", leads: a.length, avgMinutes: avg(a), medianMinutes: median(a), within1hPct: pct(a.filter((x) => x <= 60).length, a.length) }))
      .sort((a, b) => b.within1hPct - a.within1hPct),
  };

  // Win rate per salesperson (leads created in the period) and sales cycle (created → WON).
  const byAgent = new Map();
  const cycleDays = [];
  const stageTime = new Map();
  for (const l of leads) {
    const k = String(l.assignedTo || "");
    if (!byAgent.has(k)) byAgent.set(k, { leads: 0, won: 0, lost: 0, wonValue: 0, open: 0 });
    const a = byAgent.get(k);
    a.leads++;
    if (l.status === "WON") {
      a.won++;
      a.wonValue += money(l);
      cycleDays.push(Math.max(0, (wonAtOf(l) - new Date(l.createdAt).getTime()) / DAY));
    } else if (l.status === "DROP") a.lost++;
    else a.open++;

    // Time spent in each stage before moving on (completed stages only).
    const hist = [...(l.statusHistory || [])].sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
    for (let i = 0; i < hist.length - 1; i++) {
      const d = (new Date(hist[i + 1].timestamp) - new Date(hist[i].timestamp)) / DAY;
      const s = stageTime.get(hist[i].status) || { name: hist[i].status, total: 0, n: 0 };
      s.total += Math.max(0, d);
      s.n++;
      stageTime.set(hist[i].status, s);
    }
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  const medianF = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  const team = {
    perAgent: [...byAgent.entries()]
      .map(([id, a]) => ({
        name: agentName.get(id) || "Unassigned",
        ...a,
        winRate: pct(a.won, a.leads),
        closeRate: pct(a.won, a.won + a.lost),
      }))
      .sort((a, b) => b.won - a.won || b.leads - a.leads),
  };
  const cycle = {
    won: cycleDays.length,
    avgDays: cycleDays.length ? r1(cycleDays.reduce((x, y) => x + y, 0) / cycleDays.length) : 0,
    medianDays: r1(medianF(cycleDays)),
    stages: [...stageTime.values()]
      .map((s) => ({ name: s.name, avgDays: r1(s.total / s.n), samples: s.n }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 10),
  };

  // Leads created per week (month for a year view) and how many of them are won.
  const monthly = days > 90;
  const keyOf = (t) => {
    const d = new Date(t);
    if (monthly) return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const day = (d.getDay() + 6) % 7; // Monday start
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
  };
  const trendMap = new Map();
  for (const l of leads) {
    const k = keyOf(l.createdAt);
    if (!trendMap.has(k)) trendMap.set(k, { t: k, leads: 0, won: 0 });
    const r = trendMap.get(k);
    r.leads++;
    if (l.status === "WON") r.won++;
  }
  const trend = [...trendMap.values()]
    .sort((a, b) => a.t - b.t)
    .map((r) => ({
      label: new Date(r.t).toLocaleDateString("en-IN", monthly ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" }),
      leads: r.leads,
      won: r.won,
    }));

  // Stuck: open leads with no status change for 7+ days (any age, not just the period).
  const stuckDays = 7;
  const open = await Lead.find({ ...tf, deletedAt: null, status: { $nin: ["WON", "DROP"] } })
    .select("name status assignedTo createdAt updatedAt statusHistory expectedValue")
    .limit(30000)
    .lean();
  const stuck = open
    .map((l) => {
      const last = Math.max(new Date(l.createdAt).getTime(), ...(l.statusHistory || []).map((h) => new Date(h.timestamp).getTime()));
      return { _id: l._id, name: l.name, status: l.status, owner: agentName.get(String(l.assignedTo)) || "Unassigned", value: money(l), days: Math.floor((Date.now() - last) / DAY) };
    })
    .filter((l) => l.days >= stuckDays)
    .sort((a, b) => b.days - a.days);

  const catOf = new Map();
  for (const [cat, vals] of Object.entries(cats)) for (const v of vals) catOf.set(v, cat);
  const stageMap = new Map();
  for (const l of open) {
    const cat = catOf.get(l.status) || "Other";
    if (!stageMap.has(cat)) stageMap.set(cat, { name: cat, count: 0, value: 0 });
    const r = stageMap.get(cat);
    r.count++;
    r.value += money(l);
  }
  const pipelineByStage = Object.keys(cats)
    .map((c) => stageMap.get(c))
    .filter(Boolean)
    .concat(stageMap.has("Other") ? [stageMap.get("Other")] : []);
  const stuckByOwner = new Map();
  for (const l of stuck) stuckByOwner.set(l.owner, (stuckByOwner.get(l.owner) || 0) + 1);

  const sortMap = (m) => [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  res.json({
    success: true,
    data: {
      days,
      funnel,
      sources,
      machines,
      lost: { count: lostCount, value: lostValue, reasons: sortMap(lostReasons), competitors: sortMap(competitors).slice(0, 10) },
      response,
      team,
      cycle,
      trend,
      pipelineByStage,
      stuck: {
        days: stuckDays,
        count: stuck.length,
        items: stuck.slice(0, 25),
        byOwner: [...stuckByOwner.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      },
    },
  });
});

module.exports = { getTargets, getInsights };
