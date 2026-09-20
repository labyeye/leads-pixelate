// What the tenant has used of the AI features their plan includes, this calendar month,
// next to the plan's limits. Read-only: the limits live in models/Subscription.js PLAN_LIMITS.
const express = require("express");
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const Tenant = require("../models/Tenant");
const SocialPost = require("../models/SocialPost");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { PLAN_LIMITS } = require("../models/Subscription");
const svc = require("../services/autopilotService");

const router = express.Router();

router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = req.user.tenantId ? await Tenant.findById(req.user.tenantId) : null;
    if (!tenant) {
      res.status(400);
      throw new Error("No organisation found for this account");
    }

    const now = new Date();
    const start = svc.monthStart(now);
    const resetsAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const limits = PLAN_LIMITS[tenant.plan] || PLAN_LIMITS.trial;
    const a = svc.effectiveAutopilot(tenant, now);
    const ent = svc.entitlement(a, now);
    const ap = svc.planLimits(a, now);
    const tenantId = tenant._id;

    const [posts, aiCalls, leads, team] = await Promise.all([
      SocialPost.countDocuments({ tenantId, source: "autopilot", createdAt: { $gte: start } }),
      CallLog.countDocuments({ tenantId, callType: "automated_ai", createdAt: { $gte: start } }),
      Lead.countDocuments({ tenantId, createdAt: { $gte: start } }),
      User.countDocuments({ tenantId, status: "active" }),
    ]);

    res.json({
      success: true,
      data: {
        plan: { id: tenant.plan, expiresAt: tenant.planExpiresAt },
        month: { start, resetsAt },
        autopilot: {
          used: posts,
          limit: ap.monthlyPosts,
          daysPerWeek: ap.daysPerWeek,
          enabled: !!a.enabled,
          state: ent.state, // none | trial | paid | expired
          endsAt: ent.endsAt,
        },
        aiCalls: { used: aiCalls, limit: limits.aiCalls },
        leads: { used: leads, limit: limits.leadsPerMonth },
        team: { used: team, limit: limits.teamMembers },
      },
    });
  }),
);

module.exports = router;
