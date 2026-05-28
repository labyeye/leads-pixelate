const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    leadName: String,
    leadCompany: String,
    phone: String,
    status: {
      type: String,
      enum: ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"],
      default: "PENDING",
    },
    waMessageId: {
      type: String,
      default: "",
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedReason: {
      type: String,
      default: "",
    },
  },
  { _id: true },
);

const replySchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    leadName: String,
    phone: String,
    messageText: String,
    messageType: {
      type: String,
      default: "text",
    },
    waMessageId: String,
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const whatsappCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsappTemplate",
      required: true,
    },
    templateSnapshot: {
      name: String,
      displayName: String,
      bodyText: String,
      headerText: String,
      footerText: String,
    },
    // Variable mapping: [{ position: 1, fieldKey: "name" }, { position: 2, fieldKey: "company" }]
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
    messages: [messageSchema],
    replies: [replySchema],
    status: {
      type: String,
      enum: ["DRAFT", "SENDING", "COMPLETED", "PARTIAL", "FAILED"],
      default: "DRAFT",
    },
    // Denormalized counters for quick access
    totalCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    repliedCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sentAt: Date,
  },
  { timestamps: true },
);

whatsappCampaignSchema.index({ status: 1 });
whatsappCampaignSchema.index({ createdAt: -1 });
whatsappCampaignSchema.index({ "messages.waMessageId": 1 });
whatsappCampaignSchema.index({ "replies.phone": 1 });

module.exports = mongoose.model("WhatsappCampaign", whatsappCampaignSchema);
