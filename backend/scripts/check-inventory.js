// Offline check of the Inventory models (no database): totals, statuses, required fields.
const assert = require("assert");
const TradeDoc = require("../models/TradeDoc");
const PriceBook = require("../models/PriceBook");

(async () => {
  const doc = new TradeDoc({
    type: "invoice", number: "INV-0001", partyName: "Acme",
    items: [{ name: "A", quantity: 2, rate: 100 }, { name: "B", quantity: 1, rate: 50.5 }],
    discount: 50, taxPercent: 18,
  });
  await doc.validate();
  assert.strictEqual(doc.subtotal, 250.5);
  assert.strictEqual(doc.tax, 36.09);
  assert.strictEqual(doc.total, 236.59);

  const bad = new TradeDoc({ type: "purchase_order", number: "PO-1", partyName: "Acme", status: "Paid", items: [{ name: "A", quantity: 1, rate: 1 }] });
  await assert.rejects(() => bad.validate(), /Status must be one of/);
  const empty = new TradeDoc({ type: "sales_order", number: "SO-1", partyName: "C", items: [] });
  await assert.rejects(() => empty.validate(), /at least one item/);
  const noParty = new TradeDoc({ type: "sales_order", number: "SO-1", items: [{ name: "A", quantity: 1, rate: 1 }] });
  await assert.rejects(() => noParty.validate(), /who this is for/);

  await assert.rejects(() => new PriceBook({ name: "W", items: [{ product: "507f1f77bcf86cd799439011", price: -1 }] }).validate(), /price/i);
  console.log("check-inventory: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
