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
    designation: {
      type: String,
      trim: true,
    },
    dateOfJoining: {
      type: Date,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern", ""],
      default: "",
    },
    address: {
      line1: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      pincode: { type: String, trim: true, default: "" },
    },
    emergencyContact: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    // Payroll info — sensitive, hidden by default like the other secrets on
    // this model; the user edit screen explicitly selects it back in.
    bankDetails: {
      accountName: { type: String, trim: true, default: "", select: false },
      accountNumber: { type: String, trim: true, default: "", select: false },
      ifsc: { type: String, trim: true, default: "", select: false },
      bankName: { type: String, trim: true, default: "", select: false },
    },
    // HR/ID documents (resume, ID proof, offer letter, etc). Uploaded via
    // the generic /api/upload endpoint, referenced here by URL.
    documents: [
      {
        name: { type: String, trim: true },
        type: {
          type: String,
          enum: [
            "resume",
            "id_proof",
            "address_proof",
            "offer_letter",
            "other",
          ],
          default: "other",
        },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
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
    resetOtpHash: {
      type: String,
      select: false,
    },
    resetOtpExpires: {
      type: Date,
      select: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneOtpHash: {
      type: String,
      select: false,
    },
    phoneOtpExpires: {
      type: Date,
      select: false,
    },
    totpSecret: {
      type: String,
      select: false,
    },
    totpEnabled: {
      type: Boolean,
      default: false,
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
