// Native app push via FCM HTTP v1 (no firebase-admin dependency).
// Set FCM_SERVICE_ACCOUNT to the Firebase service-account JSON (raw JSON string or a path to the file).
// Without it pushes are skipped and people still see everything in the in-app inbox.
const PushDevice = require("../models/PushDevice");
const log = require("../utils/logger").scope("Push");

let cfgCache;
function fcmConfig() {
  if (cfgCache !== undefined) return cfgCache;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT || "";
    cfgCache = raw
      ? JSON.parse(
          raw.trim().startsWith("{") ? raw : require("fs").readFileSync(raw, "utf8"),
        )
      : null;
  } catch (e) {
    log.error("Bad FCM_SERVICE_ACCOUNT", { message: e.message });
    cfgCache = null;
  }
  return cfgCache;
}

let tokenCache = { token: "", exp: 0 };
async function accessToken(cfg) {
  if (tokenCache.exp > Date.now() + 60000) return tokenCache.token;
  const jwt = require("jsonwebtoken");
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: cfg.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    cfg.private_key,
    { algorithm: "RS256" },
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error_description || "FCM auth failed");
  tokenCache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return d.access_token;
}

/** Push to every phone of the given users. Never throws (callers fire-and-forget). */
async function pushToUsers(userIds, { title, body, data }) {
  try {
    const cfg = fcmConfig();
    if (!cfg) return;
    const devices = await PushDevice.find({ user: { $in: userIds } }).lean();
    if (!devices.length) return;
    const access = await accessToken(cfg);
    await Promise.allSettled(
      devices.map(async (d) => {
        const r = await fetch(
          `https://fcm.googleapis.com/v1/projects/${cfg.project_id}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token: d.fcmToken,
                notification: { title, body },
                data: Object.fromEntries(
                  Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
                ),
                android: { priority: "HIGH", notification: { channel_id: "nestleads_push" } },
                apns: { payload: { aps: { sound: "default" } } },
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        // A dead token (app uninstalled) is dropped so it isn't retried forever.
        if (r.status === 404 || r.status === 410) await PushDevice.deleteOne({ _id: d._id });
      }),
    );
  } catch (e) {
    log.error("pushToUsers failed", { message: e.message });
  }
}

module.exports = { pushToUsers };
