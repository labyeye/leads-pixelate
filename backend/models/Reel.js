const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    reelNo: {
      type: String,
      unique: true,
    },
    company: {
      type: String,
      required: [true, "Company is required"],
      enum: ["Silver Tone", "ITC", "Spectra 160", "Spectra 180"],
    },
    reelWeight: {
      type: Number,
      required: [true, "Reel weight is required"],
    },
    reelSize: {
      type: String,
      required: [true, "Reel size is required"],
      trim: true,
    },
    entryDate: {
      type: Date,
      default: Date.now,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

reelSchema.pre("save", async function (next) {
  if (this.reelNo) return next();
  try {
    const last = await this.constructor
      .findOne({}, { reelNo: 1 })
      .sort({ reelNo: -1 })
      .lean();

    let nextNum = 1;
    if (last && last.reelNo) {
      const parts = last.reelNo.split("-");
      nextNum = parseInt(parts[1], 10) + 1;
    }

    this.reelNo = `SKY-${String(nextNum).padStart(3, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Reel", reelSchema);
