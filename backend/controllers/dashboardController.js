const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const User = require("../models/User");
const CallLog = require("../models/CallLog");
const ActivityLog = require("../models/ActivityLog");
const { METRICS, AI_USER_ID, AI_NAME, statusEvents, countByUser, targetOf } = require("../utils/performanceMetrics");
const AICallSettings = require("../models/AICallSettings");
const Setting = require("../models/Setting");
const Quotation = require("../models/Quotation");

const CLOSED_STATUSES = ["WON", "DROP"];

const getDashboardStats = asyncHandler(async (req, res) => {
  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);

  // Stages the tenant tagged as hot / lost in Settings → Lead Statuses.
  const pipelineSetting = await Setting.findOne({ tenantId: req.user.tenantId || null })
    .select("customLeadStatuses")
    .lean();
  const customOf = (role) =>
    (pipelineSetting?.customLeadStatuses || []).filter((c) => c.role === role).map((c) => c.value);
  const closedStatuses = [...CLOSED_STATUSES, ...customOf("lost")];
  const HOT_STATUSES = [
    ...customOf("hot"),
    "DISCUSSION",
    "DISCUSSION 1",
    "DISCUSSION 2",
    "DISCUSSION 3",
    "QUOTATION",
    "QUOTATION 1",
    "QUOTATION 2",
    "QUOTATION 3",
    "VISIT SCHEDULED",
    "VISITED",
  ];

  const [
    totalLeads,
    newLeadsToday,
    newLeadsThisWeek,
    leadsThisMonth,
    leadsLastMonth,
    convertedClients,
    totalUsers,
    statusCounts,
    sourceCounts,
    hotLeadsCount,
    todayFollowUpLeads,
    overdueFollowUpsCount,
    uncontactedLeadsCount,
    userPerformanceData,
  ] = await Promise.all([
    Lead.countDocuments({ ...tf }),
    Lead.countDocuments({
      ...tf,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }),
    Lead.countDocuments({ ...tf, createdAt: { $gte: startOfWeek } }),
    Lead.countDocuments({ ...tf, createdAt: { $gte: startOfMonth } }),
    Lead.countDocuments({
      ...tf,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }),
    Lead.countDocuments({ ...tf, status: "WON" }),
    User.countDocuments({ ...tf, status: "active" }),
    Lead.aggregate([
      { $match: { ...tf } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: { ...tf } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]),

    Lead.countDocuments({ ...tf, status: { $in: HOT_STATUSES } }),

    Lead.find({
      ...tf,
      followUpDate: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: closedStatuses },
    })
      .select("name company phone status assignedTo followUpDate")
      .populate("assignedTo", "name")
      .limit(10)
      .lean(),

    Lead.countDocuments({
      ...tf,
      followUpDate: { $lt: todayStart },
      status: { $nin: closedStatuses },
    }),

    Lead.countDocuments({
      ...tf,
      status: "PENDING CONTACT",
      createdAt: { $lt: twoDaysAgo },
    }),

    User.aggregate([
      { $match: { ...tf, status: "active" } },
      {
        $lookup: {
          from: "leads",
          localField: "_id",
          foreignField: "assignedTo",
          as: "myLeads",
        },
      },
      {
        $project: {
          name: 1,
          role: 1,
          avatar: 1,
          leadsCount: { $size: "$myLeads" },
          conversions: {
            $size: {
              $filter: {
                input: "$myLeads",
                as: "lead",
                cond: { $eq: ["$$lead.status", "WON"] },
              },
            },
          },
        },
      },
      { $match: { leadsCount: { $gt: 0 } } },
      { $sort: { conversions: -1, leadsCount: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const leadGrowth =
    leadsLastMonth > 0
      ? Math.round(((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100)
      : 0;

  const monthBoundaries = Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - i) + 1,
      0,
    );
    const monthName = monthStart.toLocaleString("default", { month: "short" });
    return { monthStart, monthEnd, monthName };
  });

  const chartResults = await Promise.all(
    monthBoundaries.map(({ monthStart, monthEnd }) =>
      Promise.all([
        Lead.countDocuments({
          ...tf,
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
        Lead.countDocuments({
          ...tf,
          status: "WON",
          updatedAt: { $gte: monthStart, $lte: monthEnd },
        }),
        // Worked: leads created this month that have moved past PENDING CONTACT.
        Lead.countDocuments({
          ...tf,
          status: { $ne: "PENDING CONTACT" },
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
      ]),
    ),
  );

  const leadsChartData = chartResults.map(([leads, converted, contacted], i) => ({
    month: monthBoundaries[i].monthName,
    leads,
    converted,
    contacted,
    pending: Math.max(leads - contacted, 0),
    contactedRate: leads > 0 ? Math.round((contacted / leads) * 100) : 0,
    conversionRate: leads > 0 ? Math.round((converted / leads) * 100) : 0,
  }));

  const statusCountsMap = statusCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const sourceCountsMap = sourceCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const funnelStages = [
    {
      label: "New",
      count: statusCountsMap["PENDING CONTACT"] || 0,
      color: "#FFD60A",
    },
    {
      label: "Contacted",
      count:
        (statusCountsMap["1"] || 0) +
        (statusCountsMap["2"] || 0) +
        (statusCountsMap["3"] || 0) +
        (statusCountsMap["COMPLETED"] || 0),
      color: "#3B82F6",
    },
    {
      label: "Discussion",
      count:
        (statusCountsMap["DISCUSSION"] || 0) +
        (statusCountsMap["DISCUSSION 1"] || 0) +
        (statusCountsMap["DISCUSSION 2"] || 0) +
        (statusCountsMap["DISCUSSION 3"] || 0) +
        (statusCountsMap["DISCUSSION COMPLETED"] || 0),
      color: "#A855F7",
    },
    {
      label: "Quotation",
      count:
        (statusCountsMap["QUOTATION"] || 0) +
        (statusCountsMap["QUOTATION 1"] || 0) +
        (statusCountsMap["QUOTATION 2"] || 0) +
        (statusCountsMap["QUOTATION 3"] || 0) +
        (statusCountsMap["QUOTATION COMPLETED"] || 0),
      color: "#FB923C",
    },
    {
      label: "Visit",
      count:
        (statusCountsMap["VISIT SCHEDULED"] || 0) +
        (statusCountsMap["VISITED"] || 0),
      color: "#00C48C",
    },
    {
      label: "Won",
      count: statusCountsMap["WON"] || 0,
      color: "#A3E635",
    },
  ];

  const sourceData = Object.entries(sourceCountsMap).map(([name, value]) => ({
    name,
    value,
  }));

  const recentLeads = await Lead.find({ ...tf })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("name company phone status source createdAt assignedTo")
    .populate("assignedTo", "name")
    .lean();

  // Clients won per agent per month (last 6 months), top 5 agents by total, for the line graph.
  const wonRows = await Lead.find({
    ...tf,
    status: "WON",
    assignedTo: { $ne: null },
    updatedAt: { $gte: monthBoundaries[0].monthStart },
  })
    .select("assignedTo updatedAt")
    .lean();
  const startIdx = monthBoundaries[0].monthStart.getFullYear() * 12 + monthBoundaries[0].monthStart.getMonth();
  const perAgent = new Map(); // userId -> number[6]
  for (const l of wonRows) {
    const d = new Date(l.updatedAt);
    const i = d.getFullYear() * 12 + d.getMonth() - startIdx;
    if (i < 0 || i > 5) continue;
    const k = String(l.assignedTo);
    if (!perAgent.has(k)) perAgent.set(k, [0, 0, 0, 0, 0, 0]);
    perAgent.get(k)[i]++;
  }
  const topIds = [...perAgent.entries()]
    .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
    .slice(0, 5);
  const agentUsers = topIds.length ? await User.find({ _id: { $in: topIds.map(([id]) => id) } }).select("name").lean() : [];
  const nameOf = new Map(agentUsers.map((u) => [String(u._id), u.name]));
  const trendAgents = topIds.map(([id]) => nameOf.get(id) || "Former user");
  const performerTrend = {
    agents: trendAgents,
    data: monthBoundaries.map((m, i) => ({
      month: m.monthName,
      ...Object.fromEntries(topIds.map(([, arr], j) => [trendAgents[j], arr[i]])),
    })),
  };

  // This month's leads per salesperson: assigned vs worked (moved past PENDING CONTACT).
  const agentRows = await Lead.aggregate([
    { $match: { ...tf, assignedTo: { $ne: null }, createdAt: { $gte: startOfMonth } } },
    {
      $group: {
        _id: "$assignedTo",
        assigned: { $sum: 1 },
        worked: { $sum: { $cond: [{ $ne: ["$status", "PENDING CONTACT"] }, 1, 0] } },
      },
    },
    { $sort: { assigned: -1 } },
    { $limit: 15 },
  ]);
  const agentMonthUsers = agentRows.length
    ? await User.find({ _id: { $in: agentRows.map((r) => r._id) } }).select("name").lean()
    : [];
  const agentMonthName = new Map(agentMonthUsers.map((u) => [String(u._id), u.name]));
  const agentMonthly = agentRows.map((r) => ({
    name: agentMonthName.get(String(r._id)) || "Former user",
    assigned: r.assigned,
    worked: r.worked,
    pending: r.assigned - r.worked,
    pct: r.assigned ? Math.round((r.worked / r.assigned) * 100) : 0,
  }));

  // Leads per day per source for the last 30 days (line graph). Days with no leads are filled with 0.
  const DAILY_DAYS = 30;
  const dailyStart = new Date(todayStart);
  dailyStart.setDate(dailyStart.getDate() - (DAILY_DAYS - 1));
  const dailyRows = await Lead.aggregate([
    { $match: { ...tf, createdAt: { $gte: dailyStart } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          source: { $ifNull: ["$source", "Other"] },
        },
        n: { $sum: 1 },
      },
    },
  ]);
  const dailySourceNames = [...new Set(dailyRows.map((r) => r._id.source))];
  const dailyMap = new Map(dailyRows.map((r) => [`${r._id.day}|${r._id.source}`, r.n]));
  const pad = (n) => String(n).padStart(2, "0");
  const dailySources = {
    sources: dailySourceNames,
    data: Array.from({ length: DAILY_DAYS }, (_, i) => {
      const d = new Date(dailyStart);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const row = { day: d.toLocaleString("en-IN", { day: "numeric", month: "short" }), total: 0 };
      for (const s of dailySourceNames) {
        row[s] = dailyMap.get(`${key}|${s}`) || 0;
        row.total += row[s];
      }
      return row;
    }),
  };

  // Per agent, this month: leads assigned vs leads worked (moved past PENDING CONTACT).
  const workloadRows = await Lead.aggregate([
    { $match: { ...tf, deletedAt: null, assignedTo: { $ne: null }, createdAt: { $gte: startOfMonth } } },
    {
      $group: {
        _id: "$assignedTo",
        assigned: { $sum: 1 },
        worked: { $sum: { $cond: [{ $ne: ["$status", "PENDING CONTACT"] }, 1, 0] } },
      },
    },
  ]);
  const workloadUsers = workloadRows.length
    ? await User.find({ _id: { $in: workloadRows.map((r) => r._id) } }).select("name").lean()
    : [];
  const wlName = new Map(workloadUsers.map((u) => [String(u._id), u.name]));
  const agentWorkload = workloadRows
    .map((r) => ({
      name: wlName.get(String(r._id)) || "Former user",
      assigned: r.assigned,
      worked: r.worked,
      pending: r.assigned - r.worked,
      rate: r.assigned ? Math.round((r.worked / r.assigned) * 100) : 0,
    }))
    .sort((a, b) => b.assigned - a.assigned);

  const recentQuotations = await Quotation.find({ ...tf })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("number clientName companyName projectTitle total status createdAt createdBy")
    .populate("createdBy", "name")
    .lean();

  res.json({
    success: true,
    data: {
      recentLeads,
      recentQuotations,
      performerTrend,
      dailySources,
      agentMonthly,
      stats: {
        totalLeads,
        newLeadsToday,
        newLeadsThisWeek,
        leadsThisMonth,
        convertedClients,
        totalUsers,
        leadGrowth,
        hotLeads: hotLeadsCount,
        overdueFollowUps: overdueFollowUpsCount,
        uncontactedLeads: uncontactedLeadsCount,
      },
      todayFollowUps: todayFollowUpLeads,
      userPerformance: userPerformanceData,
      funnelStages,
      sourceData,
      statusCounts: statusCountsMap,
      sourceCounts: sourceCountsMap,
      leadsChartData,
    },
  });
});

const LIVE_WINDOWS = [60, 240, 480, 1440, 10080]; // minutes
const LIVE_BUCKETS = { 60: 12, 240: 16, 480: 16, 1440: 24, 10080: 14 };

// Admin "Live Performance" feed: calls per agent in a rolling window, the trend, newest leads,
// and the pipeline snapshot. Targets are returned raw; the page works out green/amber/red.
const getLiveStats = asyncHandler(async (req, res) => {
  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const asked = parseInt(req.query.window, 10);
  const windowMin = LIVE_WINDOWS.includes(asked) ? asked : 60;
  const now = new Date();
  const since = new Date(now.getTime() - windowMin * 60000);
  const buckets = LIVE_BUCKETS[windowMin];
  const bucketMs = (windowMin * 60000) / buckets;
  const bucketOf = (field) => ({
    $floor: { $divide: [{ $subtract: [field, since] }, bucketMs] },
  });
  // Calls the AI agent spoke on (auto-dialled, or started by someone with the "AI call" button).
  const AI_CALL_TYPES = ["automated_ai", "manual_in_app"];
  const humanCalls = { ...tf, initiatedBy: { $ne: null }, callType: { $nin: AI_CALL_TYPES }, createdAt: { $gte: since } };
  const connectedSum = {
    $sum: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $gt: ["$durationSeconds", 0] }] }, 1, 0] },
  };

  const [setting, agents, callsByAgent, callTrend, leadTrend, events, leadActivity, recentLeads, aiCallRows, statusRows, aiSettings] =
    await Promise.all([
      Setting.findOne({ tenantId: req.user.tenantId || null }).select("callTargets").lean(),
      User.find({ ...tf, status: "active", role: { $in: ["admin", "super_admin", "sales_executive"] } })
        .select("name role avatar")
        .lean(),
      CallLog.aggregate([
        { $match: humanCalls },
        {
          $group: {
            _id: "$initiatedBy",
            calls: { $sum: 1 },
            connected: connectedSum,
            talkSeconds: { $sum: "$durationSeconds" },
            lastCallAt: { $max: "$createdAt" },
          },
        },
      ]),
      CallLog.aggregate([
        { $match: humanCalls },
        { $group: { _id: bucketOf("$createdAt"), n: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { ...tf, createdAt: { $gte: since } } },
        { $group: { _id: bucketOf("$createdAt"), n: { $sum: 1 } } },
      ]),
      statusEvents(tf, since),
      ActivityLog.find({
        ...tf,
        module: "Lead",
        action: { $in: ["UPDATE", "STATUS_UPDATED", "NOTE_ADDED", "LEAD_CONVERTED"] },
        timestamp: { $gte: since },
      })
        .sort({ timestamp: -1 })
        .limit(2000)
        .lean(),
      Lead.find({ ...tf })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("name company source status phone assignedTo createdAt")
        .populate("assignedTo", "name")
        .lean(),
      CallLog.aggregate([
        { $match: { ...tf, callType: { $in: AI_CALL_TYPES }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            calls: { $sum: 1 },
            connected: connectedSum,
            talkSeconds: { $sum: "$durationSeconds" },
            lastCallAt: { $max: "$createdAt" },
          },
        },
      ]),
      Lead.aggregate([{ $match: { ...tf } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      AICallSettings.findOne(tf).select("enabled").lean(),
    ]);
  const ai = aiCallRows[0] || { calls: 0, connected: 0, talkSeconds: 0, lastCallAt: null };
  const aiCalls = ai.calls;

  const callMap = new Map(callsByAgent.map((r) => [String(r._id), r]));
  const pendingLeadIds = new Set(
    events.filter((e) => e.from === "PENDING CONTACT" && e.to !== "PENDING CONTACT").map((e) => String(e.leadId)),
  );
  const perUser = countByUser(events);
  // Everything else a person does to a lead (notes, remarks, follow-ups, edits) comes from the activity log.
  const changeMap = new Map();
  for (const a of leadActivity) {
    const who = a.user ? String(a.user) : a.userName === AI_NAME ? AI_USER_ID : "";
    if (who) changeMap.set(who, (changeMap.get(who) || 0) + 1);
  }
  const countBy = setting?.callTargets?.countBy === "calls" ? "calls" : "updates";
  const updates = leadActivity.map((a) => ({
    leadId: a.targetId,
    action: a.action,
    description: a.description || "",
    by: a.userName || "System",
    at: a.timestamp,
  }));
  const knownIds = new Set(agents.map((a) => String(a._id)));
  // Someone with calls in the window who is no longer in the list (role changed) still counts.
  const extra = callsByAgent.filter((r) => !knownIds.has(String(r._id))).map((r) => r._id);
  const extraUsers = extra.length ? await User.find({ _id: { $in: extra } }).select("name role avatar").lean() : [];

  const team = [...agents, ...extraUsers]
    .map((u) => {
      const c = callMap.get(String(u._id)) || {};
      const m = perUser.get(String(u._id)) || { calls: 0, conversations: 0, quotations: 0, visits: 0 };
      return {
        _id: u._id,
        name: u.name,
        avatar: u.avatar,
        role: u.role,
        calls: c.calls || 0,
        statusUpdates: m.calls,
        done: countBy === "calls" ? c.calls || 0 : m.calls,
        conversations: m.conversations,
        quotations: m.quotations,
        visits: m.visits,
        connected: c.connected || 0,
        talkSeconds: c.talkSeconds || 0,
        lastCallAt: c.lastCallAt || null,
        statusChanges: changeMap.get(String(u._id)) || 0,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  // The AI calling agent sits in the table as one more team member once it is switched on or has worked.
  const aiWork = perUser.get(AI_USER_ID);
  if (aiSettings?.enabled || ai.calls || aiWork) {
    const m = aiWork || { calls: 0, conversations: 0, quotations: 0, visits: 0 };
    team.push({
      _id: AI_USER_ID,
      name: AI_NAME,
      role: "ai_agent",
      isAI: true,
      calls: ai.calls,
      statusUpdates: m.calls,
      done: countBy === "calls" ? ai.calls : m.calls,
      conversations: m.conversations,
      quotations: m.quotations,
      visits: m.visits,
      connected: ai.connected,
      talkSeconds: ai.talkSeconds,
      lastCallAt: ai.lastCallAt,
      statusChanges: changeMap.get(AI_USER_ID) || 0,
    });
  }

  const series = (rows) => {
    const byIdx = new Map(rows.map((r) => [r._id, r.n]));
    return Array.from({ length: buckets }, (_, i) => ({
      t: new Date(since.getTime() + i * bucketMs).toISOString(),
      n: byIdx.get(i) || 0,
    }));
  };
  const statusTrend = new Map();
  for (const e of events) {
    const i = Math.floor((new Date(e.at) - since) / bucketMs);
    statusTrend.set(i, (statusTrend.get(i) || 0) + 1);
  }
  const callSeries = countBy === "calls" ? series(callTrend) : series([...statusTrend].map(([_id, n]) => ({ _id, n })));
  const leadSeries = series(leadTrend);

  res.json({
    success: true,
    data: {
      now,
      since,
      windowMin,
      targets: {
        calls: setting?.callTargets?.calls ?? 20,
        perMinutes: setting?.callTargets?.perMinutes ?? 60,
        amberPct: setting?.callTargets?.amberPct ?? 60,
        countBy,
        conversations: targetOf(setting?.callTargets, "conversations"),
        quotations: targetOf(setting?.callTargets, "quotations"),
        visits: targetOf(setting?.callTargets, "visits"),
      },
      totals: {
        calls: team.reduce((a, t) => a + t.calls, 0),
        done: team.reduce((a, t) => a + t.done, 0),
        conversations: team.reduce((a, t) => a + t.conversations, 0),
        quotations: team.reduce((a, t) => a + t.quotations, 0),
        visits: team.reduce((a, t) => a + t.visits, 0),
        connected: team.reduce((a, t) => a + t.connected, 0),
        talkSeconds: team.reduce((a, t) => a + t.talkSeconds, 0),
        newLeads: leadSeries.reduce((a, p) => a + p.n, 0),
        statusChanges: updates.length,
        pendingWorked: pendingLeadIds.size,
        pendingNow: statusRows.find((r) => r._id === "PENDING CONTACT")?.n || 0,
        aiCalls,
      },
      team,
      trend: callSeries.map((p, i) => ({ t: p.t, calls: p.n, leads: leadSeries[i].n })),
      recentLeads,
      updates: updates.slice(0, 40),
      statusCounts: Object.fromEntries(statusRows.map((r) => [r._id, r.n])),
    },
  });
});

// The signed-in person's own pace against each target, for the header badge. Every metric is judged
// over its own period (e.g. calls over the last 60 min, visits over the last 24 h).
const getMyPace = asyncHandler(async (req, res) => {
  const setting = await Setting.findOne({ tenantId: req.user.tenantId || null })
    .select("callTargets")
    .lean();
  const ct = setting?.callTargets;
  if (!ct?.calls) return res.json({ success: true, data: { configured: false } });

  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const amber = ct.amberPct || 60;
  const countBy = ct.countBy === "calls" ? "calls" : "updates";
  const targets = METRICS.map((m) => ({ ...m, ...targetOf(ct, m.key) })).filter((m) => m.count > 0);
  const longest = Math.max(...targets.map((m) => m.perMinutes));
  const events = await statusEvents(tf, new Date(Date.now() - longest * 60000), req.user._id);

  const metrics = [];
  for (const m of targets) {
    const since = new Date(Date.now() - m.perMinutes * 60000);
    let done;
    if (m.key === "calls" && countBy === "calls") {
      done = await CallLog.countDocuments({ initiatedBy: req.user._id, createdAt: { $gte: since } });
    } else {
      const flag = { calls: null, conversations: "conversation", quotations: "quotation", visits: "visit" }[m.key];
      done = events.filter((e) => new Date(e.at) >= since && (!flag || e[flag])).length;
    }
    const pct = (done / m.count) * 100;
    metrics.push({
      key: m.key,
      label: m.label,
      done,
      target: m.count,
      perMinutes: m.perMinutes,
      pct: Math.round(pct),
      tone: pct >= 100 ? "green" : pct >= amber ? "amber" : "red",
    });
  }
  const rank = { red: 0, amber: 1, green: 2 };
  const worst = metrics.reduce((w, m) => (rank[m.tone] < rank[w.tone] ? m : w), metrics[0]);
  res.json({
    success: true,
    data: { configured: metrics.length > 0, metrics, tone: worst?.tone },
  });
});

module.exports = { getDashboardStats, getLiveStats, getMyPace };
