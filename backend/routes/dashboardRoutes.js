const express = require("express");
const router = express.Router();
const { getDashboardStats, getLiveStats, getMyPace } = require("../controllers/dashboardController");
const { getTargets, getInsights } = require("../controllers/insightsController");
const { protect, authorize } = require("../middleware/auth");

router.get("/stats", protect, getDashboardStats);
router.get("/my-pace", protect, getMyPace);
router.get("/targets", protect, authorize("super_admin", "admin"), getTargets);
router.get("/insights", protect, authorize("super_admin", "admin"), getInsights);
router.get("/live", protect, authorize("super_admin", "admin"), getLiveStats);

module.exports = router;
