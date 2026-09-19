const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const WhatsappTemplate = require("../models/WhatsappTemplate");
const WhatsappCampaign = require("../models/WhatsappCampaign");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const { encrypt, decrypt } = require("../utils/encryption");
const log = require("../utils/logger").scope("WhatsApp");

const WA_API = "https://graph.facebook.com/v20.0";

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
    webhookVerifyToken: wa.webhookVerifyToken,
    lastSyncAt: wa.lastSyncAt,
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
exports.formatPhone = formatPhone;

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
    if (params.length > 0)
      components.push({ type: "body", parameters: params });
  }

  return components;
}

async function sendWaMessage(
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  components,
) {
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

// Best-effort WhatsApp text notification, e.g. when a quotation is marked "Sent".
// `source` picks the sender: "platform" uses the shared Nest Leads number from
// env, "tenant" (default) uses this tenant's own connected WhatsApp number.
// Silently no-ops if the chosen sender isn't set up — this must never block
// the caller's primary save.
exports.sendTextNotification = async function sendTextNotification(
  user,
  rawPhone,
  message,
  source = "tenant",
) {
  try {
    let phoneNumberId, accessToken;

    if (source === "platform") {
      accessToken = process.env.WHATSAPP_PLATFORM_ACCESS_TOKEN;
      phoneNumberId = process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID;
      if (!accessToken || !phoneNumberId) return;
    } else {
      const wa = await getWaBase(user);
      if (!wa) return;
      phoneNumberId = resolvePhoneNumberId(wa, null);
      if (!phoneNumberId) return;
      accessToken = wa.accessToken;
    }

    const phone = formatPhone(rawPhone);
    if (!phone) return;

    const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    });
    const data = await res.json();
    if (!res.ok)
      log.error("Quotation notify failed", { message: data?.error?.message || "unknown error" });
  } catch (err) {
    log.error("Quotation notify failed", { message: err.message });
  }
};

// Pulls every phone number under the WABA from Meta and adds the ones we don't
// have yet, so clients never have to hunt for a Phone Number ID.
async function importWabaNumbers(user, wabaId, accessToken) {
  const r = await fetch(
    `${WA_API}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${accessToken}`,
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  const tenant = await Tenant.findOne(getTenantQuery(user));
  const have = new Set(
    (tenant?.integrations?.whatsapp?.phoneNumbers || []).map(
      (p) => p.phoneNumberId,
    ),
  );
  const fresh = (d.data || [])
    .filter((p) => !have.has(p.id))
    .map((p) => ({
      phoneNumberId: p.id,
      label: p.verified_name || "",
      businessName: p.verified_name || "",
      phoneNumber: p.display_phone_number || "",
      addedAt: new Date(),
    }));
  if (fresh.length)
    await Tenant.updateOne(getTenantQuery(user), {
      $push: { "integrations.whatsapp.phoneNumbers": { $each: fresh } },
    });
  return fresh.length;
}

exports.syncPhoneNumbers = asyncHandler(async (req, res) => {
  const wa = await getWaBase(req.user);
  if (!wa?.wabaId) {
    res.status(400);
    throw new Error("Connect WhatsApp with your WABA ID first");
  }
  let added;
  try {
    added = await importWabaNumbers(req.user, wa.wabaId, wa.accessToken);
  } catch (err) {
    res.status(400);
    throw new Error("Could not fetch numbers from Meta: " + err.message);
  }
  res.json({ success: true, data: { added } });
});

exports.setup = asyncHandler(async (req, res) => {
  const { accessToken, wabaId } = req.body;
  if (!accessToken) {
    res.status(400);
    throw new Error("accessToken is required");
  }

  const testRes = await fetch(`${WA_API}/me?access_token=${accessToken}`);
  const testData = await testRes.json();
  if (testData.error) {
    res.status(400);
    throw new Error("Invalid access token: " + testData.error.message);
  }

  const webhookVerifyToken = crypto.randomBytes(16).toString("hex");

  await Tenant.findOneAndUpdate(
    getTenantQuery(req.user),
    {
      "integrations.whatsapp.enabled": true,
      "integrations.whatsapp.isConnected": true,
      "integrations.whatsapp.wabaId": wabaId || "",
      "integrations.whatsapp.accessToken": encrypt(accessToken),
      "integrations.whatsapp.webhookVerifyToken": webhookVerifyToken,
      "integrations.whatsapp.lastSyncAt": new Date(),
    },
    { new: true },
  );

  let added = 0;
  let warning = "";
  if (wabaId) {
    try {
      added = await importWabaNumbers(req.user, wabaId, accessToken);
    } catch (err) {
      warning = "Saved, but could not read numbers for this WABA ID: " + err.message;
    }
  }

  res.json({
    success: true,
    message: "WhatsApp connected",
    data: { added, warning },
  });
});

exports.addPhoneNumber = asyncHandler(async (req, res) => {
  const { phoneNumberId, label, businessName, phoneNumber } = req.body;
  if (!phoneNumberId) {
    res.status(400);
    throw new Error("phoneNumberId is required");
  }

  const wa = (await Tenant.findOne(getTenantQuery(req.user)))?.integrations
    ?.whatsapp;
  if (!wa?.isConnected || !wa?.accessToken) {
    res.status(400);
    throw new Error("Set up access token first via /api/whatsapp/setup");
  }

  const accessToken = decrypt(wa.accessToken);

  const checkRes = await fetch(
    `${WA_API}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`,
  );
  const checkData = await checkRes.json();
  if (checkData.error) {
    res.status(400);
    throw new Error("Invalid Phone Number ID: " + checkData.error.message);
  }

  if (wa.phoneNumbers?.some((p) => p.phoneNumberId === phoneNumberId)) {
    res.status(400);
    throw new Error("This phone number is already connected");
  }

  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    $push: {
      "integrations.whatsapp.phoneNumbers": {
        phoneNumberId,
        label: label || checkData.verified_name || "",
        businessName: businessName || checkData.verified_name || "",
        phoneNumber: phoneNumber || checkData.display_phone_number || "",
        addedAt: new Date(),
      },
    },
  });

  res.json({
    success: true,
    message: "Phone number added successfully",
    data: {
      phoneNumberId,
      label: label || checkData.verified_name,
      phoneNumber: phoneNumber || checkData.display_phone_number,
    },
  });
});

exports.removePhoneNumber = asyncHandler(async (req, res) => {
  const { phoneNumberId } = req.params;
  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    $pull: { "integrations.whatsapp.phoneNumbers": { phoneNumberId } },
  });
  res.json({ success: true, message: "Phone number removed" });
});

exports.disconnect = asyncHandler(async (req, res) => {
  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    "integrations.whatsapp.enabled": false,
    "integrations.whatsapp.isConnected": false,
    "integrations.whatsapp.wabaId": "",
    "integrations.whatsapp.accessToken": "",
    "integrations.whatsapp.phoneNumbers": [],
  });
  res.json({ success: true, message: "WhatsApp disconnected" });
});

exports.getStatus = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne(getTenantQuery(req.user));
  const wa = tenant?.integrations?.whatsapp || {};
  res.json({
    success: true,
    data: {
      isConnected: !!wa.isConnected,
      wabaId: wa.wabaId || "",
      webhookVerifyToken: wa.webhookVerifyToken || "",
      lastSyncAt: wa.lastSyncAt || null,
      phoneNumbers: (wa.phoneNumbers || []).map((p) => ({
        phoneNumberId: p.phoneNumberId,
        label: p.label,
        businessName: p.businessName,
        phoneNumber: p.phoneNumber,
        approvedTemplateCount: p.approvedTemplateCount || 0,
        addedAt: p.addedAt,
      })),
    },
  });
});

exports.getConfig = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne(getTenantQuery(req.user));
  const wa = tenant?.integrations?.whatsapp || {};
  res.json({
    success: true,
    data: {
      isConfigured: !!(
        wa.isConnected &&
        wa.accessToken &&
        wa.phoneNumbers?.length > 0
      ),
      webhookVerifyToken: wa.webhookVerifyToken || "",
      appId: process.env.FACEBOOK_APP_ID || "",
      phoneNumberCount: wa.phoneNumbers?.length || 0,
    },
  });
});

exports.getTemplates = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const templates = await WhatsappTemplate.find(tenantFilter)
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
    headerType,
    headerText,
    bodyText,
    footerText,
    buttons,
    metaTemplateName,
    headerMediaId,
    headerMediaName,
    headerMediaHandle,
    exampleValues,
    notes,
  } = req.body;
  const varMatches = (bodyText || "").match(/\{\{\d+\}\}/g) || [];
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
    headerMediaId,
    headerMediaName,
    headerMediaHandle,
    exampleValues,
    notes,
    variableCount: new Set(varMatches).size,
    tenantId: req.user.tenantId || null,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: template });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  let template = await WhatsappTemplate.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
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
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const template = await WhatsappTemplate.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  await template.deleteOne();
  res.json({ success: true, message: "Template deleted" });
});

exports.syncTemplates = asyncHandler(async (req, res) => {
  const wa = await getWaBase(req.user);
  if (!wa) {
    res.status(400);
    throw new Error("WhatsApp is not connected");
  }
  if (!wa.wabaId) {
    res.status(400);
    throw new Error("WABA ID not set. Please reconnect WhatsApp.");
  }

  const metaRes = await fetch(
    `${WA_API}/${wa.wabaId}/message_templates?access_token=${wa.accessToken}&fields=name,category,language,status,components,id,rejected_reason&limit=100`,
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
        metaTemplateId: t.id || "",
        rejectedReason:
          t.rejected_reason && t.rejected_reason !== "NONE"
            ? t.rejected_reason
            : "",
        category: t.category,
        language: t.language,
        status:
          t.status === "APPROVED"
            ? "APPROVED"
            : t.status === "REJECTED"
              ? "REJECTED"
              : "PENDING",
        headerType: header?.format || "NONE",
        headerText: header?.text || "",
        bodyText: body?.text || "",
        footerText: footer?.text || "",
        buttons: (buttons?.buttons || []).map((b) => ({
          type: b.type,
          text: b.text,
          url: b.url,
          phoneNumber: b.phone_number,
        })),
        variableCount: new Set(varMatches).size,
        tenantId,
      },
      { upsert: true, new: true, runValidators: false },
    );
    synced++;
  }

  const approvedCount = templates.filter((t) => t.status === "APPROVED").length;
  await Tenant.findOneAndUpdate(getTenantQuery(req.user), {
    "integrations.whatsapp.lastSyncAt": new Date(),
  });

  res.json({
    success: true,
    message: `Synced ${synced} templates from Meta`,
    data: { synced, approved: approvedCount },
  });
});

// Template -> Meta "components" payload (same shape final-pixelate submits).
function buildMetaComponents(t) {
  const components = [];

  if (t.headerType === "TEXT" && t.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: t.headerText });
  } else if (["IMAGE", "DOCUMENT"].includes(t.headerType)) {
    components.push({
      type: "HEADER",
      format: t.headerType,
      example: { header_handle: [t.headerMediaHandle] },
    });
  }

  const body = { type: "BODY", text: t.bodyText.trim() };
  const nums = [
    ...new Set(
      (t.bodyText.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.slice(2))),
    ),
  ].sort((a, b) => a - b);
  if (nums.length) {
    body.example = {
      body_text: [
        nums.map((n) => (t.exampleValues?.[n - 1] || "").trim() || `sample_${n}`),
      ],
    };
  }
  components.push(body);

  if (t.footerText) components.push({ type: "FOOTER", text: t.footerText });

  if (t.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) => {
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
        if (b.type === "PHONE_NUMBER")
          return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
        return { type: "QUICK_REPLY", text: b.text };
      }),
    });
  }
  return components;
}

exports.submitTemplate = asyncHandler(async (req, res) => {
  const wa = await getWaBase(req.user);
  if (!wa?.wabaId) {
    res.status(400);
    throw new Error("WhatsApp is not connected (WABA ID missing)");
  }
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const template = await WhatsappTemplate.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  if (
    ["IMAGE", "DOCUMENT"].includes(template.headerType) &&
    !template.headerMediaHandle
  ) {
    res.status(400);
    throw new Error("Upload a sample header file before submitting to Meta");
  }

  const name = template.metaTemplateName || template.name;
  const metaRes = await fetch(`${WA_API}/${wa.wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${wa.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      language: template.language || "en",
      category: template.category,
      components: buildMetaComponents(template),
    }),
  });
  const data = await metaRes.json().catch(() => ({}));

  // 2388023 = "already exists": treat as submitted; Sync Templates pulls the real status.
  const alreadyExists = data?.error?.error_subcode === 2388023;
  if (!metaRes.ok && !alreadyExists) {
    const e = data?.error || {};
    res.status(422);
    throw new Error(
      e.error_user_msg ||
        e.error_data?.details ||
        e.message ||
        "Meta rejected the template",
    );
  }

  template.status = "PENDING";
  template.metaTemplateName = name;
  template.metaTemplateId = data.id || template.metaTemplateId;
  template.submittedAt = new Date();
  template.rejectedReason = "";
  await template.save();
  res.json({
    success: true,
    message:
      "Submitted to Meta. Review takes a few hours to 2 days, then press Sync.",
    data: template,
  });
});

// Meta resumable upload -> header_handle (needed only for template submission).
async function uploadHeaderHandle(accessToken, { buffer, mimetype, originalname }) {
  let appId = process.env.WHATSAPP_APP_ID;
  if (!appId) {
    const dbg = await (
      await fetch(
        `${WA_API}/debug_token?input_token=${accessToken}&access_token=${accessToken}`,
      )
    ).json();
    appId = dbg?.data?.app_id;
  }
  if (!appId) throw new Error("Could not determine Meta App ID");

  const q = new URLSearchParams({
    file_name: originalname,
    file_length: String(buffer.length),
    file_type: mimetype,
  });
  const session = await (
    await fetch(`${WA_API}/${appId}/uploads?${q}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).json();
  if (!session.id)
    throw new Error(session?.error?.message || "Upload session failed");

  const up = await (
    await fetch(`${WA_API}/${session.id}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
        "Content-Type": mimetype,
      },
      body: buffer,
    })
  ).json();
  if (!up.h) throw new Error(up?.error?.message || "Header upload failed");
  return up.h;
}

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
  const campaign = await WhatsappCampaign.findOne({
    _id: req.params.id,
    ...tenantFilter,
  })
    .populate("template")
    .populate("createdBy", "name");
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  res.json({ success: true, data: campaign });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const { name, templateId, leadIds, variableMapping, phoneNumberId } =
    req.body;
  if (!name || !templateId || !leadIds?.length) {
    res.status(400);
    throw new Error("name, templateId, and leadIds are required");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
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
    fromPhoneNumberId: resolvedPhoneNumberId,
    sentAt: new Date(),
  });

  res.status(201).json({ success: true, data: campaign });

  (async () => {
    let sentCount = 0,
      failedCount = 0;
    for (const lead of leads) {
      const phone = formatPhone(lead.phone);
      const msg = campaign.messages.find(
        (m) => String(m.lead) === String(lead._id),
      );
      if (!phone) {
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
        const apiRes = await sendWaMessage(
          resolvedPhoneNumberId,
          wa.accessToken,
          phone,
          template.metaTemplateName || template.name,
          template.language,
          components,
        );
        if (msg) {
          msg.status = "SENT";
          msg.waMessageId = apiRes?.messages?.[0]?.id || "";
          msg.sentAt = new Date();
        }
        sentCount++;
      } catch (err) {
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
  })().catch((err) => log.error("Campaign send failed", { campaignId: campaign._id, message: err.message }));
});

// Re-sends only to people who did NOT receive the message (failed / never sent /
// sent but not delivered). DELIVERED and READ are never touched.
const RESENDABLE = ["FAILED", "PENDING", "SENT"];

exports.resendCampaign = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaign = await WhatsappCampaign.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const targets = campaign.messages.filter((m) => RESENDABLE.includes(m.status));
  if (!targets.length) {
    res.status(400);
    throw new Error("Everyone has already received this message");
  }

  const template = await WhatsappTemplate.findOne({
    _id: campaign.template,
    ...tenantFilter,
  });
  const wa = await getWaBase(req.user);
  const phoneNumberId = wa && resolvePhoneNumberId(wa, campaign.fromPhoneNumberId);
  if (!template || !phoneNumberId) {
    res.status(400);
    throw new Error(
      !template
        ? "The template of this campaign no longer exists"
        : "The WhatsApp number this campaign was sent from is not connected",
    );
  }

  const claimed = await WhatsappCampaign.findOneAndUpdate(
    { _id: campaign._id, status: { $ne: "SENDING" } },
    { status: "SENDING" },
  );
  if (!claimed) {
    res.status(409);
    throw new Error("This campaign is still sending, try again in a moment");
  }

  res.json({ success: true, data: { resending: targets.length } });

  (async () => {
    for (const m of targets) {
      // A late delivery webhook may have landed since we started — never double-send.
      const stillPending = await WhatsappCampaign.exists({
        _id: campaign._id,
        messages: { $elemMatch: { _id: m._id, status: { $in: RESENDABLE } } },
      });
      if (!stillPending) continue;

      let set;
      try {
        const lead = await Lead.findOne({ _id: m.lead, ...tenantFilter });
        if (!lead) throw new Error("Lead no longer exists");
        const phone = formatPhone(lead.phone);
        if (!phone) throw new Error("Invalid phone number");
        const apiRes = await sendWaMessage(
          phoneNumberId,
          wa.accessToken,
          phone,
          template.metaTemplateName || template.name,
          template.language,
          buildTemplateComponents(template, campaign.variableMapping, lead),
        );
        set = {
          status: "SENT",
          phone,
          waMessageId: apiRes?.messages?.[0]?.id || "",
          sentAt: new Date(),
          failedReason: "",
        };
      } catch (err) {
        set = { status: "FAILED", failedReason: err.message };
      }
      // Per-message atomic update: safe against webhook saves on the same doc.
      await WhatsappCampaign.updateOne(
        { _id: campaign._id },
        {
          $set: Object.fromEntries(
            Object.entries(set).map(([k, v]) => [`messages.$[m].${k}`, v]),
          ),
        },
        { arrayFilters: [{ "m._id": m._id }] },
      );
    }
  })()
    .catch((err) =>
      log.error("Campaign resend failed", { campaignId: campaign._id, message: err.message }),
    )
    .finally(async () => {
      const fresh = await WhatsappCampaign.findById(campaign._id);
      if (!fresh) return;
      const n = (...s) => fresh.messages.filter((x) => s.includes(x.status)).length;
      const sent = n("SENT", "DELIVERED", "READ");
      const failed = n("FAILED");
      await WhatsappCampaign.updateOne(
        { _id: campaign._id },
        {
          status:
            failed === fresh.messages.length
              ? "FAILED"
              : sent > 0
                ? "COMPLETED"
                : "PARTIAL",
          sentCount: sent,
          deliveredCount: n("DELIVERED", "READ"),
          readCount: n("READ"),
          failedCount: failed,
        },
      );
    });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const {
    leadId,
    templateId,
    variableMapping,
    messageType,
    messageText,
    phoneNumberId,
  } = req.body;
  if (!leadId) {
    res.status(400);
    throw new Error("leadId is required");
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

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const lead = await Lead.findOne({ _id: leadId, ...tenantFilter });
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const phone = formatPhone(lead.phone);
  if (!phone) {
    res.status(400);
    throw new Error("Lead has no valid phone number");
  }

  let waResult;
  if (messageType === "text" && messageText) {
    const body = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: messageText },
    };
    const r = await fetch(`${WA_API}/${resolvedPhoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wa.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "WhatsApp API error");
    waResult = data;
  } else if (templateId) {
    const template = await WhatsappTemplate.findOne({
      _id: templateId,
      ...tenantFilter,
    });
    if (!template) {
      res.status(404);
      throw new Error("Template not found");
    }
    const components = buildTemplateComponents(
      template,
      variableMapping || [],
      lead,
    );
    waResult = await sendWaMessage(
      resolvedPhoneNumberId,
      wa.accessToken,
      phone,
      template.metaTemplateName || template.name,
      template.language,
      components,
    );
  } else {
    res.status(400);
    throw new Error("Either templateId or messageType+messageText is required");
  }

  res.json({
    success: true,
    data: { messageId: waResult?.messages?.[0]?.id || "" },
  });
});

exports.verifyWebhook = asyncHandler(async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe") return res.sendStatus(403);

  if (token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
    return res.status(200).send(challenge);
  const tenant = await Tenant.findOne({
    "integrations.whatsapp.webhookVerifyToken": token,
  });
  if (tenant) return res.status(200).send(challenge);
  res.sendStatus(403);
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true });
  const body = req.body;
  if (body?.object !== "whatsapp_business_account") return;

  for (const entry of body.entry || []) {
    const wabaId = entry.id;
    const tenant = await Tenant.findOne({
      "integrations.whatsapp.wabaId": wabaId,
      "integrations.whatsapp.isConnected": true,
    });

    for (const change of entry.changes || []) {
      const value = change.value || {};

      for (const statusObj of value.statuses || []) {
        const waMessageId = statusObj.id;
        const newStatus = (statusObj.status || "").toUpperCase();
        const statusMap = {
          SENT: "SENT",
          DELIVERED: "DELIVERED",
          READ: "READ",
          FAILED: "FAILED",
        };
        const statusField = statusMap[newStatus];
        if (!statusField) continue;
        try {
          const tenantFilter = tenant ? { tenantId: tenant._id } : {};
          const campaign = await WhatsappCampaign.findOne({
            "messages.waMessageId": waMessageId,
            ...tenantFilter,
          });
          if (!campaign) continue;
          const msg = campaign.messages.find(
            (m) => m.waMessageId === waMessageId,
          );
          if (!msg) continue;
          const prev = msg.status;
          msg.status = statusField;
          if (statusField === "DELIVERED") {
            msg.deliveredAt = new Date();
            if (prev !== "DELIVERED") campaign.deliveredCount++;
          }
          if (statusField === "READ") {
            msg.readAt = new Date();
            if (prev !== "READ") campaign.readCount++;
          }
          if (statusField === "FAILED") {
            msg.failedReason = statusObj?.errors?.[0]?.message || "Failed";
            if (prev !== "FAILED") {
              campaign.failedCount++;
              if (prev === "SENT")
                campaign.sentCount = Math.max(0, campaign.sentCount - 1);
            }
          }
          await campaign.save();
        } catch (err) {
          log.error("Webhook status update failed", { message: err.message });
        }
      }

      for (const incomingMsg of value.messages || []) {
        if (incomingMsg.type !== "text") continue;
        const fromPhone = incomingMsg.from;
        const messageText = incomingMsg?.text?.body || "";
        try {
          const tenantFilter = tenant ? { tenantId: tenant._id } : {};
          const campaign = await WhatsappCampaign.findOne({
            "messages.phone": fromPhone,
            ...tenantFilter,
          }).sort({ sentAt: -1 });
          if (!campaign) continue;
          const sentMsg = campaign.messages.find((m) => m.phone === fromPhone);
          campaign.replies.push({
            lead: sentMsg?.lead,
            leadName: sentMsg?.leadName,
            phone: fromPhone,
            messageText,
            waMessageId: incomingMsg.id,
            receivedAt: new Date(),
          });
          campaign.repliedCount = (campaign.repliedCount || 0) + 1;
          await campaign.save();
        } catch (err) {
          log.error("Webhook reply handling failed", { message: err.message });
        }
      }
    }
  }
});

exports.getReplies = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const campaigns = await WhatsappCampaign.find({
    repliedCount: { $gt: 0 },
    ...tenantFilter,
  })
    .select("name replies sentAt")
    .sort({ "replies.receivedAt": -1 });
  const replies = campaigns.flatMap((c) =>
    c.replies.map((r) => ({
      campaignId: c._id,
      campaignName: c.name,
      ...r.toObject(),
    })),
  );
  replies.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  res.json({ success: true, count: replies.length, data: replies });
});

exports.uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const wa = await getWaBase(req.user);
  if (!wa || !wa.phoneNumbers.length) {
    res.status(400);
    throw new Error("WhatsApp is not connected");
  }

  const phoneNumberId = wa.phoneNumbers[0].phoneNumberId;
  const { buffer, mimetype, originalname } = req.file;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimetype);
  form.append("file", new Blob([buffer], { type: mimetype }), originalname);

  const uploadRes = await fetch(`${WA_API}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${wa.accessToken}` },
    body: form,
  });
  const data = await uploadRes.json();
  if (!uploadRes.ok) {
    res.status(400);
    throw new Error(data?.error?.message || "Media upload failed");
  }
  // Best effort: the handle is only needed to submit a template to Meta.
  let handle = "";
  try {
    handle = await uploadHeaderHandle(wa.accessToken, req.file);
  } catch (err) {
    log.warn("Header handle upload failed: " + err.message);
  }
  res.json({
    success: true,
    data: { mediaId: data.id, handle, filename: originalname, mimetype },
  });
});
