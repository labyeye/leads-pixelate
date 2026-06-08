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
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    // Permissions matrix: { "Leads": { "sales_executive": { create: true, read: true, update: true, delete: false }, ... }, ... }
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Setting", settingSchema);
