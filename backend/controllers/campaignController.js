const asyncHandler = require("express-async-handler");
const Campaign = require("../models/Campaign");
const WhatsappCampaign = require("../models/WhatsappCampaign");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const { encrypt, decrypt } = require("../utils/encryption");

const WA_API = "https://graph.facebook.com/v20.0";

// ─── Shared helpers (mirrored from whatsappController) ───────────────────────

function getTenantQuery(user) {
  return user.tenantId ? { _id: user.tenantId } : { ownerUser: user._id };
}

async function getWaBase(user) {
  const tenant = await Tenant.findOne(getTenantQuery(user));
  const wa = tenant?.integrations?.whatsapp;
  if (!wa?.isConnected || !wa?.accessToken) return null;
  return {
    tenantId: tenant._id,
    accessToken: decrypt(wa.accessToken),
    wabaId: wa.wabaId,
    phoneNumbers: wa.phoneNumbers || [],
  };
}

function resolvePhoneNumberId(wa, requestedId) {
  if (!wa || !wa.phoneNumbers.length) return null;
  if (requestedId) {
    const found = wa.phoneNumbers.find((p) => p.phoneNumberId === requestedId);
    return found ? requestedId : null;
  }
  if (wa.phoneNumbers.length === 1) return wa.phoneNumbers[0].phoneNumberId;
  return null;
}

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
      parameters: [{ type: "image", image: { id: template.headerMediaId } }],
    });
  }
  if (variableMapping?.length > 0) {
    const params = [...variableMapping]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        type: "text",
        text: resolveVariable(v.fieldKey, v.customValue, lead),
      }));
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "WhatsApp API error");
  return data;
}

// ─── Audience resolver ───────────────────────────────────────────────────────

async function resolveLeads(audience, tenantId) {
  const tenantFilter = tenantId ? { tenantId } : {};
  const query = { ...tenantFilter };

  if (audience.targetType === "SEGMENT") {
    const { leadStatus, leadSource, assignedTo } = audience.filters || {};
    if (leadStatus?.length) query.status = { $in: leadStatus };
    if (leadSource?.length) query.source = { $in: leadSource };
    if (assignedTo?.length) query.assignedTo = { $in: assignedTo };
  }

  return Lead.find(query).select("_id name company phone email");
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

async function syncMetricsFromWa(campaign) {
  if (!campaign.whatsappCampaignId) return campaign;
  const wa = await WhatsappCampaign.findById(campaign.whatsappCampaignId).select(
    "sentCount deliveredCount readCount failedCount repliedCount status",
  );
  if (!wa) return campaign;

  campaign.metrics.sent = wa.sentCount || 0;
  campaign.metrics.delivered = wa.deliveredCount || 0;
  campaign.metrics.read = wa.readCount || 0;
  campaign.metrics.replied = wa.repliedCount || 0;
  campaign.metrics.failed = wa.failedCount || 0;

  if (wa.status === "COMPLETED" && campaign.status === "RUNNING") {
    campaign.status = "COMPLETED";
    campaign.completedAt = new Date();
  }
  await campaign.save();
  return campaign;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

exports.getCampaigns = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const { status, type } = req.query;
  const filter = { ...tenantFilter };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const campaigns = await Campaign.find(filter)
    .sort({ createdAt: -1 })
    .populate("createdBy", "name")
    .select("-audience.contacts");

  res.json({ success: true, count: campaigns.length, data: campaigns });
});

exports.getCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  let campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter })
    .populate("createdBy", "name")
    .populate("whatsapp.templateId", "displayName name bodyText");

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  // Lazy-sync metrics from WhatsappCampaign
  if (campaign.whatsappCampaignId && campaign.status === "RUNNING") {
    campaign = await syncMetricsFromWa(campaign);
  }

  res.json({ success: true, data: campaign });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const { name, description, type, audience, whatsapp } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("Campaign name is required");
  }

  const campaign = await Campaign.create({
    name,
    description: description || "",
    type: type || "WHATSAPP",
    status: "DRAFT",
    audience: audience || { targetType: "ALL_LEADS", filters: {} },
    whatsapp: whatsapp || {},
    createdBy: req.user._id,
    tenantId: req.user.tenantId || null,
  });

  await campaign.populate("createdBy", "name");
  res.status(201).json({ success: true, data: campaign });
});

exports.updateCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "DRAFT") {
    res.status(400);
    throw new Error("Only DRAFT campaigns can be edited");
  }

  const allowed = ["name", "description", "audience", "whatsapp"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) campaign[key] = req.body[key];
  }

  await campaign.save();
  await campaign.populate("createdBy", "name");
  res.json({ success: true, data: campaign });
});

exports.deleteCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (campaign.status === "RUNNING") {
    res.status(400);
    throw new Error("Cannot delete a running campaign");
  }

  await campaign.deleteOne();
  res.json({ success: true, message: "Campaign deleted" });
});

exports.launchCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "DRAFT") {
    res.status(400);
    throw new Error("Only DRAFT campaigns can be launched");
  }

  if (campaign.type === "WHATSAPP") {
    const { templateId, variableMapping, phoneNumberId } = campaign.whatsapp || {};

    if (!templateId) {
      res.status(400);
      throw new Error("WhatsApp template is required before launching");
    }

    const template = await WhatsappTemplate.findOne({
      _id: templateId,
      ...tenantFilter,
    });
    if (!template) {
      res.status(404);
      throw new Error("Template not found");
    }

    const wa = await getWaBase(req.user);
    if (!wa) {
      res.status(400);
      throw new Error("WhatsApp is not connected");
    }

    const resolvedPhoneNumberId = resolvePhoneNumberId(wa, phoneNumberId);
    if (!resolvedPhoneNumberId) {
      res.status(400);
      throw new Error(
        wa.phoneNumbers.length > 1
          ? "Multiple numbers connected — please specify phoneNumberId"
          : "No phone numbers connected. Add one in Settings → WhatsApp.",
      );
    }

    const leads = await resolveLeads(campaign.audience, req.user.tenantId);
    if (!leads.length) {
      res.status(400);
      throw new Error("No contacts match the selected audience filters");
    }

    // Build WhatsappCampaign messages list
    const messages = leads.map((lead) => ({
      lead: lead._id,
      leadName: lead.name,
      leadCompany: lead.company,
      phone: formatPhone(lead.phone),
      status: "PENDING",
    }));

    const waCampaign = await WhatsappCampaign.create({
      name: campaign.name,
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
      fromPhoneNumberId: resolvedPhoneNumberId,
      sentAt: new Date(),
    });

    // Update Campaign
    campaign.whatsappCampaignId = waCampaign._id;
    campaign.status = "RUNNING";
    campaign.launchedAt = new Date();
    campaign.metrics.total = leads.length;
    campaign.audience.totalContacts = leads.length;
    campaign.audience.contacts = leads.map((lead) => ({
      refType: "Lead",
      refId: lead._id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: "PENDING",
    }));
    await campaign.save();

    // Respond immediately; send messages in background
    res.json({
      success: true,
      message: `Campaign launched — sending to ${leads.length} contacts`,
      data: campaign,
    });

    // Background send
    (async () => {
      let sentCount = 0, failedCount = 0;
      for (const lead of leads) {
        const phone = formatPhone(lead.phone);
        const msg = waCampaign.messages.find(
          (m) => String(m.lead) === String(lead._id),
        );
        if (!phone) {
          if (msg) { msg.status = "FAILED"; msg.failedReason = "Invalid phone"; }
          failedCount++;
          continue;
        }
        try {
          const components = buildTemplateComponents(template, variableMapping, lead);
          const apiRes = await sendWaMessage(
            resolvedPhoneNumberId,
            wa.accessToken,
            phone,
            template.metaTemplateName || template.name,
            template.language,
            components,
          );
          if (msg) { msg.status = "SENT"; msg.waMessageId = apiRes?.messages?.[0]?.id || ""; msg.sentAt = new Date(); }
          sentCount++;
        } catch (err) {
          if (msg) { msg.status = "FAILED"; msg.failedReason = err.message; }
          failedCount++;
        }
      }
      waCampaign.sentCount = sentCount;
      waCampaign.failedCount = failedCount;
      waCampaign.status = failedCount === leads.length ? "FAILED" : "COMPLETED";
      await waCampaign.save();

      // Sync back to Campaign
      campaign.metrics.sent = sentCount;
      campaign.metrics.failed = failedCount;
      campaign.status = "COMPLETED";
      campaign.completedAt = new Date();
      await campaign.save();
    })().catch((err) => console.error("[Campaign Launch]", err.message));
  } else {
    res.status(400);
    throw new Error(`Campaign type "${campaign.type}" is not yet supported`);
  }
});

exports.pauseCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "RUNNING") {
    res.status(400);
    throw new Error("Only running campaigns can be paused");
  }

  campaign.status = "PAUSED";
  await campaign.save();
  res.json({ success: true, data: campaign });
});

exports.cancelCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });

  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (!["DRAFT", "RUNNING", "PAUSED"].includes(campaign.status)) {
    res.status(400);
    throw new Error("Campaign cannot be cancelled in its current state");
  }

  campaign.status = "CANCELLED";
  await campaign.save();
  res.json({ success: true, data: campaign });
});

exports.getStats = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};

  const [total, draft, running, completed, cancelled] = await Promise.all([
    Campaign.countDocuments(tenantFilter),
    Campaign.countDocuments({ ...tenantFilter, status: "DRAFT" }),
    Campaign.countDocuments({ ...tenantFilter, status: "RUNNING" }),
    Campaign.countDocuments({ ...tenantFilter, status: "COMPLETED" }),
    Campaign.countDocuments({ ...tenantFilter, status: "CANCELLED" }),
  ]);

  // Aggregate total contacts reached
  const agg = await Campaign.aggregate([
    { $match: { ...tenantFilter, status: "COMPLETED" } },
    {
      $group: {
        _id: null,
        totalSent: { $sum: "$metrics.sent" },
        totalDelivered: { $sum: "$metrics.delivered" },
        totalRead: { $sum: "$metrics.read" },
      },
    },
  ]);

  const aggData = agg[0] || { totalSent: 0, totalDelivered: 0, totalRead: 0 };

  res.json({
    success: true,
    data: {
      total,
      draft,
      running,
      completed,
      cancelled,
      totalSent: aggData.totalSent,
      totalDelivered: aggData.totalDelivered,
      totalRead: aggData.totalRead,
    },
  });
});

exports.resolveAudience = asyncHandler(async (req, res) => {
  const { targetType, filters } = req.body;

  const audience = { targetType: targetType || "ALL_LEADS", filters: filters || {} };
  const leads = await resolveLeads(audience, req.user.tenantId);

  res.json({
    success: true,
    data: {
      count: leads.length,
      preview: leads.slice(0, 5).map((l) => ({
        name: l.name,
        phone: l.phone,
        company: l.company,
      })),
    },
  });
});
