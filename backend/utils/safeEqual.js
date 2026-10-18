const crypto = require("crypto");

// Constant-time string compare that never throws on length mismatch.
const safeEqual = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a ?? "")).digest();
  const y = crypto.createHash("sha256").update(String(b ?? "")).digest();
  return crypto.timingSafeEqual(x, y) && String(a ?? "").length === String(b ?? "").length;
};

// Meta-style "sha256=<hex>" HMAC check over the raw request body.
const validSignature = (rawBody, header, secret) => {
  if (!rawBody || !header || !secret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(header, expected);
};

module.exports = { safeEqual, validSignature };

if (require.main === module) {
  const assert = require("assert");
  assert.ok(safeEqual("abc", "abc") && !safeEqual("abc", "abd") && !safeEqual("a", "abc") && !safeEqual(undefined, "x"));
  const body = Buffer.from('{"a":1}');
  const sig = "sha256=" + crypto.createHmac("sha256", "s").update(body).digest("hex");
  assert.ok(validSignature(body, sig, "s"));
  assert.ok(!validSignature(body, sig, "other") && !validSignature(body, undefined, "s") && !validSignature(body, "sha256=x", "s") && !validSignature(body, sig, ""));
  console.log("safeEqual ok");
}
