// Offline check for controllers/clientController.js — no DB, models are stubbed.
// Run: node scripts/check-clients.js
const assert = require("assert");
const mongoose = require("mongoose");
const Client = require("../models/Client");
const ctl = require("../controllers/clientController");

const oid = () => new mongoose.Types.ObjectId();
const user = { _id: oid(), tenantId: oid(), name: "Asha", role: "admin" };

const call = async (handler, { body = {}, params = {}, query = {} } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  let error = null;
  await handler({ user, body, params, query, ip: "127.0.0.1" }, res, (e) => (error = e));
  return { res, error };
};
const chain = (result) => {
  const c = { select: () => c, sort: () => c, skip: () => c, limit: () => c, lean: async () => result, populate: () => c };
  c.then = (ok, bad) => Promise.resolve(result).then(ok, bad);
  return c;
};

const good = (over = {}) => ({
  name: "Ravi Kumar",
  company: "Acme Pvt Ltd",
  email: "Ravi@Acme.com",
  phone: "+91 98765 43210",
  address: "12 MG Road, Pune",
  businessType: "Manufacturing",
  gst: "",
  services: "SEO, Web Design",
  projectStatus: "on hold",
  paymentStatus: "",
  ...over,
});

async function main() {
  // ---- import: valid rows go in, bad rows come back with row number + reason ----
  let inserted = null;
  Client.find = () => chain([{ email: "taken@acme.com" }]);
  Client.insertMany = async (docs, opts) => ((inserted = { docs, opts }), docs);

  const rows = [
    good(), // row 2 ok
    good({ email: "b@acme.com", address: "" }), // row 3 no address
    good({ email: "c@acme.com", phone: "12345" }), // row 4 bad phone
    good({ email: "not-an-email" }), // row 5 bad email
    good({ email: "TAKEN@acme.com" }), // row 6 already in DB
    good({ email: "ravi@acme.com" }), // row 7 repeats row 2
    good({ email: "d@acme.com", gst: "BADGST" }), // row 8
    good({ email: "e@acme.com", projectStatus: "Halted" }), // row 9
    good({ email: "f@acme.com", name: "=HYPERLINK(\"http://x\")", phone: "09876543211", createdBy: "hacker" }), // row 10 ok, sanitised
  ];
  let { res, error } = await call(ctl.importClients, { body: { clients: rows } });
  assert.ifError(error);
  assert.strictEqual(res.body.imported, 2);
  assert.deepStrictEqual(
    res.body.skipped.map((s) => s.row),
    [3, 4, 5, 6, 7, 8, 9],
  );
  const reason = (row) => res.body.skipped.find((s) => s.row === row).reason;
  assert.match(reason(3), /address/i);
  assert.match(reason(4), /10-digit/);
  assert.match(reason(5), /valid email/i);
  assert.match(reason(6), /already exists/);
  assert.match(reason(7), /repeated in this file/);
  assert.match(reason(8), /GST/);
  assert.match(reason(9), /Project Status/);

  assert.strictEqual(inserted.opts.ordered, false);
  const [a, b] = inserted.docs;
  assert.strictEqual(a.email, "ravi@acme.com");
  assert.strictEqual(a.phone, "9876543210", "+91 and spaces stripped");
  assert.strictEqual(a.projectStatus, "On Hold", "case-insensitive status");
  assert.strictEqual(a.paymentStatus, "Pending", "blank falls back to default");
  assert.deepStrictEqual([...a.services], ["SEO", "Web Design"]);
  assert.strictEqual(String(a.createdBy), String(user._id), "importer is recorded as who added it");
  assert.strictEqual(String(a.tenantId), String(user.tenantId));
  assert.strictEqual(String(b.createdBy), String(user._id), "createdBy in the file is ignored");
  assert.ok(!b.name.startsWith("="), "formula prefix stripped: " + b.name);
  assert.strictEqual(b.phone, "9876543211", "leading 0 stripped");

  // nothing valid: still 200 with the reasons, and no insert
  inserted = null;
  ({ res } = await call(ctl.importClients, { body: { clients: [good({ address: "" })] } }));
  assert.strictEqual(res.body.imported, 0);
  assert.strictEqual(res.body.skipped.length, 1);
  assert.strictEqual(inserted, null);

  // bad payloads
  ({ res, error } = await call(ctl.importClients, { body: { clients: [] } }));
  assert.strictEqual(res.statusCode, 400);
  ({ res, error } = await call(ctl.importClients, { body: { clients: new Array(1001).fill(good()) } }));
  assert.strictEqual(res.statusCode, 400);

  // ---- create: who added it comes from the session, never the body ----
  let created = null;
  Client.create = async (doc) => {
    created = doc;
    return { ...doc, name: doc.name, populate: async () => {} };
  };
  ({ res, error } = await call(ctl.createClient, { body: { name: "X", createdBy: "hacker", tenantId: "other" } }));
  assert.ifError(error);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(String(created.createdBy), String(user._id));
  assert.strictEqual(String(created.tenantId), String(user.tenantId));

  // ---- list populates the adder's name ----
  let populated = null;
  Client.find = () => {
    const c = chain([]);
    c.populate = (...args) => ((populated = args), c);
    return c;
  };
  Client.countDocuments = async () => 0;
  await call(ctl.getClients);
  assert.deepStrictEqual(populated, ["createdBy", "name"]);

  // ---- update/get/delete are tenant-scoped; createdBy/tenantId can't be edited ----
  let seen = null;
  Client.findOneAndUpdate = (filter, updates) => {
    seen = { filter, updates };
    return { populate: async () => ({ name: "Y" }) };
  };
  ({ res } = await call(ctl.updateClient, { params: { id: "abc" }, body: { name: "Y", createdBy: "hacker", tenantId: "other" } }));
  assert.strictEqual(res.body.success, true);
  assert.deepStrictEqual(seen.updates, { name: "Y" });
  assert.strictEqual(String(seen.filter.tenantId), String(user.tenantId));

  Client.findOneAndUpdate = () => ({ populate: async () => null });
  ({ res, error } = await call(ctl.updateClient, { params: { id: "abc" }, body: { name: "Y" } }));
  assert.strictEqual(res.statusCode, 404, "someone else's client is a 404");

  let delFilter = null;
  Client.findOneAndDelete = async (f) => ((delFilter = f), null);
  ({ res } = await call(ctl.deleteClient, { params: { id: "abc" } }));
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(String(delFilter.tenantId), String(user.tenantId));

  let getFilter = null;
  Client.findOne = (f) => ((getFilter = f), chain(null));
  ({ res } = await call(ctl.getClient, { params: { id: "abc" } }));
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(String(getFilter.tenantId), String(user.tenantId));

  console.log("check-clients: all checks passed");
}

main().catch((err) => {
  console.error("check-clients FAILED:", err);
  process.exit(1);
});
