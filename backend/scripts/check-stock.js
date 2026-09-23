// Offline check of stock movement rules (Product.updateOne is stubbed, no database).
const assert = require("assert");
const Product = require("../models/Product");
const { syncStock } = require("../utils/stock");

(async () => {
  const calls = [];
  Product.updateOne = async (f, u) => calls.push([String(f._id), u.$inc.stockQuantity]);
  const items = [{ productId: "a", quantity: 3 }, { name: "free text", quantity: 9 }];
  const run = async (type, before, after) => {
    calls.length = 0;
    await syncStock(type, null, before, after);
    return calls.slice();
  };
  const doc = (status) => ({ status, items });

  assert.deepStrictEqual(await run("sales_order", null, doc("Draft")), []);
  assert.deepStrictEqual(await run("sales_order", doc("Draft"), doc("Confirmed")), [["a", -3]]);
  assert.deepStrictEqual(await run("sales_order", doc("Confirmed"), doc("Fulfilled")), []);
  assert.deepStrictEqual(await run("sales_order", doc("Confirmed"), doc("Confirmed")), []);
  assert.deepStrictEqual(await run("sales_order", doc("Fulfilled"), doc("Cancelled")), [["a", 3]]);
  assert.deepStrictEqual(await run("sales_order", null, doc("Confirmed")), [["a", -3]]);
  assert.deepStrictEqual(await run("sales_order", doc("Confirmed"), null), [["a", 3]]);
  assert.deepStrictEqual(await run("purchase_order", doc("Issued"), doc("Received")), [["a", 3]]);
  assert.deepStrictEqual(await run("purchase_order", doc("Received"), doc("Cancelled")), [["a", -3]]);
  assert.deepStrictEqual(await run("invoice", doc("Draft"), doc("Paid")), []);
  console.log("check-stock: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
