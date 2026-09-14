const LINKEDIN_API = "https://api.linkedin.com/rest";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
// LinkedIn REST APIs are versioned by calendar month, not a fixed major version.
const LINKEDIN_API_VERSION = "202507";

const LINKEDIN_SCOPES = ["r_ads", "r_ads_leadgen_automation"].join(" ");

function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_ADS_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: LINKEDIN_SCOPES,
    state,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code, redirectUri) {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_ADS_CLIENT_ID,
      client_secret: process.env.LINKEDIN_ADS_CLIENT_SECRET,
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, expires_in, refresh_token, refresh_token_expires_in }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_ADS_CLIENT_ID,
      client_secret: process.env.LINKEDIN_ADS_CLIENT_SECRET,
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function listAdAccounts(accessToken) {
  const res = await fetch(
    `${LINKEDIN_API}/adAccounts?q=search&search=(status:(values:List(ACTIVE)))`,
    { headers: authHeaders(accessToken) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to list LinkedIn ad accounts");
  return (data.elements || []).map((a) => ({
    id: String(a.id),
    name: a.name || `Account ${a.id}`,
  }));
}

async function listLeadForms(adAccountId, accessToken) {
  const res = await fetch(
    `${LINKEDIN_API}/leadForms?owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A${adAccountId})`,
    { headers: authHeaders(accessToken) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to list LinkedIn lead forms");
  return (data.elements || []).map((f) => ({
    id: String(f.id),
    name: f.name || `Form ${f.id}`,
  }));
}

async function listCampaigns(adAccountId, accessToken) {
  const res = await fetch(
    `${LINKEDIN_API}/adAccounts/${adAccountId}/adCampaigns?q=search`,
    { headers: authHeaders(accessToken) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to list LinkedIn campaigns");
  return (data.elements || []).map((c) => ({
    id: String(c.id),
    name: c.name || `Campaign ${c.id}`,
    status: c.status || "UNKNOWN",
  }));
}

// Pull-style sync via the Lead Sync API. LinkedIn also supports a push
// webhook subscription for real-time delivery, wired up separately below.
async function fetchLeadFormResponses(adAccountId, accessToken, sinceMs) {
  const params = new URLSearchParams({
    q: "owner",
    owner: `(sponsoredAccount:urn:li:sponsoredAccount:${adAccountId})`,
  });
  if (sinceMs) {
    params.set(
      "submittedAtTimeRange",
      `(start:${sinceMs})`,
    );
  }
  const res = await fetch(`${LINKEDIN_API}/leadFormResponses?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to fetch LinkedIn lead responses");
  return data.elements || [];
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listAdAccounts,
  listCampaigns,
  listLeadForms,
  fetchLeadFormResponses,
};
