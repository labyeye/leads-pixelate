const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Long-lived bearer token, returned in the JSON response body. Used by the
// mobile app (NestLeads), which has no meaningful CSRF/XSS surface to
// protect against by moving to cookies.
const generateToken = (id, tv = 0, sid) => {
  return jwt.sign({ id, tv, sid }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

// Short-lived access token set as an httpOnly cookie for the web app.
const generateAccessToken = (id, tv = 0, sid) => {
  return jwt.sign({ id, tv, sid, scope: "access" }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// Refresh token: a JWT so the user id can be recovered on refresh without a
// DB lookup-by-token-value, plus a random jti. Only the SHA-256 hash of the
// full token is persisted, so a leaked DB doesn't expose usable tokens, and
// rotating/clearing the stored hash revokes it (used on logout/reset).
async function generateRefreshToken(id, sid) {
  const jti = crypto.randomBytes(16).toString("hex");
  const raw = jwt.sign({ id, jti, sid, scope: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  return { raw, hash: hashRefreshToken(raw) };
}

// SHA-256, not bcrypt: bcrypt only reads the first 72 bytes, and a JWT's first 72 bytes are the header plus the
// start of the payload, so every refresh token of a user would have matched every other one.
const hashRefreshToken = (raw) => "sha256:" + crypto.createHash("sha256").update(raw).digest("hex");

// New hashes are compared in constant time; a legacy bcrypt hash is accepted once (the caller re-issues, which
// rewrites it in the new format).
async function refreshTokenMatches(raw, stored) {
  if (typeof stored !== "string") return false;
  if (!stored.startsWith("sha256:")) return bcrypt.compare(raw, stored);
  const a = Buffer.from(hashRefreshToken(raw));
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateToken, generateAccessToken, generateRefreshToken, refreshTokenMatches };
