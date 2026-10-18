// Offline checks for the security hardening (no database, no network). Run: node scripts/check-hardening.js
process.env.JWT_SECRET = "test-secret";
const assert = require("assert");
const path = require("path");
const jwt = require("jsonwebtoken");
const root = path.join(__dirname, "..");
const stub = (rel, exports) => {
  const f = require.resolve(path.join(root, rel));
  require.cache[f] = { id: f, filename: f, loaded: true, exports };
};
const res = () => ({ code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, sendStatus(c) { this.code = c; return this; } });

(async () => {
  // 1. every :id lookup is pinned to the caller's tenant
  const seen = [];
  stub("models/Product.js", { findOne: (f) => { seen.push(f); return Promise.resolve(null); }, find: () => ({ sort: async () => [] }) });
  stub("utils/activityLogger.js", () => {});
  const { getProduct } = require("../controllers/productController");
  await getProduct({ params: { id: "p1" }, user: { tenantId: "tenantA" } }, res(), () => {});
  assert.deepStrictEqual(seen[0], { _id: "p1", tenantId: "tenantA" }, "product lookup must carry tenantId");

  // 2. mass assignment: protected fields are dropped
  const { safeBody, tenantScope } = require("../utils/tenantScope");
  assert.deepStrictEqual(safeBody({ name: "x", tenantId: "evil", _id: "1", deletedAt: 1 }), { name: "x" });
  assert.deepStrictEqual(tenantScope({ user: {} }), {});

  // 3. email regex: valid long TLDs pass, the ReDoS payload returns instantly
  const User = require("../models/User");
  const re = User.schema.path("email").options.match[0];
  const t = Date.now();
  assert.ok(re.test("a@b.tech") && re.test("a.b@mail.agency") && !re.test("nope") && !re.test("a b@x.com"));
  re.test("a".repeat(5000) + "@" + "a.".repeat(3000) + "!");
  assert.ok(Date.now() - t < 200, "email regex must be linear-time");

  // 4. refresh tokens: each token only matches its own hash (bcrypt-on-JWT matched every token of a user)
  const g = require("../utils/generateToken");
  const a = await g.generateRefreshToken("u1");
  const b = await g.generateRefreshToken("u1");
  assert.ok(await g.refreshTokenMatches(a.raw, a.hash));
  assert.ok(!(await g.refreshTokenMatches(b.raw, a.hash)), "another refresh token must not verify");

  // 5. protect(): stale tokenVersion and non-access scopes are refused
  let dbUser = { _id: "u1", status: "active", tokenVersion: 1, tenantId: null };
  stub("models/User.js", { findById: () => ({ select: async () => dbUser }) });
  stub("models/Tenant.js", {});
  delete require.cache[require.resolve("../middleware/auth.js")];
  const { protect } = require("../middleware/auth");
  const call = async (tok) => { const r = res(); let ok = false; try { await protect({ headers: { authorization: "Bearer " + tok }, cookies: {}, baseUrl: "/x" }, r, (e) => (ok = !e)); } catch (e) {} return { ok, code: r.code }; };
  assert.ok((await call(g.generateAccessToken("u1", 1))).ok, "current token works");
  assert.ok(!(await call(g.generateAccessToken("u1", 0))).ok, "token from before a password change is rejected");
  assert.ok(!(await call(a.raw)).ok, "refresh token is not an access token");
  assert.ok(!(await call(jwt.sign({ id: "u1", tv: 1 }, "wrong-secret"))).ok, "foreign signature rejected");
  dbUser = { ...dbUser, tokenVersion: 2 };
  assert.ok(!(await call(g.generateToken("u1", 1))).ok, "bearer token dies after tokenVersion bump");

  // 6. signatures
  const { validSignature } = require("../utils/safeEqual");
  const crypto = require("crypto");
  const body = Buffer.from("{}");
  const sig = "sha256=" + crypto.createHmac("sha256", "s").update(body).digest("hex");
  assert.ok(validSignature(body, sig, "s") && !validSignature(body, undefined, "s") && !validSignature(body, "sha256=00", "s"));

  console.log("all hardening checks passed");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
