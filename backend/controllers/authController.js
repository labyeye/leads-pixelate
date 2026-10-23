const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const validator = require("validator");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  refreshTokenMatches,
} = require("../utils/generateToken");
const { setAuthCookies, clearAuthCookies } = require("../utils/authCookies");
const logActivity = require("../utils/activityLogger");
const { sendPasswordResetEmail, sendOtpEmail } = require("../utils/emailService");
const { sendWhatsAppOtp } = require("../utils/whatsappOtp");
const { formatPhone } = require("./whatsappController");
const totp = require("../utils/totp");
const Session = require("../models/Session");
const { startSession } = require("../utils/sessions");
const log = require("../utils/logger").scope("Auth");

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// Issues the web-app cookie session (access + refresh + csrf) alongside the
// existing bearer token in the JSON body used by the mobile app.
async function issueWebSession(res, user, sid) {
  const accessToken = generateAccessToken(user._id, user.tokenVersion, sid);
  const { raw: refreshToken, hash: refreshTokenHash } =
    await generateRefreshToken(user._id, sid);

  user.refreshTokenHash = refreshTokenHash;
  user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  setAuthCookies(res, { accessToken, refreshToken });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, companyName, phone, department } = req.body;

  if (![name, email, password, companyName].every((v) => typeof v === "string" && v)) {
    res.status(400);
    throw new Error("Company name, your name, email and password are required");
  }

  const normalizedEmail =
    validator.normalizeEmail(email) || email.toLowerCase().trim();

  if (!validator.isEmail(normalizedEmail)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    res.status(400);
    throw new Error("Password must be 8-72 characters and include a letter and a number");
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

  const sid = await startSession(req, user);
  await issueWebSession(res, user, sid);

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      phone: user.phone,
      department: user.department,
      status: user.status,
      tenantId: tenant._id,
      token: generateToken(user._id, user.tokenVersion, sid),
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
      },
    },
  });
});

// 3 wrong passwords are allowed; the 4th wrong one locks the account for 10 min.
// Signing in with a WhatsApp or email OTP (or resetting the password) lifts the lock.
const MAX_FAILED_LOGINS = 4;
const LOCK_MS = 10 * 60 * 1000;
const LOCKED_MSG = "Too many wrong passwords. Your account is blocked for 10 minutes. Recover access now with an OTP on your phone (WhatsApp) or email.";
// Valid-looking bcrypt hash, compared against when the email is unknown so response time doesn't reveal it.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.G1c/3d1Hn5X9lq0Yx1y6k8mQ5G1e";

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
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

  if (user.lockUntil && user.lockUntil > new Date()) {
    res.status(429);
    throw new Error(LOCKED_MSG);
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    const locked = (user.failedLogins || 0) + 1 >= MAX_FAILED_LOGINS;
    await User.updateOne(
      { _id: user._id },
      locked
        ? { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MS) } }
        : { $inc: { failedLogins: 1 } },
    );
    logActivity({
      user,
      action: "LOGIN_FAILED",
      module: "Auth",
      description: `Wrong password attempt by ${user.name}`,
      ip: req.ip,
    });
    res.status(locked ? 429 : 401);
    throw new Error(locked ? LOCKED_MSG : "Invalid email or password");
  }

  // Checked only after the password is right, so the status isn't disclosed to someone guessing emails.
  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  user.failedLogins = 0;
  user.lockUntil = null;
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

  const sid = await startSession(req, user);
  await issueWebSession(res, user, sid);

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      status: user.status,
      tenantId: user.tenantId,
      lastLogin: user.lastLogin,
      token: generateToken(user._id, user.tokenVersion, sid),
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
  user.tokenVersion = (user.tokenVersion || 0) + 1; // revokes every older bearer/cookie token
  await user.save();
  await Session.deleteMany(
    req.sessionId
      ? { userId: user._id, _id: { $ne: req.sessionId } }
      : { userId: user._id },
  );
  await issueWebSession(res, user, req.sessionId);

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
    data: { token: generateToken(user._id, user.tokenVersion, req.sessionId) },
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

  const isValid = await refreshTokenMatches(token, user.refreshTokenHash);
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

  if (decoded.sid && !(await Session.exists({ _id: decoded.sid, userId: user._id }))) {
    clearAuthCookies(res);
    res.status(401);
    throw new Error("This device was signed out. Please log in again.");
  }

  await issueWebSession(res, user, decoded.sid);

  res.json({ success: true, message: "Session refreshed" });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.sid) await Session.deleteOne({ _id: decoded.sid, userId: decoded.id });
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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await Session.deleteMany({ userId: user._id });
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

  res.json({
    success: true,
    message: "Password has been reset. Please log in.",
  });
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

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+backupCodes +passkeys",
  );
  const methods = ["email"];
  if (user?.phoneVerified) methods.push("whatsapp");
  if (user?.totpEnabled) methods.push("totp");
  if (user?.backupCodes?.some((c) => !c.usedAt)) methods.push("backup");
  if (user?.passkeys?.length) methods.push("passkey");

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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await Session.deleteMany({ userId: user._id });
  user.resetOtpHash = undefined;
  user.resetOtpExpires = undefined;
  user.failedLogins = 0;
  user.lockUntil = null;
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

  res.json({
    success: true,
    message: "Password has been reset. Please log in.",
  });
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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await Session.deleteMany({ userId: user._id });
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

  res.json({
    success: true,
    message: "Password has been reset. Please log in.",
  });
});

// --- Passwordless login via WhatsApp OTP (phone must already be verified) ---

function phoneVariants(raw) {
  const normalised = String(raw || "")
    .replace(/\D/g, "")
    .slice(-10);
  return [normalised, `+91${normalised}`, `91${normalised}`];
}

const loginRequestOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400);
    throw new Error("Phone number is required");
  }

  const user = await User.findOne({
    phone: { $in: phoneVariants(phone) },
    phoneVerified: true,
  }).select("+phone");

  if (user && user.status !== "inactive") {
    const otp = generateOtp();
    user.loginOtpHash = hashOtp(otp);
    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    try {
      await sendWhatsAppOtp(formatPhone(user.phone), otp);
    } catch (err) {
      log.error("Login OTP send failed", { message: err.message });
    }
  }

  if (!user || user.status === "inactive")
    log.warn("Login OTP requested but no active user with that verified phone — nothing sent");
  // Generic response regardless of match, to avoid phone-number enumeration.
  res.json({
    success: true,
    message:
      "If that phone number is registered and verified, an OTP has been sent.",
  });
});

const loginRequestEmailOtp = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!validator.isEmail(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }
  const user = await User.findOne({ email });
  if (user && user.status !== "inactive") {
    const otp = generateOtp();
    user.loginOtpHash = hashOtp(otp);
    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.loginOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });
    try {
      await sendOtpEmail({ to: user.email, userName: user.name, otp, purpose: "login" });
    } catch (err) {
      log.error("Login email OTP send failed", { message: err.message });
    }
  }
  if (!user || user.status === "inactive")
    log.warn("Login email OTP requested but no active user with that email — nothing sent");
  res.json({
    success: true,
    message: "If that email is registered, a code has been sent to it.",
  });
});

const loginVerifyEmailOtp = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const otp = String(req.body.otp || "");
  const fail = () => {
    res.status(401);
    throw new Error("Invalid or expired code");
  };
  if (!email || !otp) return fail();

  const user = await User.findOne({ email }).select(
    "+loginOtpHash +loginOtpExpires +loginOtpAttempts",
  );
  if (!user || !user.loginOtpHash || !user.loginOtpExpires || user.loginOtpExpires < new Date())
    return fail();
  if ((user.loginOtpAttempts || 0) >= 5) {
    res.status(429);
    throw new Error("Too many attempts — request a new code");
  }
  if (hashOtp(otp) !== user.loginOtpHash) {
    user.loginOtpAttempts = (user.loginOtpAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    return fail();
  }
  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  user.loginOtpHash = undefined;
  user.loginOtpExpires = undefined;
  user.loginOtpAttempts = 0;
  user.failedLogins = 0;
  user.lockUntil = null;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const tenant = user.tenantId
    ? await Tenant.findById(user.tenantId).select("name plan status")
    : null;
  logActivity({
    user,
    action: "LOGIN",
    module: "Auth",
    description: `${user.name} logged in via email OTP`,
    ip: req.ip,
  });
  const sid = await startSession(req, user);
  await issueWebSession(res, user, sid);
  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      status: user.status,
      tenantId: user.tenantId,
      lastLogin: user.lastLogin,
      token: generateToken(user._id, user.tokenVersion, sid),
      tenant: tenant
        ? { _id: tenant._id, name: tenant.name, plan: tenant.plan, status: tenant.status }
        : null,
    },
  });
});

const loginVerifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400);
    throw new Error("Phone and OTP are required");
  }

  const user = await User.findOne({
    phone: { $in: phoneVariants(phone) },
    loginOtpHash: hashOtp(otp),
    loginOtpExpires: { $gt: new Date() },
  }).select("+loginOtpHash +loginOtpExpires");

  if (!user) {
    res.status(401);
    throw new Error("Invalid or expired OTP");
  }

  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  user.loginOtpHash = undefined;
  user.loginOtpExpires = undefined;
  user.failedLogins = 0;
  user.lockUntil = null;
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
    description: `${user.name} logged in via WhatsApp OTP`,
    ip: req.ip,
  });

  const sid = await startSession(req, user);
  await issueWebSession(res, user, sid);

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      status: user.status,
      tenantId: user.tenantId,
      lastLogin: user.lastLogin,
      token: generateToken(user._id, user.tokenVersion, sid),
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

// --- Phone verification (required once before WhatsApp reset can be offered) ---

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

// Step 1 of changing email/phone: a WhatsApp code proves the person holds the phone.
//  - phone: code goes to the NEW number
//  - email: code goes to the current verified number
const sendContactOtp = asyncHandler(async (req, res) => {
  const type = req.body.type;
  const value = String(req.body.value || "").trim();
  if (!["email", "phone"].includes(type) || !value) {
    res.status(400);
    throw new Error("Type and value are required");
  }

  const user = await User.findById(req.user._id).select("+phone");
  let target;

  if (type === "phone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      res.status(400);
      throw new Error("Enter a valid phone number");
    }
    const taken = await User.findOne({ phone: value, _id: { $ne: user._id } });
    if (taken) {
      res.status(400);
      throw new Error("This phone number is already in use");
    }
    target = value;
  } else {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400);
      throw new Error("Enter a valid email address");
    }
    if (email === user.email && user.emailVerified) {
      res.status(400);
      throw new Error("This email is already verified");
    }
    if (
      email !== user.email &&
      (await User.findOne({ email, _id: { $ne: user._id } }))
    ) {
      res.status(400);
      throw new Error("This email is already in use");
    }
    target = email;
  }

  const otp = generateOtp();
  user.pendingContactType = type;
  user.pendingContactValue = type === "email" ? value.toLowerCase() : value;
  user.contactOtpHash = hashOtp(otp);
  user.contactOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.contactOtpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  if (type === "email") {
    await sendOtpEmail({
      to: target,
      userName: user.name,
      otp,
      purpose: "verify-email",
    });
    return res.json({ success: true, message: "Code sent to the new email" });
  }
  await sendWhatsAppOtp(formatPhone(target), otp);

  res.json({ success: true, message: "Code sent via WhatsApp" });
});

// Step 2: apply the pending change once the code matches.
const verifyContactOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+pendingContactType +pendingContactValue +contactOtpHash +contactOtpExpires +contactOtpAttempts",
  );
  if (
    !user?.pendingContactType ||
    !user.contactOtpHash ||
    !user.contactOtpExpires ||
    user.contactOtpExpires < new Date()
  ) {
    res.status(400);
    throw new Error("This code is invalid or has expired");
  }
  if ((user.contactOtpAttempts || 0) >= 5) {
    res.status(429);
    throw new Error("Too many attempts — request a new code");
  }
  if (hashOtp(String(req.body.otp || "")) !== user.contactOtpHash) {
    user.contactOtpAttempts = (user.contactOtpAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    res.status(400);
    throw new Error("This code is invalid or has expired");
  }

  const type = user.pendingContactType;
  const value = user.pendingContactValue;
  if (type === "email") {
    if (await User.findOne({ email: value, _id: { $ne: user._id } })) {
      res.status(400);
      throw new Error("This email is already in use");
    }
    user.email = value;
    user.emailVerified = true;
  } else {
    user.phone = value;
    user.phoneVerified = true;
  }
  user.pendingContactType = null;
  user.pendingContactValue = undefined;
  user.contactOtpHash = undefined;
  user.contactOtpExpires = undefined;
  user.contactOtpAttempts = 0;
  const updated = await user.save();

  logActivity({
    user: req.user,
    action: "PROFILE_UPDATED",
    module: "Auth",
    description: `${req.user.name} changed their ${type} (verified by code)`,
    targetId: req.user._id,
    ip: req.ip,
  });

  res.json({ success: true, message: `${type === "email" ? "Email" : "Phone number"} updated`, data: updated });
});

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
  issueWebSession,
};
