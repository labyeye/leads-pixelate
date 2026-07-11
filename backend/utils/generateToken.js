const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Long-lived bearer token, returned in the JSON response body. Used by the
// mobile app (NestLeads), which has no meaningful CSRF/XSS surface to
// protect against by moving to cookies.
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

// Short-lived access token set as an httpOnly cookie for the web app.
const generateAccessToken = (id) => {
  return jwt.sign({ id, scope: "access" }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// Refresh token: a JWT so the user id can be recovered on refresh without a
// DB lookup-by-token-value, plus a random jti. Only the bcrypt hash of the
// full token is persisted, so a leaked DB doesn't expose usable tokens, and
// rotating/clearing the stored hash revokes it (used on logout/reset).
async function generateRefreshToken(id) {
  const jti = crypto.randomBytes(16).toString("hex");
  const raw = jwt.sign({ id, jti, scope: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  const hash = await bcrypt.hash(raw, 10);
  return { raw, hash };
}

module.exports = { generateToken, generateAccessToken, generateRefreshToken };
