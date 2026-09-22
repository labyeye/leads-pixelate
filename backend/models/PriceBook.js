const mongoose = require("mongoose");

// A named list of special prices (wholesale, festival, one big client...). Each row overrides the
// product's normal price.
const priceBookSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Please name the price book"], trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 300 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    items: {
      type: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
          name: { type: String, default: "" }, // kept so the book still reads well if the product is renamed or removed
          price: { type: Number, required: true, min: 0 },
          _id: false,
        },
      ],
      default: [],
    },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  },
  { timestamps: true },
);

priceBookSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model("PriceBook", priceBookSchema);
