const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "sales_executive",
        "service_manager",
        "accountant",
      ],
      default: "sales_executive",
    },
    phone: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    employeeId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    receiveAutoAssignedLeads: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    refreshTokenExpires: {
      type: Date,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    // Per-rep Gmail connection for in-CRM email (send + two-way sync via
    // polling). Tokens are select:false like the other secrets on this
    // model — only pulled in explicitly by the email OAuth/send flow.
    emailIntegration: {
      gmail: {
        connected: { type: Boolean, default: false },
        emailAddress: { type: String, default: "" },
        accessToken: { type: String, default: "", select: false },
        refreshToken: { type: String, default: "", select: false },
        tokenExpiresAt: { type: Date, default: null, select: false },
        historyId: { type: String, default: "" },
        lastSyncedAt: { type: Date, default: null },
        connectedAt: { type: Date, default: null },
      },
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
