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
      default: "",
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
        "Google Ads",
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
    facebookAdsetName: { type: String, default: null },
    facebookCampaignName: { type: String, default: null },
    facebookFormName: { type: String, default: null },
    googleAdsLeadId: { type: String, default: null },
    googleAdsCampaignId: { type: String, default: null },
    googleAdsCampaignName: { type: String, default: null },
    googleAdsFormId: { type: String, default: null },
    googleAdsCustomerId: { type: String, default: null },
    customFields: {
      type: Map,
      of: String,
      default: {},
    },
    phone: {
      type: String,
      default: "",
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
      default: "",
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    interestedProducts: {
      type: [String],
      default: [],
    },
    // No enum here — tenants can extend the pipeline with custom stages
    // (backend/models/Setting.js customLeadStatuses), so the valid set is
    // dynamic per tenant. Actual validation of allowed values/transitions
    // happens in leadController via backend/utils/leadStatuses.js.
    status: {
      type: String,
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
    tradeindiaQueryId: {
      type: String,
    },
    justdialLeadId: {
      type: String,
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
leadSchema.index({ tenantId: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, source: 1 });
leadSchema.index({ tenantId: 1, assignedTo: 1 });
leadSchema.index(
  { tenantId: 1, indiamartQueryId: 1 },
  { sparse: true, unique: true },
);
leadSchema.index(
  { tenantId: 1, tradeindiaQueryId: 1 },
  { sparse: true, unique: true },
);
leadSchema.index(
  { tenantId: 1, justdialLeadId: 1 },
  { sparse: true, unique: true },
);
leadSchema.index(
  { tenantId: 1, facebookLeadgenId: 1 },
  { sparse: true, unique: true },
);
leadSchema.index(
  { tenantId: 1, googleAdsLeadId: 1 },
  { sparse: true, unique: true },
);

module.exports = mongoose.model("Lead", leadSchema);
