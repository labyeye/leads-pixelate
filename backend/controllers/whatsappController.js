const asyncHandler = require("express-async-handler");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const WhatsappCampaign = require("../models/WhatsappCampaign");
const Lead = require("../models/Lead");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(raw) {
  // Strip everything except digits
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;

  // Already has country code (>10 digits)
  if (digits.length > 10) return digits;

  // 10-digit Indian number → prepend 91
  if (digits.length === 10) return "91" + digits;

  return digits;
}

function resolveVariable(fieldKey, customValue, lead) {
  switch (fieldKey) {
    case "name":
      return lead.name || "";
    case "company":
      return lead.company || "";
    case "phone":
      return lead.phone || "";
    case "location":
      return lead.location || "";
    case "requirement":
      return lead.requirement || "";
    case "budget":
      return lead.budget || "";
    case "custom":
      return customValue || "";
    default:
      return "";
  }
}

function buildTemplateComponents(template, variableMapping, lead) {
  const components = [];

  // Header component
  if (template.headerType === "TEXT" && template.headerText) {
    components.push({
      type: "header",
      parameters: [{ type: "text", text: template.headerText }],
    });
  } else if (template.headerType === "DOCUMENT" && template.headerMediaId) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            id: template.headerMediaId,
            filename: template.headerMediaName || "document.pdf",
          },
        },
      ],
    });
  } else if (template.headerType === "IMAGE" && template.headerMediaId) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { id: template.headerMediaId },
        },
      ],
    });
  } else if (!template.headerType && template.headerText) {
    // backward compat
    components.push({
      type: "header",
      parameters: [{ type: "text", text: template.headerText }],
    });
  }

  if (variableMapping && variableMapping.length > 0) {
    const sorted = [...variableMapping].sort((a, b) => a.position - b.position);
    const parameters = sorted.map((v) => ({
      type: "text",
      text: resolveVariable(v.fieldKey, v.customValue, lead),
    }));
    if (parameters.length > 0) {
      components.push({ type: "body", parameters });
    }
  }

  return components;
}

async function sendWhatsappMessage(
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  components,
) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "en" },
    },
  };

  if (components && components.length > 0) {
    body.template.components = components;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "WhatsApp API error");
  }

  return data;
}

function getWaConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    webhookVerifyToken:
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "skylyf_whatsapp_verify",
    appId: process.env.WHATSAPP_APP_ID,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

exports.getTemplates = asyncHandler(async (req, res) => {
  const templates = await WhatsappTemplate.find()
    .sort({ createdAt: -1 })
    .populate("createdBy", "name");
  res.json({ success: true, count: templates.length, data: templates });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    displayName,
    category,
    language,
    headerText,
    bodyText,
    footerText,
    buttons,
    metaTemplateName,
    notes,
  } = req.body;

  // Count variables in body like {{1}}, {{2}} ...
  const varMatches = (bodyText || "").match(/\{\{\d+\}\}/g) || [];
  const variableCount = new Set(varMatches).size;

  const template = await WhatsappTemplate.create({
    name,
    displayName,
    category,
    language,
    headerText,
    bodyText,
    footerText,
    buttons,
    metaTemplateName: metaTemplateName || name,
    notes,
    variableCount,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: template });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  let template = await WhatsappTemplate.findById(req.params.id);
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }

  if (req.body.bodyText !== undefined) {
    const varMatches = (req.body.bodyText || "").match(/\{\{\d+\}\}/g) || [];
    req.body.variableCount = new Set(varMatches).size;
  }

  template = await WhatsappTemplate.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json({ success: true, data: template });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await WhatsappTemplate.findById(req.params.id);
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  await template.deleteOne();
  res.json({ success: true, message: "Template deleted" });
});

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

exports.getCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await WhatsappCampaign.find()
    .sort({ createdAt: -1 })
    .populate("template", "displayName name")
    .populate("createdBy", "name")
    .select("-messages -replies");

  res.json({ success: true, count: campaigns.length, data: campaigns });
});

exports.getCampaign = asyncHandler(async (req, res) => {
  const campaign = await WhatsappCampaign.findById(req.params.id)
    .populate("template")
    .populate("createdBy", "name");

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  res.json({ success: true, data: campaign });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const { name, templateId, leadIds, variableMapping } = req.body;

  if (!name || !templateId || !leadIds || !leadIds.length) {
    res.status(400);
    throw new Error("name, templateId, and leadIds are required");
  }

  const template = await WhatsappTemplate.findById(templateId);
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }

  const config = getWaConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    res.status(400);
    throw new Error(
      "WhatsApp is not configured. Please add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in settings.",
    );
  }

  const leads = await Lead.find({ _id: { $in: leadIds } });

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
    createdBy: req.user._id,
    sentAt: new Date(),
  });

  // Send messages in background, respond immediately
  res.status(201).json({ success: true, data: campaign });

  // Fire-and-forget: send all messages
  (async () => {
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      const phone = formatPhone(lead.phone);
      if (!phone) {
        const msg = campaign.messages.find(
          (m) => String(m.lead) === String(lead._id),
        );
        if (msg) {
          msg.status = "FAILED";
          msg.failedReason = "Invalid phone number";
        }
        failedCount++;
        continue;
      }

      try {
        const components = buildTemplateComponents(
          template,
          variableMapping,
          lead,
        );
        const apiRes = await sendWhatsappMessage(
          config.phoneNumberId,
          config.accessToken,
          phone,
          template.metaTemplateName || template.name,
          template.language,
          components,
        );

        const waMessageId = apiRes?.messages?.[0]?.id || "";
        const msg = campaign.messages.find(
          (m) => String(m.lead) === String(lead._id),
        );
        if (msg) {
          msg.status = "SENT";
          msg.waMessageId = waMessageId;
          msg.sentAt = new Date();
        }
        sentCount++;
      } catch (err) {
        const msg = campaign.messages.find(
          (m) => String(m.lead) === String(lead._id),
        );
        if (msg) {
          msg.status = "FAILED";
          msg.failedReason = err.message;
        }
        failedCount++;
      }
    }

    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.status =
      failedCount === leads.length
        ? "FAILED"
        : sentCount > 0
          ? "COMPLETED"
          : "PARTIAL";
    await campaign.save();
  })().catch((err) => console.error("[WhatsApp Campaign] Error:", err.message));
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

exports.verifyWebhook = asyncHandler(async (req, res) => {
  const config = getWaConfig();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.webhookVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ success: false, message: "Forbidden" });
  }
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  // Acknowledge immediately
  res.status(200).json({ success: true });

  const body = req.body;
  if (body?.object !== "whatsapp_business_account") return;

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};

      // Status updates (sent, delivered, read, failed)
      const statuses = value.statuses || [];
      for (const statusObj of statuses) {
        const waMessageId = statusObj.id;
        const newStatus = (statusObj.status || "").toUpperCase();

        let statusField = null;
        if (newStatus === "SENT") statusField = "SENT";
        else if (newStatus === "DELIVERED") statusField = "DELIVERED";
        else if (newStatus === "READ") statusField = "READ";
        else if (newStatus === "FAILED") statusField = "FAILED";

        if (!statusField) continue;

        try {
          const campaign = await WhatsappCampaign.findOne({
            "messages.waMessageId": waMessageId,
          });
          if (!campaign) continue;

          const msg = campaign.messages.find(
            (m) => m.waMessageId === waMessageId,
          );
          if (!msg) continue;

          const prevStatus = msg.status;
          msg.status = statusField;

          if (statusField === "DELIVERED") msg.deliveredAt = new Date();
          if (statusField === "READ") msg.readAt = new Date();
          if (statusField === "FAILED")
            msg.failedReason = statusObj?.errors?.[0]?.message || "Failed";

          // Update counters
          if (statusField === "DELIVERED" && prevStatus !== "DELIVERED")
            campaign.deliveredCount++;
          if (statusField === "READ" && prevStatus !== "READ")
            campaign.readCount++;
          if (statusField === "FAILED" && prevStatus !== "FAILED") {
            campaign.failedCount++;
            if (prevStatus === "SENT")
              campaign.sentCount = Math.max(0, campaign.sentCount - 1);
          }

          await campaign.save();
        } catch (err) {
          console.error("[Webhook Status]", err.message);
        }
      }

      // Incoming messages (replies)
      const messages = value.messages || [];
      for (const incomingMsg of messages) {
        if (incomingMsg.type !== "text") continue;

        const fromPhone = incomingMsg.from;
        const messageText = incomingMsg?.text?.body || "";
        const waMessageId = incomingMsg.id;

        try {
          // Find campaign that sent to this phone
          const campaign = await WhatsappCampaign.findOne({
            "messages.phone": fromPhone,
          }).sort({ sentAt: -1 });
          if (!campaign) continue;

          const sentMsg = campaign.messages.find((m) => m.phone === fromPhone);

          campaign.replies.push({
            lead: sentMsg?.lead,
            leadName: sentMsg?.leadName,
            phone: fromPhone,
            messageText,
            waMessageId,
            receivedAt: new Date(),
          });
          campaign.repliedCount = (campaign.repliedCount || 0) + 1;

          await campaign.save();
        } catch (err) {
          console.error("[Webhook Reply]", err.message);
        }
      }
    }
  }
});

// Get all replies across all campaigns
exports.getReplies = asyncHandler(async (req, res) => {
  const campaigns = await WhatsappCampaign.find({ repliedCount: { $gt: 0 } })
    .select("name replies sentAt")
    .sort({ "replies.receivedAt": -1 });

  const replies = [];
  for (const c of campaigns) {
    for (const r of c.replies) {
      replies.push({
        campaignId: c._id,
        campaignName: c.name,
        ...r.toObject(),
      });
    }
  }

  replies.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  res.json({ success: true, count: replies.length, data: replies });
});

// ---------------------------------------------------------------------------
// Media Upload — forwards file to WhatsApp media API, returns media_id
// ---------------------------------------------------------------------------

exports.uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const config = getWaConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    res.status(400);
    throw new Error("WhatsApp is not configured");
  }

  const { buffer, mimetype, originalname } = req.file;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimetype);
  form.append("file", new Blob([buffer], { type: mimetype }), originalname);

  const uploadRes = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
    },
  );

  const data = await uploadRes.json();

  if (!uploadRes.ok) {
    res.status(400);
    throw new Error(data?.error?.message || "Media upload failed");
  }

  res.json({
    success: true,
    data: {
      mediaId: data.id,
      filename: originalname,
      mimetype,
    },
  });
});

// WhatsApp API config (stored in env, exposed safely)
exports.getConfig = asyncHandler(async (req, res) => {
  const config = getWaConfig();
  res.json({
    success: true,
    data: {
      phoneNumberId: config.phoneNumberId || "",
      webhookVerifyToken: config.webhookVerifyToken || "",
      appId: config.appId || "",
      isConfigured: !!(config.phoneNumberId && config.accessToken),
    },
  });
});
