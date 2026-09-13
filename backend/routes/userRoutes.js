const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateAutoAssign,
  addUserDocument,
  removeUserDocument,
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

router.post(
  "/:id/documents",
  authorize("super_admin", "admin"),
  addUserDocument,
);
router.delete(
  "/:id/documents/:docId",
  authorize("super_admin", "admin"),
  removeUserDocument,
);

module.exports = router;
