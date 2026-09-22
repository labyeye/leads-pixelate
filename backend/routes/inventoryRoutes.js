// Inventory section: price books, sales orders, purchase orders, invoices.
// Access follows the existing roles: buying-side pages (price books, purchase orders)
// use the "Products" permission, selling-side ones (sales orders, invoices) use "Quotations".
const express = require("express");
const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");
const PriceBook = require("../models/PriceBook");
const { crud, tradeDocs } = require("../controllers/inventoryController");

function mount(handlers, resource) {
  const r = express.Router();
  r.use(protect);
  r.route("/").get(checkPermission(resource, "read"), handlers.list).post(checkPermission(resource, "create"), handlers.create);
  r.route("/:id")
    .get(checkPermission(resource, "read"), handlers.get)
    .put(checkPermission(resource, "update"), handlers.update)
    .delete(checkPermission(resource, "delete"), handlers.remove);
  return r;
}

module.exports = {
  priceBooks: mount(crud(PriceBook, { label: "Price book" }), "Products"),
  salesOrders: mount(tradeDocs("sales_order", "Sales order"), "Quotations"),
  purchaseOrders: mount(tradeDocs("purchase_order", "Purchase order"), "Products"),
  invoices: mount(tradeDocs("invoice", "Invoice"), "Quotations"),
};
