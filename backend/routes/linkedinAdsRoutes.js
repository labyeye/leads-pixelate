const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");
const { resolvePincode, isPincode } = require("../utils/pincode");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { nextBatchAssignee, assignmentFields } = require("../utils/leadAssignment");
const linkedinAds = require("../services/linkedinAdsService");
const log = require("../utils/logger").scope("LinkedIn Ads");

function getRedirectUri() {
  return (
    process.env.LINKEDIN_ADS_REDIRECT_URI ||
    `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/linkedin-ads/callback`
  );
}

function tenantQuery(req) {
  return req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
}

// LinkedIn lead form answers use questionType keys like FIRST_NAME,
// LAST_NAME, EMAIL_ADDRESS, PHONE_NUMBER, COMPANY_NAME, CITY, STATE.
function mapAnswerFields(answers = []) {
  const map = {};
  for (const a of answers) {
    const key = (a.answerDetails?.questionType || a.question || "").toLowerCase();
    const value =
      a.answerDetails?.textQuestionAnswer?.answer ||
      a.answerDetails?.consentQuestionAnswer?.consentAnswer ||
      "";
    if (key) map[key] = value;
  }
  return map;
}

router.get(
  "/auth-url",
  protect,
  asyncHandler(async (req, res) => {
    if (!process.env.LINKEDIN_ADS_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: "LinkedIn Ads integration not configured",
      });
    }
    const state = Buffer.from(
      `${req.user.tenantId || "global"}:${req.user._id}`,
    ).toString("base64");
    const authUrl = linkedinAds.buildAuthUrl(getRedirectUri(), state);
    log.info("Auth URL requested", { userId: req.user._id });
    res.json({ success: true, data: { authUrl } });
  }),
);

router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const frontendBase = process.env.CLIENT_URL || "http://localhost:5173";

    if (error || !code) {
      log.warn("OAuth callback denied by user or LinkedIn", { error });
      return res.redirect(
        `${frontendBase}/campaigns/linkedin?lnkd_error=${encodeURIComponent(error || "access_denied")}`,
      );
    }

    let tenantId, userId;
    try {
      const decoded = Buffer.from(String(state), "base64").toString("utf8");
      [tenantId, userId] = decoded.split(":");
      if (!userId) throw new Error("Invalid state");
    } catch {
      log.warn("OAuth callback received invalid state param");
      return res.redirect(
        `${frontendBase}/integrations?lnkd_error=invalid_state`,
      );
    }

    let tokens;
    try {
      tokens = await linkedinAds.exchangeCodeForTokens(code, getRedirectUri());
    } catch (err) {
      log.error("Token exchange failed", { userId, message: err.message });
      return res.redirect(
        `${frontendBase}/campaigns/linkedin?lnkd_error=token_exchange_failed`,
      );
    }

    if (!tokens.refresh_token) {
      log.warn("LinkedIn did not return a refresh token", { userId });
      return res.redirect(
        `${frontendBase}/campaigns/linkedin?lnkd_error=no_refresh_token`,
      );
    }

    const query =
      tenantId && tenantId !== "global"
        ? { _id: tenantId }
        : { ownerUser: userId };

    await Tenant.findOneAndUpdate(query, {
      "integrations.linkedinAds.refreshToken": tokens.refresh_token,
      "integrations.linkedinAds.oauthUserId": userId,
    });

    log.info("Account connected", { userId, tenantId: tenantId || "global" });
    res.redirect(`${frontendBase}/campaigns/linkedin?lnkd_step=select_account`);
  }),
);

router.get(
  "/accounts",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(tenantQuery(req));
    const refreshToken = tenant?.integrations?.linkedinAds?.refreshToken;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Please connect your LinkedIn account first" });
    }

    try {
      const accessToken = await linkedinAds.refreshAccessToken(refreshToken);
      const accounts = await linkedinAds.listAdAccounts(accessToken);
      res.json({ success: true, data: accounts });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.get(
  "/campaigns",
  protect,
  asyncHandler(async (req, res) => {
    const { adAccountId } = req.query;
    if (!adAccountId) {
      return res
        .status(400)
        .json({ success: false, message: "adAccountId is required" });
    }
    const tenant = await Tenant.findOne(tenantQuery(req));
    const refreshToken = tenant?.integrations?.linkedinAds?.refreshToken;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "LinkedIn Ads not connected" });
    }

    try {
      const accessToken = await linkedinAds.refreshAccessToken(refreshToken);
      const campaigns = await linkedinAds.listCampaigns(adAccountId, accessToken);
      res.json({ success: true, data: campaigns });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.get(
  "/forms",
  protect,
  asyncHandler(async (req, res) => {
    const { adAccountId } = req.query;
    if (!adAccountId) {
      return res
        .status(400)
        .json({ success: false, message: "adAccountId is required" });
    }
    const tenant = await Tenant.findOne(tenantQuery(req));
    const refreshToken = tenant?.integrations?.linkedinAds?.refreshToken;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "LinkedIn Ads not connected" });
    }

    try {
      const accessToken = await linkedinAds.refreshAccessToken(refreshToken);
      const forms = await linkedinAds.listLeadForms(adAccountId, accessToken);
      res.json({ success: true, data: forms });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.post(
  "/connect-account",
  protect,
  asyncHandler(async (req, res) => {
    const {
      adAccountId,
      adAccountName = "",
      selectedFormIds = [],
      allowedStates = [],
      defaultAssigneeId = "",
    } = req.body;
    const assign = assignmentFields(req.body);

    if (!adAccountId) {
      return res
        .status(400)
        .json({ success: false, message: "adAccountId is required" });
    }

    const query = tenantQuery(req);
    const tenant = await Tenant.findOne(query);
    if (!tenant?.integrations?.linkedinAds?.refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "LinkedIn Ads not connected" });
    }

    const webhookKey = crypto.randomBytes(16).toString("hex");
    const accountEntry = {
      adAccountId: String(adAccountId),
      adAccountName,
      selectedFormIds,
      allowedStates: allowedStates.map((s) => s.toLowerCase().trim()),
      defaultAssigneeId,
      ...assign,
      webhookKey,
      connectedAt: new Date(),
    };

    const existing = tenant.integrations.linkedinAds.accounts?.find(
      (a) => a.adAccountId === accountEntry.adAccountId,
    );

    if (existing) {
      accountEntry.webhookKey = existing.webhookKey || webhookKey;
      await Tenant.findOneAndUpdate(
        query,
        {
          "integrations.linkedinAds.enabled": true,
          $set: {
            "integrations.linkedinAds.accounts.$[elem]": accountEntry,
          },
        },
        { arrayFilters: [{ "elem.adAccountId": accountEntry.adAccountId }] },
      );
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.linkedinAds.enabled": true,
        $push: { "integrations.linkedinAds.accounts": accountEntry },
      });
    }

    log.info("Ad account connected", {
      tenantId: tenant._id,
      adAccountId: accountEntry.adAccountId,
      formCount: selectedFormIds.length,
    });

    res.json({
      success: true,
      message: "LinkedIn Ads account connected successfully",
      data: {
        adAccountId: accountEntry.adAccountId,
        adAccountName,
        webhookKey: accountEntry.webhookKey,
        webhookUrl: `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/linkedin-ads/webhook/${accountEntry.webhookKey}`,
      },
    });
  }),
);

router.post(
  "/disconnect",
  protect,
  asyncHandler(async (req, res) => {
    const { adAccountId } = req.body;
    const query = tenantQuery(req);

    if (adAccountId) {
      await Tenant.findOneAndUpdate(query, {
        $pull: { "integrations.linkedinAds.accounts": { adAccountId } },
      });
      const tenant = await Tenant.findOne(query);
      if (!tenant?.integrations?.linkedinAds?.accounts?.length) {
        await Tenant.findOneAndUpdate(query, {
          "integrations.linkedinAds.enabled": false,
          "integrations.linkedinAds.refreshToken": "",
        });
      }
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.linkedinAds.enabled": false,
        "integrations.linkedinAds.refreshToken": "",
        "integrations.linkedinAds.oauthUserId": "",
        "integrations.linkedinAds.accounts": [],
      });
    }
    log.info("Disconnected", { tenantId: query._id || query.ownerUser, adAccountId: adAccountId || "all" });
    res.json({ success: true, message: "LinkedIn Ads disconnected" });
  }),
);

router.get(
  "/connected-accounts",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(tenantQuery(req));
    const accounts = (tenant?.integrations?.linkedinAds?.accounts || []).map(
      (a) => ({
        adAccountId: a.adAccountId,
        adAccountName: a.adAccountName,
        selectedFormIds: a.selectedFormIds || [],
        allowedStates: a.allowedStates || [],
        defaultAssigneeId: a.defaultAssigneeId || "",
        assigneeIds: a.assigneeIds || [],
        assignBatchSize: a.assignBatchSize || 1,
        connectedAt: a.connectedAt,
        webhookUrl: `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/linkedin-ads/webhook/${a.webhookKey}`,
      }),
    );
    const hasToken = !!tenant?.integrations?.linkedinAds?.refreshToken;
    res.json({ success: true, data: accounts, hasToken });
  }),
);

// assigneeIds (block round robin) wins over the single defaultAssigneeId when set.
async function resolveAssignee(account, tenantId, adminUser, cache) {
  if (account.assigneeIds?.length) {
    const id = await nextBatchAssignee({
      tenantId,
      key: `linkedinAds:${account.adAccountId}`,
      assigneeIds: account.assigneeIds,
      batchSize: account.assignBatchSize || 1,
    });
    if (id) return id;
  }
  const defaultAssigneeId = account.defaultAssigneeId;
  if (!defaultAssigneeId) return adminUser._id;
  if (cache[defaultAssigneeId]) return cache[defaultAssigneeId];
  const u = await User.findById(defaultAssigneeId).catch(() => null);
  cache[defaultAssigneeId] = u?._id || adminUser._id;
  return cache[defaultAssigneeId];
}

async function upsertLeadFromResponse({
  fMap,
  tenant,
  account,
  formId,
  formName,
  leadId,
  adminUser,
  assigneeCache,
}) {
  const extractCity = (m) => m.city || m.city_town || m.town || "";

  let stateRaw = (fMap.state || fMap.region || "").trim();
  let cityRaw = extractCity(fMap).trim();

  if (isPincode(stateRaw)) {
    const resolved = await resolvePincode(stateRaw);
    if (resolved) {
      stateRaw = resolved.state;
      if (!cityRaw) cityRaw = resolved.city;
    }
  } else if (isPincode(cityRaw)) {
    const resolved = await resolvePincode(cityRaw);
    if (resolved) {
      cityRaw = resolved.city;
      if (!stateRaw) stateRaw = resolved.state;
    }
  }

  const locationRaw = (stateRaw || cityRaw).toLowerCase().trim();
  const allowedStates = account.allowedStates || [];
  if (allowedStates.length > 0 && locationRaw) {
    const matches = allowedStates.some(
      (s) =>
        locationRaw.includes(s.toLowerCase()) ||
        s.toLowerCase().includes(locationRaw),
    );
    if (!matches) return { skipped: "filtered" };
  }

  const name =
    fMap.full_name ||
    `${fMap.first_name || ""} ${fMap.last_name || ""}`.trim() ||
    "LinkedIn Lead";

  const leadData = {
    name,
    company: fMap.company_name || fMap.company || "N/A",
    phone: fMap.phone_number || fMap.phone || "",
    email: fMap.email_address || fMap.email || "",
    location: cityRaw,
    requirement: `Via LinkedIn Lead Form: ${formName || formId}`,
    source: "LinkedIn",
    linkedinFormId: String(formId || ""),
    linkedinFormName: formName || "",
    linkedinAdAccountId: account.adAccountId,
  };

  const existing = await Lead.findOne({ linkedinLeadId: leadId });
  if (existing) {
    await Lead.findByIdAndUpdate(existing._id, { $set: leadData });
    return { updated: true };
  }

  const assigneeId = await resolveAssignee(
    account,
    tenant?._id,
    adminUser,
    assigneeCache,
  );

  try {
    await Lead.create({
      ...leadData,
      status: "PENDING CONTACT",
      assignedTo: assigneeId,
      tenantId: tenant._id || null,
      linkedinLeadId: leadId,
    });
    return { created: true };
  } catch (err) {
    if (err.code === 11000) return { updated: true };
    throw err;
  }
}

router.post(
  "/sync",
  protect,
  asyncHandler(async (req, res) => {
    const { adAccountId, since } = req.body;
    const query = tenantQuery(req);
    const tenant = await Tenant.findOne(query);
    if (!tenant?.integrations?.linkedinAds?.enabled) {
      return res
        .status(400)
        .json({ success: false, message: "LinkedIn Ads not connected" });
    }

    const accountsToSync = adAccountId
      ? tenant.integrations.linkedinAds.accounts.filter(
          (a) => a.adAccountId === adAccountId,
        )
      : tenant.integrations.linkedinAds.accounts;

    if (!accountsToSync.length) {
      return res
        .status(400)
        .json({ success: false, message: "No accounts to sync" });
    }

    const adminUser = await User.findOne({
      ...(tenant._id ? { tenantId: tenant._id } : {}),
      role: { $in: ["admin", "super_admin"] },
    });
    if (!adminUser) {
      return res
        .status(400)
        .json({ success: false, message: "No admin user found" });
    }

    const accessToken = await linkedinAds.refreshAccessToken(
      tenant.integrations.linkedinAds.refreshToken,
    );

    const sinceMs = since ? new Date(since).getTime() : undefined;

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFiltered = 0;
    const accountResults = [];
    const assigneeCache = {};

    for (const account of accountsToSync) {
      const accountResult = {
        adAccountName: account.adAccountName,
        created: 0,
        updated: 0,
        filtered: 0,
        error: null,
      };

      try {
        const responses = await linkedinAds.fetchLeadFormResponses(
          account.adAccountId,
          accessToken,
          sinceMs,
        );

        for (const row of responses) {
          const formId = row.leadType?.formResponse?.leadGenFormUrn?.split(":").pop();
          if (
            account.selectedFormIds?.length &&
            formId &&
            !account.selectedFormIds.includes(String(formId))
          )
            continue;

          const fMap = mapAnswerFields(row.formResponse?.answers);
          const result = await upsertLeadFromResponse({
            fMap,
            tenant,
            account,
            formId,
            formName: "",
            leadId: String(row.id || `${account.adAccountId}:${row.submittedAt}`),
            adminUser,
            assigneeCache,
          });

          if (result.created) {
            totalCreated++;
            accountResult.created++;
          } else if (result.updated) {
            totalUpdated++;
            accountResult.updated++;
          } else if (result.skipped) {
            totalFiltered++;
            accountResult.filtered++;
          }
        }
      } catch (err) {
        accountResult.error = err.message;
        log.error("Sync failed for account", {
          adAccountName: account.adAccountName,
          message: err.message,
        });
      }

      accountResults.push(accountResult);
    }

    const parts = [`${totalCreated} new`];
    if (totalUpdated > 0) parts.push(`${totalUpdated} already in DB`);
    if (totalFiltered > 0)
      parts.push(`${totalFiltered} blocked by location filter`);

    log.info("Sync complete", {
      tenantId: tenant._id,
      created: totalCreated,
      updated: totalUpdated,
      filtered: totalFiltered,
    });

    res.json({
      success: true,
      message: `Sync complete — ${parts.join(", ")}`,
      data: {
        created: totalCreated,
        updated: totalUpdated,
        filtered: totalFiltered,
        accounts: accountResults,
      },
    });
  }),
);

// LinkedIn's Lead Sync API pushes new submissions here once a webhook
// subscription is registered against a given webhookKey/account.
router.post(
  "/webhook/:webhookKey",
  express.json(),
  asyncHandler(async (req, res) => {
    const { webhookKey } = req.params;
    const body = req.body || {};

    const tenant = await Tenant.findOne({
      "integrations.linkedinAds.accounts.webhookKey": webhookKey,
      "integrations.linkedinAds.enabled": true,
    });

    if (!tenant) {
      log.warn("Webhook hit with unknown key", { webhookKey });
      return res.sendStatus(404);
    }
    res.sendStatus(200);

    const account = tenant.integrations.linkedinAds.accounts.find(
      (a) => a.webhookKey === webhookKey,
    );
    if (!account) return;

    const formId = body.leadType?.formResponse?.leadGenFormUrn?.split(":").pop();
    if (
      account.selectedFormIds?.length &&
      formId &&
      !account.selectedFormIds.includes(String(formId))
    ) {
      log.info("Webhook lead skipped (form not selected)", { adAccountId: account.adAccountId, formId });
      return;
    }

    const fMap = mapAnswerFields(body.formResponse?.answers);

    const adminUser = await User.findOne({
      ...(tenant._id ? { tenantId: tenant._id } : {}),
      role: { $in: ["admin", "super_admin"] },
    });
    if (!adminUser) {
      log.warn("Webhook lead dropped, no admin user for tenant", { tenantId: tenant._id });
      return;
    }

    try {
      const result = await upsertLeadFromResponse({
        fMap,
        tenant,
        account,
        formId,
        formName: "",
        leadId: String(body.id || `webhook:${Date.now()}`),
        adminUser,
        assigneeCache: {},
      });
      log.info("Webhook lead received", {
        adAccountId: account.adAccountId,
        formId,
        result: result.created ? "created" : result.updated ? "updated" : "filtered",
      });
    } catch (err) {
      log.error("Failed to save webhook lead", {
        adAccountId: account.adAccountId,
        message: err.message,
      });
    }
  }),
);

module.exports = router;
