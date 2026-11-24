const mongoose = require("mongoose");

// One row of the content-planner sheet: an idea with a date/time, references and an
// approval trail. Once approved it is turned into a real SocialPost via "schedule".
const socialPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },
    brief: { type: String, default: "", trim: true },
    platforms: {
      type: [String],
      enum: ["facebook", "instagram", "linkedin"],
      default: [],
    },
    postType: {
      type: String,
      enum: ["image", "carousel", "reel"],
      default: "image",
    },
    plannedDate: { type: Date, required: [true, "Date is required"] },
    plannedTime: { type: String, default: "10:00" }, // HH:mm, local to the planner
    references: {
      type: [
        {
          _id: false,
          label: { type: String, default: "", trim: true },
          url: { type: String, default: "", trim: true },
        },
      ],
      default: [],
    },
    referenceNotes: { type: String, default: "" },
    caption: { type: String, default: "" },
    hashtags: { type: [String], default: [] },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["PLANNED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SCHEDULED"],
      default: "PLANNED",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvalNote: { type: String, default: "" },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialPost", default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  },
  { timestamps: true },
);

socialPlanSchema.index({ tenantId: 1, plannedDate: 1 });
socialPlanSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model("SocialPlan", socialPlanSchema);
