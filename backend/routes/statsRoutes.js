const express = require("express");
const router = express.Router();
const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");
const { PLAN_LIMITS } = require("../models/Subscription");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Campaign = require("../models/Campaign");
const Quotation = require("../models/Quotation");

// Same guard pattern as the HRMS backend: static secret, no JWT.
// Pass as ?key=<secret> or X-Stats-Key header.
function statsGuard(req, res, next) {
  const secret = process.env.NESTLEADS_SECRET;
  if (!secret) {
    return res.status(503).json({
      success: false,
      message: "Stats endpoint not configured (NESTLEADS_SECRET missing)",
    });
  }
  const provided = req.query.key || req.headers["x-stats-key"];
  if (provided !== secret) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

router.get("/", statsGuard, async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // ── 1. Tenant counts ───────────────────────────────────────────────────
    const [totalTenants, activeTenants, trialTenants, suspendedTenants, cancelledTenants, newLast7Days, newLast30Days] =
      await Promise.all([
        Tenant.countDocuments(),
        Tenant.countDocuments({ status: "active" }),
        Tenant.countDocuments({ plan: "trial" }),
        Tenant.countDocuments({ status: "suspended" }),
        Tenant.countDocuments({ status: "cancelled" }),
        Tenant.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Tenant.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]);

    // ── 2. Subscription stats ────────────────────────────────────────────────
    const [totalSubs, activeSubs, trialSubs, cancelledSubs, pastDueSubs, expiringIn7DaysCount, expiringIn30DaysCount, expiredSubsCount] =
      await Promise.all([
        Subscription.countDocuments(),
        Subscription.countDocuments({ status: "active" }),
        Subscription.countDocuments({ status: "trialing" }),
        Subscription.countDocuments({ status: "cancelled" }),
        Subscription.countDocuments({ status: "past_due" }),
        Subscription.countDocuments({ status: { $ne: "cancelled" }, currentPeriodEnd: { $gte: now, $lte: in7Days } }),
        Subscription.countDocuments({ status: { $ne: "cancelled" }, currentPeriodEnd: { $gte: now, $lte: in30Days } }),
        Subscription.countDocuments({ status: { $ne: "cancelled" }, currentPeriodEnd: { $lt: now } }),
      ]);

    const planBreakdown = await Subscription.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: { plan: "$plan", billingCycle: "$billingCycle" }, count: { $sum: 1 } } },
      { $sort: { "_id.plan": 1 } },
    ]);

    // ── 3. Revenue — invoices are embedded per-subscription, amounts in paise ──
    const revenueAgg = await Subscription.aggregate([
      { $unwind: "$invoices" },
      { $match: { "invoices.status": "paid" } },
      { $group: { _id: "$invoices.billingCycle", total: { $sum: "$invoices.amount" }, count: { $sum: 1 } } },
    ]);
    const revenueByBilling = {};
    for (const r of revenueAgg) {
      revenueByBilling[r._id || "monthly"] = { total: Math.round((r.total || 0) / 100), count: r.count };
    }
    const totalRevenue = (revenueByBilling.monthly?.total || 0) + (revenueByBilling.yearly?.total || 0);

    const recentRevenueAgg = await Subscription.aggregate([
      { $unwind: "$invoices" },
      { $match: { "invoices.status": "paid", "invoices.paidAt": { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: "$invoices.amount" } } },
    ]);

    const mrrAgg = await Subscription.aggregate([
      { $match: { status: "active", billingCycle: "monthly" } },
      { $group: { _id: null, mrr: { $sum: "$amount" } } },
    ]);
    const mrr = Math.round((mrrAgg[0]?.mrr || 0) / 100);

    const arrFromYearlyAgg = await Subscription.aggregate([
      { $match: { status: "active", billingCycle: "yearly" } },
      { $group: { _id: null, arr: { $sum: "$amount" } } },
    ]);
    const arrFromYearly = Math.round((arrFromYearlyAgg[0]?.arr || 0) / 100);
    const arr = mrr * 12 + arrFromYearly;

    // ── 4. Team member (User) stats ─────────────────────────────────────────
    const [totalTeamMembers, activeTeamMembers] = await Promise.all([
      User.countDocuments({ tenantId: { $ne: null } }),
      User.countDocuments({ tenantId: { $ne: null }, status: "active" }),
    ]);

    const teamPerTenantAgg = await User.aggregate([
      { $match: { tenantId: { $ne: null } } },
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
      { $group: { _id: null, avg: { $avg: "$count" }, max: { $max: "$count" } } },
    ]);

    // ── 5. Activity last 30 days ────────────────────────────────────────────
    const [leadsCapturedLast30Days, campaignsLaunchedLast30Days, quotationsCreatedLast30Days] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Campaign.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Quotation.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    // ── 6. Per-tenant list ───────────────────────────────────────────────────
    const tenantDocs = await Tenant.find()
      .populate("ownerUser", "email phone address")
      .sort({ createdAt: -1 })
      .select("name plan planExpiresAt status createdAt ownerUser")
      .lean();

    const subs = await Subscription.find().lean();
    const subByTenant = {};
    for (const s of subs) if (s.tenant) subByTenant[s.tenant.toString()] = s;

    const teamCountMap = {};
    const teamCounts = await User.aggregate([
      { $match: { tenantId: { $ne: null } } },
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
    ]);
    for (const t of teamCounts) if (t._id) teamCountMap[t._id.toString()] = t.count;

    const activeTeamCountMap = {};
    const activeTeamCounts = await User.aggregate([
      { $match: { tenantId: { $ne: null }, status: "active" } },
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
    ]);
    for (const t of activeTeamCounts) if (t._id) activeTeamCountMap[t._id.toString()] = t.count;

    const lastLoginMap = {};
    const lastLogins = await User.aggregate([
      { $match: { tenantId: { $ne: null }, lastLogin: { $ne: null } } },
      { $group: { _id: "$tenantId", lastLogin: { $max: "$lastLogin" } } },
    ]);
    for (const l of lastLogins) if (l._id) lastLoginMap[l._id.toString()] = l.lastLogin;

    const tenants = tenantDocs.map((t) => {
      const tenantId = t._id.toString();
      const sub = subByTenant[tenantId];
      const plan = sub?.plan || t.plan;
      const renewalDate = t.planExpiresAt || null;
      const isExpired = !!renewalDate && renewalDate < now && t.status !== "cancelled";
      const expiringIn7Days = !!renewalDate && renewalDate >= now && renewalDate <= in7Days;
      const expiringIn30Days = !!renewalDate && renewalDate >= now && renewalDate <= in30Days;
      const isTrial = t.plan === "trial" || sub?.status === "trialing";

      return {
        id: tenantId,
        name: t.name,
        email: t.ownerUser?.email || "",
        phone: t.ownerUser?.phone || "",
        industry: null,
        city: t.ownerUser?.address?.city || null,
        state: t.ownerUser?.address?.state || null,
        status: isTrial ? "trial" : t.status === "active" ? "active" : "inactive",
        lastLogin: lastLoginMap[tenantId] || null,
        joinedAt: t.createdAt,
        activeTeamMembers: activeTeamCountMap[tenantId] || 0,
        loginUsers: teamCountMap[tenantId] || 0,
        subscription: {
          plan,
          billingCycle: sub?.billingCycle || "monthly",
          status: sub?.status || t.status,
          isTrial,
          trialEndDate: isTrial ? renewalDate : null,
          renewalDate,
          maxTeamMembers: PLAN_LIMITS[plan]?.teamMembers || 0,
          currentTeamMemberCount: activeTeamCountMap[tenantId] || 0,
          amountPaid: Math.round((sub?.amount || 0) / 100),
          paymentStatus: sub?.status === "active" ? "paid" : "pending",
          autoRenew: !!sub && sub.status !== "cancelled",
          expiringIn7Days,
          expiringIn30Days,
          isExpired,
        },
      };
    });

    // ── 7. Expiring / alert buckets ──────────────────────────────────────────
    const expiringTenants = tenants.filter((t) => t.subscription.expiringIn30Days);
    const expiredTenants = tenants.filter((t) => t.subscription.isExpired);
    const trialTenantsList = tenants.filter((t) => t.subscription.isTrial);

    res.json({
      success: true,
      generatedAt: now.toISOString(),
      overview: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          trial: trialTenants,
          inactive: suspendedTenants + cancelledTenants,
          newLast7Days,
          newLast30Days,
        },
        subscriptions: {
          total: totalSubs,
          active: activeSubs,
          trial: trialSubs,
          cancelled: cancelledSubs,
          pendingRenewal: pastDueSubs,
          expiringIn7Days: expiringIn7DaysCount,
          expiringIn30Days: expiringIn30DaysCount,
          expired: expiredSubsCount,
        },
        revenue: {
          totalAllTime: totalRevenue,
          last30Days: Math.round((recentRevenueAgg[0]?.total || 0) / 100),
          mrr,
          arr,
          byBillingCycle: {
            monthly: revenueByBilling.monthly || { total: 0, count: 0 },
            yearly: revenueByBilling.yearly || { total: 0, count: 0 },
          },
        },
        teamMembers: {
          total: totalTeamMembers,
          active: activeTeamMembers,
          avgPerTenant: Math.round((teamPerTenantAgg[0]?.avg || 0) * 10) / 10,
          maxInOneTenant: teamPerTenantAgg[0]?.max || 0,
        },
        activity: {
          leadsCapturedLast30Days,
          campaignsLaunchedLast30Days,
          quotationsCreatedLast30Days,
        },
        planBreakdown: planBreakdown.map((p) => ({
          plan: p._id.plan,
          billingCycle: p._id.billingCycle,
          count: p.count,
        })),
      },
      alerts: {
        expiringIn7Days: expiringTenants
          .filter((t) => t.subscription.expiringIn7Days)
          .map((t) => ({ name: t.name, email: t.email, plan: t.subscription.plan, renewalDate: t.subscription.renewalDate })),
        expiringIn30Days: expiringTenants.map((t) => ({
          name: t.name,
          email: t.email,
          plan: t.subscription.plan,
          renewalDate: t.subscription.renewalDate,
        })),
        expired: expiredTenants.map((t) => ({
          name: t.name,
          email: t.email,
          plan: t.subscription.plan,
          renewalDate: t.subscription.renewalDate,
          lastLogin: t.lastLogin,
        })),
        trialsActive: trialTenantsList.map((t) => ({
          name: t.name,
          email: t.email,
          trialEndDate: t.subscription.trialEndDate,
          activeTeamMembers: t.activeTeamMembers,
        })),
      },
      tenants,
    });
  } catch (err) {
    console.error("[Stats] Error:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
