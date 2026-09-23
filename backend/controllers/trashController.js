const asyncHandler = require("express-async-handler");
const logActivity = require("../utils/activityLogger");

// One entry per soft-deletable model. `title` / `sub` are what the Trash page shows.
const TYPES = {
  lead: {
    Model: require("../models/Lead"),
    label: "Lead",
    fields: "name company phone email",
    title: (d) => d.name,
    sub: (d) => d.company || d.phone || d.email,
  },
  client: {
    Model: require("../models/Client"),
    label: "Client",
    fields: "name company email phone",
    title: (d) => d.name,
    sub: (d) => d.company || d.email || d.phone,
  },
  product: {
    Model: require("../models/Product"),
    label: "Product",
    fields: "name",
    title: (d) => d.name,
    sub: () => "",
  },
  service: {
    Model: require("../models/Service"),
    label: "Service",
    fields: "status",
    title: () => "Service allocation",
    sub: (d) => d.status,
  },
  quotation: {
    Model: require("../models/Quotation"),
    label: "Quotation",
    fields: "number total status",
    title: (d) => d.number,
    sub: (d) => `${d.status || ""} · ₹${d.total ?? 0}`,
  },
  campaign: {
    Model: require("../models/Campaign"),
    label: "Campaign",
    fields: "name status",
    title: (d) => d.name,
    sub: (d) => d.status,
  },
};

// Not every model is tenant-scoped (e.g. Service), so only filter where the field exists.
const scope = (req, Model) =>
  req.user.tenantId && Model.schema.path("tenantId")
    ? { tenantId: req.user.tenantId }
    : {};

const pick = (req, res) => {
  const t = TYPES[req.params.type];
  if (!t) {
    res.status(404);
    throw new Error("Unknown trash type");
  }
  return t;
};

const getTrash = asyncHandler(async (req, res) => {
  const lists = await Promise.all(
    Object.entries(TYPES).map(async ([type, t]) => {
      const docs = await t.Model.find({
        deletedAt: { $ne: null },
        ...scope(req, t.Model),
      })
        .setOptions({ withDeleted: true })
        .select(`${t.fields} deletedAt deletedBy`)
        .populate("deletedBy", "name")
        .lean();
      return docs.map((d) => ({
        _id: d._id,
        type,
        label: t.label,
        title: t.title(d),
        sub: t.sub(d) || "",
        deletedAt: d.deletedAt,
        deletedBy: d.deletedBy,
      }));
    }),
  );
  const data = lists.flat().sort((a, b) => b.deletedAt - a.deletedAt);
  res.json({ success: true, count: data.length, data });
});

const restoreItem = asyncHandler(async (req, res) => {
  const t = pick(req, res);
  const doc = await t.Model.findOneAndUpdate(
    {
      _id: req.params.id,
      deletedAt: { $ne: null },
      ...scope(req, t.Model),
    },
    { $set: { deletedAt: null, deletedBy: null } },
  ).setOptions({ withDeleted: true });
  if (!doc) {
    res.status(404);
    throw new Error(`${t.label} not found in trash`);
  }
  logActivity({
    user: req.user,
    action: "RESTORE",
    module: t.label,
    description: `Restored ${t.label.toLowerCase()} from trash: ${t.title(doc)}`,
    targetId: doc._id,
    ip: req.ip,
  });
  res.json({ success: true, message: `${t.label} restored` });
});

const purgeItem = asyncHandler(async (req, res) => {
  const t = pick(req, res);
  const doc = await t.Model.findOneAndDelete({
    _id: req.params.id,
    deletedAt: { $ne: null },
    ...scope(req, t.Model),
  }).setOptions({ withDeleted: true });
  if (!doc) {
    res.status(404);
    throw new Error(`${t.label} not found in trash`);
  }
  logActivity({
    user: req.user,
    action: "PERMANENT_DELETE",
    module: t.label,
    description: `Permanently deleted ${t.label.toLowerCase()}: ${t.title(doc)}`,
    targetId: doc._id,
    ip: req.ip,
  });
  res.json({ success: true, message: `${t.label} permanently deleted` });
});

module.exports = { getTrash, restoreItem, purgeItem };
