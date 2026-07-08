const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const {
  syncIndiamartLeads,
  formatIMDate,
  fetchFromIndiaMART,
  mapIMLeadToModel,
  getRoundRobinAssigneeId,
  getRoundRobinFromIds,
} = require("../services/indiamartService");
const User = require("../models/User");
const logActivity = require("../utils/activityLogger");
const { resolvePincode } = require("../utils/pincode");

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

  const docs = leads.map((row) => ({
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

module.exports = {
  getLeads,
  getLead,
  createLead,
  importLeads,
  updateLead,
  deleteLead,
  addNote,
  convertToClient,
  connectIndiamart,
  disconnectIndiamart,
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
  getStatusHistoryReport,
  updateIndiamartSettings,
  getLeadColumnPreferences,
  updateLeadColumnPreferences,
};
