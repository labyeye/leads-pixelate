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
  forgotPasswordMethods,
  forgotPasswordWhatsapp,
  resetPasswordWithOtp,
  resetPasswordWithTotp,
  loginRequestOtp,
  loginVerifyOtp,
  loginRequestEmailOtp,
  loginVerifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendContactOtp,
  verifyContactOtp,
  totpSetup,
  totpVerifySetup,
  totpDisable,
} = require("../controllers/authController");
const {
  registerOptions,
  registerVerify,
  listPasskeys,
  deletePasskey,
  loginOptions,
  loginVerify,
  resetOptions,
  resetVerify,
} = require("../controllers/passkeyController");
const {
  listSessions,
  removeSession,
  removeOtherSessions,
  backupCodesStatus,
  generateBackupCodes,
  loginWithBackupCode,
  resetPasswordWithBackupCode,
} = require("../controllers/securityController");
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
router.get(
  "/forgot-password/methods",
  forgotPasswordLimiter,
  forgotPasswordMethods,
);
router.post(
  "/forgot-password/whatsapp",
  forgotPasswordLimiter,
  forgotPasswordWhatsapp,
);
router.post(
  "/reset-password/otp/whatsapp",
  forgotPasswordLimiter,
  resetPasswordWithOtp,
);
router.post(
  "/reset-password/otp/totp",
  forgotPasswordLimiter,
  resetPasswordWithTotp,
);
router.post(
  "/reset/backup",
  forgotPasswordLimiter,
  resetPasswordWithBackupCode,
);
router.get("/reset/passkey-options", forgotPasswordLimiter, resetOptions);
router.post("/reset/passkey", forgotPasswordLimiter, resetVerify);
router.post("/login/otp/send", forgotPasswordLimiter, loginRequestOtp);
router.post("/login/otp/verify", forgotPasswordLimiter, loginVerifyOtp);
router.post("/login/email-otp/send", forgotPasswordLimiter, loginRequestEmailOtp);
router.post("/login/email-otp/verify", forgotPasswordLimiter, loginVerifyEmailOtp);
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.post("/phone/send-otp", protect, sendPhoneOtp);
router.post("/phone/verify-otp", protect, verifyPhoneOtp);
router.post("/contact/send-otp", protect, forgotPasswordLimiter, sendContactOtp);
router.post("/contact/verify-otp", protect, forgotPasswordLimiter, verifyContactOtp);
router.post("/2fa/totp/setup", protect, totpSetup);
router.post("/2fa/totp/verify", protect, totpVerifySetup);
router.post("/2fa/totp/disable", protect, totpDisable);
router.get("/sessions", protect, listSessions);
router.delete("/sessions", protect, removeOtherSessions);
router.delete("/sessions/:id", protect, removeSession);
router.get("/backup-codes", protect, backupCodesStatus);
router.post("/backup-codes", protect, forgotPasswordLimiter, generateBackupCodes);
router.post("/login/backup", forgotPasswordLimiter, loginWithBackupCode);
router.post("/passkey/register-options", protect, registerOptions);
router.post("/passkey/register", protect, registerVerify);
router.get("/passkey", protect, listPasskeys);
router.delete("/passkey/:id", protect, deletePasskey);
router.get("/passkey/login-options", loginOptions);
router.post("/passkey/login", loginVerify);

module.exports = router;
