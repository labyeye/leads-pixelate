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
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ name: "text" });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

module.exports = mongoose.model("Product", productSchema);
