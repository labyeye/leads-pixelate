// Manual calls from the CRM (a person talking to a lead), placed through Twilio click-to-call.
// The public Twilio webhooks live in webhookRoutes.js.
const express = require("express");
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const User = require("../models/User");
const twilio = require("../services/twilioService");
const log = require("../utils/logger").scope("ManualCall");

const router = express.Router();
router.use(protect);

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ""));

// Which number the agent will be called on: what they typed, else the one on their profile.
router.post(
  "/manual",
  asyncHandler(async (req, res) => {
    const { leadId, agentPhone, remember } = req.body || {};
    if (!twilio.isConfigured()) {
      res.status(503);
      throw new Error("Calling isn't set up on the server yet (Twilio keys missing).");
    }
    if (!isId(leadId)) {
      res.status(400);
      throw new Error("Choose a lead to call");
    }
    const lead = await Lead.findOne({ _id: leadId, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) });
    if (!lead) {
      res.status(404);
      throw new Error("Lead not found");
    }
    const to = twilio.e164(lead.phone);
    if (!to) {
      res.status(400);
      throw new Error(`"${lead.name}" doesn't have a valid phone number.`);
    }
    const agent = twilio.e164(agentPhone || req.user.phone);
    if (!agent) {
      res.status(400);
      throw new Error("Enter the phone number we should ring you on (with country code, like +91…).");
    }
    if (agent === to) {
      res.status(400);
      throw new Error("Your number and the lead's number are the same.");
    }

    const callLog = await CallLog.create({
      tenantId: lead.tenantId,
      leadId: lead._id,
      initiatedBy: req.user._id,
      callType: "manual_call",
      status: "initiated",
      phoneNumber: to,
    });

    try {
      const { sid } = await twilio.startCall({ agentPhone: agent, callLogId: String(callLog._id) });
      callLog.conversationId = sid;
      await callLog.save();
    } catch (err) {
      callLog.status = "failed";
      callLog.errorReason = String(err.message).slice(0, 300);
      await callLog.save();
      log.warn("Twilio refused the call", { message: err.message });
      res.status(502);
      throw new Error(err.message);
    }

    // Remember the agent's number on their profile so the next call is one click.
    if (remember && agentPhone && agent !== twilio.e164(req.user.phone)) {
      await User.updateOne({ _id: req.user._id }, { $set: { phone: agent } });
    }

    res.status(201).json({
      success: true,
      message: "Your phone is ringing. Pick up and we'll connect you to the lead.",
      data: { callLogId: String(callLog._id), callSid: callLog.conversationId },
    });
  }),
);

// Progress of one call (the UI polls it after "Call").
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const c = isId(req.params.id)
      ? await CallLog.findOne({ _id: req.params.id, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) })
      : null;
    if (!c) {
      res.status(404);
      throw new Error("Call not found");
    }
    res.json({ success: true, data: { status: c.status, durationSeconds: c.durationSeconds, errorReason: c.errorReason } });
  }),
);

module.exports = router;
