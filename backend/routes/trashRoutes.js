const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getTrash,
  restoreItem,
  purgeItem,
} = require("../controllers/trashController");

router.use(protect, authorize("super_admin", "admin"));

router.get("/", getTrash);
router.post("/:type/:id/restore", restoreItem);
router.delete("/:type/:id", purgeItem);

module.exports = router;
