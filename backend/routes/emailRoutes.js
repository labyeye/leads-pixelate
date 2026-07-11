const express = require("express");
const router = express.Router();
const {
  getAuthUrl,
  gmailCallback,
  disconnectGmail,
  getGmailStatus,
  getLeadThread,
  sendLeadEmail,
} = require("../controllers/emailController");
const { protect } = require("../middleware/auth");

// Public — Google redirects the browser here directly, no JWT available.
router.get("/gmail/callback", gmailCallback);

router.use(protect);
router.get("/gmail/auth-url", getAuthUrl);
router.post("/gmail/disconnect", disconnectGmail);
router.get("/gmail/status", getGmailStatus);

router.get("/leads/:leadId", getLeadThread);
router.post("/leads/:leadId/send", sendLeadEmail);

module.exports = router;
