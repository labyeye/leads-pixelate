const express = require("express");
const router = express.Router();
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const twilio = require("../services/twilioService");
const { handleElevenLabsWebhook } = require("../controllers/aiCallingController");

// Public webhook route for ElevenLabs post-call analysis and transcripts
router.post("/elevenlabs", handleElevenLabsWebhook);

// ---- Twilio click-to-call (services/twilioService.js). Public, but every request must carry a valid
// Twilio signature computed over the exact URL Twilio called.
const fromTwilio = (req, res, next) => {
  const url = twilio.webhookBase() + req.originalUrl;
  if (!twilio.validSignature(req.get("X-Twilio-Signature"), url, req.body || {})) {
    return res.status(403).type("text/plain").send("Invalid signature");
  }
  next();
};
const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));
const twiml = (res, body) => res.type("text/xml").send(body);
const TERMINAL = ["completed", "failed", "no_answer", "busy"];

// The agent picked up: tell them who they're calling, then dial the lead.
router.post("/twilio/connect/:id", fromTwilio, async (req, res) => {
  const call = isId(req.params.id) ? await CallLog.findById(req.params.id) : null;
  if (!call) return twiml(res, twilio.emptyTwiml());
  const lead = await Lead.findById(call.leadId).select("name");
  call.status = "in_progress";
  await call.save();
  twiml(
    res,
    twilio.connectTwiml({
      leadName: lead?.name,
      leadPhone: call.phoneNumber,
      dialActionUrl: `${twilio.webhookBase()}/api/webhooks/twilio/dial-done/${call._id}`,
    }),
  );
});

// The lead's leg ended: this is the real outcome and talk time.
router.post("/twilio/dial-done/:id", fromTwilio, async (req, res) => {
  const call = isId(req.params.id) ? await CallLog.findById(req.params.id) : null;
  if (call) {
    const st = twilio.mapStatus(req.body.DialCallStatus);
    if (st && TERMINAL.includes(st)) {
      call.status = st;
      call.durationSeconds = Number(req.body.DialCallDuration) || 0;
      if (st !== "completed") call.errorReason = `The lead's phone: ${st.replace("_", " ")}`;
      await call.save();
    }
  }
  twiml(res, twilio.emptyTwiml());
});

// The agent's leg: ringing / answered / ended. It never overrides the lead's outcome.
router.post("/twilio/status/:id", fromTwilio, async (req, res) => {
  const call = isId(req.params.id) ? await CallLog.findById(req.params.id) : null;
  const st = twilio.mapStatus(req.body.CallStatus);
  if (call && st) {
    const settled = TERMINAL.includes(call.status);
    if (!settled) {
      if (TERMINAL.includes(st) && st !== "completed") {
        call.status = st;
        call.errorReason = "Your phone: " + st.replace("_", " ");
      } else if (st === "completed") {
        call.status = "completed";
        call.durationSeconds = Number(req.body.CallDuration) || 0;
      } else if (call.status === "initiated" || call.status === "ringing") {
        call.status = st;
      }
      await call.save();
    }
  }
  res.sendStatus(204);
});

module.exports = router;
