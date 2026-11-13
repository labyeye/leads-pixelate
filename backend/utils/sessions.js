const Session = require("../models/Session");
const User = require("../models/User");
const terms = require("./terms");

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

// Signing in through a screen that shows the Terms + Privacy links counts as acceptance (the apps send acceptTerms).
// Stored on the user, so it is asked once per account — never again on another device.
async function recordTermsAcceptance(req, user) {
  if (req.body?.acceptTerms !== true || terms.accepted(user)) return;
  const set = {
    termsVersion: terms.VERSION,
    termsAcceptedAt: new Date(),
    termsAcceptedIp: String(req.ip || "").slice(0, 64),
    termsAcceptedAgent: String(req.headers["user-agent"] || "").slice(0, 200),
  };
  await User.updateOne({ _id: user._id }, { $set: set });
  Object.assign(user, set);
}

// Creates the device record for a fresh sign-in and returns its id for the tokens.
async function startSession(req, user) {
  await recordTermsAcceptance(req, user).catch(() => {});
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
