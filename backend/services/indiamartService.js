const https = require("https");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { resolvePincode, isPincode } = require("../utils/pincode");

const INDIAMART_API_BASE =
  "https://mapi.indiamart.com/wservce/crm/crmListing/v2/";

const QUERY_TYPE_MAP = {
  W: "Direct Enquiry",
  B: "Buy Lead",
  P: "PNS Call",
  BIZ: "Catalog View",
  WA: "WhatsApp Enquiry",
};

function formatIMDate(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const dd = map.day;
  const mm = map.month;
  const yyyy = map.year;
  const HH = map.hour;
  const MM = map.minute;
  const SS = map.second;
  return `${dd}-${mm}-${yyyy} ${HH}:${MM}:${SS}`;
}

function parseIMDate(dateString) {
  if (!dateString) return new Date();

  const str = String(dateString).trim();
  let year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    ampm = null;

  const format1 = str.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
  );
  const format2 = str.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/i,
  );
  const format3 = str.match(
    /^(\d{1,2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
  );

  if (format1) {
    year = parseInt(format1[1], 10);
    month = parseInt(format1[2], 10) - 1;
    day = parseInt(format1[3], 10);
    hour = parseInt(format1[4], 10);
    minute = parseInt(format1[5], 10);
    second = parseInt(format1[6], 10);
  } else if (format2) {
    day = parseInt(format2[1], 10);
    const monthMap = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    month = monthMap[format2[2].toLowerCase().substring(0, 3)];
    year = parseInt(format2[3], 10);
    hour = parseInt(format2[4], 10);
    minute = parseInt(format2[5], 10);
    second = parseInt(format2[6], 10);
    ampm = format2[7];
  } else if (format3) {
    day = parseInt(format3[1], 10);
    month = parseInt(format3[2], 10) - 1;
    year = parseInt(format3[3], 10);
    hour = parseInt(format3[4], 10);
    minute = parseInt(format3[5], 10);
    second = parseInt(format3[6], 10);
  } else {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  if (ampm) {
    if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
  }

  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  return new Date(
    Date.UTC(year, month, day, hour, minute, second) - IST_OFFSET_MS,
  );
}

async function fetchFromIndiaMART(apiKey, startTime, endTime) {
  if (!apiKey) throw new Error("INDIAMART_API_KEY not set in environment");

  let url = `${INDIAMART_API_BASE}?glusr_crm_key=${encodeURIComponent(apiKey)}`;
  if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
  if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Failed to parse IndiaMART response: " + data));
          }
        });
      })
      .on("error", reject);
  });
}

function mapIMLeadToModel(record, defaultAssignedTo) {
  const name =
    record.SENDER_NAME && record.SENDER_NAME !== "IndiaMART Buyer"
      ? record.SENDER_NAME
      : "IndiaMART Buyer";

  const phone =
    record.SENDER_MOBILE || record.SENDER_MOBILE_ALT || "0000000000";
  const email =
    record.SENDER_EMAIL || `${record.UNIQUE_QUERY_ID}@indiamart.noreply`;
  const company =
    record.SENDER_COMPANY ||
    record.SENDER_ADDRESS ||
    record.SENDER_COUNTRY_ISO ||
    "Not Provided";
  const requirement =
    record.QUERY_MESSAGE ||
    record.SUBJECT ||
    `${QUERY_TYPE_MAP[record.QUERY_TYPE] || record.QUERY_TYPE} enquiry`;

  const indiamartQueryTime = record.QUERY_TIME
    ? parseIMDate(record.QUERY_TIME)
    : new Date();

  return {
    name,
    company,
    phone,
    email,
    state: record.SENDER_STATE || record.SENDER_CITY || "",
    remarks: "",
    source: "IndiaMART",
    requirement,
    status: "PENDING CONTACT",
    assignedTo: defaultAssignedTo,
    indiamartQueryId: record.UNIQUE_QUERY_ID,
    indiamartQueryType: QUERY_TYPE_MAP[record.QUERY_TYPE] || record.QUERY_TYPE,
    indiamartQueryTime,
    statusHistory: [
      {
        status: "PENDING CONTACT",
        timestamp: indiamartQueryTime,
        remarks: "Initial IndiaMART import",
      },
    ],
    createdAt: indiamartQueryTime,
  };
}

async function getRoundRobinAssigneeId(tenantId = null) {
  const tenantFilter = tenantId ? { tenantId } : {};

  let targets = await User.find({
    ...tenantFilter,
    role: "sales_executive",
    status: "active",
    receiveAutoAssignedLeads: true,
  });

  if (targets.length === 0) {
    targets = await User.find({
      ...tenantFilter,
      role: "sales_executive",
      status: "active",
    });
  }

  if (targets.length === 0) {
    targets = await User.find({
      ...tenantFilter,
      role: { $in: ["super_admin", "admin"] },
    });
  }

  if (targets.length === 0 && tenantId) {
    targets = await User.find({ role: { $in: ["super_admin", "admin"] } });
  }

  if (targets.length === 0) return null;

  const targetIds = targets.map((t) => t._id);

  const leadCounts = await Lead.aggregate([
    { $match: { assignedTo: { $in: targetIds }, source: "IndiaMART" } },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  targetIds.forEach((id) => (countMap[id.toString()] = 0));
  leadCounts.forEach((lc) => (countMap[lc._id.toString()] = lc.count));

  let winner = targets[0]._id;
  let minCount = Infinity;

  targets.forEach((t) => {
    const count = countMap[t._id.toString()];
    if (count < minCount) {
      minCount = count;
      winner = t._id;
    }
  });

  return winner;
}

async function getRoundRobinFromIds(userIds) {
  if (!userIds || userIds.length === 0) return null;
  if (userIds.length === 1) {
    const u = await User.findById(userIds[0]).catch(() => null);
    return u?._id || null;
  }
  const mongoose = require("mongoose");
  const ids = userIds.map((id) => new mongoose.Types.ObjectId(id));
  const counts = await Lead.aggregate([
    { $match: { assignedTo: { $in: ids } } },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
  const sorted = ids.sort((a, b) => (countMap[a.toString()] || 0) - (countMap[b.toString()] || 0));
  return sorted[0];
}

async function syncIndiamartLeads({
  apiKey,
  tenantId = null,
  startTime,
  endTime,
  updateExisting = true,
  assigneeIds = [],
}) {
  const result = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    apiResponse: null,
  };

  let apiData;
  try {
    apiData = await fetchFromIndiaMART(apiKey, startTime, endTime);
    result.apiResponse = {
      CODE: apiData.CODE,
      STATUS: apiData.STATUS,
      MESSAGE: apiData.MESSAGE,
    };
  } catch (err) {
    throw new Error(`IndiaMART API fetch failed: ${err.message}`);
  }

  if (apiData.CODE !== 200) {
    if (apiData.CODE === 204) {
      result.fetched = 0;
      return result;
    }
    throw new Error(`IndiaMART API error ${apiData.CODE}: ${apiData.MESSAGE}`);
  }

  const records = apiData.RESPONSE || [];
  result.fetched = records.length;

  for (const record of records) {
    const qid = record.UNIQUE_QUERY_ID;
    if (!qid) {
      result.errors.push("Record missing UNIQUE_QUERY_ID, skipped.");
      continue;
    }

    try {
      const tenantFilter = tenantId ? { tenantId } : { tenantId: null };
      const existing = await Lead.findOne({ indiamartQueryId: qid, ...tenantFilter });
      if (existing) {
        if (updateExisting) {
          const parsedTime = record.QUERY_TIME
            ? parseIMDate(record.QUERY_TIME)
            : existing.indiamartQueryTime;

          await Lead.findByIdAndUpdate(existing._id, {
            name:
              record.SENDER_NAME && record.SENDER_NAME !== "IndiaMART Buyer"
                ? record.SENDER_NAME
                : existing.name,
            company:
              record.SENDER_COMPANY ||
              record.SENDER_ADDRESS ||
              record.SENDER_COUNTRY_ISO ||
              existing.company,
            phone:
              record.SENDER_MOBILE ||
              record.SENDER_MOBILE_ALT ||
              existing.phone,
            email:
              record.SENDER_EMAIL ||
              `${record.UNIQUE_QUERY_ID}@indiamart.noreply` ||
              existing.email,
            state: record.SENDER_STATE || record.SENDER_CITY || existing.state,
            requirement:
              record.QUERY_MESSAGE ||
              record.SUBJECT ||
              `${QUERY_TYPE_MAP[record.QUERY_TYPE] || record.QUERY_TYPE} enquiry` ||
              existing.requirement,
            indiamartQueryType:
              QUERY_TYPE_MAP[record.QUERY_TYPE] ||
              record.QUERY_TYPE ||
              existing.indiamartQueryType,
            indiamartQueryTime: parsedTime,
            createdAt: parsedTime,
          });
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      // Resolve pincode → city/state if SENDER_CITY or SENDER_STATE is a 6-digit pin
      if (isPincode(record.SENDER_CITY)) {
        const resolved = await resolvePincode(record.SENDER_CITY);
        if (resolved) {
          record.SENDER_CITY = resolved.city;
          if (!record.SENDER_STATE) record.SENDER_STATE = resolved.state;
        }
      }
      if (isPincode(record.SENDER_STATE)) {
        const resolved = await resolvePincode(record.SENDER_STATE);
        if (resolved) {
          record.SENDER_STATE = resolved.state;
          if (!record.SENDER_CITY) record.SENDER_CITY = resolved.city;
        }
      }

      const assignedToId = assigneeIds.length > 0
        ? await getRoundRobinFromIds(assigneeIds)
        : await getRoundRobinAssigneeId(tenantId);
      const leadData = mapIMLeadToModel(record, assignedToId);
      if (tenantId) leadData.tenantId = tenantId;
      await Lead.create(leadData);
      result.created++;
    } catch (err) {
      result.errors.push(`QID ${qid}: ${err.message}`);
    }
  }

  return result;
}

let lastSyncEndTime = null;

async function runScheduledSync(tenantId, apiKey, assigneeIds = []) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const endTime = formatIMDate(now);
  const startTime = lastSyncEndTime
    ? formatIMDate(
        new Date(new Date(lastSyncEndTime).getTime() - 5 * 60 * 1000),
      )
    : formatIMDate(oneDayAgo);

  const result = await syncIndiamartLeads({
    apiKey,
    tenantId,
    startTime,
    endTime,
    assigneeIds,
  });

  lastSyncEndTime = now.toISOString();

  console.log(
    `[IndiaMART Sync] ${new Date().toISOString()} | Fetched: ${result.fetched} | Created: ${result.created} | Skipped: ${result.skipped}`,
  );
  if (result.errors.length) {
    console.warn(`[IndiaMART Sync] Errors:`, result.errors);
  }

  return result;
}

module.exports = {
  syncIndiamartLeads,
  runScheduledSync,
  formatIMDate,
  fetchFromIndiaMART,
  mapIMLeadToModel,
  getRoundRobinAssigneeId,
};
