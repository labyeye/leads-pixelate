const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");
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
].join(",");

async function fbGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await fetch(`${FB_API}${path}?${qs}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Facebook API error");
  return data;
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
      return res
        .status(400)
        .json({
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
    const { pageId, selectedFormIds = [] } = req.body;

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

    const { token: pageToken, name: pageName } = await getPageToken(
      pageId,
      userToken,
    );
    const subscribed = await subscribePageToWebhook(pageId, pageToken);

    await Tenant.findOneAndUpdate(
      req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id },
      {
        "integrations.facebook.enabled": true,
        "integrations.facebook.pageId": pageId,
        "integrations.facebook.pageName": pageName,
        "integrations.facebook.accessToken": pageToken,
        "integrations.facebook.selectedFormIds": selectedFormIds,
        "integrations.facebook.webhookVerified": subscribed,
        "integrations.facebook.connectedAt": new Date(),
      },
    );

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
    await Tenant.findOneAndUpdate(
      req.user.tenantId
        ? { _id: req.user.tenantId }
        : { ownerUser: req.user._id },
      {
        "integrations.facebook.enabled": false,
        "integrations.facebook.pageId": "",
        "integrations.facebook.pageName": "",
        "integrations.facebook.accessToken": "",
        "integrations.facebook.userAccessToken": "",
        "integrations.facebook.selectedFormIds": [],
        "integrations.facebook.webhookVerified": false,
      },
    );
    res.json({ success: true, message: "Facebook disconnected" });
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
        "integrations.facebook.pageId": pageId,
      });
      if (!tenant || !tenant.integrations.facebook.enabled) continue;

      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, form_id, ad_id, ad_name } = change.value;

        const selectedForms =
          tenant.integrations.facebook.selectedFormIds || [];
        if (selectedForms.length > 0 && !selectedForms.includes(form_id))
          continue;

        try {
          const exists = await Lead.findOne({ facebookLeadgenId: leadgen_id });
          if (exists) continue;

          const fbRes = await fetch(
            `${FB_API}/${leadgen_id}?access_token=${tenant.integrations.facebook.accessToken}&fields=field_data,created_time`,
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
          const city = fMap.city || fMap.location || "";
          const product =
            fMap.product || fMap.product_interest || fMap.interested_in || "";

          const adminUser = await User.findOne({
            ...(tenant._id ? { tenantId: tenant._id } : {}),
            role: { $in: ["admin", "super_admin"] },
          });
          if (!adminUser) continue;

          await Lead.create({
            name,
            company: company || "N/A",
            phone,
            email,
            location: city,
            source: "Facebook",
            requirement:
              product || `Via Facebook Lead Ad: ${ad_name || form_id}`,
            status: "PENDING CONTACT",
            assignedTo: adminUser._id,
            tenantId: tenant._id || null,
            facebookLeadgenId: leadgen_id,
            facebookFormId: form_id,
            facebookAdId: ad_id || "",
          });
        } catch {
          // Silently continue — don't let one failed lead stop processing others
        }
      }
    }
  }),
);

module.exports = router;
