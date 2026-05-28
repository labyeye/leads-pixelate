const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organisation name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      enum: ["trial", "starter", "growth", "enterprise"],
      default: "trial",
    },
    planExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    },
    status: {
      type: String,
      enum: ["active", "suspended", "cancelled"],
      default: "active",
    },
    limits: {
      leadsPerMonth: { type: Number, default: 100 }, // trial limit
      teamMembers: { type: Number, default: 2 },
    },
    usage: {
      leadsThisMonth: { type: Number, default: 0 },
      resetAt: {
        type: Date,
        default: () => {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() + 1);
          return d;
        },
      },
    },
    integrations: {
      indiamart: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: "" },
        lastSync: { type: Date, default: null },
      },
      facebook: {
        enabled: { type: Boolean, default: false },
        userAccessToken: { type: String, default: "" },
        oauthUserId: { type: String, default: "" },
        // Multi-page support — each connected page stored separately
        pages: [
          {
            pageId: { type: String, required: true },
            pageName: { type: String, default: "" },
            accessToken: { type: String, default: "" },
            selectedFormIds: { type: [String], default: [] },
            webhookVerified: { type: Boolean, default: false },
            connectedAt: { type: Date, default: null },
          },
        ],
      },
      tradeindia: {
        enabled: { type: Boolean, default: false },
        userId: { type: String, default: "" },
        apiKey: { type: String, default: "" },
      },
      justdial: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: "" },
      },
    },
    razorpay: {
      customerId: { type: String, default: null },
      subscriptionId: { type: String, default: null },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);
