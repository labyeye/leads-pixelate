const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const User = require("../models/User");

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

  const HOT_STATUSES = [
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
    newLeadsToday,
    newLeadsThisWeek,
    leadsThisMonth,
    leadsLastMonth,
    totalUsers,
    statusCounts,
    sourceCounts,
    hotLeadsCount,
    todayFollowUpLeads,
    overdueFollowUpsCount,
    uncontactedLeadsCount,
    userPerformanceData,
  ] = await Promise.all([
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
      status: { $nin: CLOSED_STATUSES },
    })
      .select("name company phone status assignedTo followUpDate")
      .populate("assignedTo", "name")
      .limit(10)
      .lean(),

    Lead.countDocuments({
      ...tf,
      followUpDate: { $lt: todayStart },
      status: { $nin: CLOSED_STATUSES },
    }),

    Lead.countDocuments({
      ...tf,
      status: "PENDING CONTACT",
      createdAt: { $lt: twoDaysAgo },
    }),

    Lead.aggregate([
      { $match: { ...tf, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: "$assignedTo",
          leadsCount: { $sum: 1 },
          conversions: { $sum: { $cond: [{ $eq: ["$status", "WON"] }, 1, 0] } },
        },
      },
      { $sort: { conversions: -1, leadsCount: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.status": "active" } },
      { $limit: 5 },
      {
        $project: {
          name: "$user.name",
          role: "$user.role",
          avatar: "$user.avatar",
          leadsCount: 1,
          conversions: 1,
        },
      },
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

  const boundaries = [
    ...monthBoundaries.map((m) => m.monthStart),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];
  const bucketByMonth = (extraMatch, field) =>
    Lead.aggregate([
      { $match: { ...tf, ...extraMatch, [field]: { $gte: boundaries[0], $lt: boundaries[6] } } },
      { $bucket: { groupBy: `$${field}`, boundaries, default: "other", output: { count: { $sum: 1 } } } },
    ]);
  const [createdBuckets, wonBuckets] = await Promise.all([
    bucketByMonth({}, "createdAt"),
    bucketByMonth({ status: "WON" }, "updatedAt"),
  ]);
  const countFor = (buckets, monthStart) =>
    buckets.find((b) => new Date(b._id).getTime() === monthStart.getTime())?.count || 0;

  const leadsChartData = monthBoundaries.map(({ monthStart, monthName }) => {
    const leads = countFor(createdBuckets, monthStart);
    const converted = countFor(wonBuckets, monthStart);
    return {
      month: monthName,
      leads,
      converted,
      conversionRate: leads > 0 ? Math.round((converted / leads) * 100) : 0,
    };
  });

  const statusCountsMap = statusCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const totalLeads = statusCounts.reduce((n, r) => n + r.count, 0);
  const convertedClients = statusCountsMap["WON"] || 0;

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

  res.json({
    success: true,
    data: {
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

module.exports = { getDashboardStats };
