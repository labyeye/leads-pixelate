const https = require("https");
const http = require("http");
const Lead = require("../models/Lead");
const { resolvePincode, isPincode } = require("../utils/pincode");

// TradeIndia does not publish one fixed public API endpoint the way
// IndiaMART does — each seller's "My Inquiry API" panel hands them a
// ready-made request URL plus userid/profile_id/key. We store whatever
// URL the tenant was given and only append the credential params, rather
// than guessing a hardcoded base URL.
//
// The exact response envelope/field names are also not publicly
// documented, so pickField()/findRecordsArray() below read leniently
// across the common name variants seen in comparable B2B lead APIs. If a
// tenant's account returns a shape we don't recognise, syncTradeIndiaLeads
// surfaces the raw response keys in the error so it can be adjusted.

function pickField(record, candidates) {
  for (const key of candidates) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return "";
}

function findRecordsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const candidateKeys = [
    "RESPONSE",
    "response",
    "data",
    "result",
    "results",
    "leads",
    "inquiries",
    "enquiries",
    "records",
  ];
  for (const key of candidateKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return null;
}

function buildRequestUrl(apiUrl, { userId, profileId, apiKey, startDate, endDate }) {
  const url = new URL(apiUrl);
  const setIfMissing = (key, value) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  setIfMissing("userid", userId);
  setIfMissing("profile_id", profileId);
  setIfMissing("key", apiKey);
  if (startDate) setIfMissing("from_date", startDate);
  if (endDate) setIfMissing("to_date", endDate);
  return url.toString();
}

async function fetchFromTradeIndia(apiUrl, credentials) {
  if (!apiUrl) throw new Error("TradeIndia API URL not configured");

  const requestUrl = buildRequestUrl(apiUrl, credentials);
  const client = requestUrl.startsWith("http://") ? http : https;

  const raw = await new Promise((resolve, reject) => {
    client
      .get(requestUrl, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });

  if (raw.status && raw.status >= 400) {
    throw new Error(
      `TradeIndia API returned HTTP ${raw.status}. Check the API Link, User ID, Profile ID, and Key from your TradeIndia seller panel.`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.body);
  } catch {
    throw new Error(
      "TradeIndia API did not return JSON — the account's API Link may point to a different response format than expected. Please verify it in the TradeIndia seller panel.",
    );
  }

  return parsed;
}

function mapTILeadToModel(record, defaultAssignedTo) {
  const name = pickField(record, ["sender_name", "name", "buyer_name", "enquiry_name"]) || "TradeIndia Buyer";
  const phone = pickField(record, ["sender_mobile", "mobile", "phone", "contact_no", "buyer_mobile"]) || "0000000000";
  const queryId = pickField(record, ["query_id", "inquiry_id", "enquiry_id", "id", "unique_id"]);
  const email = pickField(record, ["sender_email", "email", "buyer_email"]) || `${queryId || Date.now()}@tradeindia.noreply`;
  const company = pickField(record, ["sender_company", "company", "company_name", "buyer_company"]) || "Not Provided";
  const requirement = pickField(record, ["message", "query_message", "requirement", "product_name", "subject"]) || "TradeIndia enquiry";
  const city = pickField(record, ["sender_city", "city"]);
  const state = pickField(record, ["sender_state", "state"]);
  const dateStr = pickField(record, ["query_time", "inquiry_date", "date", "created_at"]);
  const queryTime = dateStr ? new Date(dateStr) : new Date();
  const validTime = isNaN(queryTime.getTime()) ? new Date() : queryTime;

  return {
    name,
    company,
    phone,
    email,
    location: city,
    state,
    remarks: "",
    source: "TradeIndia",
    requirement,
    status: "PENDING CONTACT",
    assignedTo: defaultAssignedTo,
    tradeindiaQueryId: queryId ? String(queryId) : undefined,
    statusHistory: [
      {
        status: "PENDING CONTACT",
        timestamp: validTime,
        remarks: "Initial TradeIndia import",
      },
    ],
    createdAt: validTime,
  };
}

async function syncTradeIndiaLeads({
  apiUrl,
  userId,
  profileId,
  apiKey,
  tenantId = null,
  startDate,
  endDate,
  assigneeIds = [],
  getRoundRobinFromIds,
  getRoundRobinAssigneeId,
}) {
  const result = { fetched: 0, created: 0, skipped: 0, errors: [] };

  const payload = await fetchFromTradeIndia(apiUrl, {
    userId,
    profileId,
    apiKey,
    startDate,
    endDate,
  });

  const records = findRecordsArray(payload);
  if (records === null) {
    throw new Error(
      `TradeIndia API responded but no lead list was found in the payload (keys received: ${Object.keys(payload || {}).join(", ") || "none"}). The response shape may differ from what this integration expects — please share a sample response so it can be adjusted.`,
    );
  }

  result.fetched = records.length;

  const tenantFilter = tenantId ? { tenantId } : { tenantId: null };

  for (const record of records) {
    try {
      const queryId = pickField(record, ["query_id", "inquiry_id", "enquiry_id", "id", "unique_id"]);
      if (queryId) {
        const existing = await Lead.findOne({
          tradeindiaQueryId: String(queryId),
          ...tenantFilter,
        });
        if (existing) {
          result.skipped++;
          continue;
        }
      }

      let cityVal = pickField(record, ["sender_city", "city"]);
      let stateVal = pickField(record, ["sender_state", "state"]);
      if (isPincode(cityVal)) {
        const resolved = await resolvePincode(cityVal);
        if (resolved) {
          cityVal = resolved.city;
          if (!stateVal) stateVal = resolved.state;
        }
      }

      const assignedToId =
        assigneeIds.length > 0
          ? await getRoundRobinFromIds(assigneeIds)
          : await getRoundRobinAssigneeId(tenantId);

      const leadData = mapTILeadToModel(record, assignedToId);
      leadData.location = cityVal;
      leadData.state = stateVal;
      if (tenantId) leadData.tenantId = tenantId;

      await Lead.create(leadData);
      result.created++;
    } catch (err) {
      result.errors.push(err.message);
    }
  }

  return result;
}

module.exports = { fetchFromTradeIndia, mapTILeadToModel, syncTradeIndiaLeads };
