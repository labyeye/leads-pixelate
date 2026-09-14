const mongoose = require("mongoose");

// The four tiers below are what actually gates permissions across the app
// (route authorize() checks, nav visibility). A Role is just a named,
// editable label a tenant can assign that maps to one of these tiers —
// super_admin is intentionally excluded, it's a fixed system role.
const PERMISSION_TIERS = [
  "admin",
  "sales_executive",
  "service_manager",
  "accountant",
];

const roleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    tier: { type: String, enum: PERMISSION_TIERS, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);
module.exports.PERMISSION_TIERS = PERMISSION_TIERS;
