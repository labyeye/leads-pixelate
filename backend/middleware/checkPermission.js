const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");

const DEFAULT_PERMISSIONS = {
  Leads: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  Products: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  Clients: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: { create: false, read: true, update: true, delete: false },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  Quotations: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: true, read: true, update: true, delete: false },
  },
  Services: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    service_manager: { create: true, read: true, update: true, delete: false },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  Reports: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  "Visit Calendar": {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: false, update: false, delete: false },
  },
  "Follow-ups": {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: { create: true, read: true, update: true, delete: false },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: false, update: false, delete: false },
  },
  "Team / Users": {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: false },
    sales_executive: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: false, update: false, delete: false },
  },
  Integrations: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: false, update: false, delete: false },
  },
  Billing: {
    super_admin: { create: true, read: true, update: true, delete: false },
    admin: { create: false, read: true, update: false, delete: false },
    sales_executive: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: true, update: false, delete: false },
  },
  Settings: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: false, read: true, update: true, delete: false },
    sales_executive: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: false, update: false, delete: false },
  },
  Campaigns: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    sales_executive: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    service_manager: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    accountant: { create: false, read: true, update: false, delete: false },
  },
};

const permissionsCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function getTenantPermissions(tenantId) {
  const key = tenantId ? tenantId.toString() : "global";
  const cached = permissionsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const setting = await Setting.findOne({ tenantId: tenantId || null }).lean();
  const data = setting?.permissions || null;
  permissionsCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function invalidatePermissionsCache(tenantId) {
  const key = tenantId ? tenantId.toString() : "global";
  permissionsCache.delete(key);
}

function checkPermission(resource, op) {
  return asyncHandler(async (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      res.status(401);
      throw new Error("Not authorized");
    }

    if (role === "super_admin") return next();

    const tenantPerms = await getTenantPermissions(req.user.tenantId);
    const matrix = tenantPerms || DEFAULT_PERMISSIONS;

    const resourcePerms = matrix[resource];
    if (!resourcePerms) {
      if (op === "read") return next();
      if (role === "admin") return next();
      res.status(403);
      throw new Error("You do not have permission to perform this action");
    }

    const rolePerms = resourcePerms[role];
    if (!rolePerms || !rolePerms[op]) {
      res.status(403);
      throw new Error("You do not have permission to perform this action");
    }

    next();
  });
}

module.exports = {
  checkPermission,
  invalidatePermissionsCache,
  DEFAULT_PERMISSIONS,
};
