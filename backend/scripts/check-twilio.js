// Offline check for manual Twilio click-to-call — no network, no Twilio account, no database.
// Run: node scripts/check-twilio.js
const assert = require("assert");
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const twilio = require("../services/twilioService");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const User = require("../models/User");

const oid = () => new mongoose.Types.ObjectId();

// ---- pure helpers -----------------------------------------------------------
assert.strictEqual(twilio.e164("9876543210"), "+919876543210", "bare Indian numbers get +91");
assert.strictEqual(twilio.e164("098765 43210"), "+919876543210", "leading 0 dropped");
assert.strictEqual(twilio.e164("919876543210"), "+919876543210");
assert.strictEqual(twilio.e164("+1 (415) 555-0100"), "+14155550100", "international numbers kept");
assert.strictEqual(twilio.e164("12345"), null);
assert.strictEqual(twilio.e164(""), null);
assert.strictEqual(twilio.e164(undefined), null);
assert.strictEqual(twilio.e164("+12"), null);

process.env.TWILIO_AUTH_TOKEN = "tok_secret";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_PHONE_NUMBER = "+15005550006";
process.env.TWILIO_WEBHOOK_BASE = "https://hooks.example.com/";
assert.strictEqual(twilio.webhookBase(), "https://hooks.example.com", "trailing slash trimmed");

const sign = (url, params = {}) =>
  crypto.createHmac("sha1", process.env.TWILIO_AUTH_TOKEN).update(url + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");
{
  const url = "https://hooks.example.com/api/webhooks/twilio/status/1";
  const params = { CallStatus: "ringing", CallSid: "CA1" };
  assert.ok(twilio.validSignature(sign(url, params), url, params));
  assert.ok(!twilio.validSignature(sign(url, params), url, { ...params, CallStatus: "completed" }), "tampered parameter");
  assert.ok(!twilio.validSignature(sign(url, params), url + "x", params), "other URL");
  assert.ok(!twilio.validSignature("", url, params) && !twilio.validSignature(undefined, url, params));
  assert.ok(!twilio.validSignature("AAAA", url, params), "wrong length must not throw");
}

const t = twilio.connectTwiml({ leadName: "Ravi <b>&\"Sons\"", leadPhone: "+919876543210", dialActionUrl: "https://x/y?a=1&b=2" });
assert.ok(t.includes("Ravi &lt;b&gt;&amp;&quot;Sons&quot;") && !t.includes("<b>"), "names are escaped in TwiML");
assert.ok(t.includes("<Number>+919876543210</Number>") && t.includes('callerId="+15005550006"'));
assert.ok(t.includes("a=1&amp;b=2"), "attribute URLs are escaped");
assert.deepStrictEqual(
  ["queued", "ringing", "in-progress", "completed", "busy", "no-answer", "failed", "canceled", "weird"].map(twilio.mapStatus),
  ["initiated", "ringing", "in_progress", "completed", "busy", "no_answer", "failed", "failed", null],
);

// ---- routes -----------------------------------------------------------------
async function main() {
  const tenantId = oid();
  const user = { _id: oid(), tenantId, role: "sales_executive", name: "Agent", phone: "9000000001" };
  const stub = (name, exports) => {
    const p = require.resolve(name);
    require.cache[p] = { id: p, filename: p, loaded: true, exports };
  };
  stub("../middleware/auth", { protect: (req, _res, next) => ((req.user = user), next()), authorize: () => (_r, _s, n) => n() });

  const calls = [];
  CallLog.create = async (d) => {
    const doc = { ...d, _id: oid(), saves: 0, save: async function () { this.saves++; } };
    calls.push(doc);
    return doc;
  };
  CallLog.findById = async (id) => calls.find((c) => String(c._id) === String(id)) || null;
  CallLog.findOne = async (f) => calls.find((c) => String(c._id) === String(f._id) && (!f.tenantId || String(c.tenantId) === String(f.tenantId))) || null;
  const lead = { _id: oid(), tenantId, name: "Ravi", phone: "9876543210" };
  let leadFilter;
  Lead.findOne = async (f) => ((leadFilter = f), String(f._id) === String(lead._id) && String(f.tenantId) === String(tenantId) ? lead : null);
  Lead.findById = () => ({ select: async () => lead });
  const userUpdates = [];
  User.updateOne = async (f, u) => userUpdates.push(u.$set);

  let twilioReply = { ok: true, status: 201, json: async () => ({ sid: "CAabc" }) };
  const seen = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.twilio.com")) {
      seen.push({ url: String(url), headers: opts.headers, body: new URLSearchParams(String(opts.body)) });
      return twilioReply;
    }
    return realFetch(url, opts);
  };

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/calls", require("../routes/callRoutes"));
  app.use("/api/webhooks", require("../routes/webhookRoutes"));
  app.use((err, _req, res, _next) => res.status(res.statusCode >= 400 ? res.statusCode : 500).json({ message: err.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, headers = {}) => {
    const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const hook = async (path, params, signed = true) => {
    const url = twilio.webhookBase() + path;
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...(signed ? { "X-Twilio-Signature": sign(url, params) } : {}) },
      body: new URLSearchParams(params),
    });
    return { status: r.status, text: await r.text(), type: r.headers.get("content-type") };
  };

  try {
    // ---- placing a call
    process.env.TWILIO_ACCOUNT_SID = "";
    assert.strictEqual((await post("/api/calls/manual", { leadId: String(lead._id) })).status, 503, "no keys -> clear message");
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    assert.strictEqual((await post("/api/calls/manual", { leadId: "nope" })).status, 400);
    assert.strictEqual((await post("/api/calls/manual", { leadId: String(oid()) })).status, 404, "unknown lead");
    lead.phone = "12";
    assert.strictEqual((await post("/api/calls/manual", { leadId: String(lead._id) })).status, 400, "lead without a usable number");
    lead.phone = "9876543210";
    assert.strictEqual((await post("/api/calls/manual", { leadId: String(lead._id), agentPhone: "abc" })).status, 400, "agent number must be valid");
    assert.strictEqual((await post("/api/calls/manual", { leadId: String(lead._id), agentPhone: "9876543210" })).status, 400, "cannot call yourself");
    assert.strictEqual(calls.length, 0, "nothing is logged for refused requests");

    // uses the number on the agent's profile by default
    let r = await post("/api/calls/manual", { leadId: String(lead._id) });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.strictEqual(String(leadFilter.tenantId), String(tenantId), "leads are looked up inside the caller's tenant");
    const c = calls[0];
    assert.strictEqual(c.callType, "manual_call");
    assert.strictEqual(c.phoneNumber, "+919876543210");
    assert.strictEqual(String(c.initiatedBy), String(user._id));
    assert.strictEqual(c.conversationId, "CAabc", "Twilio call sid saved");
    const req = seen[0];
    assert.ok(req.url.endsWith("/ACtest/Calls.json"));
    assert.ok(req.headers.Authorization.startsWith("Basic "));
    assert.strictEqual(req.body.get("To"), "+919000000001", "Twilio rings the AGENT first");
    assert.strictEqual(req.body.get("From"), "+15005550006");
    assert.strictEqual(req.body.get("Url"), `https://hooks.example.com/api/webhooks/twilio/connect/${c._id}`);
    assert.strictEqual(req.body.get("StatusCallback"), `https://hooks.example.com/api/webhooks/twilio/status/${c._id}`);
    assert.deepStrictEqual(req.body.getAll("StatusCallbackEvent"), []);
    assert.strictEqual(userUpdates.length, 0, "profile number unchanged unless asked");

    // typed number + remember
    r = await post("/api/calls/manual", { leadId: String(lead._id), agentPhone: "+91 90000 00002", remember: true });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(seen[1].body.get("To"), "+919000000002");
    assert.deepStrictEqual(userUpdates, [{ phone: "+919000000002" }]);

    // Twilio refuses (trial account, unverified number...): the reason is shown and logged
    twilioReply = { ok: false, status: 400, json: async () => ({ message: "The number +919000000001 is unverified. Trial accounts may only make calls to verified numbers." }) };
    r = await post("/api/calls/manual", { leadId: String(lead._id) });
    assert.strictEqual(r.status, 502);
    assert.ok(/unverified/.test(r.body.message));
    const failed = calls[calls.length - 1];
    assert.strictEqual(failed.status, "failed");
    assert.ok(/unverified/.test(failed.errorReason));

    // polling one call
    const g = await fetch(`${base}/api/calls/${c._id}`);
    assert.strictEqual((await g.json()).data.status, "initiated");
    assert.strictEqual((await fetch(`${base}/api/calls/${oid()}`)).status, 404);

    // ---- Twilio webhooks
    const id = String(c._id);
    assert.strictEqual((await hook(`/api/webhooks/twilio/status/${id}`, { CallStatus: "ringing" }, false)).status, 403, "unsigned requests are refused");
    assert.strictEqual(c.status, "initiated");
    await hook(`/api/webhooks/twilio/status/${id}`, { CallStatus: "ringing" });
    assert.strictEqual(c.status, "ringing");

    let h = await hook(`/api/webhooks/twilio/connect/${id}`, { CallSid: "CAabc" });
    assert.strictEqual(h.status, 200);
    assert.ok(/xml/.test(h.type));
    assert.ok(h.text.includes("Connecting you to Ravi") && h.text.includes("<Number>+919876543210</Number>"));
    assert.ok(h.text.includes(`/api/webhooks/twilio/dial-done/${id}`));
    assert.strictEqual(c.status, "in_progress");

    await hook(`/api/webhooks/twilio/status/${id}`, { CallStatus: "initiated" }); // late, must not go backwards
    assert.strictEqual(c.status, "in_progress");

    h = await hook(`/api/webhooks/twilio/dial-done/${id}`, { DialCallStatus: "completed", DialCallDuration: "125" });
    assert.ok(h.text.includes("<Response/>"));
    assert.strictEqual(c.status, "completed");
    assert.strictEqual(c.durationSeconds, 125, "talk time comes from the lead's leg");
    await hook(`/api/webhooks/twilio/status/${id}`, { CallStatus: "completed", CallDuration: "140" }); // agent leg ends later
    assert.strictEqual(c.durationSeconds, 125, "the agent leg never overrides the outcome");

    // lead did not pick up
    await post("/api/calls/manual", { leadId: String(lead._id) }, {}).catch(() => {});
    twilioReply = { ok: true, status: 201, json: async () => ({ sid: "CAdef" }) };
    await post("/api/calls/manual", { leadId: String(lead._id) });
    const c2 = calls[calls.length - 1];
    await hook(`/api/webhooks/twilio/connect/${c2._id}`, {});
    await hook(`/api/webhooks/twilio/dial-done/${c2._id}`, { DialCallStatus: "no-answer", DialCallDuration: "0" });
    assert.strictEqual(c2.status, "no_answer");
    assert.ok(/no answer/.test(c2.errorReason));

    // agent did not pick up their own phone
    await post("/api/calls/manual", { leadId: String(lead._id) });
    const c3 = calls[calls.length - 1];
    await hook(`/api/webhooks/twilio/status/${c3._id}`, { CallStatus: "no-answer" });
    assert.strictEqual(c3.status, "no_answer");
    assert.ok(/Your phone/.test(c3.errorReason));

    // unknown call ids are harmless
    assert.strictEqual((await hook(`/api/webhooks/twilio/connect/${oid()}`, {})).status, 200);
    assert.strictEqual((await hook(`/api/webhooks/twilio/dial-done/not-an-id`, { DialCallStatus: "busy" })).status, 200);
  } finally {
    global.fetch = realFetch;
    server.close();
  }
  console.log("check-twilio: all checks passed");
}

main().catch((err) => {
  console.error("check-twilio FAILED:", err);
  process.exit(1);
});
