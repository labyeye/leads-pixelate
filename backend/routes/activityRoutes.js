const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getActivityLogs,
  getActivityStats,
} = require("../controllers/activityController");

router.use(protect, authorize("super_admin"));

router.get("/", getActivityLogs);
router.get("/stats", getActivityStats);

module.exports = router;
