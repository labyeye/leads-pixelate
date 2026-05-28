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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Setting", settingSchema);
