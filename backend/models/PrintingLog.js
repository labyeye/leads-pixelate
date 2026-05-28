const mongoose = require("mongoose");

const printingLogSchema = new mongoose.Schema(
  {
    printingId: {
      type: String,
      unique: true,
    },
    reelNo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: [true, "Reel reference is required"],
    },
    company: { type: String, required: true },
    reelWeight: { type: Number, required: true },
    reelSize: { type: String, required: true },
    reelNoStr: { type: String },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FactoryProduct",
      required: [true, "Product is required"],
    },
    printDate: {
      type: Date,
      default: Date.now,
    },
    printedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

printingLogSchema.pre("save", async function (next) {
  if (this.printingId) return next();

  try {
    const last = await this.constructor
      .findOne({}, { printingId: 1 })
      .sort({ printingId: -1 })
      .lean();

    let nextNum = 1;
    if (last && last.printingId) {
      const parts = last.printingId.split("-");
      nextNum = parseInt(parts[1], 10) + 1;
    }

    this.printingId = `PR-${String(nextNum).padStart(3, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("PrintingLog", printingLogSchema);
