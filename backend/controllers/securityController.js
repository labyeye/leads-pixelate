const asyncHandler = require("express-async-handler");
const { checkPasswordRules } = require("../utils/passwordPolicy");
const crypto = require("crypto");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Session = require("../models/Session");
const { generateToken } = require("../utils/generateToken");
const { startSession } = require("../utils/sessions");
const logActivity = require("../utils/activityLogger");
const { issueWebSession } = require("./authController");
const { clearAuthCookies } = require("../utils/authCookies");

// ── Signed-in devices ────────────────────────────────────────────────────

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ userId: req.user._id }).sort({
    lastActiveAt: -1,
  });
  res.json({
    success: true,
    data: sessions.map((s) => ({
      _id: s._id,
      deviceName: s.deviceName,
      platform: s.platform,
      ip: s.ip,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      current: String(s._id) === req.sessionId,
    })),
  });
});

const removeSession = asyncHandler(async (req, res) => {
  const r = await Session.deleteOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!r.deletedCount) {
    res.status(404);
    throw new Error("Device not found");
  }
  res.json({ success: true, message: "Device signed out" });
});

const removeOtherSessions = asyncHandler(async (req, res) => {
  await Session.deleteMany(
    req.sessionId
      ? { userId: req.user._id, _id: { $ne: req.sessionId } }
      : { userId: req.user._id },
  );
  res.json({ success: true, message: "Signed out of all other devices" });
});

// ── Password reset helpers ───────────────────────────────────────────────

const PASSWORD_RULE = { test: (p) => !checkPasswordRules(p) };

const assertNewPassword = (res, password) => {
  if (typeof password !== "string" || !PASSWORD_RULE.test(password)) {
    res.status(400);
    throw new Error(checkPasswordRules(password));
  }
};

// Sets the new password and signs the account out everywhere.
async function finishPasswordReset(req, res, user, via) {
  user.password = req.body.password;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.failedLogins = 0;
  user.lockUntil = null;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshTokenHash = undefined;
  user.refreshTokenExpires = undefined;
  await user.save();
  await Session.deleteMany({ userId: user._id });
  clearAuthCookies(res);
  logActivity({
    user,
    action: "PASSWORD_RESET",
    module: "Auth",
    description: `${user.name} reset their password via ${via}`,
    targetId: user._id,
    ip: req.ip,
  });
  res.json({
    success: true,
    message: "Password has been reset. Please log in.",
  });
}

// ── Backup codes ─────────────────────────────────────────────────────────

const CODE_COUNT = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const hashCode = (c) =>
  crypto
    .createHash("sha256")
    .update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .digest("hex");
const newCode = () => {
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
};

const backupCodesStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+backupCodes backupCodesGeneratedAt",
  );
  res.json({
    success: true,
    data: {
      remaining: user.backupCodes.filter((c) => !c.usedAt).length,
      generatedAt: user.backupCodesGeneratedAt || null,
    },
  });
});

// Replaces any existing set. Requires the account password so a stolen
// session alone can't mint recovery codes.
const generateBackupCodes = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!password || !(await user.matchPassword(password))) {
    res.status(400);
    throw new Error("Password is incorrect");
  }
  const codes = Array.from({ length: CODE_COUNT }, newCode);
  user.backupCodes = codes.map((c) => ({ hash: hashCode(c) }));
  user.backupCodesGeneratedAt = new Date();
  await user.save({ validateBeforeSave: false });

  logActivity({
    user,
    action: "BACKUP_CODES_GENERATED",
    module: "Auth",
    description: `${user.name} generated new backup codes`,
    ip: req.ip,
  });
  res.json({ success: true, data: { codes } });
});

// Single-use sign-in when the user has lost their other methods.
const loginWithBackupCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const fail = () => {
    res.status(401);
    throw new Error("Invalid email or backup code");
  };
  if (typeof email !== "string" || typeof code !== "string") return fail();

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+backupCodes",
  );
  if (!user || user.status === "inactive") return fail();
  const h = hashCode(code);
  const entry = user.backupCodes.find((c) => c.hash === h && !c.usedAt);
  if (!entry) return fail();

  entry.usedAt = new Date();
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const tenant = user.tenantId
    ? await Tenant.findById(user.tenantId).select("name plan status")
    : null;
  logActivity({
    user,
    action: "LOGIN",
    module: "Auth",
    description: `${user.name} logged in with a backup code`,
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
      emailVerified: !!user.emailVerified,
      phoneVerified: !!user.phoneVerified,
      totpEnabled: !!user.totpEnabled,
      token: generateToken(user._id, user.tokenVersion, sid),
      tenant: tenant
        ? { _id: tenant._id, name: tenant.name, plan: tenant.plan, status: tenant.status }
        : null,
    },
  });
});

const resetPasswordWithBackupCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  assertNewPassword(res, req.body.password);
  const bad = () => {
    res.status(400);
    throw new Error("Invalid email or backup code");
  };
  if (typeof email !== "string" || typeof code !== "string") return bad();

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+backupCodes",
  );
  if (!user) return bad();
  const h = hashCode(code);
  const entry = user.backupCodes.find((c) => c.hash === h && !c.usedAt);
  if (!entry) return bad();
  entry.usedAt = new Date();
  await finishPasswordReset(req, res, user, "a backup code");
});

module.exports = {
  finishPasswordReset,
  assertNewPassword,
  resetPasswordWithBackupCode,
  listSessions,
  removeSession,
  removeOtherSessions,
  backupCodesStatus,
  generateBackupCodes,
  loginWithBackupCode,
};
