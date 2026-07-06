const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");
const { resolvePincode, isPincode } = require("../utils/pincode");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const googleAds = require("../services/googleAdsService");

function getRedirectUri() {
  return (
    process.env.GOOGLE_ADS_REDIRECT_URI ||
    `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/google-ads/callback`
  );
}

function tenantQuery(req) {
  return req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
}

// Google's lead field IDs use snake_case-ish keys like FULL_NAME, PHONE_NUMBER, EMAIL, CITY, ...
function mapSubmissionFields(fields = []) {
  const map = {};
  for (const f of fields) {
    const key = (f.fieldName || f.field_name || "").toLowerCase();
    map[key] = f.fieldValue || f.field_value || "";
  }
  return map;
}

router.get(
  "/auth-url",
  protect,
  asyncHandler(async (req, res) => {
    if (!process.env.GOOGLE_ADS_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: "Google Ads integration not configured",
      });
    }
    const state = Buffer.from(
      `${req.user.tenantId || "global"}:${req.user._id}`,
    ).toString("base64");
    const authUrl = googleAds.buildAuthUrl(getRedirectUri(), state);
    res.json({ success: true, data: { authUrl } });
  }),
);

router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const frontendBase = process.env.CLIENT_URL || "http://localhost:5173";

    if (error || !code) {
      return res.redirect(
        `${frontendBase}/integrations?gads_error=${encodeURIComponent(error || "access_denied")}`,
      );
    }

    let tenantId, userId;
    try {
      const decoded = Buffer.from(String(state), "base64").toString("utf8");
      [tenantId, userId] = decoded.split(":");
      if (!userId) throw new Error("Invalid state");
    } catch {
      return res.redirect(
        `${frontendBase}/integrations?gads_error=invalid_state`,
      );
    }

    let tokens;
    try {
      tokens = await googleAds.exchangeCodeForTokens(code, getRedirectUri());
    } catch {
      return res.redirect(
        `${frontendBase}/integrations?gads_error=token_exchange_failed`,
      );
    }

    if (!tokens.refresh_token) {
      return res.redirect(
        `${frontendBase}/integrations?gads_error=no_refresh_token`,
      );
    }

    const query =
      tenantId && tenantId !== "global"
        ? { _id: tenantId }
        : { ownerUser: userId };

    await Tenant.findOneAndUpdate(query, {
      "integrations.googleAds.refreshToken": tokens.refresh_token,
      "integrations.googleAds.oauthUserId": userId,
    });

    res.redirect(`${frontendBase}/integrations?gads_step=select_account`);
  }),
);

router.get(
  "/accounts",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(tenantQuery(req));
    const refreshToken = tenant?.integrations?.googleAds?.refreshToken;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Please connect your Google account first" });
    }

    try {
      const accessToken = await googleAds.getAccessToken(refreshToken);
      const customerIds = await googleAds.listAccessibleCustomers(accessToken);

      const accounts = [];
      for (const id of customerIds) {
        try {
          const name = await googleAds.getCustomerName(
            id,
            accessToken,
            tenant.integrations.googleAds.loginCustomerId,
          );
          accounts.push({ id, name });
        } catch (err) {
          accounts.push({ id, name: `Account ${id}`, error: err.message });
        }
      }
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
    const { customerId } = req.query;
    if (!customerId) {
      return res
        .status(400)
        .json({ success: false, message: "customerId is required" });
    }
    const tenant = await Tenant.findOne(tenantQuery(req));
    const refreshToken = tenant?.integrations?.googleAds?.refreshToken;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Google Ads not connected" });
    }

    try {
      const accessToken = await googleAds.getAccessToken(refreshToken);
      const campaigns = await googleAds.listCampaignsWithLeadForms(
        customerId,
        accessToken,
        tenant.integrations.googleAds.loginCustomerId,
      );
      res.json({ success: true, data: campaigns });
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
      customerId,
      customerName = "",
      selectedCampaignIds = [],
      allowedStates = [],
      defaultAssigneeId = "",
      loginCustomerId = "",
    } = req.body;

    if (!customerId) {
      return res
        .status(400)
        .json({ success: false, message: "customerId is required" });
    }

    const query = tenantQuery(req);
    const tenant = await Tenant.findOne(query);
    if (!tenant?.integrations?.googleAds?.refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Google Ads not connected" });
    }

    const webhookKey = crypto.randomBytes(16).toString("hex");
    const accountEntry = {
      customerId: String(customerId).replace(/-/g, ""),
      customerName,
      selectedCampaignIds,
      allowedStates: allowedStates.map((s) => s.toLowerCase().trim()),
      defaultAssigneeId,
      webhookKey,
      connectedAt: new Date(),
    };

    const existing = tenant.integrations.googleAds.accounts?.find(
      (a) => a.customerId === accountEntry.customerId,
    );

    if (existing) {
      accountEntry.webhookKey = existing.webhookKey || webhookKey;
      await Tenant.findOneAndUpdate(
        query,
        {
          "integrations.googleAds.enabled": true,
          "integrations.googleAds.loginCustomerId":
            loginCustomerId || tenant.integrations.googleAds.loginCustomerId,
          $set: {
            "integrations.googleAds.accounts.$[elem]": accountEntry,
          },
        },
        { arrayFilters: [{ "elem.customerId": accountEntry.customerId }] },
      );
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.googleAds.enabled": true,
        "integrations.googleAds.loginCustomerId":
          loginCustomerId || tenant.integrations.googleAds.loginCustomerId,
        $push: { "integrations.googleAds.accounts": accountEntry },
      });
    }

    res.json({
      success: true,
      message: "Google Ads account connected successfully",
      data: {
        customerId: accountEntry.customerId,
        customerName,
        webhookKey: accountEntry.webhookKey,
        webhookUrl: `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/google-ads/webhook`,
      },
    });
  }),
);

router.post(
  "/disconnect",
  protect,
  asyncHandler(async (req, res) => {
    const { customerId } = req.body;
    const query = tenantQuery(req);

    if (customerId) {
      await Tenant.findOneAndUpdate(query, {
        $pull: { "integrations.googleAds.accounts": { customerId } },
      });
      const tenant = await Tenant.findOne(query);
      if (!tenant?.integrations?.googleAds?.accounts?.length) {
        await Tenant.findOneAndUpdate(query, {
          "integrations.googleAds.enabled": false,
          "integrations.googleAds.refreshToken": "",
        });
      }
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.googleAds.enabled": false,
        "integrations.googleAds.refreshToken": "",
        "integrations.googleAds.oauthUserId": "",
        "integrations.googleAds.accounts": [],
      });
    }
    res.json({ success: true, message: "Google Ads disconnected" });
  }),
);

router.get(
  "/connected-accounts",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(tenantQuery(req));
    const accounts = (tenant?.integrations?.googleAds?.accounts || []).map(
      (a) => ({
        customerId: a.customerId,
        customerName: a.customerName,
        selectedCampaignIds: a.selectedCampaignIds || [],
        allowedStates: a.allowedStates || [],
        defaultAssigneeId: a.defaultAssigneeId || "",
        connectedAt: a.connectedAt,
        webhookUrl: `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/google-ads/webhook`,
      }),
    );
    const hasToken = !!tenant?.integrations?.googleAds?.refreshToken;
    res.json({ success: true, data: accounts, hasToken });
  }),
);

async function resolveAssignee(defaultAssigneeId, adminUser, cache) {
  if (!defaultAssigneeId) return adminUser._id;
  if (cache[defaultAssigneeId]) return cache[defaultAssigneeId];
  const u = await User.findById(defaultAssigneeId).catch(() => null);
  cache[defaultAssigneeId] = u?._id || adminUser._id;
  return cache[defaultAssigneeId];
}

async function upsertLeadFromSubmission({
  fMap,
  tenant,
  account,
  campaignId,
  campaignName,
  gclid,
  submissionResourceName,
  adminUser,
  assigneeCache,
}) {
  const extractCity = (m) =>
    m.city || m.city_town || m["city/town"] || m.district || m.town || "";

  let stateRaw = (m => m.state || m.province || m.region || "")(fMap).trim();
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
    fMap.name ||
    `${fMap.first_name || ""} ${fMap.last_name || ""}`.trim() ||
    "Google Ads Lead";

  const leadData = {
    name,
    company: fMap.company_name || fMap.company || "N/A",
    phone: fMap.phone_number || fMap.phone || "",
    email: fMap.email || "",
    location: cityRaw,
    requirement: `Via Google Ads Lead Form: ${campaignName || campaignId}`,
    source: "Google Ads",
    googleAdsCampaignId: String(campaignId || ""),
    googleAdsCampaignName: campaignName || "",
    googleAdsCustomerId: account.customerId,
  };

  const leadId = submissionResourceName || `${account.customerId}:${gclid}`;
  const existing = await Lead.findOne({ googleAdsLeadId: leadId });
  if (existing) {
    await Lead.findByIdAndUpdate(existing._id, { $set: leadData });
    return { updated: true };
  }

  const assigneeId = await resolveAssignee(
    account.defaultAssigneeId,
    adminUser,
    assigneeCache,
  );

  try {
    await Lead.create({
      ...leadData,
      status: "PENDING CONTACT",
      assignedTo: assigneeId,
      tenantId: tenant._id || null,
      googleAdsLeadId: leadId,
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
    const { customerId, since } = req.body;
    const query = tenantQuery(req);
    const tenant = await Tenant.findOne(query);
    if (!tenant?.integrations?.googleAds?.enabled) {
      return res
        .status(400)
        .json({ success: false, message: "Google Ads not connected" });
    }

    const accountsToSync = customerId
      ? tenant.integrations.googleAds.accounts.filter(
          (a) => a.customerId === customerId,
        )
      : tenant.integrations.googleAds.accounts;

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

    const accessToken = await googleAds.getAccessToken(
      tenant.integrations.googleAds.refreshToken,
    );

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFiltered = 0;
    const accountResults = [];
    const assigneeCache = {};

    for (const account of accountsToSync) {
      const accountResult = {
        customerName: account.customerName,
        created: 0,
        updated: 0,
        filtered: 0,
        error: null,
      };

      try {
        const submissions = await googleAds.fetchLeadFormSubmissions(
          account.customerId,
          accessToken,
          tenant.integrations.googleAds.loginCustomerId,
          since,
        );

        for (const row of submissions) {
          const data = row.leadFormSubmissionData;
          if (!data) continue;

          const campaignId = data.campaignId;
          if (
            account.selectedCampaignIds?.length &&
            !account.selectedCampaignIds.includes(String(campaignId))
          )
            continue;

          const fMap = mapSubmissionFields(data.leadFormSubmissionFields);
          const result = await upsertLeadFromSubmission({
            fMap,
            tenant,
            account,
            campaignId,
            campaignName: row.campaign?.name,
            gclid: data.gclid,
            submissionResourceName: data.resourceName,
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
        console.error(
          `[Google Ads sync] Failed for account ${account.customerName}:`,
          err.message,
        );
      }

      accountResults.push(accountResult);
    }

    const parts = [`${totalCreated} new`];
    if (totalUpdated > 0) parts.push(`${totalUpdated} already in DB`);
    if (totalFiltered > 0)
      parts.push(`${totalFiltered} blocked by location filter`);

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

// Google Ads lead form webhook delivery.
// Google POSTs { google_key, api_version, lead_id, campaign_id, form_id,
//   is_test, gcl_id, user_column_data: [{ column_id, string_value, column_name }] }
// and expects the response body to echo back google_key to confirm receipt.
router.post(
  "/webhook",
  express.json(),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { google_key, lead_id, campaign_id, form_id, user_column_data, is_test } =
      body;

    if (!google_key) return res.sendStatus(400);

    const tenant = await Tenant.findOne({
      "integrations.googleAds.accounts.webhookKey": google_key,
      "integrations.googleAds.enabled": true,
    });

    if (!tenant) return res.sendStatus(404);

    // Acknowledge immediately per Google's webhook contract.
    res.status(200).json({ google_key });

    if (is_test) return;

    const account = tenant.integrations.googleAds.accounts.find(
      (a) => a.webhookKey === google_key,
    );
    if (!account) return;

    if (
      account.selectedCampaignIds?.length &&
      campaign_id &&
      !account.selectedCampaignIds.includes(String(campaign_id))
    )
      return;

    const fMap = {};
    for (const col of user_column_data || []) {
      const key = (col.column_name || col.column_id || "").toLowerCase();
      fMap[key] = col.string_value || "";
    }

    const adminUser = await User.findOne({
      ...(tenant._id ? { tenantId: tenant._id } : {}),
      role: { $in: ["admin", "super_admin"] },
    });
    if (!adminUser) return;

    try {
      await upsertLeadFromSubmission({
        fMap,
        tenant,
        account,
        campaignId: campaign_id,
        campaignName: "",
        gclid: null,
        submissionResourceName: `webhook:${lead_id}`,
        adminUser,
        assigneeCache: {},
      });
    } catch (err) {
      console.error("[Google Ads webhook] Failed to save lead:", err.message);
    }
  }),
);

module.exports = router;
