const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const WhatsappCampaign = require("../models/WhatsappCampaign");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const { encrypt, decrypt } = require("../utils/encryption");

const WA_API = "https://graph.facebook.com/v20.0";

// ---------------------------------------------------------------------------
// Tenant helpers
// ---------------------------------------------------------------------------

function getTenantQuery(user) {
  return user.tenantId ? { _id: user.tenantId } : { ownerUser: user._id };
}

async function getWaConfig(user) {
  const tenant = await Tenant.findOne(getTenantQuery(user));
  const wa = tenant?.integrations?.whatsapp;
  if (!wa?.isConnected || !wa?.phoneNumberId || !wa?.accessToken) return null;
  return {
    tenantId: tenant._id,
    phoneNumberId: wa.phoneNumberId,
    accessToken: decrypt(wa.accessToken),
    wabaId: wa.wabaId,
    businessName: wa.businessName,
    phoneNumber: wa.phoneNumber,
    webhookVerifyToken: wa.webhookVerifyToken,
    approvedTemplateCount: wa.approvedTemplateCount,
    lastSyncAt: wa.lastSyncAt,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > 10) return digits;
  if (digits.length === 10) return "91" + digits;
  return digits;
}

function resolveVariable(fieldKey, customValue, lead) {
  const map = {
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    location: lead.location,
    requirement: lead.requirement,
    budget: lead.budget,
    custom: customValue,
  };
  return map[fieldKey] || customValue || "";
}

function buildTemplateComponents(template, variableMapping, lead) {
  const components = [];

  if (template.headerType === "TEXT" && template.headerText) {
    components.push({ type: "header", parameters: [{ type: "text", text: template.headerText }] });
  } else if (template.headerType === "DOCUMENT" && template.headerMediaId) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { id: template.headerMediaId, filename: template.headerMediaName || "document.pdf" } }],
    });
  } else if (template.headerType === "IMAGE" && template.headerMediaId) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { id: template.headerMediaId } }],
    });
  }

  if (variableMapping?.length > 0) {
    const params = [...variableMapping]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({ type: "text", text: resolveVariable(v.fieldKey, v.customValue, lead) }));
    if (params.length > 0) components.push({ type: "body", parameters: params });
  }

  return components;
}

async function sendWaMessage(phoneNumberId, accessToken, to, templateName, language, components) {
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: language || "en" } },
  };
  if (components?.length > 0) body.template.components = components;

  const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "WhatsApp API error");
  return data;
}

// ---------------------------------------------------------------------------
// Connection — Embedded Signup OAuth
// ---------------------------------------------------------------------------

// POST /api/whatsapp/connect
// Body: { code } — short-lived code from Meta Embedded Signup JS SDK
exports.connectEmbeddedSignup = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400);
    throw new Error("code is required");
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI || "https://leads.pixelatenest.com";

  if (!appId || !appSecret) {
    res.status(500);
    throw new Error("Facebook App credentials not configured");
  }

  // Exchange code for token
  const tokenRes = await fetch(
    `${WA_API}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    res.status(400);
    throw new Error(tokenData.error?.message || "Failed to exchange code for token");
  }

  const userToken = tokenData.access_token;

  // Get WABA and phone number details
  let wabaId, phoneNumberId, businessName, phoneNumber;
  try {
    const debugRes = await fetch(`${WA_API}/debug_token?input_token=${userToken}&access_token=${appId}|${appSecret}`);
    const debugData = await debugRes.json();
    wabaId = debugData?.data?.granular_scopes?.find((s) => s.scope === "whatsapp_business_management")?.target_ids?.[0] || "";
  } catch (_) {}

  // If WABA ID available, fetch phone number details
  if (wabaId) {
    try {
      const phoneRes = await fetch(`${WA_API}/${wabaId}/phone_numbers?access_token=${userToken}`);
      const phoneData = await phoneRes.json();
      const firstPhone = phoneData?.data?.[0];
      if (firstPhone) {
        phoneNumberId = firstPhone.id;
        phoneNumber = firstPhone.display_phone_number;
        businessName = firstPhone.verified_name;
      }
    } catch (_) {}
  }

  const webhookVerifyToken = crypto.randomBytes(16).toString("hex");
  const encryptedToken = encrypt(userToken);

  await Tenant.findOneAndUpdate(
    getTenantQuery(req.user),
    {
      "integrations.whatsapp.enabled": true,
      "integrations.whatsapp.isConnected": true,
      "integrations.whatsapp.wabaId": wabaId || "",
      "integrations.whatsapp.phoneNumberId": phoneNumberId || "",
      "integrations.whatsapp.accessToken": encryptedToken,
      "integrations.whatsapp.businessName": businessName || "",
      "integrations.whatsapp.phoneNumber": phoneNumber || "",
      "integrations.whatsapp.webhookVerifyToken": webhookVerifyToken,
      "integrations.whatsapp.lastSyncAt": new Date(),
    },
    { new: true }
  );

  res.json({
    success: true,
    message: "WhatsApp Business connected successfully",
    data: { wabaId, phoneNumberId, businessName, phoneNumber },
  });
});

// POST /api/whatsapp/connect-manual
// Body: { phoneNumberId, accessToken, wabaId, businessName, phoneNumber }
exports.connectManual = asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, wabaId, businessName, phoneNumber } = req.body;

  if (!phoneNumberId || !accessToken) {
    res.status(400);
    throw new Error("phoneNumberId and accessToken are required");
  }

  // Validate token with Meta
  const testRes = await fetch(`${WA_API}/${phoneNumberId}?access_token=${accessToken}&fields=display_phone_number,verified_name`);
  const testData = await testRes.json();
  if (testData.error) {
    res.status(400);
    throw new Error("Invalid credentials: " + (testData.error.message || "Meta API rejected token"));
  }

  const webhookVerifyToken = crypto.randomBytes(16).toString("hex");

  await Tenant.findOneAndUpdate(
    getTenantQuery(req.user),
    {
      "integrations.whatsapp.enabled": true,
      "integrations.whatsapp.isConnected": true,
      "integrations.whatsapp.wabaId": wabaId || "",
      "integrations.whatsapp.phoneNumberId": phoneNumberId,
      "integrations.whatsapp.accessToken": encrypt(accessToken),
      "integrations.whatsapp.businessName": businessName || testData.verified_name || "",
      "integrations.whatsapp.phoneNumber": phoneNumber || testData.display_phone_number || "",
      "integrations.whatsapp.webhookVerifyToken": webhookVerifyToken,
      "integrations.whatsapp.lastSyncAt": new Date(),
    },
    { new: true }
  );

  res.json({
    success: true,
    message: "WhatsApp connected successfully",
    data: { phoneNumberId, wabaId, businessName: businessName || testData.verified_name },
  });
});

// POST /api/whatsapp/disconnect
exports.disconnect = asyncHandler(async (req, res) => {
  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    "integrations.whatsapp.enabled": false,
    "integrations.whatsapp.isConnected": false,
    "integrations.whatsapp.wabaId": "",
    "integrations.whatsapp.phoneNumberId": "",
    "integrations.whatsapp.accessToken": "",
    "integrations.whatsapp.businessName": "",
    "integrations.whatsapp.phoneNumber": "",
  });
  res.json({ success: true, message: "WhatsApp disconnected" });
});

// GET /api/whatsapp/status
exports.getStatus = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne(getTenantQuery(req.user));
  const wa = tenant?.integrations?.whatsapp || {};
  res.json({
    success: true,
    data: {
      isConnected: !!wa.isConnected,
      businessName: wa.businessName || "",
      phoneNumber: wa.phoneNumber || "",
      wabaId: wa.wabaId || "",
      phoneNumberId: wa.phoneNumberId || "",
      lastSyncAt: wa.lastSyncAt || null,
      approvedTemplateCount: wa.approvedTemplateCount || 0,
      webhookVerifyToken: wa.webhookVerifyToken || "",
    },
  });
});

// GET /api/whatsapp/config (legacy — keep for backward compat)
exports.getConfig = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne(getTenantQuery(req.user));
  const wa = tenant?.integrations?.whatsapp || {};
  res.json({
    success: true,
    data: {
      phoneNumberId: wa.phoneNumberId || "",
      webhookVerifyToken: wa.webhookVerifyToken || "",
      appId: process.env.FACEBOOK_APP_ID || "",
      isConfigured: !!(wa.isConnected && wa.phoneNumberId && wa.accessToken),
    },
  });
});

// ---------------------------------------------------------------------------
// Templates (multi-tenant)
// ---------------------------------------------------------------------------

exports.getTemplates = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const templates = await WhatsappTemplate.find(tenantFilter)
    .sort({ createdAt: -1 })
    .populate("createdBy", "name");
  res.json({ success: true, count: templates.length, data: templates });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const { name, displayName, category, language, headerType, headerText, bodyText, footerText, buttons, metaTemplateName, notes } = req.body;

  const varMatches = (bodyText || "").match(/\{\{\d+\}\}/g) || [];
  const variableCount = new Set(varMatches).size;

  const template = await WhatsappTemplate.create({
    name,
    displayName,
    category,
    language,
    headerType,
    headerText,
    bodyText,
    footerText,
    buttons,
    metaTemplateName: metaTemplateName || name,
    notes,
    variableCount,
    tenantId: req.user.tenantId || null,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: template });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  let template = await WhatsappTemplate.findOne({ _id: req.params.id, ...tenantFilter });
  if (!template) { res.status(404); throw new Error("Template not found"); }

  if (req.body.bodyText !== undefined) {
    const varMatches = (req.body.bodyText || "").match(/\{\{\d+\}\}/g) || [];
    req.body.variableCount = new Set(varMatches).size;
  }

  template = await WhatsappTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.json({ success: true, data: template });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const template = await WhatsappTemplate.findOne({ _id: req.params.id, ...tenantFilter });
  if (!template) { res.status(404); throw new Error("Template not found"); }
  await template.deleteOne();
  res.json({ success: true, message: "Template deleted" });
});

// POST /api/whatsapp/sync-templates — pull approved templates from Meta
exports.syncTemplates = asyncHandler(async (req, res) => {
  const config = await getWaConfig(req.user);
  if (!config) { res.status(400); throw new Error("WhatsApp is not connected"); }

  if (!config.wabaId) { res.status(400); throw new Error("WABA ID not set. Please reconnect WhatsApp."); }

  const metaRes = await fetch(
    `${WA_API}/${config.wabaId}/message_templates?access_token=${config.accessToken}&fields=name,category,language,status,components&limit=100`
  );
  const metaData = await metaRes.json();
  if (metaData.error) throw new Error(metaData.error.message);

  const templates = metaData.data || [];
  let synced = 0;
  const tenantId = req.user.tenantId || null;

  for (const t of templates) {
    const body = t.components?.find((c) => c.type === "BODY");
    const header = t.components?.find((c) => c.type === "HEADER");
    const footer = t.components?.find((c) => c.type === "FOOTER");
    const buttons = t.components?.find((c) => c.type === "BUTTONS");

    const varMatches = (body?.text || "").match(/\{\{\d+\}\}/g) || [];

    await WhatsappTemplate.findOneAndUpdate(
      { metaTemplateName: t.name, tenantId },
      {
        name: t.name.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
        displayName: t.name,
        metaTemplateName: t.name,
        category: t.category,
        language: t.language,
        status: t.status === "APPROVED" ? "APPROVED" : t.status === "REJECTED" ? "REJECTED" : "PENDING",
        headerType: header?.format || "NONE",
        headerText: header?.text || "",
        bodyText: body?.text || "",
        footerText: footer?.text || "",
        buttons: (buttons?.buttons || []).map((b) => ({ type: b.type, text: b.text, url: b.url, phoneNumber: b.phone_number })),
        variableCount: new Set(varMatches).size,
        tenantId,
      },
      { upsert: true, new: true, runValidators: false }
    );
    synced++;
  }

  const approvedCount = templates.filter((t) => t.status === "APPROVED").length;
  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    "integrations.whatsapp.approvedTemplateCount": approvedCount,
    "integrations.whatsapp.lastSyncAt": new Date(),
  });

  res.json({ success: true, message: `Synced ${synced} templates from Meta`, data: { synced, approved: approvedCount } });
});

// ---------------------------------------------------------------------------
// Campaigns (multi-tenant)
// ---------------------------------------------------------------------------

exports.getCampaigns = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaigns = await WhatsappCampaign.find(tenantFilter)
    .sort({ createdAt: -1 })
    .populate("template", "displayName name")
    .populate("createdBy", "name")
    .select("-messages -replies");
  res.json({ success: true, count: campaigns.length, data: campaigns });
});

exports.getCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await WhatsappCampaign.findOne({ _id: req.params.id, ...tenantFilter })
    .populate("template")
    .populate("createdBy", "name");
  if (!campaign) { res.status(404); throw new Error("Campaign not found"); }
  res.json({ success: true, data: campaign });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const { name, templateId, leadIds, variableMapping } = req.body;

  if (!name || !templateId || !leadIds?.length) {
    res.status(400);
    throw new Error("name, templateId, and leadIds are required");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const template = await WhatsappTemplate.findOne({ _id: templateId, ...tenantFilter });
  if (!template) { res.status(404); throw new Error("Template not found"); }

  const config = await getWaConfig(req.user);
  if (!config) { res.status(400); throw new Error("WhatsApp is not connected. Please connect in Settings → WhatsApp."); }

  const leads = await Lead.find({ _id: { $in: leadIds }, ...tenantFilter });

  const messages = leads.map((lead) => ({
    lead: lead._id,
    leadName: lead.name,
    leadCompany: lead.company,
    phone: formatPhone(lead.phone),
    status: "PENDING",
  }));

  const campaign = await WhatsappCampaign.create({
    name,
    template: template._id,
    templateSnapshot: {
      name: template.name,
      displayName: template.displayName,
      bodyText: template.bodyText,
      headerText: template.headerText,
      footerText: template.footerText,
    },
    variableMapping: variableMapping || [],
    messages,
    totalCount: messages.length,
    status: "SENDING",
    tenantId: req.user.tenantId || null,
    createdBy: req.user._id,
    sentAt: new Date(),
  });

  res.status(201).json({ success: true, data: campaign });

  // Fire-and-forget send
  (async () => {
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      const phone = formatPhone(lead.phone);
      const msg = campaign.messages.find((m) => String(m.lead) === String(lead._id));

      if (!phone) {
        if (msg) { msg.status = "FAILED"; msg.failedReason = "Invalid phone number"; }
        failedCount++;
        continue;
      }

      try {
        const components = buildTemplateComponents(template, variableMapping, lead);
        const apiRes = await sendWaMessage(config.phoneNumberId, config.accessToken, phone, template.metaTemplateName || template.name, template.language, components);
        if (msg) { msg.status = "SENT"; msg.waMessageId = apiRes?.messages?.[0]?.id || ""; msg.sentAt = new Date(); }
        sentCount++;
      } catch (err) {
        if (msg) { msg.status = "FAILED"; msg.failedReason = err.message; }
        failedCount++;
      }
    }

    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.status = failedCount === leads.length ? "FAILED" : sentCount > 0 ? "COMPLETED" : "PARTIAL";
    await campaign.save();
  })().catch((err) => console.error("[WhatsApp Campaign]", err.message));
});

// ---------------------------------------------------------------------------
// Send single message to a lead
// ---------------------------------------------------------------------------

// POST /api/whatsapp/send
exports.sendMessage = asyncHandler(async (req, res) => {
  const { leadId, templateId, variableMapping, messageType, messageText } = req.body;

  if (!leadId) { res.status(400); throw new Error("leadId is required"); }

  const config = await getWaConfig(req.user);
  if (!config) { res.status(400); throw new Error("WhatsApp is not connected"); }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const lead = await Lead.findOne({ _id: leadId, ...tenantFilter });
  if (!lead) { res.status(404); throw new Error("Lead not found"); }

  const phone = formatPhone(lead.phone);
  if (!phone) { res.status(400); throw new Error("Lead has no valid phone number"); }

  let waResult;

  if (messageType === "text" && messageText) {
    const body = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: messageText } };
    const r = await fetch(`${WA_API}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "WhatsApp API error");
    waResult = data;
  } else if (templateId) {
    const template = await WhatsappTemplate.findOne({ _id: templateId, ...tenantFilter });
    if (!template) { res.status(404); throw new Error("Template not found"); }
    const components = buildTemplateComponents(template, variableMapping || [], lead);
    waResult = await sendWaMessage(config.phoneNumberId, config.accessToken, phone, template.metaTemplateName || template.name, template.language, components);
  } else {
    res.status(400);
    throw new Error("Either templateId or messageType+messageText is required");
  }

  res.json({ success: true, data: { messageId: waResult?.messages?.[0]?.id || "" } });
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

exports.verifyWebhook = asyncHandler(async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") return res.sendStatus(403);

  // Check against global env token OR per-tenant token
  const globalToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (token === globalToken) return res.status(200).send(challenge);

  // Try per-tenant lookup
  const tenant = await Tenant.findOne({ "integrations.whatsapp.webhookVerifyToken": token });
  if (tenant) return res.status(200).send(challenge);

  res.sendStatus(403);
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true });

  const body = req.body;
  if (body?.object !== "whatsapp_business_account") return;

  for (const entry of body.entry || []) {
    const wabaId = entry.id;

    // Find tenant by WABA ID
    const tenant = await Tenant.findOne({ "integrations.whatsapp.wabaId": wabaId, "integrations.whatsapp.isConnected": true });

    for (const change of entry.changes || []) {
      const value = change.value || {};

      // Status updates
      for (const statusObj of value.statuses || []) {
        const waMessageId = statusObj.id;
        const newStatus = (statusObj.status || "").toUpperCase();
        const statusMap = { SENT: "SENT", DELIVERED: "DELIVERED", READ: "READ", FAILED: "FAILED" };
        const statusField = statusMap[newStatus];
        if (!statusField) continue;

        try {
          const tenantFilter = tenant ? { tenantId: tenant._id } : {};
          const campaign = await WhatsappCampaign.findOne({ "messages.waMessageId": waMessageId, ...tenantFilter });
          if (!campaign) continue;

          const msg = campaign.messages.find((m) => m.waMessageId === waMessageId);
          if (!msg) continue;

          const prev = msg.status;
          msg.status = statusField;
          if (statusField === "DELIVERED") { msg.deliveredAt = new Date(); if (prev !== "DELIVERED") campaign.deliveredCount++; }
          if (statusField === "READ") { msg.readAt = new Date(); if (prev !== "READ") campaign.readCount++; }
          if (statusField === "FAILED") {
            msg.failedReason = statusObj?.errors?.[0]?.message || "Failed";
            if (prev !== "FAILED") { campaign.failedCount++; if (prev === "SENT") campaign.sentCount = Math.max(0, campaign.sentCount - 1); }
          }
          await campaign.save();
        } catch (err) {
          console.error("[WA Webhook Status]", err.message);
        }
      }

      // Incoming messages
      for (const incomingMsg of value.messages || []) {
        if (incomingMsg.type !== "text") continue;
        const fromPhone = incomingMsg.from;
        const messageText = incomingMsg?.text?.body || "";
        const waMessageId = incomingMsg.id;

        try {
          const tenantFilter = tenant ? { tenantId: tenant._id } : {};
          const campaign = await WhatsappCampaign.findOne({ "messages.phone": fromPhone, ...tenantFilter }).sort({ sentAt: -1 });
          if (!campaign) continue;

          const sentMsg = campaign.messages.find((m) => m.phone === fromPhone);
          campaign.replies.push({ lead: sentMsg?.lead, leadName: sentMsg?.leadName, phone: fromPhone, messageText, waMessageId, receivedAt: new Date() });
          campaign.repliedCount = (campaign.repliedCount || 0) + 1;
          await campaign.save();
        } catch (err) {
          console.error("[WA Webhook Reply]", err.message);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Replies & Media
// ---------------------------------------------------------------------------

exports.getReplies = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaigns = await WhatsappCampaign.find({ repliedCount: { $gt: 0 }, ...tenantFilter })
    .select("name replies sentAt")
    .sort({ "replies.receivedAt": -1 });

  const replies = campaigns.flatMap((c) =>
    c.replies.map((r) => ({ campaignId: c._id, campaignName: c.name, ...r.toObject() }))
  );
  replies.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  res.json({ success: true, count: replies.length, data: replies });
});

exports.uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error("No file uploaded"); }

  const config = await getWaConfig(req.user);
  if (!config) { res.status(400); throw new Error("WhatsApp is not connected"); }

  const { buffer, mimetype, originalname } = req.file;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimetype);
  form.append("file", new Blob([buffer], { type: mimetype }), originalname);

  const uploadRes = await fetch(`${WA_API}/${config.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    body: form,
  });
  const data = await uploadRes.json();
  if (!uploadRes.ok) { res.status(400); throw new Error(data?.error?.message || "Media upload failed"); }

  res.json({ success: true, data: { mediaId: data.id, filename: originalname, mimetype } });
});
