const mongoose = require("mongoose");

// A phone that can receive pushes for one user. The token moves to whoever signs in on the phone last.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  fcmToken: { type: String, required: true, unique: true },
  platform: { type: String, default: "unknown" },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ user: 1 });

module.exports = mongoose.model("PushDevice", schema);
