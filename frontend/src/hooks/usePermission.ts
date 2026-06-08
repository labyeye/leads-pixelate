import { useAuth } from "@/contexts/AuthContext";

type CrudOp = "create" | "read" | "update" | "delete";

// Mirrors DEFAULT_PERMISSIONS in backend/middleware/checkPermission.js
const DEFAULT_PERMISSIONS: Record<
  string,
  Record<string, Record<CrudOp, boolean>>
> = {
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

export function usePermission() {
  const { user, permissions } = useAuth();

  function can(resource: string, op: CrudOp): boolean {
    if (!user) return false;
    if (user.role === "super_admin") return true;

    const matrix = permissions || DEFAULT_PERMISSIONS;
    const resourcePerms = matrix[resource];
    if (!resourcePerms) {
      return op === "read" || user.role === "admin";
    }
    return resourcePerms[user.role]?.[op] ?? false;
  }

  return { can };
}
