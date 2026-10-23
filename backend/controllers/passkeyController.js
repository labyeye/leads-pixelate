const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const { generateToken } = require("../utils/generateToken");
const logActivity = require("../utils/activityLogger");
const { issueWebSession } = require("./authController");
const { startSession } = require("../utils/sessions");
const {
  finishPasswordReset,
  assertNewPassword,
} = require("./securityController");

const RP_ID = process.env.PASSKEY_RP_ID || "leads-backend.pixelatenest.com";
const RP_NAME = "NestLeads";
const ORIGINS = [
  `https://${RP_ID}`,
  ...(process.env.CLIENT_URL || "").split(","),
  ...(process.env.PASSKEY_ORIGINS || "").split(","),
]
  .map((o) => o.trim())
  .filter(Boolean);

// Challenges are stateless: a short-lived signed token the client echoes back,
// so this works across serverless instances without a challenge store.
const signChallenge = (challenge, purpose, uid) =>
  jwt.sign({ challenge, purpose, uid }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });

const readChallenge = (res, token, purpose) => {
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (p.purpose === purpose) return p;
  } catch {
    /* fall through */
  }
  res.status(400);
  throw new Error("Passkey request expired. Please try again.");
};

const registerOptions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+passkeys");
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user._id)),
    attestationType: "none",
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });
  res.json({
    success: true,
    data: {
      ...options,
      challengeToken: signChallenge(options.challenge, "register", user._id),
    },
  });
});

const registerVerify = asyncHandler(async (req, res) => {
  const { challengeToken, name, ...credential } = req.body;
  const c = readChallenge(res, challengeToken, "register");
  if (String(c.uid) !== String(req.user._id)) {
    res.status(400);
    throw new Error("Passkey request does not match this account");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: c.challenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });
  } catch (e) {
    res.status(400);
    throw new Error(`Passkey could not be verified: ${e.message}`);
  }
  if (!verification.verified) {
    res.status(400);
    throw new Error("Passkey could not be verified");
  }

  const { credential: cred } = verification.registrationInfo;
  const user = await User.findById(req.user._id).select("+passkeys");
  if (user.passkeys.some((p) => p.credentialId === cred.id)) {
    res.status(409);
    throw new Error("This passkey is already registered");
  }
  user.passkeys.push({
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey).toString("base64url"),
    counter: cred.counter,
    transports: cred.transports || [],
    name: String(name || "").trim().slice(0, 60) || "Passkey",
  });
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Passkey added" });
});

const listPasskeys = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+passkeys");
  res.json({
    success: true,
    data: user.passkeys.map((p) => ({
      _id: p._id,
      name: p.name,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt || null,
    })),
  });
});

const deletePasskey = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+passkeys");
  const before = user.passkeys.length;
  user.passkeys = user.passkeys.filter((p) => String(p._id) !== req.params.id);
  if (user.passkeys.length === before) {
    res.status(404);
    throw new Error("Passkey not found");
  }
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: "Passkey removed" });
});

// Discoverable-credential sign-in: no email needed, the passkey identifies the user.
const loginOptions = asyncHandler(async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
  });
  res.json({
    success: true,
    data: {
      ...options,
      challengeToken: signChallenge(options.challenge, "login"),
    },
  });
});

const loginVerify = asyncHandler(async (req, res) => {
  const { challengeToken, ...assertion } = req.body;
  const c = readChallenge(res, challengeToken, "login");

  const user = await User.findOne({
    "passkeys.credentialId": assertion.id,
  }).select("+passkeys");
  const stored = user?.passkeys.find((p) => p.credentialId === assertion.id);
  if (!user || !stored) {
    res.status(401);
    throw new Error("Passkey not recognised. Sign in another way.");
  }
  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Account is deactivated. Contact your administrator.");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: c.challenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
  } catch (e) {
    res.status(401);
    throw new Error("Passkey verification failed");
  }
  if (!verification.verified) {
    res.status(401);
    throw new Error("Passkey verification failed");
  }

  stored.counter = verification.authenticationInfo.newCounter;
  stored.lastUsedAt = new Date();
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
    description: `${user.name} logged in with a passkey`,
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

// Same discoverable-credential challenge as sign-in, but its own purpose so a
// login challenge can't be replayed to reset a password (and vice versa).
const resetOptions = asyncHandler(async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  });
  res.json({
    success: true,
    data: {
      ...options,
      challengeToken: signChallenge(options.challenge, "reset"),
    },
  });
});

const resetVerify = asyncHandler(async (req, res) => {
  const { challengeToken, password, ...assertion } = req.body;
  assertNewPassword(res, password);
  const c = readChallenge(res, challengeToken, "reset");

  const user = await User.findOne({
    "passkeys.credentialId": assertion.id,
  }).select("+passkeys");
  const stored = user?.passkeys.find((p) => p.credentialId === assertion.id);
  if (!user || !stored) {
    res.status(401);
    throw new Error("Passkey not recognised");
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: c.challenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
  } catch {
    res.status(401);
    throw new Error("Passkey verification failed");
  }
  if (!verification.verified) {
    res.status(401);
    throw new Error("Passkey verification failed");
  }
  stored.counter = verification.authenticationInfo.newCounter;
  stored.lastUsedAt = new Date();
  req.body.password = password;
  await finishPasswordReset(req, res, user, "a passkey");
});

module.exports = {
  resetOptions,
  resetVerify,
  registerOptions,
  registerVerify,
  listPasskeys,
  deletePasskey,
  loginOptions,
  loginVerify,
};
