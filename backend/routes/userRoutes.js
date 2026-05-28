const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateAutoAssign,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.post(
  "/auto-assign",
  authorize("super_admin", "admin"),
  updateAutoAssign,
);

router
  .route("/")
  .get(authorize("super_admin", "admin"), getUsers)
  .post(authorize("super_admin", "admin"), createUser);

router
  .route("/:id")
  .get(authorize("super_admin", "admin"), getUser)
  .put(authorize("super_admin", "admin"), updateUser)
  .delete(authorize("super_admin"), deleteUser);

module.exports = router;
