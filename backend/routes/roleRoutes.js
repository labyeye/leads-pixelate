const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/roleController");

router.use(protect, authorize("super_admin", "admin"));

router.route("/").get(getRoles).post(createRole);
router.route("/:id").put(updateRole).delete(deleteRole);

module.exports = router;
