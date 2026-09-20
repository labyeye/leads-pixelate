// One Social Autopilot campaign: its own accounts, brand, logos, schedule, references and
// competitors. Field names deliberately match the old Tenant.autopilot sub-fields so
// services/autopilotService.js reads a campaign exactly like it used to read the tenant's
// setup. Entitlement (trial / paid plan) stays on Tenant.autopilot.
const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    enabled: { type: Boolean, default: false },
    // Explicit accounts this campaign posts to; an account belongs to at most one campaign.
    accountIds: { type: [String], default: [] },
    postsPerDay: { type: Number, default: 1, min: 1, max: 2 },
    tone: { type: String, default: "", maxlength: 200 },
    language: { type: String, enum: ["English", "Hindi", "Hinglish"], default: "English" },
    notes: { type: String, default: "", maxlength: 500 },
    reviewFirst: { type: Boolean, default: false },
    runningSince: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    onboardedAt: { type: Date, default: null },
    // Set when the owner approves this campaign's first post.
    firstApprovedAt: { type: Date, default: null },

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
    // What each post should be: format, goal, what to include, the call to action and free-form
    // instructions. Video is not generated yet, so only image / carousel are accepted.
    brief: {
      format: { type: String, enum: ["image", "carousel"], default: "image" },
      slides: { type: Number, default: 5, min: 2, max: 8 },
      goal: { type: String, default: "", maxlength: 200 },
      cta: {
        type: { type: String, default: "none" },
        text: { type: String, default: "", maxlength: 80 },
        link: { type: String, default: "", maxlength: 300 },
        phone: { type: String, default: "", maxlength: 20 },
      },
      include: { type: [String], default: [] },
      instructions: { type: String, default: "", maxlength: 1500 },
    },
    // How long the campaign runs. days 0 = until paused. startsOn / endsOn are set when it starts.
    timeline: {
      days: { type: Number, default: 0, min: 0, max: 90 },
      startsOn: { type: Date, default: null },
      endsOn: { type: Date, default: null },
    },
    // Reusable corrections the owner gave while reviewing this campaign's posts.
    lessons: { type: [String], default: [] },
    progress: {
      stage: { type: String, default: "" }, // planning | creating | review | done | failed
      at: { type: Date, default: null },
    },
    analysis: {
      status: { type: String, enum: ["idle", "running", "done", "failed"], default: "idle" },
      stage: { type: String, default: "" }, // intro | profile | posts | references | competitors | style | profile_built
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
      // What the competitors do and where this brand can stand apart (from the competitor scan).
      competitive: {
        positioning: { type: String, default: "", maxlength: 400 },
        whatTheyDoWell: { type: [String], default: [] },
        gapsToExploit: { type: [String], default: [] },
      },
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

    // Instagram accounts to learn from (Meta Business Discovery) plus the owner's own notes.
    competitors: {
      type: [
        {
          id: String,
          username: { type: String, default: "", maxlength: 60 },
          notes: { type: String, default: "", maxlength: 500 },
          followers: { type: Number, default: null },
          summary: { type: String, default: "", maxlength: 300 },
          error: { type: String, default: "", maxlength: 200 },
          readAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    // Moodboard images (stored resized, under uploads/autopilot/<tenant>/brand/<campaign>/refs/).
    references: {
      type: [{ id: String, file: String, url: String, note: { type: String, default: "", maxlength: 200 } }],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AutopilotCampaign", campaignSchema);
