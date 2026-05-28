const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Please select a product/service type"],
    },
    allocatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Please allocate this to a client"],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "On Hold", "Cancelled"],
      default: "Pending",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    timeline: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

serviceSchema.index({ status: 1 });
serviceSchema.index({ allocatedClient: 1 });

module.exports = mongoose.model("Service", serviceSchema);
