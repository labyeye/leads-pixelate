const crypto = require("crypto");

const isProd = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const baseCookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
};

// Issues the browser-session cookies: httpOnly access + refresh tokens, plus
// a JS-readable CSRF token the frontend echoes back via X-CSRF-Token.
function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie("access_token", accessToken, {
    ...baseCookieOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie("refresh_token", refreshToken, {
    ...baseCookieOpts,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/api/auth",
  });

  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", { ...baseCookieOpts });
  res.clearCookie("refresh_token", { ...baseCookieOpts, path: "/api/auth" });
  res.clearCookie("csrf_token", { path: "/", httpOnly: false });
}

module.exports = { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_MAX_AGE };
