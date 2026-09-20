// Offline check for recording -> transcript -> Gemini -> lead update. No network, Twilio, ElevenLabs, Gemini or database.
// Run: node scripts/check-call-analysis.js
const assert = require("assert");
const mongoose = require("mongoose");
const CallLog = require("../models/CallLog");
const Lead = require("../models/Lead");
const Setting = require("../models/Setting");
const svc = require("../services/callAnalysisService");

const oid = () => new mongoose.Types.ObjectId();
const REC = "https://api.twilio.com/2010/Recordings/RE1";

// ---- pure helpers -----------------------------------------------------------
const w = (text, start, type = "word") => ({ text, start, type });
const turns = svc.turnsFrom({
  transcripts: [
    { channel_index: 0, words: [w("Hello", 0), w(" ", 0.4, "spacing"), w("sir", 0.5), w("quote", 6)] },
    { channel_index: 1, words: [w("Haan", 2), w("boliye", 2.5)] },
  ],
});
assert.deepStrictEqual(turns, [
  { role: "agent", message: "Hello sir" },
  { role: "user", message: "Haan boliye" },
  { role: "agent", message: "quote" },
], "channels merged by time, spacing tokens dropped, same-side words joined");
assert.deepStrictEqual(svc.turnsFrom({ words: [w("hi", 0)] }), [{ role: "agent", message: "hi" }], "single-channel response still parses");

const maps = { "PENDING CONTACT": ["1", "DISCUSSION", "DROP"], DISCUSSION: ["DISCUSSION", "QUOTATION", "VISIT SCHEDULED", "DROP"] };
assert.deepStrictEqual(svc.nextStatuses("PENDING CONTACT", maps), ["1", "DISCUSSION"], "DROP is protected, never auto-picked");
assert.deepStrictEqual(svc.nextStatuses("DISCUSSION", maps), ["QUOTATION"], "self and protected excluded");

// ---- full flow with fakes -----------------------------------------------------
async function main() {
  Object.assign(process.env, { ELEVENLABS_API_KEY: "e", GEMINI_API_KEY: "g", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_PHONE_NUMBER: "+1500" });

  const log = { _id: oid(), leadId: oid(), initiatedBy: oid(), analysisState: "" };
  CallLog.findOneAndUpdate = async (f, u) => (f._id === log._id && f.analysisState.$in.includes(log.analysisState) ? Object.assign(log, u.$set) : null);
  CallLog.updateOne = async (_f, u) => Object.assign(log, u.$set);
  const lead = { _id: oid(), tenantId: oid(), name: "Ravi", status: "PENDING CONTACT", remarks: "old", statusHistory: [], saves: 0, save: async function () { this.saves++; } };
  Lead.findById = async () => lead;
  Setting.findOne = () => ({ select: () => ({ lean: async () => ({}) }) });

  let gemReply = { summary: "Wants 3 units, budget 5L.", sentiment: "Positive", status: "DISCUSSION", followUpInDays: 3, budget: "5L" };
  const hits = [];
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    url = String(url);
    hits.push(url);
    if (url.startsWith("https://api.twilio.com") || url.includes("Recordings")) return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    if (url.includes("elevenlabs")) {
      return { ok: true, json: async () => ({ transcripts: [{ channel_index: 0, words: [w("Hi", 0)] }, { channel_index: 1, words: [w("Haan", 1)] }] }) };
    }
    return { ok: true, json: async () => ({ steps: [{ type: "model_output", content: [{ type: "text", text: "```json\n" + JSON.stringify(gemReply) + "\n```" }] }] }) };
  };

  try {
    await svc.processRecording(log._id, "https://api.twilio.com/2010/Recordings/RE1", 4);
    assert.strictEqual(log.analysisState, "skipped", "very short calls are skipped");
    assert.ok(!hits.length, "…without spending on ElevenLabs / Gemini");

    log.analysisState = "";
    await svc.processRecording(log._id, "https://api.twilio.com/2010/Recordings/RE1", 90);
    assert.strictEqual(log.analysisState, "done");
    assert.strictEqual(lead.status, "DISCUSSION", "status moved");
    assert.deepStrictEqual(lead.stagePath, ["PENDING CONTACT", "DISCUSSION"]);
    assert.ok(lead.remarks.startsWith("old\n\n") && lead.remarks.includes("Wants 3 units"), "remark appended, old kept");
    assert.strictEqual(lead.statusHistory.length, 1);
    assert.strictEqual(String(lead.statusHistory[0].changedBy), String(log.initiatedBy));
    assert.ok(lead.followUpDate > new Date(Date.now() + 2 * 86400000), "follow-up date from followUpInDays");
    assert.strictEqual(lead.budget, "5L");
    assert.strictEqual(log.statusApplied, true);
    assert.strictEqual(log.sentiment, "Positive");
    assert.strictEqual(log.transcript.length, 2);

    // a retried webhook must not run twice
    const before = hits.length;
    await svc.processRecording(log._id, "x", 90);
    assert.strictEqual(hits.length, before, "second delivery is a no-op");

    // Gemini invents a status, or one that isn't reachable -> stays as a suggestion at most, remark still saved
    log.analysisState = "";
    lead.status = "PENDING CONTACT";
    lead.stagePath = undefined;
    lead.statusHistory = [];
    gemReply = { summary: "Rang, asked to call later.", sentiment: "Neutral", status: "QUOTATION", followUpInDays: 2 };
    await svc.processRecording(log._id, REC, 90);
    assert.strictEqual(lead.status, "PENDING CONTACT", "unreachable status not applied");
    assert.strictEqual(log.statusApplied, false);
    assert.strictEqual(lead.statusHistory.length, 0);

    // stage that needs a follow-up date but Gemini gave none -> not applied
    log.analysisState = "";
    gemReply = { summary: "Interested.", sentiment: "Positive", status: "DISCUSSION" };
    await svc.processRecording(log._id, REC, 90);
    assert.strictEqual(lead.status, "PENDING CONTACT", "no follow-up date, no status change");

    // Gemini/ElevenLabs down -> marked failed (retryable), lead untouched
    log.analysisState = "";
    const saves = lead.saves;
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ detail: "boom" }), arrayBuffer: async () => new ArrayBuffer(1) });
    await svc.processRecording(log._id, REC, 90);
    assert.strictEqual(log.analysisState, "failed");
    assert.strictEqual(lead.saves, saves);

    // keys missing -> skipped quietly
    log.analysisState = "";
    delete process.env.GEMINI_API_KEY;
    await svc.processRecording(log._id, REC, 90);
    assert.strictEqual(log.analysisState, "skipped");
  } finally {
    global.fetch = realFetch;
  }
  console.log("check-call-analysis: all checks passed");
}

main().catch((err) => {
  console.error("check-call-analysis FAILED:", err);
  process.exit(1);
});
