const mongoose = require("mongoose");

// One row per wish actually sent: the unique index makes the daily job safe to re-run (once per person, kind and year).
const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ref: { type: String, required: true }, // user id
    kind: { type: String, required: true }, // team_birthday | team_anniversary
    year: { type: Number, required: true },
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, ref: 1, kind: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("CelebrationLog", schema);
