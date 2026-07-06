const GOOGLE_ADS_API_VERSION = "v17";
const GOOGLE_ADS_API = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_ADS_SCOPES = ["https://www.googleapis.com/auth/adwords"].join(
  " ",
);

function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_ADS_SCOPES,
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
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function getAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

function authHeaders(accessToken, loginCustomerId) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = String(loginCustomerId).replace(/-/g, "");
  }
  return headers;
}

async function listAccessibleCustomers(accessToken) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers:listAccessibleCustomers`, {
    headers: authHeaders(accessToken),
  });
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message || "Failed to list Google Ads accounts");
  // resourceNames look like "customers/1234567890"
  return (data.resourceNames || []).map((rn) => rn.split("/")[1]);
}

async function gaqlSearch(customerId, accessToken, loginCustomerId, query) {
  const cleanId = String(customerId).replace(/-/g, "");
  const res = await fetch(
    `${GOOGLE_ADS_API}/customers/${cleanId}/googleAds:search`,
    {
      method: "POST",
      headers: authHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.[0]?.error?.message || "Google Ads API error";
    throw new Error(msg);
  }
  return data.results || [];
}

async function getCustomerName(customerId, accessToken, loginCustomerId) {
  const results = await gaqlSearch(
    customerId,
    accessToken,
    loginCustomerId,
    "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
  );
  return results[0]?.customer?.descriptiveName || `Account ${customerId}`;
}

async function listCampaignsWithLeadForms(customerId, accessToken, loginCustomerId) {
  const results = await gaqlSearch(
    customerId,
    accessToken,
    loginCustomerId,
    `SELECT campaign.id, campaign.name, campaign.status
     FROM campaign
     WHERE campaign.status != 'REMOVED'
     ORDER BY campaign.id DESC
     LIMIT 200`,
  );
  return results.map((r) => ({
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: r.campaign.status,
  }));
}

// Pulls lead form submissions via GAQL. Google exposes submitted field
// values as a JSON string in lead_form_submission_data.custom_lead_form_submission_fields
// and lead_form_submission_data.lead_form_submission_fields.
async function fetchLeadFormSubmissions(
  customerId,
  accessToken,
  loginCustomerId,
  sinceDate,
) {
  const dateFilter = sinceDate
    ? `WHERE lead_form_submission_data.submission_date_time >= '${sinceDate}'`
    : `WHERE segments.date DURING LAST_30_DAYS`;

  const results = await gaqlSearch(
    customerId,
    accessToken,
    loginCustomerId,
    `SELECT
       lead_form_submission_data.resource_name,
       lead_form_submission_data.asset_id,
       lead_form_submission_data.campaign_id,
       lead_form_submission_data.gclid,
       lead_form_submission_data.lead_form_submission_fields,
       lead_form_submission_data.submission_date_time,
       campaign.name
     FROM lead_form_submission_data
     ${dateFilter}
     LIMIT 500`,
  );
  return results;
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  getAccessToken,
  listAccessibleCustomers,
  getCustomerName,
  listCampaignsWithLeadForms,
  fetchLeadFormSubmissions,
};
