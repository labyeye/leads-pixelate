const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Tighter than the general /api/auth limiter — prevents using password
// reset as an email-flooding vector against a target address.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many reset requests, please try again later.",
  },
});

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;
