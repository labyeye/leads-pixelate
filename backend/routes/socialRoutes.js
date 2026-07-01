const express = require("express");
const router = express.Router();
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  submitPost,
  approvePost,
  rejectPost,
  publishPost,
  getAccounts,
  connectAccount,
  disconnectAccount,
  getFacebookAuthUrl,
  facebookCallback,
  fetchFacebookPages,
  importFromIntegration,
  getStats,
  getAnalytics,
} = require("../controllers/socialController");
const { protect, authorize } = require("../middleware/auth");

router.get("/auth/facebook/callback", facebookCallback);

router.use(protect);

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);

router.route("/posts").get(getPosts).post(createPost);
router.route("/posts/:id").get(getPost).put(updatePost).delete(deletePost);

router.put("/posts/:id/submit", submitPost);
router.put(
  "/posts/:id/approve",
  authorize("super_admin", "admin"),
  approvePost,
);
router.put("/posts/:id/reject", authorize("super_admin", "admin"), rejectPost);
router.post(
  "/posts/:id/publish",
  authorize("super_admin", "admin"),
  publishPost,
);

router.route("/accounts").get(getAccounts).post(connectAccount);
router.delete(
  "/accounts/:id",
  authorize("super_admin", "admin"),
  disconnectAccount,
);

router.get("/auth/facebook", getFacebookAuthUrl);
router.post("/auth/facebook/pages", fetchFacebookPages);
router.post("/accounts/import-from-integration", importFromIntegration);

module.exports = router;
