const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const {
  syncIndiamartLeads,
  formatIMDate,
  fetchFromIndiaMART,
  mapIMLeadToModel,
  getRoundRobinAssigneeId,
} = require("../services/indiamartService");
const User = require("../models/User");
const logActivity = require("../utils/activityLogger");

const VALID_TRANSITIONS = {
  "PENDING CONTACT": ["1", "DISCUSSION", "DROP"],
  1: ["2", "DISCUSSION", "DROP"],
  2: ["3", "DISCUSSION", "DROP"],
  3: ["COMPLETED", "DISCUSSION", "DROP"],
  COMPLETED: ["COMPLETED", "DISCUSSION", "DROP"],
  DISCUSSION: [
    "DISCUSSION 1",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DISCUSSION",
    "DROP",
  ],
  "DISCUSSION 1": [
    "DISCUSSION 1",
    "DISCUSSION 2",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION 2": [
    "DISCUSSION 2",
    "DISCUSSION 3",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION 3": [
    "DISCUSSION 3",
    "DISCUSSION COMPLETED",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION COMPLETED": [
    "DISCUSSION COMPLETED",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  QUOTATION: [
    "QUOTATION 1",
    "VISIT SCHEDULED",
    "DISCUSSION",
    "QUOTATION",
    "DROP",
  ],
  "QUOTATION 1": [
    "QUOTATION 1",
    "QUOTATION 2",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION 2": [
    "QUOTATION 2",
    "QUOTATION 3",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION 3": [
    "QUOTATION 3",
    "QUOTATION COMPLETED",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION COMPLETED": [
    "QUOTATION COMPLETED",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "VISIT SCHEDULED": ["VISIT SCHEDULED", "VISITED", "DISCUSSION", "DROP"],
  VISITED: ["WON", "DISCUSSION", "DROP"],
  WON: [],
  DROP: ["PENDING CONTACT"],
};

const MANDATORY_FIELDS = {
  1: ["remarks"],
  2: ["remarks"],
  3: ["remarks"],
  COMPLETED: ["remarks"],
  DISCUSSION: ["remarks"],
  "DISCUSSION 1": ["remarks"],
  "DISCUSSION 2": ["remarks"],
  "DISCUSSION 3": ["remarks"],
  "DISCUSSION COMPLETED": ["remarks"],
  QUOTATION: ["remarks"],
  "QUOTATION 1": ["remarks"],
  "QUOTATION 2": ["remarks"],
  "QUOTATION 3": ["remarks"],
  "QUOTATION COMPLETED": ["remarks"],
  "VISIT SCHEDULED": ["remarks"],
  VISITED: ["remarks"],
  WON: ["remarks"],
  DROP: [],
};

const REQUIRES_DATE = [
  "1",
  "2",
  "3",
  "COMPLETED",
  "DISCUSSION",
  "DISCUSSION 1",
  "DISCUSSION 2",
  "DISCUSSION 3",
  "DISCUSSION COMPLETED",
  "QUOTATION",
  "QUOTATION 1",
  "QUOTATION 2",
  "QUOTATION 3",
  "QUOTATION COMPLETED",
  "VISIT SCHEDULED",
];

function isValidTransition(currentStatus, newStatus) {
  if (!VALID_TRANSITIONS[currentStatus]) {
    return false;
  }
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}

function validateMandatoryFields(newStatus, updateData, currentStatus) {
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
    page = 1,
    limit = 100000000000,
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
    ];
  }

  if (req.user.role === "sales_executive") {
    query.assignedTo = req.user._id;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate("assignedTo", "name email")
      .populate("statusHistory.changedBy", "name")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit)),
    Lead.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: leads.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
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
    requirement,
    assignedTo,
    followUpDate,
    remarks,
    budget,
    interestedProducts,
    location,
  } = req.body;

  const lead = await Lead.create({
    name,
    company,
    source,
    phone,
    email,
    requirement,
    remarks,
    budget,
    interestedProducts,
    location,
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
    if (!isValidTransition(lead.status, req.body.status)) {
      res.status(400);
      throw new Error(
        `Invalid status transition from "${lead.status}" to "${req.body.status}"`,
      );
    }

    const fieldError = validateMandatoryFields(
      req.body.status,
      req.body,
      lead.status,
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

  // Verify the key with a live call (204 = valid but no leads, 200 = valid with leads)
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
    (tenant?.integrations?.indiamart?.apiKey) ||
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
  });

  // Update lastSync timestamp on tenant
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

  // Find the tenant with active IndiaMART integration
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
      const existing = await Lead.findOne({ indiamartQueryId: qid });
      if (!existing) {
        const assignToId = await getRoundRobinAssigneeId(tenant?._id);
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

module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  convertToClient,
  connectIndiamart,
  disconnectIndiamart,
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
};
