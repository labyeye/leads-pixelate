const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    from: { type: String, enum: ["hrms", "crm"], required: true },
    senderName: { type: String, default: "" },
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    raisedBy: {
      type: String,
      enum: ["hrms", "crm"],
      required: true,
    },
    companyName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    replies: [replySchema],
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.pre("save", async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model("SupportTicket").countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
