const mongoose = require("mongoose");
const softDelete = require("./plugins/softDelete");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add the product/service name"],
      trim: true,
      maxlength: [120, "Name is too long (max 120 characters)"],
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      trim: true,
      maxlength: [40, "Category is too long (max 40 characters)"],
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      min: [0, "Price cannot be negative"],
      max: [99999999, "Price is too large"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    hsnCode: {
      type: String,
      default: "",
      maxlength: [10, "HSN/SAC code is too long (max 10 characters)"],
    },
    description: {
      type: String,
      maxlength: [500, "Description is too long (max 500 characters)"],
    },
    photos: {
      type: [{ type: String, maxlength: 500 }],
      default: [],
      validate: { validator: (v) => v.length <= 5, message: "You can add up to 5 photos" },
    },
    photoUrl: { // first photo, kept for the table thumbnail
      type: String,
      default: "",
      maxlength: [500, "Photo URL is too long"],
    },
    sku: {
      type: String,
      trim: true,
      default: "",
      maxlength: [40, "SKU is too long (max 40 characters)"],
    },
    unit: {
      type: String,
      trim: true,
      default: "pcs",
      maxlength: [20, "Unit is too long (max 20 characters)"],
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
      max: [9999999, "Stock quantity is too large"],
    },
    taxRate: {
      type: Number,
      default: 18,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100"],
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

productSchema.plugin(softDelete);
module.exports = mongoose.model("Product", productSchema);
