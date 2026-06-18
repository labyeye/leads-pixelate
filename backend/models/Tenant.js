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
      enum: [
        "trial",
        "starter",
        "growth",
        "professional",
        "business",
        "enterprise",
        "pro",
      ],
      default: "trial",
    },
    planExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    status: {
      type: String,
      enum: ["active", "suspended", "cancelled"],
      default: "active",
    },
    limits: {
      leadsPerMonth: { type: Number, default: 100 },
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
        assigneeIds: { type: [String], default: [] },
      },
      facebook: {
        enabled: { type: Boolean, default: false },
        userAccessToken: { type: String, default: "" },
        oauthUserId: { type: String, default: "" },

        pages: [
          {
            pageId: { type: String, required: true },
            pageName: { type: String, default: "" },
            accessToken: { type: String, default: "" },
            selectedFormIds: { type: [String], default: [] },

            allowedStates: { type: [String], default: [] },
            defaultAssigneeId: { type: String, default: "" },
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
      whatsapp: {
        enabled: { type: Boolean, default: false },
        isConnected: { type: Boolean, default: false },
        wabaId: { type: String, default: "" },

        accessToken: { type: String, default: "" },
        webhookVerifyToken: { type: String, default: "" },
        lastSyncAt: { type: Date, default: null },

        phoneNumbers: [
          {
            phoneNumberId: { type: String, required: true },
            label: { type: String, default: "" },
            businessName: { type: String, default: "" },
            phoneNumber: { type: String, default: "" },
            approvedTemplateCount: { type: Number, default: 0 },
            addedAt: { type: Date, default: Date.now },
          },
        ],
      },
    },
    razorpay: {
      customerId: { type: String, default: null },
      subscriptionId: { type: String, default: null },
    },
    apiKeys: [
      {
        name: { type: String, required: true },
        keyHash: { type: String, required: true },
        keyPrefix: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: null },
        active: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);
