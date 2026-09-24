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
        // Block round robin: N leads to the first person in assigneeIds, then N to the next...
        assignBatchSize: { type: Number, default: 1 },
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
            // When set, overrides defaultAssigneeId with a block round robin across these people.
            assigneeIds: { type: [String], default: [] },
            assignBatchSize: { type: Number, default: 1 },
            webhookVerified: { type: Boolean, default: false },
            connectedAt: { type: Date, default: null },
          },
        ],
      },
      tradeindia: {
        enabled: { type: Boolean, default: false },
        userId: { type: String, default: "" },
        profileId: { type: String, default: "" },
        apiKey: { type: String, default: "" },
        // TradeIndia hands each seller a ready-made request URL from their
        // "My Inquiry API" panel rather than publishing one fixed endpoint
        // — we store whatever they were given instead of guessing it.
        apiUrl: { type: String, default: "" },
        lastSync: { type: Date, default: null },
        assigneeIds: { type: [String], default: [] },
        assignBatchSize: { type: Number, default: 1 },
      },
      googleAds: {
        enabled: { type: Boolean, default: false },
        refreshToken: { type: String, default: "" },
        oauthUserId: { type: String, default: "" },
        loginCustomerId: { type: String, default: "" },

        accounts: [
          {
            customerId: { type: String, required: true },
            customerName: { type: String, default: "" },
            selectedCampaignIds: { type: [String], default: [] },

            allowedStates: { type: [String], default: [] },
            defaultAssigneeId: { type: String, default: "" },
            assigneeIds: { type: [String], default: [] },
            assignBatchSize: { type: Number, default: 1 },
            webhookKey: { type: String, default: "" },
            connectedAt: { type: Date, default: null },
          },
        ],
      },
      linkedinAds: {
        enabled: { type: Boolean, default: false },
        refreshToken: { type: String, default: "" },
        oauthUserId: { type: String, default: "" },

        accounts: [
          {
            adAccountId: { type: String, required: true },
            adAccountName: { type: String, default: "" },
            selectedFormIds: { type: [String], default: [] },

            allowedStates: { type: [String], default: [] },
            defaultAssigneeId: { type: String, default: "" },
            assigneeIds: { type: [String], default: [] },
            assignBatchSize: { type: Number, default: 1 },
            webhookKey: { type: String, default: "" },
            connectedAt: { type: Date, default: null },
          },
        ],
      },
      justdial: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: "" },
        // Justdial has no self-serve pull API — their business support
        // team pushes leads to a webhook URL we hand them. This token
        // identifies the tenant on that inbound (unauthenticated) request.
        webhookToken: { type: String, default: "" },
        lastLeadAt: { type: Date, default: null },
        assigneeIds: { type: [String], default: [] },
        assignBatchSize: { type: Number, default: 1 },
      },
      whatsapp: {
        enabled: { type: Boolean, default: false },
        isConnected: { type: Boolean, default: false },
        wabaId: { type: String, default: "" },

        accessToken: { type: String, default: "" },
        webhookVerifyToken: { type: String, default: "" },
        lastSyncAt: { type: Date, default: null },
        // Per-event switches for automatic messages: { quotation_sent: { enabled, templateId }, ... }
        automations: { type: mongoose.Schema.Types.Mixed, default: {} },

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
    leadsTableColumns: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    razorpay: {
      customerId: { type: String, default: null },
      subscriptionId: { type: String, default: null },
    },
    // Social Autopilot add-on (services/autopilotService.js). Platform-owned
    // AI keys; tenant gets a one-time trial, then pays a flat monthly add-on.
    autopilot: {
      enabled: { type: Boolean, default: false },
      postsPerDay: { type: Number, default: 1, min: 1, max: 2 },
      tone: { type: String, default: "", maxlength: 200 },
      language: {
        type: String,
        enum: ["English", "Hindi", "Hinglish"],
        default: "English",
      },
      notes: { type: String, default: "", maxlength: 500 },
      reviewFirst: { type: Boolean, default: false },
      accountIds: { type: [String], default: [] },
      trialStartedAt: { type: Date, default: null },
      trialEndsAt: { type: Date, default: null },
      paidUntil: { type: Date, default: null },
      pendingOrderIds: { type: [String], default: [] },
      runningSince: { type: Date, default: null },
      lastRunAt: { type: Date, default: null },
      lastError: { type: String, default: "" },
      onboardedAt: { type: Date, default: null },
      // Which Autopilot plan the current paidUntil period was bought on ("" = never paid).
      plan: { type: String, enum: ["", "starter", "growth", "pro"], default: "" },
      // Owner's own words about the brand (typed and/or a PDF kept outside the public uploads dir).
      brandIntro: {
        text: { type: String, default: "", maxlength: 4000 },
        pdfName: { type: String, default: "", maxlength: 200 },
        hasPdf: { type: Boolean, default: false },
        updatedAt: { type: Date, default: null },
      },
      // When to post: weekdays (0 = Sunday) and HH:MM times, India time. Empty = Claude picks.
      schedule: {
        days: { type: [Number], default: [] },
        times: { type: [String], default: [] },
      },
      contentTypes: { type: [String], default: [] },
      // Reusable corrections the owner gave while reviewing posts.
      lessons: { type: [String], default: [] },
      // Set when the owner approves their first Autopilot post; from then on runs are hands-off.
      firstApprovedAt: { type: Date, default: null },
      progress: {
        stage: { type: String, default: "" }, // planning | writing | image | review | done | failed
        at: { type: Date, default: null },
      },
      analysis: {
        status: { type: String, enum: ["idle", "running", "done", "failed"], default: "idle" },
        stage: { type: String, default: "" }, // profile | posts | style | profile_built
        error: { type: String, default: "" },
        note: { type: String, default: "" },
        at: { type: Date, default: null },
        accountId: { type: String, default: "" },
      },
      brandProfile: {
        summary: { type: String, default: "", maxlength: 600 },
        industry: { type: String, default: "", maxlength: 100 },
        audience: { type: String, default: "", maxlength: 300 },
        tone: { type: String, default: "", maxlength: 200 },
        visualStyle: { type: String, default: "", maxlength: 300 },
        hashtagStyle: { type: String, default: "", maxlength: 200 },
        contentPillars: { type: [String], default: [] },
        topPerformingThemes: { type: [String], default: [] },
        doList: { type: [String], default: [] },
        avoidList: { type: [String], default: [] },
        palette: { type: [String], default: [] },
      },
      brandKit: {
        logos: {
          type: [{ id: String, name: { type: String, maxlength: 60 }, file: String, url: String }],
          default: [],
        },
        logoId: { type: String, default: "" },
        logoEnabled: { type: Boolean, default: true },
        logoMode: { type: String, enum: ["fixed", "auto"], default: "fixed" },
        logoPosition: {
          type: String,
          enum: ["bottom-right", "bottom-left", "top-right", "top-left"],
          default: "bottom-right",
        },
        colors: { type: [String], default: [] },
      },
    },
    apiKeys: [
      {
        name: { type: String, required: true },
        keyHash: { type: String, required: true },
        keyPrefix: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: null },
        active: { type: Boolean, default: true },
        // Owner-configured fields for the website form
        fields: [
          {
            key: { type: String, required: true }, // 'email','company','requirement','budget','location','product'
            label: { type: String, required: true }, // display label
            type: { type: String, default: "text" }, // 'text','textarea','email','tel'
            required: { type: Boolean, default: false },
          },
        ],
        // Block round robin: N leads through this key to the first person, then N to the next...
        assigneeIds: { type: [String], default: [] },
        assignBatchSize: { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);
