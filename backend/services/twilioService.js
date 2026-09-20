// Manual "click-to-call" through Twilio: Twilio rings the AGENT's phone first; when the agent picks
// up, the TwiML at /connect dials the lead and bridges the two. Plain REST calls (no SDK) so there is
// nothing extra to install. Keys come from the environment, never from the browser:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (the caller ID, E.164)
//   TWILIO_WEBHOOK_BASE (optional) public https base Twilio can reach, e.g. an ngrok URL; else BACKEND_URL
const crypto = require("crypto");

const API = "https://api.twilio.com/2010-04-01/Accounts";

const isConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

// Where Twilio calls us back. Must be public https.
const webhookBase = () =>
  (process.env.TWILIO_WEBHOOK_BASE || process.env.BACKEND_URL || "https://leads-backend.pixelatenest.com").replace(/\/$/, "");

// Leads store bare 10-digit Indian numbers; Twilio needs E.164. Returns null when it is not a number.
function e164(phone) {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}

// Twilio's request signature: base64 HMAC-SHA1 of the full URL followed by every POST parameter
// (sorted by name) as name+value. Proves the webhook really came from Twilio.
function validSignature(signature, url, params = {}) {
  if (!signature || !process.env.TWILIO_AUTH_TOKEN) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", process.env.TWILIO_AUTH_TOKEN).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const xml = (s) =>
  String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

// TwiML for the moment the agent answers: say who is being called, then dial the lead.
function connectTwiml({ leadName, leadPhone, dialActionUrl }) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say>Connecting you to ${xml(leadName || "the lead")}.</Say>` +
    `<Dial callerId="${xml(process.env.TWILIO_PHONE_NUMBER)}" timeout="30" action="${xml(dialActionUrl)}" method="POST">` +
    `<Number>${xml(leadPhone)}</Number></Dial></Response>`
  );
}
const emptyTwiml = () => `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

// Twilio call status -> CallLog.status
const STATUS = {
  queued: "initiated",
  initiated: "initiated",
  ringing: "ringing",
  "in-progress": "in_progress",
  answered: "in_progress",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "failed",
};
const mapStatus = (s) => STATUS[s] || null;

// Ask Twilio to ring the agent. Resolves { sid }. Throws with Twilio's own message on refusal
// (trial accounts: "not verified", country not enabled...).
async function startCall({ agentPhone, callLogId }) {
  const base = webhookBase();
  const body = new URLSearchParams({
    To: agentPhone,
    From: process.env.TWILIO_PHONE_NUMBER,
    Url: `${base}/api/webhooks/twilio/connect/${callLogId}`,
    Method: "POST",
    StatusCallback: `${base}/api/webhooks/twilio/status/${callLogId}`,
    StatusCallbackMethod: "POST",
  });
  for (const ev of ["initiated", "ringing", "answered", "completed"]) body.append("StatusCallbackEvent", ev);

  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`${API}/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`);
  return { sid: data.sid };
}

module.exports = { isConfigured, webhookBase, e164, validSignature, connectTwiml, emptyTwiml, mapStatus, startCall, xml };
