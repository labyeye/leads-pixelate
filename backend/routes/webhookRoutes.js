const express = require("express");
const router = express.Router();
const { handleElevenLabsWebhook } = require("../controllers/aiCallingController");

// Public webhook route for ElevenLabs post-call analysis and transcripts
router.post("/elevenlabs", handleElevenLabsWebhook);

module.exports = router;
