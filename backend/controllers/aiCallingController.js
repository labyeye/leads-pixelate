const asyncHandler = require("express-async-handler");
const AICallSettings = require("../models/AICallSettings");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const { triggerElevenLabsOutboundCall } = require("../services/elevenLabsService");
const { processCallWebhookData } = require("../services/aiSummarizerService");
const log = require("../utils/logger").scope("AICallingController");

/**
 * @desc    Get AI Calling Settings for current tenant
 * @route   GET /api/ai-calling/settings
 * @access  Private
 */
const getSettings = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  let settings = await AICallSettings.findOne({ tenantId });

  if (!settings) {
    settings = await AICallSettings.create({
      tenantId,
      enabled: false,
    });
  }

  const settingsObj = settings.toObject();
  settingsObj.envApiKeySet = !!process.env.ELEVENLABS_API_KEY;
  settingsObj.envAgentIdSet = !!process.env.ELEVENLABS_AGENT_ID;

  if (!settingsObj.elevenLabsApiKey && process.env.ELEVENLABS_API_KEY) {
    settingsObj.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  }
  // agentId stays per-tenant; envAgentIdSet tells the UI a default exists (service falls back to it)

  res.json({
    success: true,
    data: settingsObj,
  });
});

/**
 * @desc    Update AI Calling Settings for current tenant
 * @route   PUT /api/ai-calling/settings
 * @access  Private (Admin / Super Admin)
 */
const updateSettings = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const updates = req.body;
  if (typeof updates.agentId === "string") updates.agentId = updates.agentId.trim();
  if (updates.agentId && !updates.agentId.startsWith("agent_")) {
    res.status(400);
    throw new Error('Invalid Agent ID. It should look like "agent_xxxxxxxx" (copy it from the ElevenLabs agent page).');
  }

  let settings = await AICallSettings.findOne({ tenantId });

  if (!settings) {
    settings = new AICallSettings({ tenantId, ...updates });
  } else {
    Object.assign(settings, updates);
  }

  await settings.save();

  const settingsObj = settings.toObject();
  settingsObj.envApiKeySet = !!process.env.ELEVENLABS_API_KEY;
  settingsObj.envAgentIdSet = !!process.env.ELEVENLABS_AGENT_ID;

  res.json({
    success: true,
    message: "AI Calling settings updated successfully",
    data: settingsObj,
  });
});

/**
 * @desc    Test ElevenLabs API key and Agent ID connection
 * @route   POST /api/ai-calling/test-connection
 * @access  Private
 */
const testConnection = asyncHandler(async (req, res) => {
  const { apiKey, agentId } = req.body;

  const keyToUse = apiKey || process.env.ELEVENLABS_API_KEY;
  const agentToUse = agentId || process.env.ELEVENLABS_AGENT_ID;

  if (!keyToUse) {
    return res.status(400).json({
      success: false,
      message: "ElevenLabs API Key is required. Please set ELEVENLABS_API_KEY in backend/.env or configure it in settings.",
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents${agentToUse ? `/${agentToUse}` : ""}`,
      {
        headers: {
          "xi-api-key": keyToUse,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: data.detail?.message || data.message || "ElevenLabs API authentication failed",
      });
    }

    res.json({
      success: true,
      message: "ElevenLabs API connection verified successfully!",
      agent: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Failed to connect to ElevenLabs: ${err.message}`,
    });
  }
});

/**
 * @desc    Manually trigger ElevenLabs AI outbound call to a lead
 * @route   POST /api/ai-calling/call-lead/:leadId
 * @access  Private
 */
const callLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const tenantId = req.user.tenantId;

  const lead = await Lead.findOne({ _id: leadId, tenantId });
  if (!lead) {
    return res.status(404).json({ success: false, message: "Lead not found" });
  }

  if (!lead.phone) {
    return res.status(400).json({ success: false, message: "Lead has no phone number" });
  }

  let settings = await AICallSettings.findOne({ tenantId });
  if (!settings) {
    settings = await AICallSettings.create({ tenantId });
  }

  const result = await triggerElevenLabsOutboundCall(lead, settings, req.user._id);

  res.json({
    success: true,
    message: `Outbound AI call initiated to ${lead.name} (${lead.phone})`,
    data: result,
  });
});

/**
 * @desc    Get Call Logs for a specific lead
 * @route   GET /api/ai-calling/logs/:leadId
 * @access  Private
 */
const getLeadCallLogs = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const tenantId = req.user.tenantId;

  const logs = await CallLog.find({ leadId, tenantId })
    .populate("initiatedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: logs,
  });
});

/**
 * @desc    Webhook handler for ElevenLabs post-call transcript & analysis callback
 * @route   POST /api/webhooks/elevenlabs
 * @access  Public (Webhook)
 */
const handleElevenLabsWebhook = asyncHandler(async (req, res) => {
  const payload = req.body;
  log.info("ElevenLabs Webhook received", { event: payload.event || payload.type });

  const result = await processCallWebhookData(payload);

  res.json({
    received: true,
    result,
  });
});

module.exports = {
  getSettings,
  updateSettings,
  testConnection,
  callLead,
  getLeadCallLogs,
  handleElevenLabsWebhook,
};
