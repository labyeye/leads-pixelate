// Document numbers (invoice, quotation, sales / purchase order) in a format the account owner
// sets in Settings > Numbering, e.g. "INV/{YY}-{seq:4}" -> INV/26-0001. A type with no format set
// keeps its old numbering untouched.
const Setting = require("../models/Setting");

const TYPES = {
  invoice: { label: "Invoice", format: "INV-{seq:4}" },
  quotation: { label: "Quotation", format: "SKF-{seq:4}" },
  sales_order: { label: "Sales order", format: "SO-{seq:4}" },
  purchase_order: { label: "Purchase order", format: "PO-{seq:4}" },
};

const TOKEN = /\{(YYYY|YY|MM|DD|seq(?::(\d{1,2}))?)\}/g;

function formatNumber(format, seq, date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return format.replace(TOKEN, (_, t, pad) => {
    if (t === "YYYY") return String(date.getFullYear());
    if (t === "YY") return p(date.getFullYear() % 100);
    if (t === "MM") return p(date.getMonth() + 1);
    if (t === "DD") return p(date.getDate());
    return String(seq).padStart(Number(pad) || 1, "0");
  });
}

// Throws a 400-style error when the format can't produce unique, printable numbers.
function checkFormat(format) {
  const bad = (m) => Object.assign(new Error(m), { statusCode: 400 });
  if (typeof format !== "string" || !format.trim() || format.length > 40) throw bad("Format must be 1-40 characters.");
  if (!/\{seq(:\d{1,2})?\}/.test(format)) throw bad("Format must include {seq} (the running number), e.g. INV-{seq:4}.");
  if (/\{seq/.test(format.replace(/\{seq(:\d{1,2})?\}/, ""))) throw bad("Use {seq} only once.");
  if (/[{}]/.test(formatNumber(format, 1))) throw bad("Unknown {token}. Use {YYYY} {YY} {MM} {DD} {seq:4}.");
  if (!/^[\w\s./\-#{}:]+$/.test(format)) throw bad("Use letters, numbers and - / . # _ only.");
  return format.trim();
}

// Next number for this tenant + type, or null when the owner hasn't set a format (caller falls
// back to its own numbering). The counter moves atomically so two saves never share a number.
async function nextDocNumber(tenantId, type) {
  const key = `numbering.${type}`;
  const before = await Setting.findOneAndUpdate(
    { tenantId: tenantId || null, [`${key}.format`]: { $exists: true } },
    { $inc: { [`${key}.next`]: 1 } },
    { new: false },
  ).lean();
  const cfg = before?.numbering?.[type];
  return cfg ? formatNumber(cfg.format, cfg.next || 1) : null;
}

module.exports = { TYPES, formatNumber, checkFormat, nextDocNumber };
