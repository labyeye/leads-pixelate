const express = require("express");
const router = express.Router();
const { getDashboardStats, getLiveStats } = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");

router.get("/stats", protect, getDashboardStats);
router.get("/live", protect, authorize("super_admin", "admin"), getLiveStats);

module.exports = router;
