const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const logActivity = require("../utils/activityLogger");

const getUsers = asyncHandler(async (req, res) => {
  const { status, role, search } = req.query;

  const query = {};

  if (req.user.tenantId) query.tenantId = req.user.tenantId;

  if (status) query.status = status;
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(query).sort("-createdAt");

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    success: true,
    data: user,
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department, avatar } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const count = await User.countDocuments(tenantFilter);
  const employeeId = `EMP-${String(count + 1).padStart(3, "0")}`;

  const user = await User.create({
    name,
    email,
    password,
    role: role || "sales_executive",
    phone,
    department,
    avatar: avatar || undefined,
    employeeId,
    tenantId: req.user.tenantId || null,
  });

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "User",
    description: `Admin ${req.user.name} created user: ${user.name} (${user.role})`,
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
      avatar: user.avatar,
      employeeId: user.employeeId,
      status: user.status,
    },
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.role === "super_admin" && req.user.role !== "super_admin") {
    res.status(403);
    throw new Error("Cannot modify super admin account");
  }

  const {
    name,
    email,
    password,
    role,
    phone,
    department,
    status,
    receiveAutoAssignedLeads,
    avatar,
  } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password;
  if (role && req.user.role === "super_admin") user.role = role;
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined) user.department = department;
  if (status) user.status = status;
  if (receiveAutoAssignedLeads !== undefined)
    user.receiveAutoAssignedLeads = receiveAutoAssignedLeads;
  if (avatar !== undefined) user.avatar = avatar;

  const updated = await user.save();

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "User",
    description: `Admin ${req.user.name} updated user: ${updated.name}`,
    targetId: updated._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: updated,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(403);
    throw new Error("Cannot deactivate your own account");
  }

  if (user.role === "super_admin" && req.user.role !== "super_admin") {
    res.status(403);
    throw new Error("Only a super admin can remove another super admin");
  }

  await User.findByIdAndDelete(user._id);

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "User",
    description: `Admin ${req.user.name} deleted user: ${user.name}`,
    targetId: user._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "User deleted successfully",
  });
});

const updateAutoAssign = asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    res.status(400);
    throw new Error("userIds must be an array");
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};

  await User.updateMany(tenantFilter, { receiveAutoAssignedLeads: false });

  if (userIds.length > 0) {
    await User.updateMany(
      { _id: { $in: userIds }, ...tenantFilter },
      { receiveAutoAssignedLeads: true },
    );
  }

  res.json({
    success: true,
    message: "Auto-assign preferences updated successfully",
  });
});

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateAutoAssign,
};
