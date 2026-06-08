const mongoose = require("mongoose");

const quotationServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hsnCode: { type: String, default: "" },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const quotationSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    clientName: { type: String, required: [true, "Please add the buyer name"] },
    companyName: { type: String, default: "" },
    address: { type: String, default: "" },
    gst: { type: String, default: "" },
    aadhar: { type: String, default: "" },
    pan: { type: String, default: "" },
    mobile: { type: String, default: "" },
    leadTag: { type: String, default: "" },
    projectTitle: {
      type: String,
      required: [true, "Please add a project title"],
    },
    services: {
      type: [quotationServiceSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one service item is required",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Approved", "Rejected"],
      default: "Draft",
    },
    notes: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
  },
  { timestamps: true },
);

quotationSchema.pre("validate", async function (next) {
  if (!this.number) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("Quotation").countDocuments();
    this.number = `SKF-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

quotationSchema.pre("validate", function (next) {
  if (this.services && this.services.length > 0) {
    this.subtotal = this.services.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
    this.tax = this.tax || this.subtotal * 0.18;
    this.total = this.subtotal + this.tax - (this.discount || 0);
  }
  next();
});

quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Quotation", quotationSchema);
