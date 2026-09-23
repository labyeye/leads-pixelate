const Product = require("../models/Product");

// Stock moves once, when a document enters a "stock applied" status; leaving them all (e.g. Cancelled, back to Draft) undoes it.
// Sales order: deducts from Confirmed on (Fulfilled keeps it). Purchase order: adds when Received. Invoices never touch stock.
const RULES = {
  sales_order: { statuses: ["Confirmed", "Fulfilled"], sign: -1 },
  purchase_order: { statuses: ["Received"], sign: 1 },
};

// sign * quantity added to each catalog-linked line; free-text lines (no productId) are ignored.
// Scoped to the tenant so a forged productId can't move another tenant's stock.
async function move(items, sign, tenantId) {
  await Promise.all(
    (items || [])
      .filter((i) => i.productId)
      .map((i) =>
        Product.updateOne({ _id: i.productId, tenantId: tenantId || null }, { $inc: { stockQuantity: sign * i.quantity } }),
      ),
  );
}

// Call with the status/items as they were before the change (null for a new doc) and after it.
// ponytail: items edited while already Confirmed/Received don't re-sync stock; cancel and re-enter if quantities change.
async function syncStock(type, tenantId, before, after) {
  const rule = RULES[type];
  if (!rule) return;
  const was = rule.statuses.includes(before?.status);
  const now = rule.statuses.includes(after?.status);
  if (!was && now) await move(after.items, rule.sign, tenantId);
  else if (was && !now) await move(before.items, -rule.sign, tenantId);
}

module.exports = { syncStock };
