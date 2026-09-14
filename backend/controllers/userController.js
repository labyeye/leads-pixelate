const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Role = require("../models/Role");
const logActivity = require("../utils/activityLogger");

// Resolves a roleId (from the Team page's role dropdown) to its tier, scoped
// to the caller's tenant. Role catalog never contains "super_admin", so this
// can never be used to self-escalate.
async function resolveRole(roleId, req, res) {
  const filter = req.user.tenantId
    ? { _id: roleId, tenantId: req.user.tenantId }
    : { _id: roleId, tenantId: null };
  const role = await Role.findOne(filter);
  if (!role) {
    res.status(400);
    throw new Error("Role not found");
  }
  return role;
}

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

  const users = await User.find(query)
    .sort("-createdAt")
    .populate("roleId", "name tier");

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("+bankDetails")
    .populate("roleId", "name tier");

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
  const {
    name,
    email,
    password,
    role,
    roleId,
    phone,
    department,
    avatar,
    designation,
    dateOfJoining,
    dateOfBirth,
    gender,
    employmentType,
    address,
    emergencyContact,
    panNumber,
    bankDetails,
  } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }

  let resolvedRole = "sales_executive";
  let resolvedRoleId = null;
  if (roleId) {
    const found = await resolveRole(roleId, req, res);
    resolvedRole = found.tier;
    resolvedRoleId = found._id;
  } else if (role === "super_admin" && req.user.role !== "super_admin") {
    res.status(403);
    throw new Error("Only a super admin can create another super admin");
  } else if (role) {
    resolvedRole = role;
  }

  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const count = await User.countDocuments(tenantFilter);
  const employeeId = `EMP-${String(count + 1).padStart(3, "0")}`;

  const user = await User.create({
    name,
    email,
    password,
    role: resolvedRole,
    roleId: resolvedRoleId,
    phone,
    department,
    avatar: avatar || undefined,
    employeeId,
    tenantId: req.user.tenantId || null,
    designation,
    dateOfJoining: dateOfJoining || undefined,
    dateOfBirth: dateOfBirth || undefined,
    gender: gender || undefined,
    employmentType: employmentType || undefined,
    address,
    emergencyContact,
    panNumber,
    bankDetails,
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
      roleId: user.roleId,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      employeeId: user.employeeId,
      status: user.status,
      designation: user.designation,
      dateOfJoining: user.dateOfJoining,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      employmentType: user.employmentType,
      address: user.address,
      emergencyContact: user.emergencyContact,
      panNumber: user.panNumber,
    },
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+bankDetails");

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
    roleId,
    phone,
    department,
    status,
    receiveAutoAssignedLeads,
    avatar,
    designation,
    dateOfJoining,
    dateOfBirth,
    gender,
    employmentType,
    address,
    emergencyContact,
    panNumber,
    bankDetails,
  } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password;
  if (roleId) {
    const found = await resolveRole(roleId, req, res);
    user.role = found.tier;
    user.roleId = found._id;
  } else if (role && req.user.role === "super_admin") {
    user.role = role;
    user.roleId = null;
  }
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined) user.department = department;
  if (status) user.status = status;
  if (receiveAutoAssignedLeads !== undefined)
    user.receiveAutoAssignedLeads = receiveAutoAssignedLeads;
  if (avatar !== undefined) user.avatar = avatar;
  if (designation !== undefined) user.designation = designation;
  if (dateOfJoining !== undefined) user.dateOfJoining = dateOfJoining || null;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
  if (gender !== undefined) user.gender = gender;
  if (employmentType !== undefined) user.employmentType = employmentType;
  if (address !== undefined) user.address = address;
  if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
  if (panNumber !== undefined) user.panNumber = panNumber;
  if (bankDetails !== undefined) user.bankDetails = bankDetails;

  let updated = await user.save();
  updated = await updated.populate("roleId", "name tier");

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

const addUserDocument = asyncHandler(async (req, res) => {
  const { name, type, url } = req.body;

  if (!name || !url) {
    res.status(400);
    throw new Error("Document name and url are required");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.documents.push({ name, type: type || "other", url });
  await user.save();

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "User",
    description: `Admin ${req.user.name} uploaded a document for ${user.name}`,
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, data: user.documents });
});

const removeUserDocument = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.documents = user.documents.filter(
    (d) => d._id.toString() !== req.params.docId,
  );
  await user.save();

  res.json({ success: true, data: user.documents });
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
  addUserDocument,
  removeUserDocument,
};
