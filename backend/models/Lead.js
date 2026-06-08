const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add the lead name"],
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Please add the company name"],
      trim: true,
    },
    source: {
      type: String,
      enum: [
        "IndiaMART",
        "TradeIndia",
        "Justdial",
        "Website",
        "Manual",
        "Facebook",
        "Instagram",
        "Meta",
      ],
      required: [true, "Please specify the lead source"],
    },
    adPlatforms: {
      type: [String],
      default: [],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    facebookLeadgenId: { type: String, default: null },
    facebookFormId: { type: String, default: null },
    facebookAdId: { type: String, default: null },
    facebookAdName: { type: String, default: null },
    facebookPageName: { type: String, default: null },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
      trim: true,
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      default: "",
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    budget: {
      type: String,
      default: "",
      trim: true,
    },
    requirement: {
      type: String,
      required: [true, "Please describe the requirement"],
    },
    interestedProducts: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: [
        "PENDING CONTACT",
        "1",
        "2",
        "3",
        "COMPLETED",
        "DISCUSSION",
        "DISCUSSION 1",
        "DISCUSSION 2",
        "DISCUSSION 3",
        "DISCUSSION COMPLETED",
        "QUOTATION",
        "QUOTATION 1",
        "QUOTATION 2",
        "QUOTATION 3",
        "QUOTATION COMPLETED",
        "VISIT SCHEDULED",
        "VISITED",
        "DROP",
        "WON",
      ],
      default: "PENDING CONTACT",
    },
    contactTag: {
      type: String,
      enum: ["HOT", "WARM", "COLD"],
      default: null,
    },
    visitScheduledDate: {
      type: Date,
      default: null,
    },
    visitActualDate: {
      type: Date,
      default: null,
    },
    stagePath: {
      type: [String],
      default: ["PENDING CONTACT"],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please assign the lead to a user"],
    },
    followUpDate: {
      type: Date,
    },
    notes: [
      {
        text: { type: String },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    indiamartQueryId: {
      type: String,
    },
    indiamartQueryType: {
      type: String,
    },
    indiamartQueryTime: {
      type: Date,
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        remarks: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

leadSchema.index({
  name: "text",
  company: "text",
  email: "text",
  phone: "text",
});
leadSchema.index({ tenantId: 1, createdAt: -1 }); // primary list: tenant + newest first
leadSchema.index({ tenantId: 1, status: 1, createdAt: -1 }); // category tab queries
leadSchema.index({ tenantId: 1, source: 1 });
leadSchema.index({ tenantId: 1, assignedTo: 1 });
leadSchema.index(
  { tenantId: 1, indiamartQueryId: 1 },
  { sparse: true, unique: true },
);
leadSchema.index(
  { tenantId: 1, facebookLeadgenId: 1 },
  { sparse: true, unique: true },
);

module.exports = mongoose.model("Lead", leadSchema);
