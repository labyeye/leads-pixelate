const mongoose = require("mongoose");

// Persisted position for "block round robin" lead assignment: N leads go to person 1, then the
// next N to person 2, and so on. One row per (tenant, integration key) — see utils/leadAssignment.js.
const assignmentCursorSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
    // e.g. "indiamart", "tradeindia", "justdial", "facebook:<pageId>", "googleAds:<customerId>".
    key: { type: String, required: true },
    // Snapshot of the assignee list and batch size the cursor was built for; a change to either
    // (someone added/removed, or the batch size edited) resets position and count to 0.
    assigneeIds: { type: [String], default: [] },
    batchSize: { type: Number, default: 1 },
    position: { type: Number, default: 0 }, // index into assigneeIds
    count: { type: Number, default: 0 }, // leads given to assigneeIds[position] so far in this batch
  },
  { timestamps: true },
);

assignmentCursorSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("AssignmentCursor", assignmentCursorSchema);
