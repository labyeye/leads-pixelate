const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    refType: { type: String, enum: ["Lead", "Client"], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: String,
    phone: String,
    email: String,
    status: {
      type: String,
      enum: ["PENDING", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED"],
      default: "PENDING",
    },
    waMessageId: String,
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    repliedAt: Date,
    failedReason: String,
  },
  { _id: true },
);

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
    },
    description: { type: String, default: "", trim: true },
    type: {
      type: String,
      enum: ["WHATSAPP"],
      default: "WHATSAPP",
    },
    status: {
      type: String,
      enum: ["DRAFT", "RUNNING", "COMPLETED", "PAUSED", "CANCELLED"],
      default: "DRAFT",
    },
    // Audience definition
    audience: {
      targetType: {
        type: String,
        enum: ["ALL_LEADS", "SEGMENT"],
        default: "ALL_LEADS",
      },
      filters: {
        leadStatus: { type: [String], default: [] },
        leadSource: { type: [String], default: [] },
        assignedTo: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      },
      contacts: [contactSchema],
      totalContacts: { type: Number, default: 0 },
    },
    // WhatsApp config
    whatsapp: {
      templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WhatsappTemplate",
        default: null,
      },
      templateSnapshot: {
        name: String,
        displayName: String,
        bodyText: String,
        headerText: String,
        footerText: String,
      },
      variableMapping: [
        {
          position: Number,
          fieldKey: {
            type: String,
            enum: [
              "name",
              "company",
              "phone",
              "location",
              "requirement",
              "budget",
              "custom",
            ],
          },
          customValue: String,
        },
      ],
      phoneNumberId: { type: String, default: "" },
    },
    // Denormalized metrics
    metrics: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    // Reference to the launched WhatsApp campaign execution
    whatsappCampaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappCampaign",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    launchedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

campaignSchema.index({ status: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ tenantId: 1 });

module.exports = mongoose.model("Campaign", campaignSchema);
