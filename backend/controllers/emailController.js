const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Email = require("../models/Email");
const gmail = require("../services/gmailService");

function getRedirectUri() {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
    `${process.env.VITE_API_URL || "https://leads.pixelatenest.com"}/api/email/gmail/callback`
  );
}

const getAuthUrl = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_GMAIL_CLIENT_ID) {
    res.status(400);
    throw new Error(
      "Gmail integration not configured — GOOGLE_GMAIL_CLIENT_ID/SECRET must be set on the server.",
    );
  }
  const state = Buffer.from(String(req.user._id)).toString("base64");
  const authUrl = gmail.buildAuthUrl(getRedirectUri(), state);
  res.json({ success: true, data: { authUrl } });
});

const gmailCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = process.env.CLIENT_URL || "http://localhost:5173";

  if (error || !code) {
    return res.redirect(
      `${frontendBase}/leads?gmail_error=${encodeURIComponent(error || "access_denied")}`,
    );
  }

  let userId;
  try {
    userId = Buffer.from(String(state), "base64").toString("utf8");
    if (!userId) throw new Error("Invalid state");
  } catch {
    return res.redirect(`${frontendBase}/leads?gmail_error=invalid_state`);
  }

  try {
    const tokens = await gmail.exchangeCodeForTokens(code, getRedirectUri());
    if (!tokens.refresh_token) {
      return res.redirect(`${frontendBase}/leads?gmail_error=no_refresh_token`);
    }

    const profile = await gmail.getProfile(tokens.access_token);

    await User.findByIdAndUpdate(userId, {
      "emailIntegration.gmail.connected": true,
      "emailIntegration.gmail.emailAddress": profile.emailAddress,
      "emailIntegration.gmail.accessToken": tokens.access_token,
      "emailIntegration.gmail.refreshToken": tokens.refresh_token,
      "emailIntegration.gmail.tokenExpiresAt": new Date(
        Date.now() + tokens.expires_in * 1000,
      ),
      // Baseline to the mailbox's current historyId so the very first sync
      // doesn't try to ingest years of unrelated personal email.
      "emailIntegration.gmail.historyId": profile.historyId,
      "emailIntegration.gmail.connectedAt": new Date(),
    });

    res.redirect(`${frontendBase}/leads?gmail_connected=1`);
  } catch (err) {
    console.error("[Gmail OAuth] callback failed:", err.message);
    res.redirect(
      `${frontendBase}/leads?gmail_error=${encodeURIComponent(err.message)}`,
    );
  }
});

const disconnectGmail = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    "emailIntegration.gmail.connected": false,
    "emailIntegration.gmail.accessToken": "",
    "emailIntegration.gmail.refreshToken": "",
    "emailIntegration.gmail.tokenExpiresAt": null,
    "emailIntegration.gmail.historyId": "",
  });
  res.json({ success: true, message: "Gmail disconnected" });
});

const getGmailStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const gmailInt = user?.emailIntegration?.gmail || {};
  res.json({
    success: true,
    data: {
      connected: !!gmailInt.connected,
      emailAddress: gmailInt.emailAddress || "",
      lastSyncedAt: gmailInt.lastSyncedAt || null,
    },
  });
});

const getLeadThread = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }
  if (
    req.user.tenantId &&
    lead.tenantId &&
    String(lead.tenantId) !== String(req.user.tenantId)
  ) {
    res.status(403);
    throw new Error("Not authorized");
  }

  const emails = await Email.find({ leadId: lead._id })
    .sort("sentAt")
    .populate("userId", "name email");

  res.json({ success: true, data: emails });
});

const sendLeadEmail = asyncHandler(async (req, res) => {
  const { subject, bodyHtml, bodyText } = req.body;
  if (!subject?.trim() || !bodyHtml?.trim()) {
    res.status(400);
    throw new Error("Subject and message body are required");
  }

  const lead = await Lead.findById(req.params.leadId);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }
  if (!lead.email?.trim()) {
    res.status(400);
    throw new Error("This lead has no email address on file");
  }

  const user = await User.findById(req.user._id).select(
    "+emailIntegration.gmail.accessToken +emailIntegration.gmail.refreshToken +emailIntegration.gmail.tokenExpiresAt",
  );
  if (!user?.emailIntegration?.gmail?.connected) {
    res.status(400);
    throw new Error("Connect your Gmail account first");
  }

  const accessToken = await gmail.getValidAccessToken(user);

  // Continue the existing thread if we've emailed this lead before.
  const lastEmail = await Email.findOne({ leadId: lead._id }).sort("-sentAt");

  const raw = await gmail.buildRawMessage({
    from: user.emailIntegration.gmail.emailAddress,
    to: lead.email,
    subject,
    bodyHtml,
    bodyText,
    inReplyTo: lastEmail?.providerMessageId ? `<${lastEmail.providerMessageId}>` : undefined,
    references: lastEmail?.providerMessageId ? `<${lastEmail.providerMessageId}>` : undefined,
  });

  const sent = await gmail.sendMessage(accessToken, {
    raw,
    threadId: lastEmail?.providerThreadId || undefined,
  });

  const emailDoc = await Email.create({
    tenantId: lead.tenantId || null,
    leadId: lead._id,
    userId: user._id,
    provider: "gmail",
    providerMessageId: sent.id,
    providerThreadId: sent.threadId,
    direction: "outbound",
    from: user.emailIntegration.gmail.emailAddress,
    to: [lead.email],
    subject,
    bodyHtml,
    bodyText: bodyText || "",
    snippet: (bodyText || bodyHtml).slice(0, 200),
    sentAt: new Date(),
  });

  res.status(201).json({ success: true, data: emailDoc });
});

module.exports = {
  getAuthUrl,
  gmailCallback,
  disconnectGmail,
  getGmailStatus,
  getLeadThread,
  sendLeadEmail,
};
