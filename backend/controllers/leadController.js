const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const Setting = require("../models/Setting");
const SavedView = require("../models/SavedView");
const {
  syncIndiamartLeads,
  formatIMDate,
  fetchFromIndiaMART,
  mapIMLeadToModel,
  getRoundRobinAssigneeId,
  getRoundRobinFromIds,
} = require("../services/indiamartService");
const { syncTradeIndiaLeads } = require("../services/tradeindiaService");
const {
  generateWebhookToken,
  mapJDLeadToModel,
  pickField: pickJDField,
} = require("../services/justdialService");
const User = require("../models/User");
const logActivity = require("../utils/activityLogger");
const { resolvePincode } = require("../utils/pincode");
const { buildTransitionMaps } = require("../utils/leadStatuses");
const { sendBulkLeadEmail } = require("../utils/emailService");

// Tenant custom pipeline stages (Setting.customLeadStatuses) extend the
// fixed transition graph — fetch them per-request and splice them in via
// buildTransitionMaps() rather than hardcoding a single global map.
async function getTransitionMapsForTenant(tenantId) {
  const setting = await Setting.findOne({ tenantId: tenantId || null })
    .select("customLeadStatuses")
    .lean();
  return buildTransitionMaps(setting?.customLeadStatuses || []);
}

function isValidTransition(currentStatus, newStatus, VALID_TRANSITIONS) {
  if (!VALID_TRANSITIONS[currentStatus]) {
    return false;
  }
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}

function validateMandatoryFields(
  newStatus,
  updateData,
  currentStatus,
  MANDATORY_FIELDS,
  REQUIRES_DATE,
) {
  const isSameStatus = newStatus === currentStatus;
  const required = MANDATORY_FIELDS[newStatus] || [];

  for (const field of required) {
    if (!updateData[field] || updateData[field].trim() === "") {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required for status "${newStatus}"`;
    }
  }

  if (isSameStatus) {
    return null;
  }

  if (REQUIRES_DATE.includes(newStatus)) {
    if (newStatus === "VISIT SCHEDULED" && !updateData.visitScheduledDate) {
      return "Scheduled visit date is required for status 'VISIT SCHEDULED'";
    } else if (newStatus === "VISITED" && !updateData.visitActualDate) {
      return "Actual visit date is required for status 'VISITED'";
    } else if (
      !["VISIT SCHEDULED", "VISITED"].includes(newStatus) &&
      !updateData.followUpDate
    ) {
      return "Follow-up date is required for this status";
    }
  }

  return null;
}

const getLeads = asyncHandler(async (req, res) => {
  const {
    status,
    source,
    assignedTo,
    search,
    startDate,
    endDate,
    hasFollowup,
  } = req.query;

  const query = {};

  if (req.user.tenantId) {
    query.tenantId = req.user.tenantId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (status) query.status = status;
  if (source) query.source = source;
  if (assignedTo) query.assignedTo = assignedTo;

  if (hasFollowup === "true") {
    query.followUpDate = { $exists: true, $ne: null };
    query.status = { $nin: ["WON", "DROP"] };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  if (req.user.role === "sales_executive") {
    query.assignedTo = req.user._id;
  }

  const leads = await Lead.find(query)
    .populate("assignedTo", "name email")
    .lean()
    .sort("-createdAt");

  res.json({
    success: true,
    count: leads.length,
    total: leads.length,
    data: leads,
  });
});

const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate("assignedTo", "name email")
    .populate("notes.addedBy", "name")
    .populate("statusHistory.changedBy", "name");

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  res.json({
    success: true,
    data: lead,
  });
});

const createLead = asyncHandler(async (req, res) => {
  const {
    name,
    company,
    source,
    phone,
    email,
    website,
    requirement,
    assignedTo,
    followUpDate,
    remarks,
    budget,
    interestedProducts,
    location,
  } = req.body;

  let resolvedLocation = location || "";
  let resolvedState = req.body.state || "";
  const pinResolved = await resolvePincode(location);
  if (pinResolved) {
    resolvedLocation = pinResolved.city;
    if (!resolvedState) resolvedState = pinResolved.state;
  }

  const lead = await Lead.create({
    name,
    company,
    source,
    phone,
    email,
    website,
    requirement,
    remarks,
    budget,
    interestedProducts,
    location: resolvedLocation,
    state: resolvedState,
    tenantId: req.user.tenantId || null,
    assignedTo: assignedTo || req.user._id,
    followUpDate,
    status: "PENDING CONTACT",
    statusHistory: [
      {
        status: "PENDING CONTACT",
        timestamp: new Date(),
        changedBy: req.user._id,
        remarks: remarks || "Initial creation",
      },
    ],
  });

  const populated = await Lead.findById(lead._id).populate(
    "assignedTo",
    "name email",
  );

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Lead",
    description: `Created lead: ${lead.name} (${lead.company || ""})`,
    targetId: lead._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: populated,
  });
});

const updateLead = asyncHandler(async (req, res) => {
  let lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const statusChanged = req.body.status !== undefined;

  if (statusChanged) {
    const { VALID_TRANSITIONS, MANDATORY_FIELDS, REQUIRES_DATE } =
      await getTransitionMapsForTenant(req.user.tenantId);

    if (!isValidTransition(lead.status, req.body.status, VALID_TRANSITIONS)) {
      res.status(400);
      throw new Error(
        `Invalid status transition from "${lead.status}" to "${req.body.status}"`,
      );
    }

    const fieldError = validateMandatoryFields(
      req.body.status,
      req.body,
      lead.status,
      MANDATORY_FIELDS,
      REQUIRES_DATE,
    );
    if (fieldError) {
      res.status(400);
      throw new Error(fieldError);
    }
  }

  if (
    statusChanged &&
    [
      "1",
      "DISCUSSION",
      "DISCUSSION 1",
      "DISCUSSION 2",
      "DISCUSSION 3",
      "DISCUSSION COMPLETED",
    ].includes(req.body.status) &&
    req.body.contactTag
  ) {
    if (!["HOT", "WARM", "COLD"].includes(req.body.contactTag)) {
      res.status(400);
      throw new Error("Contact tag must be one of: HOT, WARM, COLD");
    }
  }

  if (req.body.location) {
    const pinResolved = await resolvePincode(req.body.location);
    if (pinResolved) {
      req.body.location = pinResolved.city;
      if (!req.body.state) req.body.state = pinResolved.state;
    }
  }

  const { statusHistory: _ignored, ...updateFields } = req.body;

  let updateOp;

  if (statusChanged) {
    const newStagePath = lead.stagePath ? [...lead.stagePath] : [lead.status];
    if (!newStagePath.includes(req.body.status)) {
      newStagePath.push(req.body.status);
    }
    updateFields.stagePath = newStagePath;

    const newHistoryEntry = {
      status: req.body.status,
      timestamp: new Date(),
      changedBy: req.user._id,
      remarks: req.body.remarks || "",
    };

    if (req.body.budget) newHistoryEntry.budget = req.body.budget;
    if (req.body.followUpDate)
      newHistoryEntry.followUpDate = req.body.followUpDate;
    if (req.body.visitScheduledDate)
      newHistoryEntry.visitScheduledDate = req.body.visitScheduledDate;
    if (req.body.visitActualDate)
      newHistoryEntry.visitActualDate = req.body.visitActualDate;
    if (req.body.contactTag) newHistoryEntry.contactTag = req.body.contactTag;

    updateOp = {
      $set: updateFields,
      $push: { statusHistory: newHistoryEntry },
    };
  } else {
    updateOp = { $set: updateFields };
  }

  lead = await Lead.findByIdAndUpdate(req.params.id, updateOp, {
    new: true,
    runValidators: true,
  })
    .populate("assignedTo", "name email")
    .populate("statusHistory.changedBy", "name");

  logActivity({
    user: req.user,
    action: statusChanged ? "STATUS_UPDATED" : "UPDATE",
    module: "Lead",
    description: statusChanged
      ? `Updated status of lead ${lead.name} to ${lead.status}${
          req.body.remarks ? ` with remark: ${req.body.remarks}` : ""
        }${req.body.contactTag ? ` [Tag: ${req.body.contactTag}]` : ""}`
      : `Updated lead: ${lead.name}`,
    targetId: lead._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: lead,
  });
});

const bulkAssignLeads = asyncHandler(async (req, res) => {
  const { leadIds, assignedTo } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400);
    throw new Error("leadIds must be a non-empty array");
  }
  if (!assignedTo) {
    res.status(400);
    throw new Error("assignedTo is required");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const leads = await Lead.find({ _id: { $in: leadIds }, ...tenantFilter }).select("name");

  if (leads.length === 0) {
    res.status(404);
    throw new Error("No matching leads found");
  }

  const foundIds = leads.map((l) => l._id);
  await Lead.updateMany(
    { _id: { $in: foundIds } },
    { $set: { assignedTo } },
  );

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Lead",
    description: `Bulk reassigned ${foundIds.length} lead(s)`,
    ip: req.ip,
  });

  res.json({
    success: true,
    updatedCount: foundIds.length,
    skippedCount: leadIds.length - foundIds.length,
  });
});

const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { leadIds, status, remarks } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400);
    throw new Error("leadIds must be a non-empty array");
  }
  if (!status) {
    res.status(400);
    throw new Error("status is required");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const leads = await Lead.find({ _id: { $in: leadIds }, ...tenantFilter });

  const { VALID_TRANSITIONS, MANDATORY_FIELDS, REQUIRES_DATE } =
    await getTransitionMapsForTenant(req.user.tenantId);

  const updated = [];
  const skipped = [];

  for (const lead of leads) {
    if (!isValidTransition(lead.status, status, VALID_TRANSITIONS)) {
      skipped.push({ id: lead._id, name: lead.name, reason: `Invalid transition from "${lead.status}"` });
      continue;
    }

    const fieldError = validateMandatoryFields(
      status,
      { status, remarks },
      lead.status,
      MANDATORY_FIELDS,
      REQUIRES_DATE,
    );
    if (fieldError) {
      skipped.push({ id: lead._id, name: lead.name, reason: fieldError });
      continue;
    }

    const newStagePath = lead.stagePath ? [...lead.stagePath] : [lead.status];
    if (!newStagePath.includes(status)) {
      newStagePath.push(status);
    }

    await Lead.findByIdAndUpdate(lead._id, {
      $set: { status, stagePath: newStagePath },
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          changedBy: req.user._id,
          remarks: remarks || "",
        },
      },
    });

    updated.push(lead._id);
  }

  logActivity({
    user: req.user,
    action: "STATUS_UPDATED",
    module: "Lead",
    description: `Bulk updated status of ${updated.length} lead(s) to ${status}`,
    ip: req.ip,
  });

  res.json({
    success: true,
    updatedCount: updated.length,
    skipped,
  });
});

const bulkEmailLeads = asyncHandler(async (req, res) => {
  const { leadIds, subject, message } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400);
    throw new Error("leadIds must be a non-empty array");
  }
  if (!subject || !message) {
    res.status(400);
    throw new Error("subject and message are required");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const leads = await Lead.find({ _id: { $in: leadIds }, ...tenantFilter }).select("name email");

  const sent = [];
  const skipped = [];

  for (const lead of leads) {
    if (!lead.email) {
      skipped.push({ id: lead._id, name: lead.name, reason: "No email on file" });
      continue;
    }
    try {
      await sendBulkLeadEmail({
        to: lead.email,
        subject,
        message,
        fromName: req.user?.tenantId ? undefined : "NESTLeads",
      });
      sent.push(lead._id);
    } catch (err) {
      skipped.push({ id: lead._id, name: lead.name, reason: "Failed to send" });
    }
  }

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Lead",
    description: `Sent bulk email to ${sent.length} lead(s): "${subject}"`,
    ip: req.ip,
  });

  res.json({
    success: true,
    sentCount: sent.length,
    skipped,
  });
});

const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  await Lead.findByIdAndDelete(req.params.id);

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Lead",
    description: `Deleted lead: ${lead.name} (${lead.company || ""})`,
    targetId: lead._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Lead deleted successfully",
  });
});

const addNote = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  lead.notes.push({
    text: req.body.text,
    addedBy: req.user._id,
  });

  await lead.save();

  const populated = await Lead.findById(lead._id)
    .populate("assignedTo", "name email")
    .populate("notes.addedBy", "name");

  logActivity({
    user: req.user,
    action: "NOTE_ADDED",
    module: "Lead",
    description: `Note added to lead by ${req.user.name}`,
    targetId: lead._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: populated,
  });
});

const convertToClient = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  if (lead.status === "WON") {
    res.status(400);
    throw new Error("Lead is already converted");
  }

  lead.status = "WON";
  if (req.body.remarks) {
    lead.remarks = req.body.remarks;
  }
  if (!lead.statusHistory) {
    lead.statusHistory = [];
  }

  lead.statusHistory.push({
    status: "WON",
    timestamp: new Date(),
    changedBy: req.user._id,
    remarks: req.body.remarks || "Converted to client",
  });

  await lead.save();

  const clientData = {
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    address: req.body.address || "Not Provided",
    businessType: req.body.businessType || "Not Specified",
    convertedFrom: lead._id,
  };

  const Client = require("../models/Client");
  const client = await Client.create(clientData);

  logActivity({
    user: req.user,
    action: "LEAD_CONVERTED",
    module: "Lead",
    description: `Lead converted to client: ${lead.name} → client #${client._id}`,
    targetId: lead._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: "Lead converted to client successfully",
    data: { lead, client },
  });
});

const syncLogs = [];

const connectIndiamart = asyncHandler(async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) {
    res.status(400);
    throw new Error("API key is required");
  }

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const result = await fetchFromIndiaMART(
      apiKey.trim(),
      formatIMDate(oneHourAgo),
      formatIMDate(now),
    );
    if (result.CODE !== 200 && result.CODE !== 204) {
      res.status(400);
      throw new Error(result.MESSAGE || "Invalid API key");
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(400);
      throw new Error(`Could not verify API key: ${err.message}`);
    }
    throw err;
  }

  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  await Tenant.findOneAndUpdate(query, {
    "integrations.indiamart.enabled": true,
    "integrations.indiamart.apiKey": apiKey.trim(),
  });

  res.json({ success: true, message: "IndiaMART connected successfully" });
});

const disconnectIndiamart = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  await Tenant.findOneAndUpdate(query, {
    "integrations.indiamart.enabled": false,
    "integrations.indiamart.apiKey": "",
  });

  res.json({ success: true, message: "IndiaMART disconnected" });
});

const syncFromIndiamart = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const tenant = await Tenant.findOne(query);
  const apiKey =
    process.env.INDIAMART_API_KEY ||
    tenant?.integrations?.indiamart?.apiKey ||
    null;

  if (!apiKey) {
    res.status(400);
    throw new Error(
      "IndiaMART not connected. Please add your API key from the Integrations page.",
    );
  }

  const { start_time, end_time } = req.body;
  let startTime, endTime;

  if (start_time && end_time) {
    startTime = start_time;
    endTime = end_time;
  } else {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    endTime = formatIMDate(now);
    startTime = formatIMDate(oneDayAgo);
  }

  const result = await syncIndiamartLeads({
    apiKey,
    tenantId: req.user.tenantId || tenant?._id || null,
    startTime,
    endTime,
    updateExisting: false,
    assigneeIds: tenant?.integrations?.indiamart?.assigneeIds || [],
  });

  await Tenant.findOneAndUpdate(query, {
    "integrations.indiamart.lastSync": new Date(),
  });

  const logEntry = {
    timestamp: new Date().toISOString(),
    startTime,
    endTime,
    fetched: result.fetched,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors,
    apiStatus: result.apiResponse,
    triggeredBy: req.user.name || req.user.email,
  };
  syncLogs.unshift(logEntry);
  if (syncLogs.length > 50) syncLogs.pop();

  res.json({
    success: true,
    message: `Sync complete. ${result.created} new lead(s) imported, ${result.updated || 0} existing lead(s) updated.`,
    data: result,
  });
});

const getIndiamartSyncStatus = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const tenant = await Tenant.findOne(query);
  const integration = tenant?.integrations?.indiamart || {};
  const connected =
    !!process.env.INDIAMART_API_KEY ||
    (integration.enabled && !!integration.apiKey);

  const leadFilter = { source: "IndiaMART" };
  if (req.user.tenantId) leadFilter.tenantId = req.user.tenantId;

  const total = await Lead.countDocuments(leadFilter);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentCount = await Lead.countDocuments({
    ...leadFilter,
    createdAt: { $gte: lastWeek },
  });

  res.json({
    success: true,
    data: {
      connected,
      apiKeyConfigured: connected,
      lastSync: integration.lastSync || null,
      totalIndiamartLeads: total,
      last7DaysLeads: recentCount,
      recentSyncs: syncLogs.slice(0, 10),
      assigneeIds: integration.assigneeIds || [],
    },
  });
});

const indiamartWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 [IndiaMART Webhook] Received Push notification:", req.body);

  let records = [];
  if (Array.isArray(req.body)) {
    records = req.body;
  } else if (req.body && Array.isArray(req.body.RESPONSE)) {
    records = req.body.RESPONSE;
  } else if (
    req.body &&
    req.body.RESPONSE &&
    typeof req.body.RESPONSE === "object"
  ) {
    records = [req.body.RESPONSE];
  } else if (req.body && req.body.UNIQUE_QUERY_ID) {
    records = [req.body];
  }

  if (records.length === 0) {
    return res.status(200).json({
      success: true,
      message: "Webhook received but no valid leads found",
    });
  }

  const tenant = await Tenant.findOne({
    "integrations.indiamart.enabled": true,
    "integrations.indiamart.apiKey": { $exists: true, $ne: "" },
  });

  if (!tenant) {
    console.warn(
      "[IndiaMART Webhook] No active IndiaMART tenant found, leads will be created without tenantId",
    );
  }

  let createdCount = 0;

  for (const record of records) {
    if (!record.UNIQUE_QUERY_ID) continue;
    const qid = record.UNIQUE_QUERY_ID;

    try {
      const tenantFilter = tenant
        ? { tenantId: tenant._id }
        : { tenantId: null };
      const existing = await Lead.findOne({
        indiamartQueryId: qid,
        ...tenantFilter,
      });
      if (!existing) {
        const savedIds = tenant?.integrations?.indiamart?.assigneeIds || [];
        const assignToId =
          savedIds.length > 0
            ? await getRoundRobinFromIds(savedIds)
            : await getRoundRobinAssigneeId(tenant?._id);
        const leadData = mapIMLeadToModel(record, assignToId);
        if (tenant) {
          leadData.tenantId = tenant._id;
        }
        await Lead.create(leadData);
        createdCount++;
      }
    } catch (err) {
      console.error(
        `[IndiaMART Webhook] Error processing lead QID ${qid}:`,
        err.message,
      );
    }
  }

  console.log(
    `[IndiaMART Webhook] Processed ${records.length} records. Created ${createdCount} new leads.`,
  );
  res.status(200).json({
    success: true,
    message: `Processed ${records.length} records, saved ${createdCount}`,
  });
});

// ─── TradeIndia ──────────────────────────────────────────────────────────
// Pull-style, mirroring IndiaMART, but against a tenant-supplied API URL
// (see backend/services/tradeindiaService.js for why).

const connectTradeindia = asyncHandler(async (req, res) => {
  const { userId, profileId, apiKey, apiUrl } = req.body;
  if (!userId?.trim() || !apiKey?.trim() || !apiUrl?.trim()) {
    res.status(400);
    throw new Error("User ID, API Key, and API Link are all required");
  }

  try {
    // eslint-disable-next-line no-new
    new URL(apiUrl.trim());
  } catch {
    res.status(400);
    throw new Error(
      "That doesn't look like a valid URL — copy the exact API Link from TradeIndia's My Inquiry API panel.",
    );
  }

  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  await Tenant.findOneAndUpdate(query, {
    "integrations.tradeindia.enabled": true,
    "integrations.tradeindia.userId": userId.trim(),
    "integrations.tradeindia.profileId": (profileId || "").trim(),
    "integrations.tradeindia.apiKey": apiKey.trim(),
    "integrations.tradeindia.apiUrl": apiUrl.trim(),
  });

  res.json({
    success: true,
    message:
      "TradeIndia details saved. Run a sync from the Integrations page to pull in your first batch of leads and confirm it's working.",
  });
});

const disconnectTradeindia = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  await Tenant.findOneAndUpdate(query, {
    "integrations.tradeindia.enabled": false,
    "integrations.tradeindia.apiKey": "",
    "integrations.tradeindia.apiUrl": "",
  });

  res.json({ success: true, message: "TradeIndia disconnected" });
});

const syncFromTradeindia = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const tenant = await Tenant.findOne(query);
  const ti = tenant?.integrations?.tradeindia;

  if (!ti?.enabled || !ti?.apiUrl) {
    res.status(400);
    throw new Error(
      "TradeIndia not connected. Add your API details from the Integrations page.",
    );
  }

  const result = await syncTradeIndiaLeads({
    apiUrl: ti.apiUrl,
    userId: ti.userId,
    profileId: ti.profileId,
    apiKey: ti.apiKey,
    tenantId: req.user.tenantId || tenant?._id || null,
    startDate: req.body.start_date,
    endDate: req.body.end_date,
    assigneeIds: ti.assigneeIds || [],
    getRoundRobinFromIds,
    getRoundRobinAssigneeId,
  });

  await Tenant.findOneAndUpdate(query, {
    "integrations.tradeindia.lastSync": new Date(),
  });

  res.json({
    success: true,
    message: `Sync complete. ${result.created} new lead(s) imported, ${result.skipped} already existed.`,
    data: result,
  });
});

const getTradeindiaSyncStatus = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const tenant = await Tenant.findOne(query);
  const integration = tenant?.integrations?.tradeindia || {};
  const connected = !!(integration.enabled && integration.apiUrl);

  const leadFilter = { source: "TradeIndia" };
  if (req.user.tenantId) leadFilter.tenantId = req.user.tenantId;

  const total = await Lead.countDocuments(leadFilter);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentCount = await Lead.countDocuments({
    ...leadFilter,
    createdAt: { $gte: lastWeek },
  });

  res.json({
    success: true,
    data: {
      connected,
      configured: connected,
      lastSync: integration.lastSync || null,
      totalTradeindiaLeads: total,
      last7DaysLeads: recentCount,
      assigneeIds: integration.assigneeIds || [],
    },
  });
});

// ─── Justdial ────────────────────────────────────────────────────────────
// No self-serve pull API — Justdial's business support team pushes leads
// to a webhook URL we hand them. "Connect" here just generates that URL.

const connectJustdial = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const existing = await Tenant.findOne(query);
  const token =
    existing?.integrations?.justdial?.webhookToken || generateWebhookToken();

  await Tenant.findOneAndUpdate(query, {
    "integrations.justdial.enabled": true,
    "integrations.justdial.apiKey": (req.body.apiKey || "").trim(),
    "integrations.justdial.webhookToken": token,
  });

  const backendUrl = process.env.BACKEND_URL || "https://leads-backend.pixelatenest.com";
  res.json({
    success: true,
    message: "Webhook URL generated — share it with Justdial business support to activate.",
    data: { webhookUrl: `${backendUrl}/api/leads/justdial/webhook/${token}` },
  });
});

const disconnectJustdial = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  await Tenant.findOneAndUpdate(query, {
    "integrations.justdial.enabled": false,
    "integrations.justdial.webhookToken": "",
  });

  res.json({ success: true, message: "Justdial disconnected" });
});

const getJustdialStatus = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };

  const tenant = await Tenant.findOne(query);
  const integration = tenant?.integrations?.justdial || {};
  const connected = !!(integration.enabled && integration.webhookToken);

  const leadFilter = { source: "Justdial" };
  if (req.user.tenantId) leadFilter.tenantId = req.user.tenantId;

  const total = await Lead.countDocuments(leadFilter);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentCount = await Lead.countDocuments({
    ...leadFilter,
    createdAt: { $gte: lastWeek },
  });

  const backendUrl = process.env.BACKEND_URL || "https://leads-backend.pixelatenest.com";

  res.json({
    success: true,
    data: {
      connected,
      configured: connected,
      webhookUrl: connected
        ? `${backendUrl}/api/leads/justdial/webhook/${integration.webhookToken}`
        : null,
      lastLeadAt: integration.lastLeadAt || null,
      totalJustdialLeads: total,
      last7DaysLeads: recentCount,
      assigneeIds: integration.assigneeIds || [],
    },
  });
});

const justdialWebhook = asyncHandler(async (req, res) => {
  const { token } = req.params;
  console.log("🔔 [Justdial Webhook] Received:", req.body);

  const tenant = await Tenant.findOne({
    "integrations.justdial.enabled": true,
    "integrations.justdial.webhookToken": token,
  });

  if (!tenant) {
    return res.status(404).json({ success: false, message: "Unknown webhook token" });
  }

  const leadId = pickJDField(req.body, ["lead_id", "leadid", "id", "call_id", "enquiry_id"]);

  try {
    if (leadId) {
      const existing = await Lead.findOne({
        justdialLeadId: String(leadId),
        tenantId: tenant._id,
      });
      if (existing) {
        return res.status(200).json({ success: true, message: "Already recorded" });
      }
    }

    const savedIds = tenant.integrations?.justdial?.assigneeIds || [];
    const assignToId =
      savedIds.length > 0
        ? await getRoundRobinFromIds(savedIds)
        : await getRoundRobinAssigneeId(tenant._id);

    const leadData = mapJDLeadToModel(req.body, assignToId);
    leadData.tenantId = tenant._id;
    await Lead.create(leadData);

    await Tenant.findByIdAndUpdate(tenant._id, {
      "integrations.justdial.lastLeadAt": new Date(),
    });

    res.status(200).json({ success: true, message: "Lead recorded" });
  } catch (err) {
    console.error("[Justdial Webhook] Error:", err.message);
    res.status(200).json({ success: false, message: err.message });
  }
});

const getStatusHistoryReport = asyncHandler(async (req, res) => {
  const { period, userId, fromDate, toDate } = req.query;

  const now = new Date();
  let start, end;

  if (fromDate && toDate) {
    start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    start = new Date(now);
    if (period === "week") {
      start.setDate(now.getDate() - 6);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      start = new Date(now.getFullYear(), 0, 1);
    }
    start.setHours(0, 0, 0, 0);
  }

  const tenantFilter = {};
  if (req.user.tenantId) tenantFilter.tenantId = req.user.tenantId;
  if (req.user.role === "sales_executive")
    tenantFilter.assignedTo = req.user._id;

  const historyMatch = {
    "statusHistory.timestamp": { $gte: start, $lte: end },
  };
  if (userId) {
    historyMatch["statusHistory.changedBy"] = new mongoose.Types.ObjectId(
      userId,
    );
  }

  const pipeline = [
    { $match: tenantFilter },
    { $unwind: "$statusHistory" },
    { $match: historyMatch },
    {
      $lookup: {
        from: "users",
        localField: "statusHistory.changedBy",
        foreignField: "_id",
        as: "_changedByArr",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "_assignedArr",
      },
    },
    {
      $project: {
        _id: 0,
        leadId: "$_id",
        leadName: "$name",
        leadCompany: "$company",
        leadPhone: "$phone",
        currentStatus: "$status",
        changedToStatus: "$statusHistory.status",
        timestamp: "$statusHistory.timestamp",
        remarks: "$statusHistory.remarks",
        changedBy: { $arrayElemAt: ["$_changedByArr.name", 0] },
        changedById: "$statusHistory.changedBy",
        assignedTo: { $arrayElemAt: ["$_assignedArr.name", 0] },
      },
    },
    { $sort: { timestamp: -1 } },
  ];

  const results = await Lead.aggregate(pipeline);

  res.json({ success: true, count: results.length, data: results });
});

const updateIndiamartSettings = asyncHandler(async (req, res) => {
  const { assigneeIds } = req.body;
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
  await Tenant.findOneAndUpdate(query, {
    "integrations.indiamart.assigneeIds": Array.isArray(assigneeIds)
      ? assigneeIds
      : [],
  });
  res.json({ success: true, message: "IndiaMART settings updated" });
});

const importLeads = asyncHandler(async (req, res) => {
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    res.status(400);
    throw new Error("No leads provided");
  }

  // Drop fully blank rows (e.g. trailing/hidden rows from Excel exports)
  const nonBlankLeads = leads.filter((row) =>
    Object.values(row || {}).some((v) => String(v ?? "").trim() !== ""),
  );
  if (nonBlankLeads.length === 0) {
    res.status(400);
    throw new Error("No leads provided");
  }

  const docs = nonBlankLeads.map((row) => ({
    name: (row.name || "").trim(),
    company: (row.company || "").trim(),
    phone: (row.phone || "").toString().trim(),
    email: (row.email || "").toString().trim().toLowerCase(),
    requirement: (row.requirement || "").trim(),
    remarks: (row.remarks || "").trim(),
    budget: (row.budget || "").toString().trim(),
    location: (row.location || "").trim(),
    state: (row.state || "").trim(),
    website: (row.website || "").toString().trim(),
    source: "Manual",
    tenantId: req.user.tenantId || null,
    assignedTo: req.user._id,
    status: "PENDING CONTACT",
    statusHistory: [
      {
        status: "PENDING CONTACT",
        timestamp: new Date(),
        changedBy: req.user._id,
        remarks: "Imported via Excel",
      },
    ],
  }));

  const invalid = docs
    .map((d, i) => (!d.name ? i + 1 : null))
    .filter(Boolean);
  if (invalid.length > 0) {
    res.status(400);
    throw new Error(
      `Rows missing required fields (Name): ${invalid.join(", ")}`,
    );
  }

  const inserted = await Lead.insertMany(docs, { ordered: false });
  res.json({
    success: true,
    count: inserted.length,
    message: `${inserted.length} leads imported successfully`,
  });
});

const getLeadColumnPreferences = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
  const tenant = await Tenant.findOne(query).select("leadsTableColumns");
  res.json({ success: true, data: tenant?.leadsTableColumns || {} });
});

const updateLeadColumnPreferences = asyncHandler(async (req, res) => {
  const { columns } = req.body;
  if (!columns || typeof columns !== "object" || Array.isArray(columns)) {
    res.status(400);
    throw new Error("columns must be an object of columnId -> boolean");
  }
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
  const tenant = await Tenant.findOneAndUpdate(
    query,
    { leadsTableColumns: columns },
    { new: true },
  ).select("leadsTableColumns");
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }
  res.json({ success: true, data: tenant.leadsTableColumns || {} });
});

const resolveTenantId = async (req) => {
  if (req.user.tenantId) return req.user.tenantId;
  const tenant = await Tenant.findOne({ ownerUser: req.user._id }).select(
    "_id",
  );
  return tenant?._id || null;
};

const getSavedViews = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const views = tenantId
    ? await SavedView.find({ tenantId }).sort("name")
    : [];
  res.json({ success: true, data: views });
});

const createSavedView = asyncHandler(async (req, res) => {
  const { name, filters } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400);
    throw new Error("View name is required");
  }
  const tenantId = await resolveTenantId(req);
  if (!tenantId) {
    res.status(404);
    throw new Error("Tenant not found");
  }
  const view = await SavedView.create({
    tenantId,
    name: name.trim(),
    filters: filters && typeof filters === "object" ? filters : {},
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: view });
});

const updateSavedView = asyncHandler(async (req, res) => {
  const { name, filters } = req.body;
  const tenantId = await resolveTenantId(req);
  const update = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      res.status(400);
      throw new Error("View name is required");
    }
    update.name = name.trim();
  }
  if (filters !== undefined) {
    if (typeof filters !== "object" || Array.isArray(filters)) {
      res.status(400);
      throw new Error("filters must be an object");
    }
    update.filters = filters;
  }
  const view = await SavedView.findOneAndUpdate(
    { _id: req.params.viewId, tenantId },
    update,
    { new: true },
  );
  if (!view) {
    res.status(404);
    throw new Error("Saved view not found");
  }
  res.json({ success: true, data: view });
});

const deleteSavedView = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const view = await SavedView.findOneAndDelete({
    _id: req.params.viewId,
    tenantId,
  });
  if (!view) {
    res.status(404);
    throw new Error("Saved view not found");
  }
  res.json({ success: true, data: {} });
});

module.exports = {
  getLeads,
  getLead,
  createLead,
  importLeads,
  updateLead,
  deleteLead,
  bulkAssignLeads,
  bulkUpdateStatus,
  bulkEmailLeads,
  addNote,
  convertToClient,
  connectIndiamart,
  disconnectIndiamart,
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
  connectTradeindia,
  disconnectTradeindia,
  syncFromTradeindia,
  getTradeindiaSyncStatus,
  connectJustdial,
  disconnectJustdial,
  getJustdialStatus,
  justdialWebhook,
  getStatusHistoryReport,
  updateIndiamartSettings,
  getLeadColumnPreferences,
  updateLeadColumnPreferences,
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
};
