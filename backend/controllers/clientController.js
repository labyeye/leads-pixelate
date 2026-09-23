const asyncHandler = require("express-async-handler");
const Client = require("../models/Client");
const logActivity = require("../utils/activityLogger");

const MAX_IMPORT_ROWS = 1000;
const PHONE_RE = /^[6-9]\d{9}$/;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const PROJECT_STATUSES = ["Active", "Completed", "On Hold"];
const PAYMENT_STATUSES = ["Paid", "Pending", "Overdue"];

const tenantScope = (req) =>
  req.user.tenantId ? { tenantId: req.user.tenantId } : {};

const getClients = asyncHandler(async (req, res) => {
  const {
    projectStatus,
    paymentStatus,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (req.user.tenantId) query.tenantId = req.user.tenantId;

  if (projectStatus) query.projectStatus = projectStatus;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [clients, total] = await Promise.all([
    Client.find(query)
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name"),
    Client.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: clients.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: clients,
  });
});

const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    ...tenantScope(req),
  })
    .populate("convertedFrom")
    .populate("createdBy", "name");

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  res.json({
    success: true,
    data: client,
  });
});

const createClient = asyncHandler(async (req, res) => {
  // tenantId / createdBy come from the session, never from the request body.
  const client = await Client.create({
    ...req.body,
    tenantId: req.user.tenantId || null,
    createdBy: req.user._id,
  });
  await client.populate("createdBy", "name");

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Client",
    description: `Created client: ${client.name} (${client.company || ""})`,
    targetId: client._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: client,
  });
});

const updateClient = asyncHandler(async (req, res) => {
  // Who added a client, and which tenant owns it, are not editable.
  const { createdBy, tenantId, ...updates } = req.body;

  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, ...tenantScope(req) },
    updates,
    { new: true, runValidators: true },
  ).populate("createdBy", "name");

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Client",
    description: `Updated client: ${client.name}`,
    targetId: client._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: client,
  });
});

const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, ...tenantScope(req) },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
  );

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Client",
    description: `Moved client to trash: ${client.name}`,
    targetId: client._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Client moved to trash",
  });
});

// Cell text goes into the DB and back out into CSV/Excel exports: drop angle
// brackets and any leading =,+,-,@ so a cell can't turn into a spreadsheet formula.
const text = (v, max) =>
  String(v ?? "")
    .replace(/[<>]/g, "")
    .replace(/^[=+\-@\t\r]+/, "")
    .trim()
    .slice(0, max);

// Blank -> fallback; otherwise a case-insensitive match against `allowed`, or null if unknown.
const pick = (v, allowed, fallback) => {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  return allowed.find((a) => a.toLowerCase() === s.toLowerCase()) ?? null;
};

function normalizeRow(raw) {
  const r = raw || {};
  let phone = String(r.phone ?? "").replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);

  return {
    name: text(r.name, 100),
    company: text(r.company, 150),
    email: String(r.email ?? "").trim().toLowerCase().slice(0, 150),
    phone,
    address: text(r.address, 300),
    businessType: text(r.businessType, 100),
    gst: String(r.gst ?? "").trim().toUpperCase().slice(0, 15),
    services: String(r.services ?? "")
      .split(",")
      .map((s) => text(s, 60))
      .filter(Boolean)
      .slice(0, 20),
    projectStatus: pick(r.projectStatus, PROJECT_STATUSES, "Active"),
    paymentStatus: pick(r.paymentStatus, PAYMENT_STATUSES, "Pending"),
  };
}

// Row-by-row so one bad row doesn't sink the file: valid rows are added, the
// rest come back with the Excel row number and the reason.
const importClients = asyncHandler(async (req, res) => {
  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    res.status(400);
    throw new Error("No clients provided");
  }
  if (clients.length > MAX_IMPORT_ROWS) {
    res.status(400);
    throw new Error(`Import up to ${MAX_IMPORT_ROWS} rows at a time`);
  }

  const emails = clients
    .map((r) => String(r?.email ?? "").trim().toLowerCase())
    .filter(Boolean);
  const existing = new Set(
    (
      await Client.find({ ...tenantScope(req), email: { $in: emails } })
        .select("email")
        .lean()
    ).map((c) => c.email),
  );

  const docs = [];
  const skipped = [];
  const seen = new Set();

  clients.forEach((raw, i) => {
    const row = i + 2; // Excel row: the header is row 1
    const d = normalizeRow(raw);
    const skip = (reason) => skipped.push({ row, name: d.name, reason });

    if (d.projectStatus === null) {
      return skip("Project Status must be Active, Completed or On Hold");
    }
    if (d.paymentStatus === null) {
      return skip("Payment Status must be Paid, Pending or Overdue");
    }

    const doc = new Client({
      ...d,
      tenantId: req.user.tenantId || null,
      createdBy: req.user._id,
    });
    const invalid = doc.validateSync(); // same rules as the Add Client form
    if (invalid) return skip(Object.values(invalid.errors)[0].message);

    if (!PHONE_RE.test(d.phone)) {
      return skip("Phone must be a valid 10-digit Indian mobile number");
    }
    if (d.gst && !GST_RE.test(d.gst)) return skip("Invalid GST number");
    if (existing.has(d.email)) {
      return skip("A client with this email already exists");
    }
    if (seen.has(d.email)) return skip("Email is repeated in this file");

    seen.add(d.email);
    docs.push(doc);
  });

  if (docs.length) await Client.insertMany(docs, { ordered: false });

  if (docs.length) {
    logActivity({
      user: req.user,
      action: "CREATE",
      module: "Client",
      description: `Imported ${docs.length} client(s) via Excel`,
      ip: req.ip,
    });
  }

  res.json({
    success: true,
    imported: docs.length,
    skipped,
    message: `${docs.length} client(s) imported${
      skipped.length ? `, ${skipped.length} skipped` : ""
    }`,
  });
});

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  importClients,
};
