const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
  saveNumbering,
} = require("../controllers/settingController");
const { protect, authorize, ownerOnly } = require("../middleware/auth");

router.use(protect);

router
  .route("/")
  .get(getSettings)
  .put(authorize("super_admin", "admin"), updateSettings);
router.put("/numbering", ownerOnly, saveNumbering);

module.exports = router;
