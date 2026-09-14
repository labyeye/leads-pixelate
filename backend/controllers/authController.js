const asyncHandler = require("express-async-handler");
const validator = require("validator");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateToken");
const { setAuthCookies, clearAuthCookies } = require("../utils/authCookies");
const logActivity = require("../utils/activityLogger");
const { sendPasswordResetEmail } = require("../utils/emailService");
const { sendWhatsAppOtp } = require("../utils/whatsappOtp");
const { formatPhone } = require("./whatsappController");
const totp = require("../utils/totp");
const log = require("../utils/logger").scope("Auth");

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// Issues the web-app cookie session (access + refresh + csrf) alongside the
// existing bearer token in the JSON body used by the mobile app.
async function issueWebSession(res, user) {
  const accessToken = generateAccessToken(user._id);
  const { raw: refreshToken, hash: refreshTokenHash } =
    await generateRefreshToken(user._id);

  user.refreshTokenHash = refreshTokenHash;
  user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  setAuthCookies(res, { accessToken, refreshToken });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, companyName, phone, department } = req.body;

  if (!name || !email || !password || !companyName) {
    res.status(400);
    throw new Error("Company name, your name, email and password are required");
  }

  const normalizedEmail =
    validator.normalizeEmail(email) || email.toLowerCase().trim();

  if (!validator.isEmail(normalizedEmail)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  if (password.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters");
  }

  if (name.trim().length < 2 || name.trim().length > 80) {
    res.status(400);
    throw new Error("Name must be between 2 and 80 characters");
  }

  if (companyName.trim().length < 2 || companyName.trim().length > 120) {
    res.status(400);
    throw new Error("Company name must be between 2 and 120 characters");
  }

  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    res.status(400);
    throw new Error("An account with that email already exists");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: "super_admin",
    phone: phone?.trim(),
    department: department?.trim(),
  });

  const baseSlug = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${user._id.toString().slice(-6)}`;

  const tenant = await Tenant.create({
    name: companyName.trim(),
    slug,
    ownerUser: user._id,
    plan: "trial",
  });

  user.tenantId = tenant._id;
  await user.save({ validateBeforeSave: false });

  logActivity({
    user,
    action: "REGISTER",
    module: "User",
    description: `New account registered: ${user.name} (${tenant.name})`,
    targetId: user._id,
    ip: req.ip,
  });

  await issueWebSession(res, user);

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      status: user.status,
      tenantId: tenant._id,
      token: generateToken(user._id),
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
      },
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );

  if (!user) {
    logActivity({
      user: null,
      action: "LOGIN_FAILED",
      module: "Auth",
      description: "Failed login attempt",
      ip: req.ip,
    });
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    logActivity({
      user,
      action: "LOGIN_FAILED",
      module: "Auth",
      description: `Wrong password attempt by ${user.name}`,
      ip: req.ip,
    });
    res.status(401);
    throw new Error("Invalid email or password");
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const tenant = user.tenantId
    ? await Tenant.findById(user.tenantId).select(
        "name plan status planExpiresAt",
      )
    : null;

  logActivity({
    user,
    action: "LOGIN",
    module: "Auth",
    description: `${user.name} logged in`,
    ip: req.ip,
  });

  await issueWebSession(res, user);

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      status: user.status,
      tenantId: user.tenantId,
      lastLogin: user.lastLogin,
      token: generateToken(user._id),
      tenant: tenant
        ? {
            _id: tenant._id,
            name: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
          }
        : null,
    },
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const tenant = user.tenantId
    ? await Tenant.findById(user.tenantId).select(
        "name plan status planExpiresAt",
      )
    : null;

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      tenant: tenant
        ? {
            _id: tenant._id,
            name: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
          }
        : null,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body;

  if (name && (name.trim().length < 2 || name.trim().length > 80)) {
    res.status(400);
    throw new Error("Name must be between 2 and 80 characters");
  }

  const user = await User.findById(req.user._id);

  if (name) user.name = name.trim();
  if (phone !== undefined && phone.trim() !== user.phone) {
    user.phone = phone.trim();
    user.phoneVerified = false;
  }
  if (department !== undefined) user.department = department.trim();

  const updated = await user.save();

  logActivity({
    user: req.user,
    action: "PROFILE_UPDATED",
    module: "Auth",
    description: `${req.user.name} updated their profile`,
    targetId: req.user._id,
    ip: req.ip,
  });

  res.json({ success: true, data: updated });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current and new password are required");
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error("New password must be at least 8 characters");
  }

  if (currentPassword === newPassword) {
    res.status(400);
    throw new Error("New password must be different from current password");
  }

  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  logActivity({
    user: req.user,
    action: "PASSWORD_CHANGED",
    module: "Auth",
    description: `${req.user.name} changed their password`,
    targetId: req.user._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Password updated successfully",
    data: { token: generateToken(user._id) },
  });
});

// Rotates the httpOnly refresh-token cookie for a new short-lived access
// token. Only used by the web app — the mobile app's long-lived bearer
// token needs no refresh cycle.
const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401);
    throw new Error("Not authorized");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    clearAuthCookies(res);
    res.status(401);
    throw new Error("Session expired, please log in again");
  }

  if (decoded.scope !== "refresh") {
    clearAuthCookies(res);
    res.status(401);
    throw new Error("Not authorized");
  }

  const user = await User.findById(decoded.id).select(
    "+refreshTokenHash +refreshTokenExpires",
  );

  if (
    !user ||
    !user.refreshTokenHash ||
    !user.refreshTokenExpires ||
    user.refreshTokenExpires < new Date()
  ) {
    clearAuthCookies(res);
    res.status(401);
    throw new Error("Session expired, please log in again");
  }

  const isValid = await bcrypt.compare(token, user.refreshTokenHash);
  if (!isValid) {
    // Reused/stale refresh token — revoke the session outright.
    user.refreshTokenHash = undefined;
    user.refreshTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
    clearAuthCookies(res);
    res.status(401);
    throw new Error("Session expired, please log in again");
  }

  if (user.status === "inactive") {
    clearAuthCookies(res);
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  await issueWebSession(res, user);

  res.json({ success: true, message: "Session refreshed" });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByIdAndUpdate(decoded.id, {
        $unset: { refreshTokenHash: 1, refreshTokenExpires: 1 },
      });
      if (user) {
        logActivity({
          user,
          action: "LOGOUT",
          module: "Auth",
          description: `${user.name} logged out`,
          ip: req.ip,
        });
      }
    } catch {
      // Token already invalid/expired — nothing to revoke.
    }
  }

  clearAuthCookies(res);
  res.json({ success: true, message: "Logged out" });
});

// Always responds with a generic success message, whether or not the email
// is registered, so the endpoint can't be used to enumerate accounts.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/reset-password/${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        resetUrl,
      });
    } catch (err) {
      // Don't leak email delivery failures to the caller — log and still
      // return the generic success response.
      log.error("Password reset email send failed", {
        email: user.email,
        message: err.message,
      });
    }

    logActivity({
      user,
      action: "PASSWORD_RESET_REQUESTED",
      module: "Auth",
      description: `${user.name} requested a password reset`,
      targetId: user._id,
      ip: req.ip,
    });
  }

  res.json({
    success: true,
    message:
      "If an account exists for that email, a password reset link has been sent.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    res.status(400);
    throw new Error("Reset token is required");
  }

  if (!password || password.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordTokenHash +resetPasswordExpires");

  if (!user) {
    res.status(400);
    throw new Error("This reset link is invalid or has expired");
  }

  user.password = password;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  // Force re-login everywhere else — a password reset should invalidate any
  // existing session cookies too.
  user.refreshTokenHash = undefined;
  user.refreshTokenExpires = undefined;
  await user.save();

  clearAuthCookies(res);

  logActivity({
    user,
    action: "PASSWORD_RESET",
    module: "Auth",
    description: `${user.name} reset their password`,
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, message: "Password has been reset. Please log in." });
});

// Lets the "forgot password" screen know which reset methods this account
// has actually set up, so it doesn't offer WhatsApp/authenticator options
// that would just fail. Only usable signal here (no separate "account
// doesn't exist" branch) — email is always offered either way.
const forgotPasswordMethods = asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email || !validator.isEmail(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  const methods = ["email"];
  if (user?.phoneVerified) methods.push("whatsapp");
  if (user?.totpEnabled) methods.push("totp");

  res.json({ success: true, data: { methods } });
});

const forgotPasswordWhatsapp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+phone");

  if (user?.phoneVerified && user.phone) {
    const otp = generateOtp();
    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    try {
      await sendWhatsAppOtp(formatPhone(user.phone), otp);
    } catch (err) {
      log.error("WhatsApp reset OTP send failed", { message: err.message });
    }
  }

  res.json({
    success: true,
    message: "If that account has WhatsApp reset enabled, a code was sent.",
  });
});

const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password || password.length < 8) {
    res.status(400);
    throw new Error("Email, code and an 8+ character password are required");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    resetOtpHash: hashOtp(otp),
    resetOtpExpires: { $gt: new Date() },
  }).select("+resetOtpHash +resetOtpExpires");

  if (!user) {
    res.status(400);
    throw new Error("This code is invalid or has expired");
  }

  user.password = password;
  user.resetOtpHash = undefined;
  user.resetOtpExpires = undefined;
  user.refreshTokenHash = undefined;
  user.refreshTokenExpires = undefined;
  await user.save();

  clearAuthCookies(res);

  logActivity({
    user,
    action: "PASSWORD_RESET",
    module: "Auth",
    description: `${user.name} reset their password via WhatsApp code`,
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, message: "Password has been reset. Please log in." });
});

const resetPasswordWithTotp = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password || password.length < 8) {
    res.status(400);
    throw new Error(
      "Email, authenticator code and an 8+ character password are required",
    );
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    totpEnabled: true,
  }).select("+totpSecret");

  if (!user || !totp.verifyToken(token, user.totpSecret)) {
    res.status(400);
    throw new Error("Invalid authenticator code");
  }

  user.password = password;
  user.refreshTokenHash = undefined;
  user.refreshTokenExpires = undefined;
  await user.save();

  clearAuthCookies(res);

  logActivity({
    user,
    action: "PASSWORD_RESET",
    module: "Auth",
    description: `${user.name} reset their password via authenticator app`,
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, message: "Password has been reset. Please log in." });
});

// --- Phone verification (required once before WhatsApp reset can be offered) ---

const sendPhoneOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+phone");
  if (!user.phone) {
    res.status(400);
    throw new Error("Add a phone number to your profile first");
  }

  const otp = generateOtp();
  user.phoneOtpHash = hashOtp(otp);
  user.phoneOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  await sendWhatsAppOtp(formatPhone(user.phone), otp);

  res.json({ success: true, message: "Code sent via WhatsApp" });
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const user = await User.findOne({
    _id: req.user._id,
    phoneOtpHash: hashOtp(otp || ""),
    phoneOtpExpires: { $gt: new Date() },
  }).select("+phoneOtpHash +phoneOtpExpires");

  if (!user) {
    res.status(400);
    throw new Error("This code is invalid or has expired");
  }

  user.phoneVerified = true;
  user.phoneOtpHash = undefined;
  user.phoneOtpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Phone number verified" });
});

// --- TOTP (authenticator app) 2FA setup, used for both login 2FA and password reset ---

const totpSetup = asyncHandler(async (req, res) => {
  const secret = totp.generateSecret();
  await User.findByIdAndUpdate(req.user._id, { totpSecret: secret });

  const otpauthUrl = totp.buildOtpauthUrl(req.user.email, secret);
  const qrCode = await totp.generateQrCodeDataUrl(otpauthUrl);

  res.json({ success: true, data: { otpauthUrl, qrCode, secret } });
});

const totpVerifySetup = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await User.findById(req.user._id).select("+totpSecret");

  const isValid = user.totpSecret && totp.verifyToken(token, user.totpSecret);
  if (!isValid) {
    log.warn("TOTP setup verification rejected", { userId: req.user._id });
    res.status(400);
    throw new Error("Invalid authenticator code");
  }

  user.totpEnabled = true;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Authenticator app enabled" });
});

const totpDisable = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    totpEnabled: false,
    totpSecret: undefined,
  });
  res.json({ success: true, message: "Authenticator app disabled" });
});

module.exports = {
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
  sendPhoneOtp,
  verifyPhoneOtp,
  totpSetup,
  totpVerifySetup,
  totpDisable,
};
