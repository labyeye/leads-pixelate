const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getSettings,
  updateSettings,
  testConnection,
  callLead,
  getLeadCallLogs,
} = require("../controllers/aiCallingController");

router.use(protect);

router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.post("/test-connection", testConnection);
router.post("/call-lead/:leadId", callLead);
router.get("/logs/:leadId", getLeadCallLogs);

module.exports = router;
