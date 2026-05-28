const asyncHandler = require("express-async-handler");
const validator = require("validator");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const generateToken = require("../utils/generateToken");
const logActivity = require("../utils/activityLogger");

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
  if (phone !== undefined) user.phone = phone.trim();
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

module.exports = { register, login, getMe, updateProfile, changePassword };
