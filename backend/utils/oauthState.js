const crypto = require("crypto");
const { safeEqual } = require("./safeEqual");

// OAuth `state` that can't be forged: "<base64url(text|issuedAt)>.<hmac>". A plain base64(userId) let anyone craft a
// callback URL that attaches *their* Google/Facebook account to someone else's CRM account.
const TTL_MS = 15 * 60 * 1000;
const mac = (body) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(body).digest("base64url");

const signState = (text) => {
  const body = Buffer.from(`${text}|${Date.now()}`).toString("base64url");
  return `${body}.${mac(body)}`;
};

// Returns the signed text, or throws (callers already treat a throw as "invalid_state").
const readState = (state) => {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig || !safeEqual(sig, mac(body))) throw new Error("Invalid state");
  const decoded = Buffer.from(body, "base64url").toString("utf8");
  const i = decoded.lastIndexOf("|");
  if (Date.now() - Number(decoded.slice(i + 1)) > TTL_MS) throw new Error("State expired");
  return decoded.slice(0, i);
};

module.exports = { signState, readState };

if (require.main === module) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "t";
  const assert = require("assert");
  const s = signState("tenant:user");
  assert.strictEqual(readState(s), "tenant:user");
  assert.throws(() => readState(Buffer.from("tenant:user").toString("base64")));
  assert.throws(() => readState(s.replace(/.$/, (c) => (c === "a" ? "b" : "a"))));
  assert.throws(() => readState(undefined));
  console.log("oauthState ok");
}
