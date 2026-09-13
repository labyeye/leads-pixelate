const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");
const { resolvePincode, isPincode } = require("../utils/pincode");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const CampaignAssignment = require("../models/CampaignAssignment");

const FB_API = "https://graph.facebook.com/v20.0";
const FB_SCOPES = [
  "email",
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "pages_manage_posts",
  "leads_retrieval",
  "pages_manage_metadata",
  "business_management",
  "ads_read",
  "ads_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

async function fbGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await fetch(`${FB_API}${path}?${qs}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Facebook API error");
  return data;
}

// Ads Manager shows a node's full history, not just the first page — follow
// `paging.next` so long-running ad accounts don't get truncated at whatever
// the initial `limit` was. Capped so a single request can't run away.
async function fbGetAll(path, token, params = {}, maxPages = 10) {
  let all = [];
  let data = await fbGet(path, token, params);
  all = all.concat(data.data || []);
  let next = data.paging?.next;
  let pages = 1;
  while (next && pages < maxPages) {
    const res = await fetch(next);
    data = await res.json();
    if (data.error) throw new Error(data.error.message || "Facebook API error");
    all = all.concat(data.data || []);
    next = data.paging?.next;
    pages++;
  }
  return all;
}

async function getFbUserToken(req) {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
  const tenant = await Tenant.findOne(query);
  return tenant?.integrations?.facebook?.userAccessToken || null;
}

// Graph API "write" call — create/update via POST, delete via DELETE.
// Object/array param values are JSON-encoded, matching what the Marketing
// API expects for fields like `targeting` and `creative`.
async function fbWrite(path, token, params = {}, method = "POST") {
  const encoded = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    encoded[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  const qs = new URLSearchParams({ access_token: token, ...encoded }).toString();
  const res = await fetch(`${FB_API}${path}?${qs}`, { method });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Facebook API error");
  return data;
}

// Admins manage every campaign; anyone else must have been assigned this
// specific campaign by an admin (Task Management) to read/write it.
async function assertCampaignAccess(req, campaignId) {
  if (["admin", "super_admin"].includes(req.user.role)) return;
  const filter = req.user.tenantId
    ? { tenantId: req.user.tenantId }
    : { ownerUser: req.user._id };
  const assignment = await CampaignAssignment.findOne({
    ...filter,
    platform: "facebook",
    campaignId,
    assignedTo: req.user._id,
  });
  if (!assignment) {
    const err = new Error("You are not assigned to manage this campaign");
    err.statusCode = 403;
    throw err;
  }
}

async function getAssignedCampaignIds(req) {
  const filter = req.user.tenantId
    ? { tenantId: req.user.tenantId }
    : { ownerUser: req.user._id };
  const assignments = await CampaignAssignment.find({
    ...filter,
    platform: "facebook",
    assignedTo: req.user._id,
  }).select("campaignId");
  return new Set(assignments.map((a) => a.campaignId));
}

const ALL_EFFECTIVE_STATUSES = JSON.stringify([
  "ACTIVE",
  "PAUSED",
  "DELETED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "CAMPAIGN_PAUSED",
  "ARCHIVED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
]);

const CAMPAIGN_FIELDS =
  "id,name,status,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time";
const ADSET_FIELDS =
  "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,start_time,end_time,targeting,optimization_goal,billing_event,created_time";
const AD_FIELDS =
  "id,name,status,effective_status,adset_id,campaign_id,created_time,creative{title,body,image_url,call_to_action_type,object_story_spec}";

function normalizeAd(a) {
  return {
    ...a,
    creative: a.creative && {
      title: a.creative.title,
      body: a.creative.body,
      image_url: a.creative.image_url,
      call_to_action_type: a.creative.call_to_action_type,
      link_url:
        a.creative.object_story_spec?.link_data?.link ||
        a.creative.object_story_spec?.video_data?.call_to_action?.value
          ?.link ||
        undefined,
    },
  };
}

// Fetches a node's children with the full-history status filter, falling
// back to Graph API's own default filtering if that filter itself errors
// (rather than silently returning nothing for that node).
async function fbGetAllWithFallback(path, token, fields, label) {
  try {
    return await fbGetAll(path, token, {
      fields,
      effective_status: ALL_EFFECTIVE_STATUSES,
      limit: "100",
    });
  } catch (err) {
    console.error(`[${label}] status-filtered fetch failed:`, err.message);
    return await fbGetAll(path, token, { fields, limit: "100" });
  }
}

async function resolveAdPlatform(adId, token, cache) {
  if (!adId) return { source: "Facebook", platforms: [] };
  if (cache[adId]) return cache[adId];
  try {
    const data = await fbGet(`/${adId}`, token, {
      fields: "publisher_platforms,adset{name},campaign{name}",
    });
    const platforms = data.publisher_platforms || [];
    const hasFb = platforms.includes("facebook");
    const hasIg = platforms.includes("instagram");
    let source = "Facebook";
    if (hasIg && !hasFb) source = "Instagram";
    else if (hasIg && hasFb) source = "Meta";
    const result = {
      source,
      platforms,
      adsetName: data.adset?.name || "",
      campaignName: data.campaign?.name || "",
    };
    cache[adId] = result;
    return result;
  } catch {
    cache[adId] = {
      source: "Facebook",
      platforms: [],
      adsetName: "",
      campaignName: "",
    };
    return cache[adId];
  }
}

async function resolveFormName(formId, token, cache) {
  if (!formId) return "";
  if (cache[formId] !== undefined) return cache[formId];
  try {
    const data = await fbGet(`/${formId}`, token, { fields: "name" });
    cache[formId] = data.name || "";
  } catch {
    cache[formId] = "";
  }
  return cache[formId];
}

const KNOWN_FIELD_KEYS = new Set([
  "full_name",
  "name",
  "first_name",
  "last_name",
  "company_name",
  "company",
  "phone_number",
  "phone",
  "mobile",
  "email",
  "email_address",
  "city",
  "city_town",
  "city/town",
  "district",
  "town",
  "location",
  "state",
  "province",
  "region",
  "product",
  "product_interest",
  "interested_in",
]);

function extractCustomFields(fMap) {
  const custom = {};
  for (const [k, v] of Object.entries(fMap)) {
    if (!KNOWN_FIELD_KEYS.has(k) && v) custom[k] = String(v);
  }
  return custom;
}

async function getLongLivedToken(shortToken) {
  const res = await fetch(
    `${FB_API}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${shortToken}`,
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token;
}

async function getPageToken(pageId, userToken) {
  const data = await fbGet(`/${pageId}`, userToken, {
    fields: "access_token,name,id",
  });
  return { token: data.access_token, name: data.name };
}

async function subscribePageToWebhook(pageId, pageToken) {
  const res = await fetch(`${FB_API}/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: ["leadgen"],
      access_token: pageToken,
    }),
  });
  const data = await res.json();
  return data.success === true;
}

router.get(
  "/auth-url",
  protect,
  asyncHandler(async (req, res) => {
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return res.status(400).json({
        success: false,
        message: "Facebook integration not configured",
      });
    }

    const redirectUri =
      process.env.FACEBOOK_REDIRECT_URI ||
      `${process.env.VITE_API_URL || "https://leads.pixelatenest.com/"}/api/facebook/callback`;

    const state = Buffer.from(
      `${req.user.tenantId || "global"}:${req.user._id}`,
    ).toString("base64");

    const authUrl =
      `https://www.facebook.com/v20.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&scope=${encodeURIComponent(FB_SCOPES)}` +
      `&response_type=code`;

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
        `${frontendBase}/integrations?fb_error=${encodeURIComponent(error || "access_denied")}`,
      );
    }

    let tenantId, userId;
    try {
      const decoded = Buffer.from(String(state), "base64").toString("utf8");
      [tenantId, userId] = decoded.split(":");
      if (!userId) throw new Error("Invalid state");
    } catch {
      return res.redirect(
        `${frontendBase}/integrations?fb_error=invalid_state`,
      );
    }

    const redirectUri =
      process.env.FACEBOOK_REDIRECT_URI ||
      `${process.env.VITE_API_URL || "https://leads.pixelatenest.com/"}/api/facebook/callback`;

    const tokenRes = await fetch(
      `${FB_API}/oauth/access_token?` +
        `client_id=${process.env.FACEBOOK_APP_ID}` +
        `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${code}`,
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(
        `${frontendBase}/integrations?fb_error=token_exchange_failed`,
      );
    }

    let longLivedToken;
    try {
      longLivedToken = await getLongLivedToken(tokenData.access_token);
    } catch {
      longLivedToken = tokenData.access_token;
    }

    const query =
      tenantId && tenantId !== "global"
        ? { _id: tenantId }
        : { ownerUser: userId };

    await Tenant.findOneAndUpdate(query, {
      "integrations.facebook.userAccessToken": longLivedToken,
      "integrations.facebook.oauthUserId": userId,
    });

    res.redirect(`${frontendBase}/integrations?fb_step=select_page`);
  }),
);

router.get(
  "/pages",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(
      req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id },
    );

    if (!tenant?.integrations?.facebook?.userAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Please connect your Facebook account first",
      });
    }

    const token = tenant.integrations.facebook.userAccessToken;

    const personalData = await fbGet("/me/accounts", token, {
      fields: "id,name,picture,fan_count,category",
    });
    const personalPages = personalData.data || [];

    let businessPages = [];
    try {
      const businesses = await fbGet("/me/businesses", token, {
        fields: "id,name",
      });
      for (const biz of businesses.data || []) {
        try {
          const bizPages = await fbGet(`/${biz.id}/owned_pages`, token, {
            fields: "id,name,picture,fan_count,category",
          });
          businessPages = businessPages.concat(bizPages.data || []);
        } catch (_) {}
      }
    } catch (_) {}

    const seen = new Set();
    const allPages = [...personalPages, ...businessPages].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const pages = allPages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      picture: p.picture?.data?.url || null,
      fanCount: p.fan_count || 0,
    }));

    res.json({ success: true, data: pages });
  }),
);

router.get(
  "/forms",
  protect,
  asyncHandler(async (req, res) => {
    const { pageId } = req.query;
    if (!pageId || typeof pageId !== "string" || !/^\d+$/.test(pageId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid pageId is required" });
    }

    const tenant = await Tenant.findOne(
      req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id },
    );

    const userToken = tenant?.integrations?.facebook?.userAccessToken;
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    const { token: pageToken } = await getPageToken(pageId, userToken);

    const data = await fbGet(`/${pageId}/leadgen_forms`, pageToken, {
      fields: "id,name,status,leads_count,created_time",
    });

    const forms = (data.data || []).map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status,
      leadsCount: f.leads_count || 0,
      createdAt: f.created_time,
    }));

    res.json({ success: true, data: forms });
  }),
);

router.post(
  "/connect-page",
  protect,
  asyncHandler(async (req, res) => {
    const {
      pageId,
      selectedFormIds = [],
      allowedStates = [],
      defaultAssigneeId = "",
    } = req.body;

    if (!pageId || typeof pageId !== "string" || !/^\d+$/.test(pageId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid pageId is required" });
    }

    if (!Array.isArray(selectedFormIds)) {
      return res
        .status(400)
        .json({ success: false, message: "selectedFormIds must be an array" });
    }

    const query = req.user.tenantId
      ? { _id: req.user.tenantId }
      : { ownerUser: req.user._id };

    const tenant = await Tenant.findOne(query);
    const userToken = tenant?.integrations?.facebook?.userAccessToken;
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    const { token: pageToken, name: pageName } = await getPageToken(
      pageId,
      userToken,
    );
    const subscribed = await subscribePageToWebhook(pageId, pageToken);

    const pageEntry = {
      pageId,
      pageName,
      accessToken: pageToken,
      selectedFormIds,
      allowedStates: allowedStates.map((s) => s.toLowerCase().trim()),
      defaultAssigneeId,
      webhookVerified: subscribed,
      connectedAt: new Date(),
    };

    const existingPage = tenant.integrations.facebook.pages?.find(
      (p) => p.pageId === pageId,
    );

    if (existingPage) {
      await Tenant.findOneAndUpdate(
        query,
        {
          "integrations.facebook.enabled": true,
          $set: { "integrations.facebook.pages.$[elem]": pageEntry },
        },
        {
          arrayFilters: [{ "elem.pageId": pageId }],
        },
      );
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.facebook.enabled": true,
        $push: { "integrations.facebook.pages": pageEntry },
      });
    }

    res.json({
      success: true,
      message: "Facebook Page connected successfully",
      data: {
        pageId,
        pageName,
        subscribed,
        formsSelected: selectedFormIds.length,
      },
    });
  }),
);

router.post(
  "/disconnect",
  protect,
  asyncHandler(async (req, res) => {
    const { pageId } = req.body;
    const query = req.user.tenantId
      ? { _id: req.user.tenantId }
      : { ownerUser: req.user._id };

    if (pageId) {
      await Tenant.findOneAndUpdate(query, {
        $pull: { "integrations.facebook.pages": { pageId } },
      });

      const tenant = await Tenant.findOne(query);
      if (!tenant?.integrations?.facebook?.pages?.length) {
        await Tenant.findOneAndUpdate(query, {
          "integrations.facebook.enabled": false,
          "integrations.facebook.userAccessToken": "",
        });
      }
    } else {
      await Tenant.findOneAndUpdate(query, {
        "integrations.facebook.enabled": false,
        "integrations.facebook.userAccessToken": "",
        "integrations.facebook.oauthUserId": "",
        "integrations.facebook.pages": [],
      });
    }
    res.json({ success: true, message: "Facebook disconnected" });
  }),
);

router.get(
  "/connected-pages",
  protect,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne(
      req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id },
    );
    const pages = (tenant?.integrations?.facebook?.pages || []).map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      selectedFormIds: p.selectedFormIds || [],
      allowedStates: p.allowedStates || [],
      defaultAssigneeId: p.defaultAssigneeId || "",
      webhookVerified: p.webhookVerified,
      connectedAt: p.connectedAt,
    }));
    const hasToken = !!tenant?.integrations?.facebook?.userAccessToken;
    res.json({ success: true, data: pages, hasToken });
  }),
);

router.post(
  "/sync",
  protect,
  asyncHandler(async (req, res) => {
    const { pageId, since, until } = req.body;
    const query = req.user.tenantId
      ? { _id: req.user.tenantId }
      : { ownerUser: req.user._id };

    const tenant = await Tenant.findOne(query);
    if (!tenant?.integrations?.facebook?.enabled) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    const pagesToSync = pageId
      ? tenant.integrations.facebook.pages.filter((p) => p.pageId === pageId)
      : tenant.integrations.facebook.pages;

    if (!pagesToSync.length) {
      return res
        .status(400)
        .json({ success: false, message: "No pages to sync" });
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

    const assigneeCache = {};
    const resolveAssignee = async (defaultAssigneeId) => {
      if (!defaultAssigneeId) return adminUser._id;
      if (assigneeCache[defaultAssigneeId])
        return assigneeCache[defaultAssigneeId];
      const u = await User.findById(defaultAssigneeId).catch(() => null);
      assigneeCache[defaultAssigneeId] = u?._id || adminUser._id;
      return assigneeCache[defaultAssigneeId];
    };

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFiltered = 0;
    const pageResults = [];
    const adPlatformCache = {};
    const formNameCache = {};

    for (const page of pagesToSync) {
      const pageResult = {
        pageName: page.pageName,
        forms: 0,
        created: 0,
        updated: 0,
        filtered: 0,
        error: null,
      };

      let formIds = [];
      try {
        formIds = page.selectedFormIds?.length
          ? page.selectedFormIds
          : await (async () => {
              const data = await fbGet(
                `/${page.pageId}/leadgen_forms`,
                page.accessToken,
                {
                  fields: "id",
                },
              );
              return (data.data || []).map((f) => f.id);
            })();
        pageResult.forms = formIds.length;
      } catch (err) {
        pageResult.error = `Could not fetch forms: ${err.message}`;
        pageResults.push(pageResult);
        console.error(
          `[FB sync] Failed to fetch forms for page ${page.pageName}:`,
          err.message,
        );
        continue;
      }

      for (const formId of formIds) {
        try {
          const sinceTs = since
            ? Math.floor(new Date(since).getTime() / 1000)
            : Math.floor((Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000);
          const filtering = [
            { field: "time_created", operator: "GREATER_THAN", value: sinceTs },
          ];
          if (until) {
            const untilTs = Math.floor(new Date(until).getTime() / 1000);
            filtering.push({
              field: "time_created",
              operator: "LESS_THAN",
              value: untilTs,
            });
          }
          const data = await fbGet(`/${formId}/leads`, page.accessToken, {
            fields: "field_data,created_time,ad_id,ad_name,form_id,platform",
            limit: "100",
            filtering: JSON.stringify(filtering),
          });

          for (const lead of data.data || []) {
            try {
              const fMap = {};
              for (const f of lead.field_data || []) {
                fMap[f.name.toLowerCase().replace(/\s+/g, "_")] =
                  f.values?.[0] ?? "";
              }

              const extractCity = (m) =>
                m.city ||
                m.city_town ||
                m["city/town"] ||
                m.district ||
                m.town ||
                Object.entries(m).find(
                  ([k]) =>
                    k.includes("city") ||
                    k.includes("district") ||
                    k.includes("town"),
                )?.[1] ||
                m.location ||
                "";

              let stateRaw = (
                fMap.state ||
                fMap.province ||
                fMap.region ||
                ""
              ).trim();
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
              const allowedStates = page.allowedStates || [];
              if (allowedStates.length > 0 && locationRaw) {
                const matches = allowedStates.some(
                  (s) =>
                    locationRaw.includes(s.toLowerCase()) ||
                    s.toLowerCase().includes(locationRaw),
                );
                if (!matches) {
                  totalFiltered++;
                  pageResult.filtered++;
                  continue;
                }
              }

              const name =
                fMap.full_name ||
                fMap.name ||
                `${fMap.first_name || ""} ${fMap.last_name || ""}`.trim() ||
                "Facebook Lead";

              const formName = await resolveFormName(
                formId,
                page.accessToken,
                formNameCache,
              );

              let adMeta = {
                source: "Facebook",
                platforms: [],
                adsetName: "",
                campaignName: "",
              };
              if (lead.ad_id) {
                adMeta = await resolveAdPlatform(
                  lead.ad_id,
                  page.accessToken,
                  adPlatformCache,
                );
              }

              const leadData = {
                name,
                company: fMap.company_name || fMap.company || "N/A",
                phone: fMap.phone_number || fMap.phone || fMap.mobile || "",
                email: fMap.email || fMap.email_address || "",
                location: extractCity(fMap),
                state: stateRaw,
                requirement:
                  fMap.product ||
                  fMap.product_interest ||
                  `Via Facebook Lead Ad: ${lead.ad_name || formId}`,
                facebookAdId: lead.ad_id || "",
                facebookAdName: lead.ad_name || "",
                facebookPageName: page.pageName || "",
                facebookFormName: formName,
                facebookAdsetName: adMeta.adsetName,
                facebookCampaignName: adMeta.campaignName,
                customFields: extractCustomFields(fMap),
              };

              const p = (lead.platform || "").toLowerCase();
              console.log(
                `[FB sync] lead=${lead.id} platform="${lead.platform}" ad_id="${lead.ad_id}"`,
              );
              let resolvedSource = adMeta.source;
              let resolvedPlatforms = adMeta.platforms;
              if (p === "ig" || p === "instagram") {
                resolvedSource = "Instagram";
                resolvedPlatforms = ["ig"];
              } else if (p === "fb" || p === "facebook") {
                resolvedSource = "Facebook";
                resolvedPlatforms = ["fb"];
              }

              const exists = await Lead.findOne({
                facebookLeadgenId: lead.id,
              });
              if (exists) {
                await Lead.findByIdAndUpdate(exists._id, {
                  $set: {
                    ...leadData,
                    source: resolvedSource,
                    adPlatforms: resolvedPlatforms,
                  },
                });
                totalUpdated++;
                pageResult.updated++;
              } else {
                try {
                  const assigneeId = await resolveAssignee(
                    page.defaultAssigneeId,
                  );
                  await Lead.create({
                    ...leadData,
                    source: resolvedSource,
                    adPlatforms: resolvedPlatforms,
                    status: "PENDING CONTACT",
                    assignedTo: assigneeId,
                    tenantId: tenant._id || null,
                    facebookLeadgenId: lead.id,
                    facebookFormId: formId,
                  });
                  totalCreated++;
                  pageResult.created++;
                } catch (createErr) {
                  if (createErr.code === 11000) {
                    console.warn(
                      `[FB sync] Duplicate lead detected for ${leadData.name} (${leadData.phone}) - skipping`,
                    );
                    totalUpdated++;
                    pageResult.updated++;
                  } else {
                    throw createErr;
                  }
                }
              }
            } catch (err) {
              console.error(
                `[FB sync] Failed to save lead from form ${formId}:`,
                err.message,
              );
            }
          }
        } catch (err) {
          console.error(
            `[FB sync] Failed to fetch leads for form ${formId} on page ${page.pageName}:`,
            err.message,
          );
        }
      }

      pageResults.push(pageResult);
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
        pages: pageResults,
      },
    });
  }),
);

router.get("/webhook-debug", (req, res) => {
  const stored = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  const incoming = req.query["hub.verify_token"];
  res.json({
    tokenSet: !!stored,
    storedLength: stored ? stored.length : 0,
    storedPreview: stored ? stored.substring(0, 4) + "..." : null,
    incomingToken: incoming || null,
    incomingLength: incoming ? incoming.length : 0,
    match: incoming === stored,
  });
});

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const stored = (process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "").trim();

  console.log("[webhook-raw-query]", JSON.stringify(req.query));
  console.log(
    "[webhook]",
    JSON.stringify({ mode, token, stored, match: token === stored }),
  );

  if (mode === "subscribe" && token === stored) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post(
  "/webhook",
  express.raw({ type: "*/*" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-hub-signature-256"];
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (signature && appSecret) {
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", appSecret).update(req.body).digest("hex");
      if (
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        return res.sendStatus(403);
      }
    }

    let body;
    try {
      body = JSON.parse(req.body.toString());
    } catch {
      return res.sendStatus(400);
    }

    if (body.object !== "page") return res.sendStatus(404);

    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      const tenant = await Tenant.findOne({
        "integrations.facebook.pages.pageId": pageId,
        "integrations.facebook.enabled": true,
      });
      if (!tenant) continue;

      const pageConfig = tenant.integrations.facebook.pages.find(
        (p) => p.pageId === pageId,
      );
      if (!pageConfig) continue;

      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, form_id, ad_id, ad_name } = change.value;

        const selectedForms = pageConfig.selectedFormIds || [];
        if (selectedForms.length > 0 && !selectedForms.includes(form_id))
          continue;

        try {
          const fbRes = await fetch(
            `${FB_API}/${leadgen_id}?access_token=${pageConfig.accessToken}&fields=field_data,created_time`,
          );
          const leadData = await fbRes.json();

          if (!leadData || leadData.error) continue;

          const fMap = {};
          for (const f of leadData.field_data || []) {
            fMap[f.name.toLowerCase().replace(/\s+/g, "_")] =
              f.values?.[0] ?? "";
          }

          const name =
            fMap.full_name ||
            fMap.name ||
            `${fMap.first_name || ""} ${fMap.last_name || ""}`.trim() ||
            "Facebook Lead";
          const phone = fMap.phone_number || fMap.phone || fMap.mobile || "";
          const email = fMap.email || fMap.email_address || "";
          const company =
            fMap.company_name || fMap.company || fMap.organization || "";
          const extractCity = (m) =>
            m.city ||
            m.city_town ||
            m["city/town"] ||
            m.district ||
            m.town ||
            Object.entries(m).find(
              ([k]) =>
                k.includes("city") ||
                k.includes("district") ||
                k.includes("town"),
            )?.[1] ||
            m.location ||
            "";

          let cityRaw = extractCity(fMap).trim();
          let stateRaw = (
            fMap.state ||
            fMap.province ||
            fMap.region ||
            ""
          ).trim();
          const product =
            fMap.product || fMap.product_interest || fMap.interested_in || "";

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
          const allowedStates = pageConfig.allowedStates || [];
          if (allowedStates.length > 0 && locationRaw) {
            const stateMatches = allowedStates.some(
              (s) =>
                locationRaw.includes(s.toLowerCase()) ||
                s.toLowerCase().includes(locationRaw),
            );
            if (!stateMatches) continue;
          }

          const formName = await resolveFormName(
            form_id,
            pageConfig.accessToken,
            {},
          );
          const adMeta = await resolveAdPlatform(
            ad_id,
            pageConfig.accessToken,
            {},
          );

          const updatableFields = {
            name,
            company: company || "N/A",
            phone,
            email,
            location: cityRaw,
            state: stateRaw,
            requirement:
              product || `Via Facebook Lead Ad: ${ad_name || form_id}`,
            facebookAdId: ad_id || "",
            facebookAdName: ad_name || "",
            facebookPageName: pageConfig.pageName || "",
            facebookFormName: formName,
            facebookAdsetName: adMeta.adsetName,
            facebookCampaignName: adMeta.campaignName,
            customFields: extractCustomFields(fMap),
          };

          const { source: resolvedSource, platforms: resolvedPlatforms } =
            adMeta;

          const existing = await Lead.findOne({
            facebookLeadgenId: leadgen_id,
          });
          if (existing) {
            await Lead.findByIdAndUpdate(existing._id, {
              $set: {
                ...updatableFields,
                source: resolvedSource,
                adPlatforms: resolvedPlatforms,
              },
            });
            continue;
          }

          let assigneeId = null;
          if (pageConfig.defaultAssigneeId) {
            const u = await User.findById(pageConfig.defaultAssigneeId).catch(
              () => null,
            );
            assigneeId = u?._id || null;
          }
          if (!assigneeId) {
            const adminUser = await User.findOne({
              ...(tenant._id ? { tenantId: tenant._id } : {}),
              role: { $in: ["admin", "super_admin"] },
            });
            if (!adminUser) continue;
            assigneeId = adminUser._id;
          }

          await Lead.create({
            ...updatableFields,
            source: resolvedSource,
            adPlatforms: resolvedPlatforms,
            status: "PENDING CONTACT",
            assignedTo: assigneeId,
            tenantId: tenant._id || null,
            facebookLeadgenId: leadgen_id,
            facebookFormId: form_id,
          });
        } catch {}
      }
    }
  }),
);

router.get(
  "/meta-campaigns",
  protect,
  asyncHandler(async (req, res) => {
    const query = req.user.tenantId
      ? { _id: req.user.tenantId }
      : { ownerUser: req.user._id };
    const tenant = await Tenant.findOne(query);
    const userToken = tenant?.integrations?.facebook?.userAccessToken;

    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    let adAccounts = [];
    try {
      const acData = await fbGet("/me/adaccounts", userToken, {
        fields: "id,name,currency,account_status,amount_spent",
        limit: "20",
      });
      adAccounts = acData.data || [];
    } catch (err) {
      const needsReconnect =
        err.message?.includes("#100") ||
        err.message?.includes("Unsupported") ||
        err.message?.includes("permission");
      return res.status(needsReconnect ? 403 : 400).json({
        success: false,
        message: needsReconnect
          ? "Ads permission missing. Please reconnect Facebook from Integrations → Facebook → Disconnect & reconnect to grant Ads access."
          : err.message,
        code: needsReconnect ? "ADS_PERMISSION_MISSING" : "API_ERROR",
      });
    }

    const allCampaigns = [];
    for (const account of adAccounts) {
      let campaigns;
      try {
        campaigns = await fbGetAllWithFallback(
          `/${account.id}/campaigns`,
          userToken,
          CAMPAIGN_FIELDS,
          "meta-campaigns",
        );
      } catch (err) {
        console.error(
          `[meta-campaigns] fetch failed for ${account.id}:`,
          err.message,
        );
        continue;
      }
      for (const c of campaigns) {
        allCampaigns.push({
          ...c,
          adAccountId: account.id,
          adAccountName: account.name,
          currency: account.currency || "INR",
        });
      }
    }

    // Non-admins only ever see campaigns an admin has assigned to them —
    // this is their whole "My Campaigns" view, not the full ad account.
    let visibleCampaigns = allCampaigns;
    if (!["admin", "super_admin"].includes(req.user.role)) {
      const assignedIds = await getAssignedCampaignIds(req);
      visibleCampaigns = allCampaigns.filter((c) => assignedIds.has(c.id));
    }

    res.json({
      success: true,
      count: visibleCampaigns.length,
      data: visibleCampaigns,
      adAccounts,
    });
  }),
);

async function resolveCampaignIdForNode(id, token) {
  try {
    const data = await fbGet(`/${id}`, token, { fields: "campaign_id" });
    return data.campaign_id || id;
  } catch {
    return id;
  }
}

router.get(
  "/meta-campaigns/:id/adsets",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    try {
      await assertCampaignAccess(req, req.params.id);
      const adSets = await fbGetAllWithFallback(
        `/${req.params.id}/adsets`,
        userToken,
        ADSET_FIELDS,
        "meta-campaigns/adsets",
      );
      res.json({ success: true, count: adSets.length, data: adSets });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.get(
  "/adsets/:id/ads",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    try {
      const campaignId = await resolveCampaignIdForNode(req.params.id, userToken);
      await assertCampaignAccess(req, campaignId);
      const ads = await fbGetAllWithFallback(
        `/${req.params.id}/ads`,
        userToken,
        AD_FIELDS,
        "adsets/ads",
      );
      const normalized = ads.map(normalizeAd);
      res.json({ success: true, count: normalized.length, data: normalized });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

// Flat cross-campaign views, matching Ads Manager's "Ad sets" / "Ads" tabs
// (every ad set/ad across every campaign in one list, not drilled into one
// campaign at a time).
router.get(
  "/all-adsets",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    try {
      const acData = await fbGet("/me/adaccounts", userToken, {
        fields: "id,name",
        limit: "20",
      });
      const adAccounts = acData.data || [];
      const isAdmin = ["admin", "super_admin"].includes(req.user.role);
      const assignedIds = isAdmin ? null : await getAssignedCampaignIds(req);

      const allAdSets = [];
      for (const account of adAccounts) {
        let campaigns;
        try {
          campaigns = await fbGetAllWithFallback(
            `/${account.id}/campaigns`,
            userToken,
            "id,name",
            "all-adsets/campaigns",
          );
        } catch {
          continue;
        }
        if (assignedIds) campaigns = campaigns.filter((c) => assignedIds.has(c.id));

        const perCampaign = await Promise.all(
          campaigns.map(async (c) => {
            try {
              const sets = await fbGetAllWithFallback(
                `/${c.id}/adsets`,
                userToken,
                ADSET_FIELDS,
                "all-adsets",
              );
              return sets.map((s) => ({
                ...s,
                campaignName: c.name,
                adAccountName: account.name,
              }));
            } catch {
              return [];
            }
          }),
        );
        perCampaign.forEach((sets) => allAdSets.push(...sets));
      }

      res.json({ success: true, count: allAdSets.length, data: allAdSets });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.get(
  "/all-ads",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    try {
      const acData = await fbGet("/me/adaccounts", userToken, {
        fields: "id,name",
        limit: "20",
      });
      const adAccounts = acData.data || [];
      const isAdmin = ["admin", "super_admin"].includes(req.user.role);
      const assignedIds = isAdmin ? null : await getAssignedCampaignIds(req);

      const allAds = [];
      for (const account of adAccounts) {
        let campaigns;
        try {
          campaigns = await fbGetAllWithFallback(
            `/${account.id}/campaigns`,
            userToken,
            "id,name",
            "all-ads/campaigns",
          );
        } catch {
          continue;
        }
        if (assignedIds) campaigns = campaigns.filter((c) => assignedIds.has(c.id));

        for (const c of campaigns) {
          let adSets;
          try {
            adSets = await fbGetAllWithFallback(
              `/${c.id}/adsets`,
              userToken,
              "id,name",
              "all-ads/adsets",
            );
          } catch {
            continue;
          }

          const perAdSet = await Promise.all(
            adSets.map(async (s) => {
              try {
                const ads = await fbGetAllWithFallback(
                  `/${s.id}/ads`,
                  userToken,
                  AD_FIELDS,
                  "all-ads",
                );
                return ads.map((a) => ({
                  ...normalizeAd(a),
                  campaignName: c.name,
                  adSetName: s.name,
                  adAccountName: account.name,
                }));
              } catch {
                return [];
              }
            }),
          );
          perAdSet.forEach((ads) => allAds.push(...ads));
        }
      }

      res.json({ success: true, count: allAds.length, data: allAds });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.get(
  "/meta-campaigns/:id/insights",
  protect,
  asyncHandler(async (req, res) => {
    const query = req.user.tenantId
      ? { _id: req.user.tenantId }
      : { ownerUser: req.user._id };
    const tenant = await Tenant.findOne(query);
    const userToken = tenant?.integrations?.facebook?.userAccessToken;

    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }

    try {
      const { since, until, datePreset } = req.query;
      const params = {
        fields:
          "impressions,clicks,spend,reach,cpm,cpc,ctr,frequency,actions",
      };
      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = datePreset || "last_30d";
      }
      const data = await fbGet(`/${req.params.id}/insights`, userToken, params);
      res.json({ success: true, data: data.data?.[0] || null });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

// --- Write endpoints: let an admin-assigned employee actually run "their"
// campaign end-to-end (status, budget, targeting, ad sets, ads) — not just
// view it. Admins can do all of this on any campaign; everyone else only on
// campaigns a CampaignAssignment ties to them (see assertCampaignAccess).

router.post(
  "/meta-campaigns",
  protect,
  asyncHandler(async (req, res) => {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only an admin can create a new campaign — ask them to create it and assign it to you.",
      });
    }
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    const {
      adAccountId,
      name,
      objective,
      status,
      daily_budget,
      lifetime_budget,
      start_time,
      stop_time,
    } = req.body;
    if (!adAccountId || !name || !objective) {
      return res.status(400).json({
        success: false,
        message: "adAccountId, name and objective are required",
      });
    }
    try {
      const data = await fbWrite(`/${adAccountId}/campaigns`, userToken, {
        name,
        objective,
        status: status || "PAUSED",
        special_ad_categories: [],
        daily_budget,
        lifetime_budget,
        start_time,
        stop_time,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

router.put(
  "/meta-campaigns/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      await assertCampaignAccess(req, req.params.id);
      const { name, status, daily_budget, lifetime_budget, start_time, stop_time } =
        req.body;
      const data = await fbWrite(`/${req.params.id}`, userToken, {
        name,
        status,
        daily_budget,
        lifetime_budget,
        start_time,
        stop_time,
      });
      res.json({ success: true, data });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.delete(
  "/meta-campaigns/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      await assertCampaignAccess(req, req.params.id);
      await fbWrite(`/${req.params.id}`, userToken, {}, "DELETE");
      res.json({ success: true, message: "Campaign deleted" });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.post(
  "/adsets",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    const {
      campaign_id,
      name,
      daily_budget,
      lifetime_budget,
      start_time,
      end_time,
      targeting,
      optimization_goal,
      billing_event,
      bid_amount,
      status,
    } = req.body;
    if (!campaign_id || !name) {
      return res
        .status(400)
        .json({ success: false, message: "campaign_id and name are required" });
    }
    try {
      await assertCampaignAccess(req, campaign_id);
      const campaign = await fbGet(`/${campaign_id}`, userToken, {
        fields: "account_id",
      });
      if (!campaign.account_id) {
        return res.status(400).json({
          success: false,
          message: "Could not resolve the ad account for this campaign",
        });
      }
      const data = await fbWrite(`/act_${campaign.account_id}/adsets`, userToken, {
        campaign_id,
        name,
        daily_budget,
        lifetime_budget,
        start_time,
        end_time,
        targeting: targeting || { geo_locations: { countries: ["IN"] } },
        optimization_goal: optimization_goal || "LINK_CLICKS",
        billing_event: billing_event || "IMPRESSIONS",
        bid_amount,
        status: status || "PAUSED",
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.put(
  "/adsets/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      const campaignId = await resolveCampaignIdForNode(req.params.id, userToken);
      await assertCampaignAccess(req, campaignId);
      const {
        name,
        status,
        daily_budget,
        lifetime_budget,
        start_time,
        end_time,
        targeting,
        optimization_goal,
        billing_event,
        bid_amount,
      } = req.body;
      const data = await fbWrite(`/${req.params.id}`, userToken, {
        name,
        status,
        daily_budget,
        lifetime_budget,
        start_time,
        end_time,
        targeting,
        optimization_goal,
        billing_event,
        bid_amount,
      });
      res.json({ success: true, data });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.delete(
  "/adsets/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      const campaignId = await resolveCampaignIdForNode(req.params.id, userToken);
      await assertCampaignAccess(req, campaignId);
      await fbWrite(`/${req.params.id}`, userToken, {}, "DELETE");
      res.json({ success: true, message: "Ad set deleted" });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.post(
  "/ads",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    const {
      adset_id,
      name,
      status,
      page_id,
      title,
      body,
      link_url,
      image_url,
      call_to_action_type,
    } = req.body;
    if (!adset_id || !name) {
      return res
        .status(400)
        .json({ success: false, message: "adset_id and name are required" });
    }
    try {
      const campaignId = await resolveCampaignIdForNode(adset_id, userToken);
      await assertCampaignAccess(req, campaignId);

      const tenantQuery = req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id };
      const tenant = await Tenant.findOne(tenantQuery);
      const pages = tenant?.integrations?.facebook?.pages || [];
      const page = page_id ? pages.find((p) => p.pageId === page_id) : pages[0];
      if (!page) {
        return res.status(400).json({
          success: false,
          message:
            "Connect a Facebook Page first (Integrations → Facebook) before creating an ad",
        });
      }

      const adSet = await fbGet(`/${adset_id}`, userToken, {
        fields: "account_id",
      });
      const accountId = `act_${adSet.account_id}`;

      const creative = await fbWrite(`/${accountId}/adcreatives`, userToken, {
        name: `${name} Creative`,
        object_story_spec: {
          page_id: page.pageId,
          link_data: {
            link: link_url || `https://www.facebook.com/${page.pageId}`,
            message: body,
            name: title,
            picture: image_url,
            call_to_action: call_to_action_type
              ? { type: call_to_action_type, value: { link: link_url } }
              : undefined,
          },
        },
      });

      const data = await fbWrite(`/${accountId}/ads`, userToken, {
        name,
        adset_id,
        status: status || "PAUSED",
        creative: { creative_id: creative.id },
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.put(
  "/ads/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      const campaignId = await resolveCampaignIdForNode(req.params.id, userToken);
      await assertCampaignAccess(req, campaignId);

      const { name, status, page_id, title, body, link_url, image_url, call_to_action_type } =
        req.body;
      const updateParams = { name, status };

      if (title || body || link_url || image_url || call_to_action_type) {
        const ad = await fbGet(`/${req.params.id}`, userToken, {
          fields: "account_id,adset_id",
        });
        const tenantQuery = req.user.tenantId
          ? { _id: req.user.tenantId }
          : { ownerUser: req.user._id };
        const tenant = await Tenant.findOne(tenantQuery);
        const pages = tenant?.integrations?.facebook?.pages || [];
        const page = page_id ? pages.find((p) => p.pageId === page_id) : pages[0];
        if (!page) {
          return res.status(400).json({
            success: false,
            message: "Connect a Facebook Page first (Integrations → Facebook)",
          });
        }
        const accountId = `act_${ad.account_id}`;
        const creative = await fbWrite(`/${accountId}/adcreatives`, userToken, {
          name: `${name || "Ad"} Creative`,
          object_story_spec: {
            page_id: page.pageId,
            link_data: {
              link: link_url || `https://www.facebook.com/${page.pageId}`,
              message: body,
              name: title,
              picture: image_url,
              call_to_action: call_to_action_type
                ? { type: call_to_action_type, value: { link: link_url } }
                : undefined,
            },
          },
        });
        updateParams.creative = { creative_id: creative.id };
      }

      const data = await fbWrite(`/${req.params.id}`, userToken, updateParams);
      res.json({ success: true, data });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

router.delete(
  "/ads/:id",
  protect,
  asyncHandler(async (req, res) => {
    const userToken = await getFbUserToken(req);
    if (!userToken) {
      return res
        .status(400)
        .json({ success: false, message: "Facebook not connected" });
    }
    try {
      const campaignId = await resolveCampaignIdForNode(req.params.id, userToken);
      await assertCampaignAccess(req, campaignId);
      await fbWrite(`/${req.params.id}`, userToken, {}, "DELETE");
      res.json({ success: true, message: "Ad deleted" });
    } catch (err) {
      res
        .status(err.statusCode || 400)
        .json({ success: false, message: err.message });
    }
  }),
);

module.exports = router;
