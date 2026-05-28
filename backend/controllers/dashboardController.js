const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const User = require("../models/User");

/*
 * Actual Lead statuses (from Lead model enum):
 * "PENDING CONTACT", "1", "2", "3", "COMPLETED",
 * "DISCUSSION", "DISCUSSION 1", "DISCUSSION 2", "DISCUSSION 3", "DISCUSSION COMPLETED",
 * "QUOTATION", "QUOTATION 1", "QUOTATION 2", "QUOTATION 3", "QUOTATION COMPLETED",
 * "VISIT SCHEDULED", "VISITED", "DROP", "WON"
 */

const CLOSED_STATUSES = ["WON", "DROP"];

const getDashboardStats = asyncHandler(async (req, res) => {
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

  // "Hot" leads = actively in discussion, quotation, or visit stage
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
    Lead.countDocuments(),
    Lead.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
    Lead.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Lead.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Lead.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }),
    Lead.countDocuments({ status: "WON" }),
    User.countDocuments({ status: "active" }),
    Lead.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),

    // Hot leads
    Lead.countDocuments({ status: { $in: HOT_STATUSES } }),

    // Today's follow-ups
    Lead.find({
      followUpDate: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: CLOSED_STATUSES },
    })
      .select("name company phone status assignedTo followUpDate")
      .populate("assignedTo", "name")
      .limit(10)
      .lean(),

    // Overdue follow-ups (past due, not closed)
    Lead.countDocuments({
      followUpDate: { $lt: todayStart },
      status: { $nin: CLOSED_STATUSES },
    }),

    // Uncontacted leads (PENDING CONTACT for 48h+)
    Lead.countDocuments({
      status: "PENDING CONTACT",
      createdAt: { $lt: twoDaysAgo },
    }),

    // Team leaderboard
    User.aggregate([
      { $match: { status: "active" } },
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

  // 6-month chart data
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
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
        Lead.countDocuments({
          status: "WON",
          updatedAt: { $gte: monthStart, $lte: monthEnd },
        }),
      ]),
    ),
  );

  const leadsChartData = chartResults.map(([leads, converted], i) => ({
    month: monthBoundaries[i].monthName,
    leads,
    converted,
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

  // Funnel stages mapped to actual Lead statuses
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
