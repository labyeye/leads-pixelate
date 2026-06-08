const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add the product/service name"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: ["Machines", "Services", "Raw Materials", "Spare Parts"],
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      min: [0, "Price cannot be negative"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    hsnCode: {
      type: String,
      default: "",
    },
    description: {
      type: String,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ name: "text" });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ tenantId: 1 });

module.exports = mongoose.model("Product", productSchema);
