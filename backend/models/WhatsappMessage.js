const mongoose = require("mongoose");

const whatsappMessageSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    phone: { type: String, required: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    text: { type: String, default: "" },
    waMessageId: { type: String },
    status: {
      type: String,
      enum: ["SENT", "DELIVERED", "READ", "FAILED"],
      default: "SENT",
    },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

whatsappMessageSchema.index({ tenantId: 1, phone: 1, timestamp: 1 });
whatsappMessageSchema.index({ waMessageId: 1 }, { sparse: true });

module.exports = mongoose.model("WhatsappMessage", whatsappMessageSchema);
