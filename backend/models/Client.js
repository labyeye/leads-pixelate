const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add the client name"],
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Please add the company name"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    address: {
      type: String,
      required: [true, "Please add an address"],
    },
    businessType: {
      type: String,
      required: [true, "Please specify the business type"],
    },
    gst: {
      type: String,
      trim: true,
    },
    services: [
      {
        type: String,
      },
    ],
    projectStatus: {
      type: String,
      enum: ["Active", "Completed", "On Hold"],
      default: "Active",
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Overdue"],
      default: "Pending",
    },
    notes: {
      type: String,
    },
    convertedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
  },
  {
    timestamps: true,
  },
);

clientSchema.index({ name: "text", company: "text", email: "text" });
clientSchema.index({ projectStatus: 1 });
clientSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("Client", clientSchema);
