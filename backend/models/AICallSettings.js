const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuestionSchema = new Schema({
  id: { type: String, required: true },
  questionText: { type: String, required: true },
  fieldKey: { type: String, default: "" }, // e.g. 'budget', 'interestedProducts', 'requirement'
  required: { type: Boolean, default: true },
  // Answer choices the assistant offers ("Under 1 lakh", "1-5 lakh"...). Empty = open-ended answer.
  options: { type: [String], default: [] },
});

const AICallSettingsSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    elevenLabsApiKey: {
      type: String,
      default: "",
    },
    agentId: {
      type: String,
      default: "",
    },
    phoneProvider: {
      type: String,
      enum: ["elevenlabs", "twilio", "exotel"],
      default: "elevenlabs",
    },
    twilioAccountSid: {
      type: String,
      default: "",
    },
    twilioAuthToken: {
      type: String,
      default: "",
    },
    twilioPhoneNumber: {
      type: String,
      default: "",
    },
    callDelayMinutes: {
      type: Number,
      default: 1,
    },
    callingHoursStart: {
      type: String,
      default: "09:00",
    },
    callingHoursEnd: {
      type: String,
      default: "19:00",
    },
    enabledDays: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    agentGreeting: {
      type: String,
      default:
        "Hello {lead_name}, I am an automated representative calling from {company_name}. I saw your recent inquiry and wanted to quickly confirm your requirements!",
    },
    agentPersona: {
      type: String,
      default:
        "You are a polite, helpful, and professional sales qualification AI assistant. Your goal is to greet the client by name and ask the customized qualification questions clearly.",
    },
    questions: {
      type: [QuestionSchema],
      default: [
        {
          id: "q1",
          questionText: "What product or service are you primarily interested in?",
          fieldKey: "interestedProducts",
          required: true,
        },
        {
          id: "q2",
          questionText: "What is your estimated budget for this requirement?",
          fieldKey: "budget",
          required: true,
        },
        {
          id: "q3",
          questionText: "How soon are you planning to make a purchase decision?",
          fieldKey: "requirement",
          required: true,
        },
      ],
    },
    autoStatusMapping: {
      qualifiedStatus: { type: String, default: "QUALIFIED" },
      unqualifiedStatus: { type: String, default: "LOST" },
      noAnswerStatus: { type: String, default: "ATTEMPTED CONTACT" },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AICallSettings", AICallSettingsSchema);
