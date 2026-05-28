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
  getStats,
} = require("../controllers/socialController");
const { protect, authorize } = require("../middleware/auth");

// OAuth callback — no auth (Facebook redirects here)
router.get("/auth/facebook/callback", facebookCallback);

// All other routes require login
router.use(protect);

// Stats
router.get("/stats", getStats);

// Posts
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

// Connected accounts
router.route("/accounts").get(getAccounts).post(connectAccount);
router.delete(
  "/accounts/:id",
  authorize("super_admin", "admin"),
  disconnectAccount,
);

// OAuth
router.get("/auth/facebook", getFacebookAuthUrl);
router.post("/auth/facebook/pages", fetchFacebookPages);

module.exports = router;
