const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      default: "Agency Flow CRM",
    },
    companyAddress: {
      type: String,
      default: "",
    },
    companyPhone: {
      type: String,
      default: "",
    },
    companyEmail: {
      type: String,
      default: "",
    },
    companyGST: {
      type: String,
      default: "",
    },
    companyPAN: {
      type: String,
      default: "",
    },
    companyState: {
      type: String,
      default: "",
    },
    companyStateCode: {
      type: String,
      default: "",
    },
    companyWebsite: {
      type: String,
      default: "",
    },
    bankAccountName: {
      type: String,
      default: "",
    },
    bankAccountNumber: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    bankIFSC: {
      type: String,
      default: "",
    },
    bankBranch: {
      type: String,
      default: "",
    },
    bankAccountType: {
      type: String,
      default: "Current",
    },
    quotationTerms: {
      type: [String],
      default: [
        "Payment: 100% advance along with purchase order.",
        "Delivery: Within 2-3 weeks from the date of receipt of PO.",
        "Validity: This quotation is valid for 15 days.",
        "Taxes: GST as applicable.",
      ],
    },
    quotationTitle: {
      type: String,
      default: "PROFORMA INVOICE",
    },
    quotationFooter: {
      type: String,
      default: "Thank you for your business!",
    },
    logoUrl: {
      type: String,
      default: "",
    },

    // Which WhatsApp sender to use for automatic notifications (e.g. quotation
    // "Sent"): the shared Nest Leads platform number, or this tenant's own
    // connected WhatsApp Business number.
    quotationWhatsappSource: {
      type: String,
      enum: ["platform", "tenant"],
      default: "tenant",
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },

    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Tenant-customized lead status labels/colors. Keyed by the fixed status
    // value stored on Lead.status — see backend/utils/leadStatuses.js.
    leadStatusLabels: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Tenant-defined extra pipeline stages, slotted into one of the
    // extendable categories (New Lead / Discussion / Quotation) — see
    // backend/utils/leadStatuses.js for how these merge with the fixed set.
    customLeadStatuses: {
      type: [
        {
          value: { type: String, required: true },
          category: { type: String, required: true },
          label: { type: String, required: true },
          colorKey: { type: String, default: "slate" },
          order: { type: Number, default: 0 },
          _id: false,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Setting", settingSchema);
