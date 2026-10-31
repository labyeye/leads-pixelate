const mongoose = require("mongoose");

// An automatic WhatsApp funnel: when the trigger happens to a lead, each step sends an approved
// template after its delay. Run by services/funnelService.js.
const stepSchema = new mongoose.Schema(
  {
    delayMinutes: { type: Number, default: 0, min: 0, max: 43200 }, // after the previous step (or the trigger)
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsappTemplate", required: true },
    variableMapping: [
      {
        position: Number,
        fieldKey: String,
        customValue: { type: String, default: "" },
        _id: false,
      },
    ],
    onlyIfStatus: { type: String, default: "" }, // send only if the lead is still in this status ("" = any)
  },
  { _id: true },
);

const funnelSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    enabled: { type: Boolean, default: false },
    trigger: {
      event: { type: String, enum: ["lead_created", "status_changed", "schedule", "manual"], required: true },
      status: { type: String, default: "" }, // status_changed: this status ("" = any change)
      sources: { type: [String], default: [] }, // only leads from these sources ([] = all)
    },
    // Who gets the messages: the leads that trigger it, or the team (e.g. a performance report).
    audience: { type: String, enum: ["leads", "staff"], default: "leads" },
    staff: {
      target: { type: String, enum: ["all", "roles", "selected"], default: "all" },
      roles: { type: [String], default: [] },
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    // trigger.event "schedule": when it runs (server time, IST).
    schedule: {
      frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "daily" },
      hour: { type: Number, default: 9, min: 0, max: 23 },
      minute: { type: Number, default: 0, min: 0, max: 59 },
      weekday: { type: Number, default: 1, min: 0, max: 6 }, // 0 = Sunday
      dayOfMonth: { type: Number, default: 1, min: 1, max: 28 },
    },
    lastRunKey: { type: String, default: "" },
    steps: { type: [stepSchema], validate: (v) => v.length > 0 && v.length <= 8 },
    stopStatuses: { type: [String], default: ["WON", "DROP"] }, // pending messages stop when the lead reaches one
    phoneNumberId: { type: String, default: "" },
    stats: {
      enrolled: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MessageFunnel", funnelSchema);
