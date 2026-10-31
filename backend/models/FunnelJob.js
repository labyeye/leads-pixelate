const mongoose = require("mongoose");

// One scheduled message of one lead in one funnel.
const jobSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    funnelId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageFunnel", required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" }, // set for lead funnels
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // set for staff funnels
    audience: { type: String, enum: ["leads", "staff"], default: "leads" },
    recipientName: { type: String, default: "" },
    recipientPhone: { type: String, default: "" },
    stepIndex: { type: Number, required: true },
    runAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "cancelled", "skipped"],
      default: "pending",
    },
    note: { type: String, default: "" }, // why it failed / was cancelled / skipped
    startedAt: { type: Date },
    sentAt: { type: Date },
    waMessageId: { type: String, default: "" },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ funnelId: 1, leadId: 1 });
jobSchema.index({ tenantId: 1, createdAt: -1 });
jobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("FunnelJob", jobSchema);
