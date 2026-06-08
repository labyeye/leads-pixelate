const mongoose = require("mongoose");

const whatsappTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9_]+$/,
        "Template name can only contain lowercase letters, numbers, and underscores",
      ],
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["MARKETING", "UTILITY", "AUTHENTICATION"],
      default: "MARKETING",
    },
    language: {
      type: String,
      default: "en",
    },

    headerType: {
      type: String,
      enum: ["NONE", "TEXT", "DOCUMENT", "IMAGE"],
      default: "NONE",
    },
    headerText: {
      type: String,
      default: "",
      trim: true,
    },

    headerMediaId: {
      type: String,
      default: "",
    },
    headerMediaName: {
      type: String,
      default: "",
    },
    bodyText: {
      type: String,
      required: [true, "Body text is required"],
      trim: true,
    },
    footerText: {
      type: String,
      default: "",
      trim: true,
    },
    buttons: [
      {
        type: {
          type: String,
          enum: ["QUICK_REPLY", "URL", "PHONE_NUMBER"],
        },
        text: String,
        url: String,
        phoneNumber: String,
      },
    ],

    variableCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      default: "DRAFT",
    },

    metaTemplateName: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
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

whatsappTemplateSchema.index({ name: 1 });
whatsappTemplateSchema.index({ status: 1 });

module.exports = mongoose.model("WhatsappTemplate", whatsappTemplateSchema);
