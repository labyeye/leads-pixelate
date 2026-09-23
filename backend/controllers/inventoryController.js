// List / create / update / delete for the Inventory section (vendors, price books and the three
// trade documents), always inside the caller's tenant.
const asyncHandler = require("express-async-handler");
const TradeDoc = require("../models/TradeDoc");
const { TYPES } = TradeDoc;
const logActivity = require("../utils/activityLogger");
const { syncStock } = require("../utils/stock");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));
const scope = (req, extra = {}) => ({ ...extra, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) });
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A client never sets who owns the row, the type, the number or the computed totals.
const body = (req) => {
  const { tenantId, _id, createdAt, updatedAt, subtotal, tax, total, number, type, createdBy, ...rest } = req.body || {};
  return rest;
};

// fixed = filter that always applies (e.g. { type: "invoice" }); label = module name for the log.
function crud(Model, { label, searchField = "name", fixed = {}, beforeCreate, onChange }) {
  const find = (req, id) => Model.findOne(scope(req, { ...fixed, _id: id }));
  const notFound = (res) => {
    res.status(404);
    throw new Error(`${label} not found`);
  };
  const log = (req, action, doc) =>
    logActivity({
      user: req.user,
      action,
      module: label,
      description: `${{ CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" }[action]} ${label.toLowerCase()}: ${doc[searchField] || doc.number || doc._id}`,
      targetId: doc._id,
      ip: req.ip,
    });

  return {
    list: asyncHandler(async (req, res) => {
      const q = scope(req, fixed);
      if (req.query.status) q.status = String(req.query.status);
      if (req.query.search) q[searchField] = { $regex: escapeRe(req.query.search), $options: "i" };
      const data = await Model.find(q).sort("-createdAt").limit(500);
      res.json({ success: true, count: data.length, data });
    }),
    get: asyncHandler(async (req, res) => {
      const doc = isId(req.params.id) ? await find(req, req.params.id) : null;
      if (!doc) notFound(res);
      res.json({ success: true, data: doc });
    }),
    create: asyncHandler(async (req, res) => {
      const data = { ...body(req), ...fixed, tenantId: req.user.tenantId || null, createdBy: req.user._id };
      if (beforeCreate) await beforeCreate(data, req);
      const doc = await Model.create(data);
      if (onChange) await onChange(req, null, doc);
      log(req, "CREATE", doc);
      res.status(201).json({ success: true, data: doc });
    }),
    update: asyncHandler(async (req, res) => {
      const doc = isId(req.params.id) ? await find(req, req.params.id) : null;
      if (!doc) notFound(res);
      const before = onChange ? { status: doc.status, items: doc.items.map((i) => i.toObject()) } : null;
      doc.set(body(req));
      await doc.save(); // save (not findOneAndUpdate) so validation and the totals run
      if (onChange) await onChange(req, before, doc);
      log(req, "UPDATE", doc);
      res.json({ success: true, data: doc });
    }),
    remove: asyncHandler(async (req, res) => {
      const doc = isId(req.params.id) ? await find(req, req.params.id) : null;
      if (!doc) notFound(res);
      await doc.deleteOne();
      if (onChange) await onChange(req, { status: doc.status, items: doc.items }, null);
      log(req, "DELETE", doc);
      res.json({ success: true });
    }),
  };
}

// SO-0001, PO-0001, INV-0001: numbered per tenant and type, one above the newest so far.
// ponytail: two creates in the same instant can pick the same number; the unique index makes the
// second fail with a clear error instead of duplicating. Add a counter document if that ever bites.
async function nextNumber(type, tenantId) {
  const last = await TradeDoc.findOne({ type, tenantId: tenantId || null }).sort({ createdAt: -1 }).select("number").lean();
  const n = last ? parseInt(String(last.number).split("-").pop(), 10) || 0 : 0;
  return `${TYPES[type].prefix}-${String(n + 1).padStart(4, "0")}`;
}

const tradeDocs = (type, label) =>
  crud(TradeDoc, {
    label,
    searchField: "partyName",
    fixed: { type },
    beforeCreate: async (data, req) => {
      data.number = await nextNumber(type, req.user.tenantId);
    },
    onChange: (req, before, after) => syncStock(type, req.user.tenantId, before, after),
  });

module.exports = { crud, tradeDocs };
