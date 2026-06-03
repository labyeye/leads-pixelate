const express = require("express");
const router = express.Router();
const {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
  pauseCampaign,
  cancelCampaign,
  getStats,
  resolveAudience,
} = require("../controllers/campaignController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/stats", getStats);
router.post("/resolve-audience", resolveAudience);

router.route("/").get(getCampaigns).post(createCampaign);
router.route("/:id").get(getCampaign).put(updateCampaign).delete(deleteCampaign);

router.post("/:id/launch", authorize("super_admin", "admin"), launchCampaign);
router.post("/:id/pause", authorize("super_admin", "admin"), pauseCampaign);
router.post("/:id/cancel", authorize("super_admin", "admin"), cancelCampaign);

module.exports = router;
