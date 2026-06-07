const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");
const { resolvePincode, isPincode } = require("../utils/pincode");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const User = require("../models/User");

const FB_API = "https://graph.facebook.com/v20.0";
const FB_SCOPES = [
  "email",
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "leads_retrieval",
  "pages_manage_metadata",
  "business_management",
  "ads_read",
  "ads_management",
].join(",");

async function fbGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await fetch(`${FB_API}${path}?${qs}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Facebook API error");
  return data;
}

/**
 * Resolve publisher_platforms for an ad_id.
 * Returns "Instagram" if only IG, "Facebook" if only FB, "Meta" if both.
 * Uses an in-memory cache per sync run to avoid duplicate API calls.
 */
async function resolveAdPlatform(adId, token, cache) {
  if (!adId) return { source: "Facebook", platforms: [] };
  if (cache[adId]) return cache[adId];
  try {
    const data = await fbGet(`/${adId}`, token, { fields: "publisher_platforms" });
    const platforms = data.publisher_platforms || [];
    const hasFb = platforms.includes("facebook");
    const hasIg = platforms.includes("instagram");
    let source = "Facebook";
    if (hasIg && !hasFb) source = "Instagram";
    else if (hasIg && hasFb) source = "Meta";
    const result = { source, platforms };
    cache[adId] = result;
    return result;
  } catch {
    // If ad lookup fails (e.g. ad deleted), default to Facebook
    cache[adId] = { source: "Facebook", platforms: [] };
    return cache[adId];
  }
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

    // Fetch personal account pages
    const personalData = await fbGet("/me/accounts", token, {
      fields: "id,name,picture,fan_count,category",
    });
    const personalPages = personalData.data || [];

    // Fetch Business Manager pages
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

    // Merge and deduplicate by page id
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

    // Upsert: update existing page entry or push new one
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
      // Remove a specific page
      await Tenant.findOneAndUpdate(query, {
        $pull: { "integrations.facebook.pages": { pageId } },
      });
      // Disable if no pages remain
      const tenant = await Tenant.findOne(query);
      if (!tenant?.integrations?.facebook?.pages?.length) {
        await Tenant.findOneAndUpdate(query, {
          "integrations.facebook.enabled": false,
          "integrations.facebook.userAccessToken": "",
        });
      }
    } else {
      // Disconnect everything
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
    const { pageId } = req.body;
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

    // Cache resolved assignees to avoid repeated DB hits per page
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
          const twoDaysAgo = Math.floor(
            (Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000,
          );
          const data = await fbGet(`/${formId}/leads`, page.accessToken, {
            fields: "field_data,created_time,ad_id,ad_name,form_id,platform",
            limit: "100",
            filtering: JSON.stringify([
              {
                field: "time_created",
                operator: "GREATER_THAN",
                value: twoDaysAgo,
              },
            ]),
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

              let stateRaw = (fMap.state || fMap.province || fMap.region || "").trim();
              let cityRaw = extractCity(fMap).trim();
              // If state/city looks like a pincode, resolve it first
              if (isPincode(stateRaw)) {
                const resolved = await resolvePincode(stateRaw);
                if (resolved) { stateRaw = resolved.state; if (!cityRaw) cityRaw = resolved.city; }
              } else if (isPincode(cityRaw)) {
                const resolved = await resolvePincode(cityRaw);
                if (resolved) { cityRaw = resolved.city; if (!stateRaw) stateRaw = resolved.state; }
              }
              const locationRaw = (stateRaw || cityRaw).toLowerCase().trim();
              const allowedStates = page.allowedStates || [];
              if (allowedStates.length > 0 && locationRaw) {
                const matches = allowedStates.some(
                  (s) => locationRaw.includes(s.toLowerCase()) || s.toLowerCase().includes(locationRaw),
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

              const leadData = {
                name,
                company: fMap.company_name || fMap.company || "N/A",
                phone: fMap.phone_number || fMap.phone || fMap.mobile || "",
                email: fMap.email || fMap.email_address || "",
                location: extractCity(fMap),
                requirement:
                  fMap.product ||
                  fMap.product_interest ||
                  `Via Facebook Lead Ad: ${lead.ad_name || formId}`,
                facebookAdId: lead.ad_id || "",
                facebookAdName: lead.ad_name || "",
                facebookPageName: page.pageName || "",
              };

              const p = (lead.platform || "").toLowerCase();
              console.log(`[FB sync] lead=${lead.id} platform="${lead.platform}" ad_id="${lead.ad_id}"`);
              let resolvedSource = "Facebook";
              let resolvedPlatforms = [];
              if (p === "ig" || p === "instagram") {
                resolvedSource = "Instagram";
                resolvedPlatforms = ["ig"];
              } else if (p === "fb" || p === "facebook") {
                resolvedSource = "Facebook";
                resolvedPlatforms = ["fb"];
              } else if (lead.ad_id) {
                // platform field missing — fall back to ad publisher_platforms lookup
                const r = await resolveAdPlatform(lead.ad_id, page.accessToken, adPlatformCache);
                resolvedSource = r.source;
                resolvedPlatforms = r.platforms;
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
                  // Handle duplicate key error
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
          let stateRaw = (fMap.state || fMap.province || fMap.region || "").trim();
          const product =
            fMap.product || fMap.product_interest || fMap.interested_in || "";

          // Resolve pincode → city/state before location filter
          if (isPincode(stateRaw)) {
            const resolved = await resolvePincode(stateRaw);
            if (resolved) { stateRaw = resolved.state; if (!cityRaw) cityRaw = resolved.city; }
          } else if (isPincode(cityRaw)) {
            const resolved = await resolvePincode(cityRaw);
            if (resolved) { cityRaw = resolved.city; if (!stateRaw) stateRaw = resolved.state; }
          }

          // Location filter — only block if location is explicitly a non-matching city
          const locationRaw = (stateRaw || cityRaw).toLowerCase().trim();
          const allowedStates = pageConfig.allowedStates || [];
          if (allowedStates.length > 0 && locationRaw) {
            const stateMatches = allowedStates.some(
              (s) => locationRaw.includes(s.toLowerCase()) || s.toLowerCase().includes(locationRaw),
            );
            if (!stateMatches) continue;
          }

          const updatableFields = {
            name,
            company: company || "N/A",
            phone,
            email,
            location: city,
            requirement:
              product || `Via Facebook Lead Ad: ${ad_name || form_id}`,
            facebookAdId: ad_id || "",
            facebookAdName: ad_name || "",
            facebookPageName: pageConfig.pageName || "",
          };

          const { source: resolvedSource, platforms: resolvedPlatforms } =
            await resolveAdPlatform(ad_id, pageConfig.accessToken, {});

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
        } catch {
          // Silently continue — don't let one failed lead stop processing others
        }
      }
    }
  }),
);

// ─── Meta Ads Campaigns ───────────────────────────────────────────────────────

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

    // Fetch ad accounts
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

    // Fetch campaigns for every active ad account
    const allCampaigns = [];
    for (const account of adAccounts) {
      try {
        const cpData = await fbGet(`/${account.id}/campaigns`, userToken, {
          fields:
            "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time",
          limit: "100",
        });
        for (const c of cpData.data || []) {
          allCampaigns.push({
            ...c,
            adAccountId: account.id,
            adAccountName: account.name,
            currency: account.currency || "INR",
          });
        }
      } catch {
        // skip accounts with insufficient permissions
      }
    }

    res.json({
      success: true,
      count: allCampaigns.length,
      data: allCampaigns,
      adAccounts,
    });
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
      const data = await fbGet(`/${req.params.id}/insights`, userToken, {
        fields: "impressions,clicks,spend,reach,cpm,cpc,ctr,frequency",
        date_preset: req.query.datePreset || "last_30d",
      });
      res.json({ success: true, data: data.data?.[0] || null });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }),
);

module.exports = router;
