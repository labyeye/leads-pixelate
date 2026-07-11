const MailComposer = require("nodemailer/lib/mail-composer");

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Separate OAuth client from Google Ads — Gmail scopes are reviewed as
// their own sensitive-API surface in Google Cloud Console, so mixing them
// onto one client isn't a good idea. Requires GOOGLE_GMAIL_CLIENT_ID /
// GOOGLE_GMAIL_CLIENT_SECRET to be set.
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code, redirectUri) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID,
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, expires_in, ... }
}

// Returns a live access token for this user's Gmail connection, refreshing
// and persisting it first if the cached one has expired. Callers pass in
// the full User document (with +accessToken/+refreshToken selected).
async function getValidAccessToken(user) {
  const gmail = user.emailIntegration?.gmail;
  if (!gmail?.connected || !gmail?.refreshToken) {
    throw new Error("Gmail not connected");
  }

  const stillValid =
    gmail.accessToken &&
    gmail.tokenExpiresAt &&
    new Date(gmail.tokenExpiresAt).getTime() - Date.now() > 60 * 1000;

  if (stillValid) return gmail.accessToken;

  const refreshed = await refreshAccessToken(gmail.refreshToken);
  user.emailIntegration.gmail.accessToken = refreshed.access_token;
  user.emailIntegration.gmail.tokenExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  );
  await user.save();
  return refreshed.access_token;
}

async function getProfile(accessToken) {
  const res = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch Gmail profile");
  return data; // { emailAddress, historyId, ... }
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMessage({ from, to, subject, bodyHtml, bodyText, inReplyTo, references }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (references) headers["References"] = references;

    const mail = new MailComposer({
      from,
      to,
      subject,
      html: bodyHtml,
      text: bodyText || undefined,
      headers,
    });

    mail.compile().build((err, message) => {
      if (err) return reject(err);
      resolve(base64UrlEncode(message));
    });
  });
}

async function sendMessage(accessToken, { raw, threadId }) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to send email");
  return data; // { id, threadId, ... }
}

// Recursively walk a Gmail message payload to find text/plain + text/html
// parts (messages can nest multipart/alternative inside multipart/mixed
// when there are attachments).
function extractBody(payload) {
  let text = "";
  let html = "";

  function walk(part) {
    if (!part) return;
    const mimeType = part.mimeType || "";
    const data = part.body?.data;
    if (data) {
      const decoded = Buffer.from(data, "base64").toString("utf8");
      if (mimeType === "text/plain" && !text) text = decoded;
      if (mimeType === "text/html" && !html) html = decoded;
    }
    (part.parts || []).forEach(walk);
  }
  walk(payload);
  return { text, html };
}

// Header values look like `"John Doe" <john@example.com>` or a bare
// `john@example.com` — pull out just the address, lowercased, for matching.
function extractAddress(headerValue) {
  const match = String(headerValue || "").match(/<([^>]+)>/);
  return (match ? match[1] : headerValue || "").trim().toLowerCase();
}

function getHeader(payload, name) {
  return (
    (payload.headers || []).find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value || ""
  );
}

async function getMessage(accessToken, messageId) {
  const res = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch Gmail message");

  const { text, html } = extractBody(data.payload);
  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet || "",
    from: getHeader(data.payload, "From"),
    to: getHeader(data.payload, "To")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    subject: getHeader(data.payload, "Subject"),
    messageIdHeader: getHeader(data.payload, "Message-ID"),
    date: getHeader(data.payload, "Date"),
    bodyText: text,
    bodyHtml: html,
  };
}

// Incremental sync: returns new message IDs added since startHistoryId,
// plus the latest historyId to store as the next cursor. Gmail expires old
// history records (~1 week) — callers should treat a 404 as "cursor too
// old, do a fresh baseline" rather than a hard failure.
async function listHistory(accessToken, startHistoryId) {
  let pageToken;
  const messageIds = new Set();
  let latestHistoryId = startHistoryId;

  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${GMAIL_API}/users/me/history?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.error) {
      const err = new Error(data.error.message || "Failed to list Gmail history");
      err.status = res.status;
      throw err;
    }

    for (const h of data.history || []) {
      for (const added of h.messagesAdded || []) {
        if (added.message?.id) messageIds.add(added.message.id);
      }
    }
    if (data.historyId) latestHistoryId = data.historyId;
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { messageIds: Array.from(messageIds), latestHistoryId };
}

// Pulls new mail since the user's stored historyId and files anything that
// belongs to a lead's thread. Deliberately does NOT ingest the whole
// mailbox — only messages that continue a thread we already track, or
// that are to/from an address matching one of this tenant's leads, get
// saved. Everything else in the rep's inbox is left alone.
async function syncGmailForUser(user) {
  const Lead = require("../models/Lead");
  const Email = require("../models/Email");

  const result = { fetched: 0, saved: 0, skipped: 0 };
  const gmailInt = user.emailIntegration?.gmail;
  if (!gmailInt?.connected) return result;

  const accessToken = await getValidAccessToken(user);
  const selfAddress = (gmailInt.emailAddress || "").toLowerCase();

  let historyId = gmailInt.historyId;
  let messageIds = [];

  try {
    const history = await listHistory(accessToken, historyId);
    messageIds = history.messageIds;
    historyId = history.latestHistoryId;
  } catch (err) {
    if (err.status === 404) {
      // Cursor expired (Gmail only retains ~1 week of history) — rebaseline
      // without trying to backfill the gap.
      const profile = await getProfile(accessToken);
      historyId = profile.historyId;
    } else {
      throw err;
    }
  }

  result.fetched = messageIds.length;

  for (const messageId of messageIds) {
    try {
      const existing = await Email.findOne({
        provider: "gmail",
        providerMessageId: messageId,
      });
      if (existing) {
        result.skipped++;
        continue;
      }

      const msg = await getMessage(accessToken, messageId);
      const fromAddress = extractAddress(msg.from);
      const toAddresses = msg.to.map(extractAddress);
      const direction = fromAddress === selfAddress ? "outbound" : "inbound";

      // Thread continuation takes priority over address matching — once a
      // thread is linked to a lead, every reply in it stays linked even if
      // a rep or lead used a different address partway through.
      let leadId = null;
      const threadMatch = await Email.findOne({
        providerThreadId: msg.threadId,
      }).select("leadId");
      if (threadMatch) {
        leadId = threadMatch.leadId;
      } else {
        // Lead.email is stored lowercase (see Lead.js schema), and
        // fromAddress/toAddresses above are already lowercased bare
        // addresses, so a direct match is enough.
        const otherParty = direction === "outbound" ? toAddresses : [fromAddress];
        const leadQuery = {
          email: { $in: otherParty.filter(Boolean) },
        };
        if (user.tenantId) leadQuery.tenantId = user.tenantId;
        const lead = await Lead.findOne(leadQuery);
        if (lead) leadId = lead._id;
      }

      if (!leadId) {
        result.skipped++;
        continue;
      }

      await Email.create({
        tenantId: user.tenantId || null,
        leadId,
        userId: user._id,
        provider: "gmail",
        providerMessageId: msg.id,
        providerThreadId: msg.threadId,
        direction,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        bodyHtml: msg.bodyHtml,
        bodyText: msg.bodyText,
        snippet: msg.snippet,
        sentAt: msg.date ? new Date(msg.date) : new Date(),
      });
      result.saved++;
    } catch (err) {
      if (err.code !== 11000) {
        console.error(`[Gmail Sync] Failed on message ${messageId}:`, err.message);
      }
    }
  }

  user.emailIntegration.gmail.historyId = historyId;
  user.emailIntegration.gmail.lastSyncedAt = new Date();
  await user.save();

  return result;
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  getProfile,
  buildRawMessage,
  sendMessage,
  getMessage,
  listHistory,
  syncGmailForUser,
};
