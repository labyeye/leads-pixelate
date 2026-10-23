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

// Tighter than the general /api/auth limiter — prevents using OTP/reset
// endpoints as an email/WhatsApp-flooding vector. Each call makes a separate
// limiter so routes don't share one counter (sending a code and then verifying
// it used to burn the same 5-per-15-minutes budget). Signed-in routes are
// counted per user, public ones per IP.
const limiter = (max = 5) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `u:${req.user._id}` : req.ip),
    message: {
      success: false,
      message: "Too many attempts, please wait a few minutes and try again.",
    },
  });

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", limiter(5), forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get(
  "/forgot-password/methods",
  limiter(10),
  forgotPasswordMethods,
);
router.post(
  "/forgot-password/whatsapp",
  limiter(5),
  forgotPasswordWhatsapp,
);
router.post(
  "/reset-password/otp/whatsapp",
  limiter(10),
  resetPasswordWithOtp,
);
router.post(
  "/reset-password/otp/totp",
  limiter(10),
  resetPasswordWithTotp,
);
router.post(
  "/reset/backup",
  limiter(10),
  resetPasswordWithBackupCode,
);
router.get("/reset/passkey-options", limiter(5), resetOptions);
router.post("/reset/passkey", limiter(10), resetVerify);
router.post("/login/otp/send", limiter(5), loginRequestOtp);
router.post("/login/otp/verify", limiter(10), loginVerifyOtp);
router.post("/login/email-otp/send", limiter(5), loginRequestEmailOtp);
router.post("/login/email-otp/verify", limiter(10), loginVerifyEmailOtp);
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.post("/phone/send-otp", protect, sendPhoneOtp);
router.post("/phone/verify-otp", protect, verifyPhoneOtp);
router.post("/contact/send-otp", protect, limiter(5), sendContactOtp);
router.post("/contact/verify-otp", protect, limiter(10), verifyContactOtp);
router.post("/2fa/totp/setup", protect, totpSetup);
router.post("/2fa/totp/verify", protect, totpVerifySetup);
router.post("/2fa/totp/disable", protect, totpDisable);
router.get("/sessions", protect, listSessions);
router.delete("/sessions", protect, removeOtherSessions);
router.delete("/sessions/:id", protect, removeSession);
router.get("/backup-codes", protect, backupCodesStatus);
router.post("/backup-codes", protect, limiter(5), generateBackupCodes);
router.post("/login/backup", limiter(10), loginWithBackupCode);
router.post("/passkey/register-options", protect, registerOptions);
router.post("/passkey/register", protect, registerVerify);
router.get("/passkey", protect, listPasskeys);
router.delete("/passkey/:id", protect, deletePasskey);
router.get("/passkey/login-options", loginOptions);
router.post("/passkey/login", loginVerify);

module.exports = router;
