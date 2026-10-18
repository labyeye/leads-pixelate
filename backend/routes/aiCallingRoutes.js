const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getSettings,
  updateSettings,
  testConnection,
  callLead,
  getLeadCallLogs,
} = require("../controllers/aiCallingController");

router.use(protect);

router.get("/settings", getSettings);
router.put("/settings", authorize("super_admin", "admin"), updateSettings);
router.post("/test-connection", authorize("super_admin", "admin"), testConnection);
router.post("/call-lead/:leadId", callLead);
router.get("/logs/:leadId", getLeadCallLogs);

module.exports = router;
