import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { settingsAPI, rolesAPI, Role } from "@/services/api";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Landmark,
  FileCheck,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ImageIcon,
  X,
  Tag,
  ChevronUp,
  ChevronDown,
  Lock,
  Bot,
  Palette,
  Hash,
} from "lucide-react";
import AICallingSettingsTab from "@/components/settings/AICallingSettingsTab";
import NumberingTab from "@/components/settings/NumberingTab";
import QuotationApprovalTab from "@/components/settings/QuotationApprovalTab";
import InvoiceDesigner from "@/components/settings/invoice-designer/InvoiceDesigner";
import { cn } from "@/lib/utils";
import {
  categories as statusCategories,
  PROTECTED_STATUSES,
  COLOR_PRESETS,
  colorKeyToClasses,
  statusColors,
  setStatusOverrides,
  setCustomLeadStatuses,
  isCustomLeadStatus,
  type CustomLeadStatus,
} from "@/components/leads/statusConstants";

const EXTENDABLE_STATUS_CATEGORIES = [
  "New Lead",
  "Discussion/Requirement",
  "Quotation",
];

type CrudOp = "create" | "read" | "update" | "delete";
type CrmRole =
  | "super_admin"
  | "admin"
  | "sales_executive"
  | "service_manager"
  | "accountant";

interface ResourcePermissions {
  resource: string;
  // keyed by tier (default roles) or by role _id (custom roles)
  permissions: Record<string, Record<CrudOp, boolean>>;
}

const NO_ACCESS: Record<CrudOp, boolean> = {
  create: false,
  read: false,
  update: false,
  delete: false,
};

const CRM_ROLES: { id: CrmRole; label: string }[] = [
  { id: "super_admin", label: "Super Admin" },
  { id: "admin", label: "Admin" },
  { id: "sales_executive", label: "Sales Exec" },
  { id: "service_manager", label: "Service Mgr" },
  { id: "accountant", label: "Accountant" },
];

const defaultAll = (): Record<CrmRole, Record<CrudOp, boolean>> => ({
  super_admin: { create: true, read: true, update: true, delete: true },
  admin: { create: true, read: true, update: true, delete: true },
  sales_executive: { create: false, read: false, update: false, delete: false },
  service_manager: { create: false, read: false, update: false, delete: false },
  accountant: { create: false, read: false, update: false, delete: false },
});

const INITIAL_PERMISSIONS: ResourcePermissions[] = [
  {
    resource: "Leads",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
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
  },
  {
    resource: "Products",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
        read: true,
        update: true,
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
  },
  {
    resource: "Clients",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
        read: true,
        update: true,
        delete: false,
      },
      service_manager: {
        create: false,
        read: true,
        update: true,
        delete: false,
      },
      accountant: { create: false, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Quotations",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
        read: true,
        update: true,
        delete: false,
      },
      service_manager: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      accountant: { create: true, read: true, update: true, delete: false },
    },
  },
  {
    resource: "Services",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      service_manager: {
        create: true,
        read: true,
        update: true,
        delete: false,
      },
      accountant: { create: false, read: true, update: false, delete: false },
    },
  },
  {
    resource: "Reports",
    permissions: {
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
  },
  {
    resource: "Campaigns",
    permissions: {
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
  },
  {
    resource: "Visit Calendar",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
        read: true,
        update: true,
        delete: false,
      },
      service_manager: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      accountant: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Follow-ups",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: true, read: true, update: true, delete: true },
      sales_executive: {
        create: true,
        read: true,
        update: true,
        delete: false,
      },
      service_manager: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
      accountant: { create: false, read: false, update: false, delete: false },
    },
  },
  {
    resource: "Team / Users",
    permissions: {
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
  },
  {
    resource: "Integrations",
    permissions: {
      ...defaultAll(),
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
  },
  {
    resource: "Billing",
    permissions: {
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
  },
  {
    resource: "Settings",
    permissions: {
      super_admin: { create: true, read: true, update: true, delete: true },
      admin: { create: false, read: true, update: true, delete: false },
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
  },
];

const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

function StateField({
  value,
  readOnly,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-black uppercase tracking-wider">
        State
      </label>
      <select
        name="companyState"
        value={value}
        onChange={onChange}
        disabled={readOnly}
        className={cn(
          "w-full px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0",
          readOnly
            ? "bg-gray-50 cursor-default text-muted-foreground"
            : "bg-white",
        )}
      >
        <option value="">Select state</option>
        {INDIA_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  placeholder = "",
  type = "text",
  readOnly = false,
  onChange,
  maxLength,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-black uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        inputMode={inputMode}
        className={cn(
          "w-full px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0",
          readOnly
            ? "bg-gray-50 cursor-default text-muted-foreground"
            : "bg-white",
        )}
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  placeholder = "",
  rows = 3,
  readOnly = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-black uppercase tracking-wider">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={cn(
          "w-full px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 resize-none",
          readOnly
            ? "bg-gray-50 cursor-default text-muted-foreground"
            : "bg-white",
        )}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user, tenant, refreshPermissions } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [isOwner, setIsOwner] = useState(false);
  const [designersOpened, setDesignersOpened] = useState<string[]>([]); // each stays mounted after its first visit so edits survive tab switches
  useEffect(() => {
    if (activeTab.endsWith("-design"))
      setDesignersOpened((d) =>
        d.includes(activeTab) ? d : [...d, activeTab],
      );
  }, [activeTab]);
  const [permissions, setPermissions] =
    useState<ResourcePermissions[]>(INITIAL_PERMISSIONS);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    tier: "sales_executive",
  });
  const [savingRole, setSavingRole] = useState(false);

  const TIER_LABELS: Record<string, string> = {
    admin: "Admin",
    sales_executive: "Sales Executive",
    service_manager: "Service Manager",
    accountant: "Accountant",
  };

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await rolesAPI.getAll();
      if (res.success) setRoles(res.data);
    } catch (error: any) {
      toast({
        title: "Failed to load roles",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRolesLoading(false);
    }
  };

  const resetRoleForm = () => {
    setEditingRoleId(null);
    setRoleForm({ name: "", tier: "sales_executive" });
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role._id);
    setRoleForm({ name: role.name, tier: role.tier });
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    try {
      setSavingRole(true);
      const res = editingRoleId
        ? await rolesAPI.update(editingRoleId, roleForm)
        : await rolesAPI.create(roleForm);
      if (res.success) {
        toast({
          title: editingRoleId ? "Role updated" : "Role created",
        });
        resetRoleForm();
        fetchRoles();
      }
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Delete the role "${role.name}"?`)) return;
    try {
      const res = await rolesAPI.delete(role._id);
      if (res.success) {
        toast({ title: "Role deleted" });
        fetchRoles();
      }
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchRoles();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.get();
      setIsOwner(!!res.isOwner);
      setSettings({
        ...res.data,
        companyName: res.data?.companyName || tenant?.name || "",
      });
      setCustomLeadStatuses(
        res.data?.customLeadStatuses,
        res.data?.customLeadCategories || [],
      );

      if (res.data?.permissions) {
        const saved = res.data.permissions as Record<string, any>;
        setPermissions((prev) =>
          prev.map((r) =>
            saved[r.resource]
              ? {
                  ...r,
                  permissions: { ...r.permissions, ...saved[r.resource] },
                }
              : r,
          ),
        );
      }
    } catch (error: any) {
      setSettings({
        companyName: tenant?.name || "",
        companyGST: "",
        companyPAN: "",
        companyState: "",
        companyStateCode: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: user?.email || "",
        companyWebsite: "",
        logoUrl: "",
        bankAccountName: "",
        bankAccountNumber: "",
        bankIFSC: "",
        bankName: "",
        bankBranch: "",
        bankAccountType: "Current",
        quotationTitle: "PROFORMA INVOICE",
        quotationFooter: "",
        quotationTerms: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    setSavingPerms(true);
    try {
      const permissionsMap: Record<
        string,
        Record<string, Record<string, boolean>>
      > = {};
      const live = new Set(permColumns.map((c) => c.id)); // drops columns of deleted roles
      permissions.forEach((r) => {
        permissionsMap[r.resource] = Object.fromEntries(
          Object.entries(r.permissions).filter(([k]) => live.has(k)),
        );
      });
      await settingsAPI.update({ permissions: permissionsMap });
      await refreshPermissions();
      toast({
        title: "Permissions saved",
        description: "Role permissions updated successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save permissions.",
        variant: "destructive",
      });
    } finally {
      setSavingPerms(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name } = e.target;
    let value = e.target.value;
    if (["companyGST", "companyPAN", "bankIFSC"].includes(name)) {
      value = value.toUpperCase();
    }
    if (name === "companyPhone" || name === "bankAccountNumber") {
      value = value.replace(/\D/g, "");
    }
    if (name === "companyStateCode") {
      value = value.replace(/\D/g, "");
    }
    setSettings((prev: any) => ({ ...prev, [name]: value }));
  };

  const updateStatusOverride = (
    status: string,
    patch: { label?: string; color?: string },
  ) => {
    setSettings((prev: any) => ({
      ...prev,
      leadStatusLabels: {
        ...(prev.leadStatusLabels || {}),
        [status]: { ...(prev.leadStatusLabels?.[status] || {}), ...patch },
      },
    }));
  };

  const resetStatusOverride = (status: string) => {
    setSettings((prev: any) => {
      const next = { ...(prev.leadStatusLabels || {}) };
      delete next[status];
      return { ...prev, leadStatusLabels: next };
    });
  };

  const updateCustomStatus = (
    value: string,
    patch: Partial<CustomLeadStatus>,
  ) => {
    setSettings((prev: any) => {
      const next = (prev.customLeadStatuses || []).map((s: CustomLeadStatus) =>
        s.value === value ? { ...s, ...patch } : s,
      );
      setCustomLeadStatuses(next, prev.customLeadCategories || []);
      return { ...prev, customLeadStatuses: next };
    });
  };

  const removeCustomStatus = (value: string) => {
    setSettings((prev: any) => {
      const next = (prev.customLeadStatuses || []).filter(
        (s: CustomLeadStatus) => s.value !== value,
      );
      setCustomLeadStatuses(next, prev.customLeadCategories || []);
      return { ...prev, customLeadStatuses: next };
    });
  };

  const addCustomStatus = (category: string) => {
    setSettings((prev: any) => {
      const existing: CustomLeadStatus[] = prev.customLeadStatuses || [];
      const tempValue = `NEW_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const next = [
        ...existing,
        {
          value: tempValue,
          category,
          label: "New Stage",
          colorKey: "slate",
          order: existing.filter((s) => s.category === category).length,
          role: "active" as const,
          requireRemarks: true,
          requireFollowUp: true,
          autoFollowUpDays: 0,
        },
      ];
      setCustomLeadStatuses(next, prev.customLeadCategories || []);
      return { ...prev, customLeadStatuses: next };
    });
  };

  const moveCustomStatus = (value: string, direction: "up" | "down") => {
    setSettings((prev: any) => {
      const existing: CustomLeadStatus[] = prev.customLeadStatuses || [];
      const item = existing.find((s) => s.value === value);
      if (!item) return prev;
      const siblings = existing
        .filter((s) => s.category === item.category)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = siblings.findIndex((s) => s.value === value);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      const next = existing.map((s) => {
        if (s.value === a.value) return { ...s, order: b.order ?? 0 };
        if (s.value === b.value) return { ...s, order: a.order ?? 0 };
        return s;
      });
      setCustomLeadStatuses(next, prev.customLeadCategories || []);
      return { ...prev, customLeadStatuses: next };
    });
  };

  const PIPELINE_TEMPLATES: Record<
    string,
    {
      label: string;
      groups: {
        name: string;
        stages: {
          label: string;
          colorKey: string;
          role?: string;
          days?: number;
        }[];
      }[];
    }
  > = {
    blank: { label: "Default (no custom groups)", groups: [] },
    realestate: {
      label: "Real estate",
      groups: [
        {
          name: "Site Visit",
          stages: [
            { label: "Visit Planned", colorKey: "cyan", days: 1 },
            { label: "Visit Done", colorKey: "teal", days: 2 },
          ],
        },
        {
          name: "Negotiation",
          stages: [
            {
              label: "Price Discussion",
              colorKey: "orange",
              role: "hot",
              days: 2,
            },
            {
              label: "Booking Pending",
              colorKey: "emerald",
              role: "hot",
              days: 1,
            },
          ],
        },
      ],
    },
    manufacturing: {
      label: "Manufacturing / B2B",
      groups: [
        {
          name: "Sampling",
          stages: [
            { label: "Sample Sent", colorKey: "purple", days: 3 },
            { label: "Sample Feedback", colorKey: "blue", days: 2 },
          ],
        },
        {
          name: "Negotiation",
          stages: [
            {
              label: "Price Negotiation",
              colorKey: "orange",
              role: "hot",
              days: 2,
            },
            { label: "PO Pending", colorKey: "emerald", role: "hot", days: 3 },
          ],
        },
      ],
    },
    services: {
      label: "Services / Agency",
      groups: [
        {
          name: "Proposal",
          stages: [
            { label: "Proposal Sent", colorKey: "purple", days: 2 },
            { label: "Proposal Review", colorKey: "blue", days: 3 },
          ],
        },
        {
          name: "Onboarding",
          stages: [
            {
              label: "Contract Sent",
              colorKey: "orange",
              role: "hot",
              days: 2,
            },
            { label: "Kickoff Planned", colorKey: "emerald", days: 1 },
          ],
        },
      ],
    },
  };

  const applyPipelineTemplate = (key: string) => {
    const t = PIPELINE_TEMPLATES[key];
    if (!t) return;
    setSettings((prev: any) => {
      const cats = t.groups.map((g) => g.name);
      const stages: CustomLeadStatus[] = t.groups.flatMap((g) =>
        g.stages.map((st, i) => ({
          value: `NEW_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          category: g.name,
          label: st.label,
          colorKey: st.colorKey,
          order: i,
          role: (st.role as any) || "active",
          requireRemarks: true,
          requireFollowUp: true,
          autoFollowUpDays: st.days || 0,
        })),
      );
      setCustomLeadStatuses(stages, cats);
      return {
        ...prev,
        customLeadCategories: cats,
        customLeadStatuses: stages,
      };
    });
  };

  const [newGroupName, setNewGroupName] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openStage, setOpenStage] = useState<string | null>(null);

  const addPipelineGroup = () => {
    const name = newGroupName.replace(/\s+/g, " ").trim().slice(0, 30);
    if (!name) return;
    setSettings((prev: any) => {
      const cats: string[] = prev.customLeadCategories || [];
      const taken = [...Object.keys(statusCategories), ...cats].map((c) =>
        c.toLowerCase(),
      );
      if (taken.includes(name.toLowerCase()) || cats.length >= 8) return prev;
      const nextCats = [...cats, name];
      setCustomLeadStatuses(prev.customLeadStatuses || [], nextCats);
      return { ...prev, customLeadCategories: nextCats };
    });
    setOpenGroups((o) => ({
      ...o,
      [newGroupName.replace(/\s+/g, " ").trim().slice(0, 30)]: true,
    }));
    setNewGroupName("");
  };

  const removePipelineGroup = (name: string) => {
    setSettings((prev: any) => {
      const nextCats = (prev.customLeadCategories || []).filter(
        (c: string) => c !== name,
      );
      const nextStatuses = (prev.customLeadStatuses || []).filter(
        (s: CustomLeadStatus) => s.category !== name,
      );
      setCustomLeadStatuses(nextStatuses, nextCats);
      return {
        ...prev,
        customLeadCategories: nextCats,
        customLeadStatuses: nextStatuses,
      };
    });
  };

  const handleTermsChange = (index: number, value: string) => {
    const newTerms = [...(settings.quotationTerms || [])];
    newTerms[index] = value;
    setSettings((prev: any) => ({ ...prev, quotationTerms: newTerms }));
  };

  const addTerm = () => {
    setSettings((prev: any) => ({
      ...prev,
      quotationTerms: [...(prev.quotationTerms || []), ""],
    }));
  };

  const removeTerm = (index: number) => {
    const newTerms = (settings.quotationTerms || []).filter(
      (_: any, i: number) => i !== index,
    );
    setSettings((prev: any) => ({ ...prev, quotationTerms: newTerms }));
  };

  // One column per default tier plus one per custom role. A custom role with no saved column
  // yet shows (and starts from) its tier's values.
  const permColumns: {
    id: string;
    label: string;
    tier: string;
    custom: boolean;
  }[] = [
    ...CRM_ROLES.map((r) => ({ ...r, tier: r.id as string, custom: false })),
    ...roles
      .filter((r) => !r.isDefault)
      .map((r) => ({
        id: r._id,
        label: r.name,
        tier: r.tier as string,
        custom: true,
      })),
  ];
  const cellPerms = (
    res: ResourcePermissions,
    col: { id: string; tier: string },
  ) => res.permissions[col.id] ?? res.permissions[col.tier] ?? NO_ACCESS;

  const togglePermission = (
    resourceIdx: number,
    col: { id: string; tier: string },
    op: CrudOp,
  ) => {
    setPermissions((prev) =>
      prev.map((r, i) => {
        if (i !== resourceIdx) return r;
        const cur = cellPerms(r, col);
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [col.id]: { ...cur, [op]: !cur[op] },
          },
        };
      }),
    );
  };

  const handleSave = async () => {
    const gst = settings?.companyGST?.trim();
    const pan = settings?.companyPAN?.trim();
    const phone = settings?.companyPhone?.trim();
    const ifsc = settings?.bankIFSC?.trim();
    const accNo = settings?.bankAccountNumber?.trim();
    const stateCode = settings?.companyStateCode?.trim();

    if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid GSTIN",
        message: "GSTIN must be 15 characters (e.g. 07AAAAA0000A1Z5).",
      });
      return;
    }
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid PAN",
        message: "PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).",
      });
      return;
    }
    if (
      phone &&
      !/^[6-9]\d{9}$/.test(phone) &&
      !(phone.length >= 8 && phone.length <= 15)
    ) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid Phone",
        message: "Enter a valid phone number.",
      });
      return;
    }
    if (stateCode && !/^\d{1,2}$/.test(stateCode)) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid State Code",
        message: "State code must be a 1-2 digit number (e.g. 07).",
      });
      return;
    }
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid IFSC",
        message:
          "IFSC format: 4 letters, 0, 6 alphanumeric (e.g. SBIN0001234).",
      });
      return;
    }
    if (accNo && !/^\d{9,18}$/.test(accNo)) {
      setActionModal({
        show: true,
        type: "error",
        title: "Invalid Account Number",
        message: "Account number must be 9–18 digits.",
      });
      return;
    }
    try {
      setSaving(true);
      const {
        invoiceTemplate: _i,
        quotationTemplate: _q,
        ...generalSettings
      } = settings; // the designers save their own
      const res = await settingsAPI.update(generalSettings);
      setStatusOverrides(res.data?.leadStatusLabels);
      setCustomLeadStatuses(
        res.data?.customLeadStatuses,
        res.data?.customLeadCategories || [],
      );
      setSettings((prev: any) => ({
        ...prev,
        customLeadStatuses: res.data?.customLeadStatuses || [],
        customLeadCategories: res.data?.customLeadCategories || [],
      }));
      setActionModal({
        show: true,
        type: "success",
        title: "Settings Saved",
        message: "Settings saved successfully.",
      });
    } catch (error: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: error.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (actionModal.show && actionModal.type === "success") {
      const t = setTimeout(
        () => setActionModal((m) => ({ ...m, show: false })),
        2000,
      );
      return () => clearTimeout(t);
    }
  }, [actionModal.show, actionModal.type]);

  if (loading) {
    return (
      <AppLayout title="Settings">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black nb-shadow animate-bounce flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const isAdminOrAbove =
    !user?.role ||
    user?.role?.toLowerCase().includes("admin") ||
    user?.role === "super_admin" ||
    user?.role === "admin";

  const allTabs = [
    { id: "general", label: "General Info", icon: Building2, adminOnly: false },
    { id: "bank", label: "Bank Details", icon: Landmark, adminOnly: true },
    { id: "terms", label: "Terms & Footer", icon: FileCheck, adminOnly: true },
    {
      id: "invoice-design",
      label: "Invoice Designer",
      icon: Palette,
      adminOnly: true,
    },
    {
      id: "quotation-design",
      label: "Quotation Designer",
      icon: Palette,
      adminOnly: true,
    },
    {
      id: "quotation-approval",
      label: "Quotation Approval",
      icon: ShieldCheck,
      adminOnly: true,
    },
    {
      id: "numbering",
      label: "Numbering",
      icon: Hash,
      adminOnly: true,
      ownerOnly: true,
    },
    {
      id: "statuses",
      label: "Lead Statuses",
      icon: Tag,
      adminOnly: true,
    },
    {
      id: "ai-calling",
      label: "AI Calling (ElevenLabs)",
      icon: Bot,
      adminOnly: false,
    },
    {
      id: "roles",
      label: "Roles",
      icon: ShieldCheck,
      adminOnly: true,
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: ShieldCheck,
      adminOnly: true,
    },
  ];
  const tabs = allTabs.filter(
    (t: any) => (!t.adminOnly || isAdminOrAbove) && (!t.ownerOnly || isOwner),
  );

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be under 2 MB.",
        variant: "destructive",
      });
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 300;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", 0.75);
      setSettings((prev: any) => ({ ...prev, logoUrl: compressed }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Could not read image", variant: "destructive" });
    };
    img.src = objectUrl;
  };

  const handleRemoveLogo = () => {
    setSettings((prev: any) => ({ ...prev, logoUrl: "" }));
  };

  return (
    <AppLayout title="Settings">
      <div className="flex flex-col lg:flex-row h-full">
        {}
        <div className="lg:w-56 lg:shrink-0 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-white lg:overflow-y-auto">
          <div className="hidden lg:block p-4 border-b-2 border-black">
            <h1 className="text-base font-display font-medium text-black">
              Settings
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Company & system config
            </p>
          </div>
          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible p-2 gap-1 lg:gap-0">
            <p className="hidden lg:block text-[10px] font-medium text-black/40 uppercase tracking-widest px-2 pt-3 pb-1">
              Company
            </p>
            {tabs
              .filter((t) =>
                [
                  "general",
                  "bank",
                  "terms",
                  "invoice-design",
                  "quotation-design",
                  "quotation-approval",
                  "statuses",
                ].includes(t.id),
              )
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 text-xs font-medium whitespace-nowrap rounded transition-colors lg:w-full lg:text-left lg:mb-0.5",
                      activeTab === tab.id
                        ? "bg-[#024BAB] text-white"
                        : "text-black hover:bg-[#024BAB]/10",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            <p className="hidden lg:block text-[10px] font-medium text-black/40 uppercase tracking-widest px-2 pt-4 pb-1">
              AI & Automation
            </p>
            {tabs
              .filter((t) => t.id === "ai-calling")
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 text-xs font-medium whitespace-nowrap rounded transition-colors lg:w-full lg:text-left lg:mb-0.5",
                      activeTab === tab.id
                        ? "bg-[#024BAB] text-white"
                        : "text-black hover:bg-[#024BAB]/10",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            <p className="hidden lg:block text-[10px] font-medium text-black/40 uppercase tracking-widest px-2 pt-4 pb-1">
              System
            </p>
            {tabs
              .filter((t) => ["roles", "permissions"].includes(t.id))
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 text-xs font-medium whitespace-nowrap rounded transition-colors lg:w-full lg:text-left lg:mb-0.5",
                      activeTab === tab.id
                        ? "bg-[#024BAB] text-white"
                        : "text-black hover:bg-[#024BAB]/10",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
          </nav>
        </div>

        {}
        <div className="flex-1 overflow-y-auto">
          {}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b-2 border-black bg-white sticky top-0 z-10">
            <div>
              <h2 className="font-display font-medium text-black">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
            {activeTab !== "permissions" &&
              activeTab !== "invoice-design" &&
              activeTab !== "quotation-design" &&
              activeTab !== "ai-calling" &&
              activeTab !== "numbering" &&
              isAdminOrAbove && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    "nb-btn px-5 py-2 text-sm font-medium text-white border-2 border-black flex items-center gap-2",
                    saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#024BAB] hover:bg-[#01368A]",
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              )}
          </div>

          {isAdminOrAbove &&
            (["invoice", "quotation"] as const).map((kind) =>
              designersOpened.includes(`${kind}-design`) ? (
                <div
                  key={kind}
                  className={activeTab === `${kind}-design` ? "" : "hidden"}
                >
                  <InvoiceDesigner
                    kind={kind}
                    settings={settings}
                    active={activeTab === `${kind}-design`}
                    isOwner={isOwner}
                    onNumberingSaved={(n) =>
                      setSettings((prev: any) => ({ ...prev, numbering: n }))
                    }
                    onSaved={(t) =>
                      setSettings((prev: any) => ({
                        ...prev,
                        [`${kind}Template`]: t,
                      }))
                    }
                  />
                </div>
              ) : null,
            )}

          <div
            className={cn(
              "p-4 sm:p-6 max-w-3xl",
              activeTab.endsWith("-design") && "hidden",
            )}
          >
            {}
            {activeTab === "general" && (
              <div className="space-y-4">
                {!isAdminOrAbove && (
                  <div className="flex items-center gap-2 px-3 py-2 border-2 border-[#F59E0B] bg-[#FFF7ED] text-xs font-medium text-[#92400E]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    View only — contact your admin to update company settings.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    onChange={handleChange}
                    label="Company Name"
                    name="companyName"
                    value={settings?.companyName || ""}
                    readOnly={!isAdminOrAbove}
                  />
                  <InputField
                    onChange={handleChange}
                    label="GST Number (GSTIN)"
                    name="companyGST"
                    value={settings?.companyGST || ""}
                    placeholder="07AAAAA0000A1Z5"
                    readOnly={!isAdminOrAbove}
                    maxLength={15}
                  />
                  <InputField
                    onChange={handleChange}
                    label="PAN Number"
                    name="companyPAN"
                    value={settings?.companyPAN || ""}
                    placeholder="ABCDE1234F"
                    readOnly={!isAdminOrAbove}
                    maxLength={10}
                  />
                  <StateField
                    value={settings?.companyState || ""}
                    readOnly={!isAdminOrAbove}
                    onChange={handleChange}
                  />
                  <InputField
                    onChange={handleChange}
                    label="State Code"
                    name="companyStateCode"
                    value={settings?.companyStateCode || ""}
                    placeholder="e.g. 10"
                    readOnly={!isAdminOrAbove}
                    maxLength={2}
                    inputMode="numeric"
                  />
                  <PhoneInput
                    label="Phone Number"
                    value={settings?.companyPhone || ""}
                    onChange={(v) =>
                      setSettings((prev: any) => ({ ...prev, companyPhone: v }))
                    }
                    readOnly={!isAdminOrAbove}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Email Address"
                    name="companyEmail"
                    value={settings?.companyEmail || ""}
                    type="email"
                    readOnly={!isAdminOrAbove}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Website URL"
                    name="companyWebsite"
                    value={settings?.companyWebsite || ""}
                    placeholder="https://example.com"
                    readOnly={!isAdminOrAbove}
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-widest text-black">
                      Company Logo
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 border-2 border-black bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {settings?.logoUrl ? (
                          <img
                            src={settings.logoUrl}
                            alt="Company logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-black/20" />
                        )}
                      </div>
                      {isAdminOrAbove && (
                        <label className="nb-btn cursor-pointer px-3 py-2 bg-white border-2 border-black text-xs font-medium uppercase tracking-widest">
                          Upload
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="sr-only"
                            onChange={handleLogoFileChange}
                          />
                        </label>
                      )}
                      {isAdminOrAbove && settings?.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="text-[10px] font-medium underline"
                        >
                          Remove
                        </button>
                      )}
                      <span className="text-[10px] text-black/50">
                        PNG, JPG, SVG or WebP · max 2 MB
                      </span>
                    </div>
                  </div>
                </div>
                <TextAreaField
                  onChange={handleChange}
                  label="Company Address"
                  name="companyAddress"
                  value={settings?.companyAddress || ""}
                  placeholder="Enter full company address"
                  rows={3}
                  readOnly={!isAdminOrAbove}
                />
              </div>
            )}

            {}
            {activeTab === "bank" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    onChange={handleChange}
                    label="Account Holder Name"
                    name="bankAccountName"
                    value={settings?.bankAccountName || ""}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Account Number"
                    name="bankAccountNumber"
                    value={settings?.bankAccountNumber || ""}
                    maxLength={18}
                    inputMode="numeric"
                  />
                  <InputField
                    onChange={handleChange}
                    label="IFSC Code"
                    name="bankIFSC"
                    value={settings?.bankIFSC || ""}
                    maxLength={11}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Bank Name"
                    name="bankName"
                    value={settings?.bankName || ""}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Branch Name"
                    name="bankBranch"
                    value={settings?.bankBranch || ""}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Account Type"
                    name="bankAccountType"
                    value={settings?.bankAccountType || "Current"}
                    placeholder="e.g. Current"
                  />
                </div>
              </div>
            )}

            {}
            {activeTab === "terms" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <InputField
                    onChange={handleChange}
                    label="Quotation Page Title"
                    name="quotationTitle"
                    value={settings?.quotationTitle || ""}
                    placeholder="e.g. PROFORMA INVOICE"
                  />
                  <TextAreaField
                    onChange={handleChange}
                    label="Footer Message"
                    name="quotationFooter"
                    value={settings?.quotationFooter || ""}
                    placeholder="e.g. This is a computer generated document."
                    rows={2}
                  />
                </div>

                <div className="border-t-2 border-black pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-black uppercase tracking-wider">
                      Terms & Conditions
                    </h3>
                    <button
                      onClick={addTerm}
                      className="nb-btn px-3 py-1.5 text-xs font-medium text-white bg-[#00C48C] border-2 border-black flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Term
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(settings?.quotationTerms || []).map(
                      (term: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <textarea
                            value={term}
                            onChange={(e) =>
                              handleTermsChange(index, e.target.value)
                            }
                            placeholder={`Term ${index + 1}`}
                            rows={2}
                            className="flex-1 px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
                          />
                          <button
                            onClick={() => removeTerm(index)}
                            className="nb-btn px-3 py-2 text-white bg-[#EF4444] border-2 border-black self-start"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ),
                    )}
                    {(!settings?.quotationTerms ||
                      settings.quotationTerms.length === 0) && (
                      <div className="text-center py-6 border-2 border-dashed border-black/30">
                        <p className="text-xs text-muted-foreground">
                          No terms added. Click "Add Term" to get started.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {}
            {activeTab === "quotation-approval" && (
              <QuotationApprovalTab
                value={settings?.quotationApproval}
                onChange={(v) =>
                  setSettings((p: any) => ({ ...p, quotationApproval: v }))
                }
              />
            )}
            {activeTab === "numbering" && isOwner && (
              <NumberingTab
                saved={settings?.numbering}
                onSaved={(n) =>
                  setSettings((p: any) => ({ ...p, numbering: n }))
                }
              />
            )}
            {activeTab === "statuses" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground mr-auto">
                    Open a group to rename stages, change colors or add your
                    own. Save to apply.
                  </p>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const k = e.target.value;
                      if (!k) return;
                      if (
                        (settings?.customLeadStatuses || []).length === 0 ||
                        window.confirm(
                          "Replace your current groups and custom stages with this template?",
                        )
                      )
                        applyPipelineTemplate(k);
                      e.target.value = "";
                    }}
                    className="h-8 border-2 border-black bg-white px-2 text-xs"
                  >
                    <option value="">Template…</option>
                    {Object.entries(PIPELINE_TEMPLATES).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex">
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPipelineGroup();
                      }}
                      maxLength={30}
                      placeholder="New group name"
                      className="h-8 w-40 text-xs px-2 border-2 border-black focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addPipelineGroup}
                      disabled={!newGroupName.trim()}
                      title="Add group (becomes a tab after Quotation)"
                      className="h-8 px-2 border-2 border-l-0 border-black bg-[#024BAB] text-white disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {Object.entries(statusCategories).map(([cat, values]) => {
                  const isOpen = !!openGroups[cat];
                  const isGroup = (
                    settings?.customLeadCategories || []
                  ).includes(cat);
                  const canAdd =
                    EXTENDABLE_STATUS_CATEGORIES.includes(cat) || isGroup;
                  const customList: CustomLeadStatus[] =
                    settings?.customLeadStatuses || [];
                  const dotOf = (st: string) => {
                    const c = customList.find((x) => x.value === st);
                    const cls = c
                      ? colorKeyToClasses(c.colorKey)
                      : settings?.leadStatusLabels?.[st]?.color ||
                        statusColors[st] ||
                        "bg-muted";
                    return cls.split(" ")[0];
                  };
                  return (
                    <div key={cat} className="border-2 border-black bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroups((o) => ({ ...o, [cat]: !o[cat] }))
                        }
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-black/[0.03]"
                      >
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 shrink-0 transition-transform",
                            !isOpen && "-rotate-90",
                          )}
                        />
                        <span className="text-sm font-medium text-black">
                          {cat}
                        </span>
                        {isGroup && (
                          <span className="text-[10px] px-1.5 py-0.5 border border-[#024BAB] text-[#024BAB]">
                            your group
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          {values.slice(0, 8).map((st) => (
                            <span
                              key={st}
                              className={cn(
                                "w-2.5 h-2.5 border border-black/40",
                                dotOf(st),
                              )}
                            />
                          ))}
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {values.length} stage
                            {values.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>

                      {isOpen && (
                        <div className="border-t-2 border-black divide-y divide-black/10">
                          {values.length === 0 && (
                            <p className="px-3 py-3 text-xs text-muted-foreground">
                              No stages yet.
                            </p>
                          )}
                          {values.map((status) => {
                            const isProtected =
                              PROTECTED_STATUSES.includes(status);
                            const custom = customList.find(
                              (x) => x.value === status,
                            );
                            const override =
                              settings?.leadStatusLabels?.[status] || {};
                            const label = custom
                              ? custom.label
                              : override.label || status;
                            const sibs = customList
                              .filter((x) => x.category === cat)
                              .sort((x, y) => (x.order || 0) - (y.order || 0));
                            const sIdx = sibs.findIndex(
                              (x) => x.value === status,
                            );
                            const editing = openStage === status;
                            const swatches = (
                              current: string | undefined,
                              pick: (p: (typeof COLOR_PRESETS)[number]) => void,
                              isActive: (
                                p: (typeof COLOR_PRESETS)[number],
                              ) => boolean,
                            ) => (
                              <div className="flex items-center gap-1 flex-wrap">
                                {COLOR_PRESETS.map((preset) => (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    title={preset.name}
                                    onClick={() => pick(preset)}
                                    className={cn(
                                      "w-5 h-5 border-2",
                                      preset.classes.split(" ")[0],
                                      isActive(preset)
                                        ? "border-black ring-2 ring-offset-1 ring-[#024BAB]"
                                        : "border-black/30",
                                    )}
                                  />
                                ))}
                              </div>
                            );
                            return (
                              <div key={status}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    !isProtected &&
                                    setOpenStage(editing ? null : status)
                                  }
                                  className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2 text-left",
                                    isProtected
                                      ? "cursor-default"
                                      : "hover:bg-black/[0.03]",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "w-3 h-3 border border-black/50 shrink-0",
                                      dotOf(status),
                                    )}
                                  />
                                  <span className="text-xs font-medium text-black truncate">
                                    {label}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                                    {custom
                                      ? "custom"
                                      : status !== label
                                        ? status
                                        : ""}
                                  </span>
                                  {custom?.role && custom.role !== "active" && (
                                    <span className="text-[10px] px-1.5 border border-black/40 uppercase">
                                      {custom.role}
                                    </span>
                                  )}
                                  <span className="ml-auto text-muted-foreground">
                                    {isProtected ? (
                                      <span className="flex items-center gap-1 text-[10px]">
                                        <Lock className="w-3 h-3" /> fixed
                                      </span>
                                    ) : (
                                      <ChevronDown
                                        className={cn(
                                          "w-3.5 h-3.5 transition-transform",
                                          editing && "rotate-180",
                                        )}
                                      />
                                    )}
                                  </span>
                                </button>

                                {editing && !isProtected && (
                                  <div className="px-3 pb-3 pt-1 space-y-3 bg-black/[0.02]">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <input
                                        value={
                                          custom
                                            ? custom.label
                                            : override.label || ""
                                        }
                                        onChange={(e) =>
                                          custom
                                            ? updateCustomStatus(status, {
                                                label: e.target.value,
                                              })
                                            : updateStatusOverride(status, {
                                                label: e.target.value,
                                              })
                                        }
                                        placeholder={status}
                                        maxLength={40}
                                        className="flex-1 min-w-[160px] h-8 text-xs px-2 border-2 border-black focus:outline-none"
                                      />
                                      {custom
                                        ? swatches(
                                            custom.colorKey,
                                            (p) =>
                                              updateCustomStatus(status, {
                                                colorKey: p.name.toLowerCase(),
                                              }),
                                            (p) =>
                                              custom.colorKey ===
                                              p.name.toLowerCase(),
                                          )
                                        : swatches(
                                            override.color,
                                            (p) =>
                                              updateStatusOverride(status, {
                                                color: p.classes,
                                              }),
                                            (p) => override.color === p.classes,
                                          )}
                                    </div>

                                    {custom ? (
                                      <>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-black">
                                          <label className="flex items-center gap-1.5">
                                            Counts as
                                            <select
                                              value={custom.role || "active"}
                                              onChange={(e) =>
                                                updateCustomStatus(status, {
                                                  role: e.target.value as any,
                                                })
                                              }
                                              className="border-2 border-black bg-white px-1.5 py-1 text-[11px]"
                                            >
                                              <option value="active">
                                                Active
                                              </option>
                                              <option value="hot">
                                                Hot lead
                                              </option>
                                              <option value="lost">
                                                Lost (closed)
                                              </option>
                                            </select>
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={
                                                custom.requireRemarks !== false
                                              }
                                              onChange={(e) =>
                                                updateCustomStatus(status, {
                                                  requireRemarks:
                                                    e.target.checked,
                                                })
                                              }
                                            />
                                            Remarks required
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={
                                                custom.requireFollowUp !== false
                                              }
                                              onChange={(e) =>
                                                updateCustomStatus(status, {
                                                  requireFollowUp:
                                                    e.target.checked,
                                                })
                                              }
                                            />
                                            Follow-up date required
                                          </label>
                                          <label className="flex items-center gap-1.5">
                                            Default follow-up
                                            <input
                                              type="number"
                                              min={0}
                                              max={90}
                                              value={
                                                custom.autoFollowUpDays ?? 0
                                              }
                                              onChange={(e) =>
                                                updateCustomStatus(status, {
                                                  autoFollowUpDays: Math.max(
                                                    0,
                                                    Math.min(
                                                      90,
                                                      Number(e.target.value) ||
                                                        0,
                                                    ),
                                                  ),
                                                })
                                              }
                                              className="w-14 border-2 border-black px-1.5 py-1 text-[11px]"
                                            />
                                            days
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            title="Move up"
                                            disabled={sIdx <= 0}
                                            onClick={() =>
                                              moveCustomStatus(status, "up")
                                            }
                                            className="p-1 border-2 border-black disabled:opacity-30 hover:bg-black/5"
                                          >
                                            <ChevronUp className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            title="Move down"
                                            disabled={
                                              sIdx === -1 ||
                                              sIdx >= sibs.length - 1
                                            }
                                            onClick={() =>
                                              moveCustomStatus(status, "down")
                                            }
                                            className="p-1 border-2 border-black disabled:opacity-30 hover:bg-black/5"
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              removeCustomStatus(status);
                                              setOpenStage(null);
                                            }}
                                            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
                                          >
                                            <Trash2 className="w-3 h-3" />{" "}
                                            Remove stage
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      (override.label || override.color) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            resetStatusOverride(status)
                                          }
                                          className="text-[11px] text-muted-foreground hover:text-destructive underline"
                                        >
                                          Reset to default
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {(canAdd || isGroup) && (
                            <div className="flex items-center justify-between px-3 py-2">
                              {canAdd ? (
                                <button
                                  type="button"
                                  onClick={() => addCustomStatus(cat)}
                                  className="flex items-center gap-1.5 text-xs font-medium text-[#024BAB] hover:underline"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add stage
                                </button>
                              ) : (
                                <span />
                              )}
                              {isGroup && (
                                <button
                                  type="button"
                                  onClick={() => removePipelineGroup(cat)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
                                >
                                  <Trash2 className="w-3 h-3" /> Remove group
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {}
            {activeTab === "roles" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0 nb-shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-display font-medium text-black">
                      Team Roles
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Create roles for how your company is structured — each one
                      behaves like one of the base permission tiers. These show
                      up when assigning a role on the Team page.
                    </p>
                  </div>
                </div>

                <div className="border-2 border-black nb-shadow-sm bg-white">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#024BAB] text-white text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left border-r-2 border-black">
                          Role Name
                        </th>
                        <th className="px-4 py-3 text-left border-r-2 border-black">
                          Permission Tier
                        </th>
                        <th className="px-4 py-3 text-center border-r-2 border-black">
                          Members
                        </th>
                        <th className="px-4 py-3 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolesLoading && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                            Loading roles…
                          </td>
                        </tr>
                      )}
                      {!rolesLoading &&
                        roles.map((role, idx) => (
                          <tr
                            key={role._id}
                            className={cn(
                              "border-b-2 border-black last:border-b-0",
                              idx % 2 === 0 ? "bg-white" : "bg-[#024BAB]/5",
                            )}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-black border-r-2 border-black">
                              {role.name}
                              {role.isDefault && (
                                <span className="ml-2 text-[10px] font-medium uppercase text-muted-foreground">
                                  Default
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-black border-r-2 border-black">
                              {TIER_LABELS[role.tier] || role.tier}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-black border-r-2 border-black">
                              {role.userCount}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditRole(role)}
                                  className="p-1.5 border-2 border-black bg-white hover:bg-[#024BAB]/10"
                                  title="Edit role"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {!role.isDefault && (
                                  <button
                                    onClick={() => handleDeleteRole(role)}
                                    className="p-1.5 border-2 border-black bg-white hover:bg-red-50"
                                    title="Delete role"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-2 border-black nb-shadow-sm bg-white p-4 space-y-3">
                  <p className="font-display font-medium text-black text-sm">
                    {editingRoleId ? "Edit Role" : "Create New Role"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-black">
                        Role Name
                      </label>
                      <input
                        value={roleForm.name}
                        onChange={(e) =>
                          setRoleForm({ ...roleForm, name: e.target.value })
                        }
                        placeholder="e.g. Marketing Lead"
                        className="border-2 border-black w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-black">
                        Behaves Like
                      </label>
                      <select
                        value={roleForm.tier}
                        onChange={(e) =>
                          setRoleForm({ ...roleForm, tier: e.target.value })
                        }
                        disabled={
                          !!editingRoleId &&
                          roles.find((r) => r._id === editingRoleId)?.isDefault
                        }
                        className="border-2 border-black w-full px-3 py-2 text-sm bg-white disabled:opacity-50"
                      >
                        {Object.entries(TIER_LABELS).map(([tier, label]) => (
                          <option key={tier} value={tier}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 sm:col-span-1">
                      <button
                        onClick={handleSaveRole}
                        disabled={savingRole}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-3 py-2 text-sm font-medium nb-shadow-sm disabled:opacity-60"
                      >
                        {savingRole ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {editingRoleId ? "Save" : "Create"}
                      </button>
                      {editingRoleId && (
                        <button
                          onClick={resetRoleForm}
                          className="border-2 border-black px-3 py-2 bg-white"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "permissions" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0 nb-shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-display font-medium text-black">
                      Role Permissions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Configure what each role can do per resource
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table
                    className="w-full border-2 border-black"
                    style={{ minWidth: 700 }}
                  >
                    <thead>
                      <tr className="bg-[#024BAB]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-r-2 border-black w-36">
                          Resource
                        </th>
                        {permColumns.map((role) => (
                          <th
                            key={role.id}
                            className="px-2 py-3 text-center text-xs font-medium text-white uppercase tracking-wider border-r-2 border-black last:border-r-0"
                            colSpan={4}
                          >
                            {role.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-[#024BAB]/10 border-b-2 border-black">
                        <th className="px-4 py-2 text-left text-[10px] font-medium text-black uppercase tracking-wider border-r-2 border-black" />
                        {permColumns.map((role) =>
                          ["C", "R", "U", "D"].map((op) => (
                            <th
                              key={`${role.id}-${op}`}
                              className="px-1 py-2 text-center text-[10px] font-medium text-black uppercase tracking-wider border-r border-black/20 last:border-r-2 last:border-black"
                            >
                              {op}
                            </th>
                          )),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((res, resIdx) => (
                        <tr
                          key={res.resource}
                          className={cn(
                            "border-b-2 border-black last:border-b-0 transition-colors",
                            resIdx % 2 === 0 ? "bg-white" : "bg-[#024BAB]/5",
                          )}
                        >
                          <td className="px-4 py-3 text-xs font-medium text-black border-r-2 border-black whitespace-nowrap">
                            {res.resource}
                          </td>
                          {permColumns.map((role) =>
                            (
                              ["create", "read", "update", "delete"] as CrudOp[]
                            ).map((op) => {
                              const checked = cellPerms(res, role)[op];
                              const isSuperAdmin = role.id === "super_admin";
                              return (
                                <td
                                  key={`${role.id}-${op}`}
                                  className="px-1 py-3 text-center border-r border-black/20 last:border-r-2 last:border-black"
                                >
                                  <button
                                    onClick={() =>
                                      !isSuperAdmin &&
                                      togglePermission(resIdx, role, op)
                                    }
                                    disabled={isSuperAdmin}
                                    className={cn(
                                      "w-5 h-5 border-2 border-black flex items-center justify-center mx-auto transition-colors",
                                      checked
                                        ? "bg-[#024BAB]"
                                        : "bg-white hover:bg-[#024BAB]/10",
                                      isSuperAdmin &&
                                        "opacity-60 cursor-not-allowed",
                                    )}
                                    title={
                                      isSuperAdmin
                                        ? "Super Admin always has full access"
                                        : `Toggle ${op} for ${role.label}`
                                    }
                                  >
                                    {checked && (
                                      <svg
                                        className="w-3 h-3 text-white"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                      >
                                        <path
                                          d="M2 6l3 3 5-5"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    )}
                                  </button>
                                </td>
                              );
                            }),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start gap-2 p-3 border-2 border-black bg-[#FA731C]/10 mt-2">
                  <span className="text-[10px] font-medium text-[#FA731C] uppercase tracking-wider shrink-0 mt-0.5">
                    Note
                  </span>
                  <p className="text-xs text-black">
                    C = Create, R = Read, U = Update, D = Delete. Super Admin
                    always has full access to all resources. Roles you create on
                    the Roles tab get their own column here; until you change
                    it, a custom role has the same access as its permission
                    tier.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSavePermissions}
                    disabled={savingPerms}
                    className="nb-btn px-5 py-2.5 text-sm font-medium text-white bg-[#024BAB] border-2 border-black flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingPerms ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Permissions
                  </button>
                </div>
              </div>
            )}

            {activeTab === "ai-calling" && <AICallingSettingsTab />}
          </div>
        </div>
      </div>

      {}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="nb-card bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center">
            {actionModal.type === "success" ? (
              <>
                <div className="mb-4 animate-bounce">
                  <CheckCircle className="w-16 h-16 text-[#00C48C]" />
                </div>
                <h2 className="text-2xl font-display font-medium text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {actionModal.message}
                </p>
                <div className="flex gap-2 mt-4">
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-200" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 animate-bounce">
                  <AlertCircle className="w-16 h-16 text-[#EF4444]" />
                </div>
                <h2 className="text-2xl font-display font-medium text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {actionModal.message}
                </p>
                <button
                  onClick={() => setActionModal((m) => ({ ...m, show: false }))}
                  className="nb-btn px-6 py-2 bg-[#EF4444] text-white text-sm font-medium border-2 border-black"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
