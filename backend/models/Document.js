const mongoose = require("mongoose");

// Document Vault: brochures, catalogues etc. a tenant keeps ready to send to clients.
// The file lives on local disk under uploads/documents/<tenant>/ (served by /uploads).
const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: ["brochure", "catalogue", "price_list", "presentation", "other"],
      default: "other",
    },
    fileName: { type: String, required: true }, // original name, shown to the client on WhatsApp
    filePath: { type: String, required: true }, // relative to uploads/
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  },
  { timestamps: true },
);

documentSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);
