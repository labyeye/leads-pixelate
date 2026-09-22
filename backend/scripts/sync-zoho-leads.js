/**
 * One-off re-sync: re-reads a Zoho leads CSV export and updates the matching
 * leads already in the DB (matched by Query Id = indiamartQueryId) for one
 * tenant, so status/remarks/follow-up/owner reflect the latest CSV.
 * Usage: node scripts/sync-zoho-leads.js <path-to-csv> <tenantId>
 */
require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { parseIMDate } = require("../services/indiamartService");

const QUERY_TYPE_MAP = {
  W: "Direct Enquiry",
  B: "Buy Lead",
  P: "PNS Call",
  BIZ: "Catalog View",
  WA: "WhatsApp Enquiry",
};

// Same buckets the original Zoho import used (see existing statusHistory
// remarks "Imported from Zoho (Lead Status: X)" in the DB).
const STATUS_MAP = {
  "not contacted": "PENDING CONTACT",
  "contacted": "DISCUSSION",
  "attempted to contact": "1",
  "pre-qualified": "DISCUSSION",
  "contact in future": "DISCUSSION",
  "lost lead": "DROP",
  "not qualified": "DROP",
  "junk lead": "DROP",
};

// Minimal RFC4180 parser: handles quoted fields, "" escapes, embedded
// newlines/commas — this CSV has all three, so a split(",") won't do.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  return rows.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])),
  );
}

function mapStatus(zohoStatus) {
  if (!zohoStatus) return null;
  return STATUS_MAP[zohoStatus.trim().toLowerCase()] || null;
}

function parseFollowUpDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const [, , csvPath, tenantIdArg] = process.argv;
  if (!csvPath || !tenantIdArg) {
    console.error(
      "Usage: node scripts/sync-zoho-leads.js <path-to-csv> <tenantId>",
    );
    process.exit(1);
  }
  const tenantId = new mongoose.Types.ObjectId(tenantIdArg);

  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({ tenantId }).select("name");
  const ownerToUserId = new Map(
    users.map((u) => [u.name.trim().toLowerCase(), u._id]),
  );

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));

  let matched = 0;
  let unmatched = 0;
  let statusChanged = 0;

  for (const row of rows) {
    const qid = row["Query Id"];
    if (!qid) {
      unmatched++;
      continue;
    }

    const existing = await Lead.findOne({ tenantId, indiamartQueryId: qid });
    if (!existing) {
      unmatched++;
      continue;
    }

    const name = (row["Lead Name"] || existing.name || "").trim();
    const company = row["Company"] || existing.company;
    const phone = row["Mobile"] || row["Phone"] || existing.phone;
    const email = row["Email"] ? row["Email"].toLowerCase() : existing.email;
    const location = row["Address - City"] || existing.location;
    const state = row["Address - State / Province"] || existing.state;
    const requirement = row["Description"] || existing.requirement;
    const remarks =
      row["Conversation Details"] !== ""
        ? row["Conversation Details"]
        : existing.remarks;

    const typeCode = row["Lead  Pull Type"] || row["Lead  Push Type"] || "";
    const queryTimeStr = row["Lead  Pull Time"] || row["Lead  Push Time"];
    const queryTime = queryTimeStr
      ? parseIMDate(queryTimeStr)
      : existing.indiamartQueryTime;

    const followUpDate =
      parseFollowUpDate(row["Date Follow Up"]) || existing.followUpDate;

    const contactTag =
      row["Pick List 1"] === "Hot Lead" ? "HOT" : existing.contactTag;

    const ownerId =
      ownerToUserId.get((row["Lead Owner"] || "").trim().toLowerCase()) ||
      existing.assignedTo;

    const update = {
      name,
      company,
      phone,
      email,
      location,
      state,
      requirement,
      remarks,
      contactTag,
      followUpDate,
      assignedTo: ownerId,
      indiamartQueryType: QUERY_TYPE_MAP[typeCode] || existing.indiamartQueryType,
      indiamartQueryTime: queryTime,
    };

    const newStatus = mapStatus(row["Lead Status"]);
    if (newStatus && newStatus !== existing.status) {
      update.status = newStatus;
      update.$push = {
        statusHistory: {
          status: newStatus,
          timestamp: new Date(),
          changedBy: ownerId,
          remarks: `Re-synced from Zoho (Lead Status: ${row["Lead Status"]})`,
        },
      };
      statusChanged++;
    }

    const { $push, ...setFields } = update;
    await Lead.findByIdAndUpdate(existing._id, {
      $set: setFields,
      ...($push ? { $push } : {}),
    });
    matched++;
  }

  console.log(
    `Done. Rows: ${rows.length}, matched+updated: ${matched}, status changed: ${statusChanged}, unmatched (no Query Id / not found): ${unmatched}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
