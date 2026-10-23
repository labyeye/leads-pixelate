const Session = require("../models/Session");

function describeFromUserAgent(ua = "") {
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [browser, os && `on ${os}`].filter(Boolean).join(" ") || "Web browser";
}

// Creates the device record for a fresh sign-in and returns its id for the tokens.
async function startSession(req, user) {
  const platform = String(req.headers["x-device-platform"] || "web").slice(0, 20);
  const deviceName =
    String(req.headers["x-device-name"] || "").trim().slice(0, 80) ||
    describeFromUserAgent(req.headers["user-agent"]);
  const s = await Session.create({
    userId: user._id,
    deviceName,
    platform,
    ip: req.ip || "",
  });
  return String(s._id);
}

module.exports = { startSession };
