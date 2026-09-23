const mongoose = require("mongoose");

// Sales orders, purchase orders and invoices share one shape: a party, line items and totals.
const TYPES = {
  sales_order: { prefix: "SO", statuses: ["Draft", "Confirmed", "Fulfilled", "Cancelled"] },
  purchase_order: { prefix: "PO", statuses: ["Draft", "Issued", "Received", "Cancelled"] },
  invoice: { prefix: "INV", statuses: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"] },
};

const tradeDocSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.keys(TYPES), required: true },
    number: { type: String, required: true },
    date: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null }, // due date, or expected delivery
    // Who it is with: a client (sales order, invoice, purchase order).
    partyName: { type: String, required: [true, "Please add who this is for"], trim: true, maxlength: 120 },
    partyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reference: { type: String, default: "", maxlength: 60 }, // e.g. a quotation number or the customer's PO number
    items: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null }, // set when picked from the catalog; drives stock
          name: { type: String, required: true, trim: true, maxlength: 160 },
          hsnCode: { type: String, default: "" },
          quantity: { type: Number, required: true, min: 0.01 },
          rate: { type: Number, required: true, min: 0 },
          _id: false,
        },
      ],
      validate: { validator: (v) => v && v.length > 0, message: "Add at least one item" },
    },
    discount: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, default: "Draft" },
    notes: { type: String, default: "", maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  },
  { timestamps: true },
);

tradeDocSchema.index({ tenantId: 1, type: 1, number: 1 }, { unique: true });

const round = (n) => Math.round(n * 100) / 100;

tradeDocSchema.pre("validate", function (next) {
  const t = TYPES[this.type];
  if (t && !t.statuses.includes(this.status)) {
    this.invalidate("status", `Status must be one of: ${t.statuses.join(", ")}`);
  }
  this.subtotal = round((this.items || []).reduce((s, i) => s + i.quantity * i.rate, 0));
  const taxable = Math.max(0, this.subtotal - (this.discount || 0));
  this.tax = round((taxable * (this.taxPercent || 0)) / 100);
  this.total = round(taxable + this.tax);
  next();
});

module.exports = mongoose.model("TradeDoc", tradeDocSchema);
module.exports.TYPES = TYPES;
