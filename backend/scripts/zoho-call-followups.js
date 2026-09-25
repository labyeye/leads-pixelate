/**
 * Uses a Zoho Calls export to give leads a follow-up date and the FOLLOW UP 1 status, so the CRM
 * calendar (which only shows FOLLOW UP / REMINDER leads) matches Zoho's.
 *
 * Usage: node scripts/zoho-call-followups.js <calls.csv> <tenantId-suffix|tenantId> [--apply]
 * Without --apply it only prints what it would do. With --apply it first writes a backup of every
 * lead it touches (old status + followUpDate) next to the CSV, then updates.
 *
 * Rules: a call counts if its Call Status is Scheduled or Overdue (Cancelled / already-held calls
 * are ignored). A lead gets its nearest upcoming call; if none is upcoming, its latest overdue one.
 * Leads are matched by name (Zoho "Related To"); duplicates are split by owner, and the ones that
 * are still ambiguous are skipped and listed. WON / DROP / VISIT SCHEDULED / VISITED keep their
 * status (their date is still set).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const KEEP = ["WON", "DROP", "VISIT SCHEDULED", "VISITED"];
const NEW_STATUS = "FOLLOW UP 1";

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') (text[i + 1] === '"' ? ((field += '"'), i++) : (q = false));
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") (row.push(field), (field = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) (row.push(field), rows.push(row));
  return rows;
}

async function main() {
  const [, , csvPath, tenantArg, flag] = process.argv;
  const apply = flag === "--apply";
  if (!csvPath || !tenantArg) return console.error("Usage: node scripts/zoho-call-followups.js <calls.csv> <tenantId|last6> [--apply]");

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  const h = rows[0];
  const col = (n) => h.indexOf(n);
  const calls = rows
    .slice(1)
    .filter((r) => r.length > 5)
    .map((r) => ({
      owner: (r[col("Call Owner")] || "").trim(),
      // Zoho exports in the account's local time (IST here)
      when: new Date(r[col("Call Start Time")].replace(" ", "T") + "+05:30"),
      status: r[col("Call Status")],
      lead: (r[col("Related To")] || "").trim(),
    }))
    .filter((c) => ["Scheduled", "Overdue"].includes(c.status) && c.lead && !isNaN(c.when));

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const Leads = db.collection("leads");
  const one = await Leads.findOne(tenantArg.length === 24 ? { tenantId: new mongoose.Types.ObjectId(tenantArg) } : { $expr: { $eq: [{ $substr: [{ $toString: "$tenantId" }, 18, 6] }, tenantArg] } });
  if (!one) throw new Error("tenant not found");
  const tenantId = one.tenantId;

  const users = await db.collection("users").find({ tenantId }).project({ name: 1 }).toArray();
  const userByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u._id]));
  const leads = await Leads.find({ tenantId, deletedAt: null }).project({ name: 1, status: 1, followUpDate: 1, assignedTo: 1 }).toArray();
  const byName = new Map();
  for (const l of leads) {
    const k = (l.name || "").trim().toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(l);
  }

  // group calls per (lead name, owner)
  const groups = new Map();
  for (const c of calls) {
    const k = `${c.lead.toLowerCase()}|${c.owner.toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }

  const now = new Date();
  const plan = [];
  const skipped = { notFound: [], ambiguous: [], noOwnerMatch: [] };
  for (const [k, cs] of groups) {
    const [name, owner] = k.split("|");
    let cands = byName.get(name) || [];
    if (!cands.length) { skipped.notFound.push(name); continue; }
    if (cands.length > 1) {
      const uid = userByName.get(owner);
      cands = cands.filter((l) => uid && String(l.assignedTo) === String(uid));
      if (cands.length !== 1) { skipped[cands.length ? "ambiguous" : "noOwnerMatch"].push(name); continue; }
    }
    const lead = cands[0];
    const upcoming = cs.filter((c) => c.when >= now).sort((a, b) => a.when - b.when)[0];
    const pick = upcoming || cs.sort((a, b) => b.when - a.when)[0];
    plan.push({ id: lead._id, name: lead.name, oldStatus: lead.status, oldDate: lead.followUpDate || null, date: pick.when, keep: KEEP.includes(lead.status), owner });
  }
  // a lead matched by two owners' calls: keep the earliest upcoming one
  const seen = new Map();
  for (const p of plan) {
    const k = String(p.id);
    if (!seen.has(k) || p.date < seen.get(k).date) seen.set(k, p);
  }
  const final = [...seen.values()];

  const perDay = {};
  for (const p of final) {
    const d = p.date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    perDay[`${d} ${p.owner}`] = (perDay[`${d} ${p.owner}`] || 0) + 1;
  }
  console.log(`calls counted: ${calls.length}, lead groups: ${groups.size}`);
  console.log(`leads to update: ${final.length} (status -> ${NEW_STATUS}: ${final.filter((p) => !p.keep).length}, date only, status kept: ${final.filter((p) => p.keep).length})`);
  console.log(`skipped: not found ${skipped.notFound.length}, ambiguous ${skipped.ambiguous.length}, owner mismatch ${skipped.noOwnerMatch.length}`);
  console.log("ambiguous / mismatch names:", [...skipped.ambiguous, ...skipped.noOwnerMatch].slice(0, 40).join(", "));
  console.log("status change breakdown:", JSON.stringify(final.filter((p) => !p.keep).reduce((a, p) => ((a[p.oldStatus] = (a[p.oldStatus] || 0) + 1), a), {})));
  console.log("new follow-up dates per day/owner:", JSON.stringify(Object.fromEntries(Object.entries(perDay).sort())));

  if (!apply) return console.log("\nDry run only. Re-run with --apply to write.");

  const backup = path.join(path.dirname(csvPath), `followup-backup-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(final.map((p) => ({ id: String(p.id), status: p.oldStatus, followUpDate: p.oldDate })), null, 1));
  console.log("backup written:", backup);
  let n = 0;
  for (const p of final) {
    const set = { followUpDate: p.date };
    const update = { $set: set };
    if (!p.keep) {
      set.status = NEW_STATUS;
      update.$push = { statusHistory: { status: NEW_STATUS, timestamp: new Date(), remarks: "Set from Zoho scheduled call" } };
    }
    n += (await Leads.updateOne({ _id: p.id }, update)).modifiedCount;
  }
  console.log("updated leads:", n);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
