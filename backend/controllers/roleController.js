const asyncHandler = require("express-async-handler");
const Role = require("../models/Role");
const User = require("../models/User");
const logActivity = require("../utils/activityLogger");

const DEFAULT_ROLES = [
  { name: "Admin", tier: "admin" },
  { name: "Sales Executive", tier: "sales_executive" },
  { name: "Service Manager", tier: "service_manager" },
  { name: "Accountant", tier: "accountant" },
];

function tenantFilter(req) {
  return req.user.tenantId ? { tenantId: req.user.tenantId } : { tenantId: null };
}

async function ensureDefaultRoles(filter) {
  const existing = await Role.find(filter);
  const missing = DEFAULT_ROLES.filter(
    (d) => !existing.some((r) => r.tier === d.tier && r.isDefault),
  );
  if (missing.length) {
    await Role.insertMany(
      missing.map((d) => ({ ...d, ...filter, isDefault: true })),
    );
  }
  return Role.find(filter).sort({ isDefault: -1, name: 1 });
}

const getRoles = asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  const roles = await ensureDefaultRoles(filter);

  const counts = await User.aggregate([
    { $match: { ...filter, roleId: { $ne: null } } },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(
    counts.map((c) => [String(c._id), c.count]),
  );

  res.json({
    success: true,
    data: roles.map((r) => ({
      _id: r._id,
      name: r.name,
      tier: r.tier,
      isDefault: r.isDefault,
      userCount: countMap[String(r._id)] || 0,
    })),
  });
});

const createRole = asyncHandler(async (req, res) => {
  const { name, tier } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Role name is required");
  }
  if (!Role.PERMISSION_TIERS.includes(tier)) {
    res.status(400);
    throw new Error("Invalid permission tier");
  }

  const filter = tenantFilter(req);
  const exists = await Role.findOne({ ...filter, name: name.trim() });
  if (exists) {
    res.status(400);
    throw new Error("A role with this name already exists");
  }

  const role = await Role.create({ ...filter, name: name.trim(), tier });

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Role",
    description: `${req.user.name} created role "${role.name}" (${tier})`,
    targetId: role._id,
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: role });
});

const updateRole = asyncHandler(async (req, res) => {
  const { name, tier } = req.body;
  const filter = tenantFilter(req);
  const role = await Role.findOne({ _id: req.params.id, ...filter });

  if (!role) {
    res.status(404);
    throw new Error("Role not found");
  }

  if (name && name.trim() && name.trim() !== role.name) {
    const exists = await Role.findOne({
      ...filter,
      name: name.trim(),
      _id: { $ne: role._id },
    });
    if (exists) {
      res.status(400);
      throw new Error("A role with this name already exists");
    }
    role.name = name.trim();
  }

  if (tier && tier !== role.tier) {
    if (role.isDefault) {
      res.status(400);
      throw new Error("The permission tier of a default role can't be changed");
    }
    if (!Role.PERMISSION_TIERS.includes(tier)) {
      res.status(400);
      throw new Error("Invalid permission tier");
    }
    role.tier = tier;
    // Keep every user already on this role in sync with its new tier.
    await User.updateMany({ roleId: role._id }, { role: tier });
  }

  await role.save();

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Role",
    description: `${req.user.name} updated role "${role.name}"`,
    targetId: role._id,
    ip: req.ip,
  });

  res.json({ success: true, data: role });
});

const deleteRole = asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  const role = await Role.findOne({ _id: req.params.id, ...filter });

  if (!role) {
    res.status(404);
    throw new Error("Role not found");
  }
  if (role.isDefault) {
    res.status(400);
    throw new Error("Default roles can't be deleted");
  }

  const assignedCount = await User.countDocuments({ roleId: role._id });
  if (assignedCount > 0) {
    res.status(400);
    throw new Error(
      `${assignedCount} team member(s) still have this role — reassign them first`,
    );
  }

  await role.deleteOne();

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Role",
    description: `${req.user.name} deleted role "${role.name}"`,
    targetId: role._id,
    ip: req.ip,
  });

  res.json({ success: true, message: "Role deleted" });
});

module.exports = { getRoles, createRole, updateRole, deleteRole };
