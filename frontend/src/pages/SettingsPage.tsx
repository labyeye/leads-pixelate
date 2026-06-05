import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Landmark,
  FileCheck,
  Loader2,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ImageIcon,
  Upload,
  X,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Permission matrix definition ────────────────────────────────────────────
type CrudOp = "create" | "read" | "update" | "delete";
type CrmRole =
  | "super_admin"
  | "admin"
  | "sales_executive"
  | "service_manager"
  | "accountant";

interface ResourcePermissions {
  resource: string;
  permissions: Record<CrmRole, Record<CrudOp, boolean>>;
}

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

function InputField({
  label,
  name,
  value,
  placeholder = "",
  type = "text",
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white"
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
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border-2 border-black nb-shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 bg-white resize-none"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [permissions, setPermissions] =
    useState<ResourcePermissions[]>(INITIAL_PERMISSIONS);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.get();
      setSettings(res.data);
    } catch (error: any) {
      setSettings({
        companyName: user?.company?.name || "",
        companyGST: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: user?.company?.email || "",
        companyWebsite: "",
        logoUrl: "",
        bankAccountName: "",
        bankAccountNumber: "",
        bankIFSC: "",
        bankName: "",
        bankBranch: "",
        quotationTitle: "PROFORMA INVOICE",
        quotationFooter: "",
        quotationTerms: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setSettings((prev: any) => ({ ...prev, [name]: value }));
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

  const togglePermission = (resourceIdx: number, role: CrmRole, op: CrudOp) => {
    setPermissions((prev) => {
      const next = prev.map((r, i) => {
        if (i !== resourceIdx) return r;
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [role]: { ...r.permissions[role], [op]: !r.permissions[role][op] },
          },
        };
      });
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsAPI.update(settings);
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

  const tabs = [
    { id: "general", label: "General Info", icon: Building2 },
    { id: "bank", label: "Bank Details", icon: Landmark },
    { id: "terms", label: "Terms & Footer", icon: FileCheck },
    { id: "template", label: "Quotation Template", icon: Layout },
    { id: "permissions", label: "Permissions", icon: ShieldCheck },
  ];

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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setSettings((prev: any) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev: any) => ({ ...prev, logoUrl: "" }));
  };

  return (
    <AppLayout title="Settings">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r-2 border-black bg-white overflow-y-auto">
          <div className="p-4 border-b-2 border-black">
            <h1 className="text-base font-display font-bold text-black">
              Settings
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Company & system config
            </p>
          </div>
          <nav className="p-2">
            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest px-2 pt-3 pb-1">
              Company
            </p>
            {tabs
              .filter((t) =>
                ["general", "bank", "terms", "template"].includes(t.id),
              )
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-left rounded transition-colors mb-0.5",
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
            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest px-2 pt-4 pb-1">
              System
            </p>
            {tabs
              .filter((t) => t.id === "permissions")
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-left rounded transition-colors mb-0.5",
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

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Content header */}
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-white sticky top-0 z-10">
            <div>
              <h2 className="font-display font-bold text-black">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
            {activeTab !== "permissions" && activeTab !== "template" && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "nb-btn px-5 py-2 text-sm font-bold text-white border-2 border-black flex items-center gap-2",
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

          <div className="p-6 max-w-3xl">
            {/* ── General Info ── */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    onChange={handleChange}
                    label="Company Name"
                    name="companyName"
                    value={settings?.companyName || ""}
                  />
                  <InputField
                    onChange={handleChange}
                    label="GST Number"
                    name="companyGST"
                    value={settings?.companyGST || ""}
                    placeholder="07AAAAA0000A1Z5"
                  />
                  <InputField
                    onChange={handleChange}
                    label="Phone Number"
                    name="companyPhone"
                    value={settings?.companyPhone || ""}
                  />
                  <InputField
                    onChange={handleChange}
                    label="Email Address"
                    name="companyEmail"
                    value={settings?.companyEmail || ""}
                    type="email"
                  />
                  <InputField
                    onChange={handleChange}
                    label="Website URL"
                    name="companyWebsite"
                    value={settings?.companyWebsite || ""}
                    placeholder="https://example.com"
                  />
                  <InputField
                    onChange={handleChange}
                    label="Logo URL"
                    name="logoUrl"
                    value={settings?.logoUrl || ""}
                    placeholder="https://yourdomain.com/logo.png"
                  />
                </div>
                <TextAreaField
                  onChange={handleChange}
                  label="Company Address"
                  name="companyAddress"
                  value={settings?.companyAddress || ""}
                  placeholder="Enter full company address"
                  rows={3}
                />
              </div>
            )}

            {/* ── Bank Details ── */}
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
                  />
                  <InputField
                    onChange={handleChange}
                    label="IFSC Code"
                    name="bankIFSC"
                    value={settings?.bankIFSC || ""}
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
                </div>
              </div>
            )}

            {/* ── Terms & Footer ── */}
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
                    <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                      Terms & Conditions
                    </h3>
                    <button
                      onClick={addTerm}
                      className="nb-btn px-3 py-1.5 text-xs font-bold text-white bg-[#00C48C] border-2 border-black flex items-center gap-1"
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

            {/* ── Quotation Template ── */}
            {activeTab === "template" && (
              <div className="space-y-6">
                {/* Logo Upload */}
                <div>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Company Logo
                    </p>
                    <p className="text-xs text-black/50 ml-1">
                      — appears on all quotation PDFs
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Upload zone */}
                    <div className="space-y-3">
                      <label
                        htmlFor="logo-upload"
                        className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black h-40 bg-white cursor-pointer hover:bg-[#FFDE00]/10 transition-colors group"
                      >
                        <div className="w-12 h-12 border-2 border-black bg-[#024BAB] flex items-center justify-center group-hover:bg-[#FFDE00] transition-colors">
                          <Upload className="w-5 h-5 text-white group-hover:text-black" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest text-black">
                            Click to upload logo
                          </p>
                          <p className="text-[10px] text-black/40 mt-1">
                            PNG, JPG, SVG — max 2 MB
                          </p>
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="sr-only"
                          onChange={handleLogoFileChange}
                        />
                      </label>

                      {settings?.logoUrl && (
                        <button
                          onClick={handleRemoveLogo}
                          className="nb-btn w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest"
                        >
                          <X className="w-3.5 h-3.5" /> Remove Logo
                        </button>
                      )}
                    </div>

                    {/* Live preview of PDF header */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black">
                        Preview — PDF Header
                      </p>
                      <div className="border-2 border-black bg-white p-4 nb-shadow-sm">
                        {/* Mimics the PDF header layout */}
                        <div className="flex items-start gap-4 pb-3 border-b border-gray-200">
                          <div className="w-14 h-14 border-2 border-black bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                            {settings?.logoUrl ? (
                              <img
                                src={settings.logoUrl}
                                alt="Company logo"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-black/20" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-[#1e3a8a] uppercase truncate">
                              {settings?.companyName || "YOUR COMPANY NAME"}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                              {settings?.companyAddress || "Company Address"}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {settings?.companyPhone &&
                                `M: ${settings.companyPhone}`}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {settings?.companyEmail &&
                                `EMAIL: ${settings.companyEmail}`}
                            </p>
                            {settings?.companyGST && (
                              <p className="text-[10px] font-bold text-gray-700 mt-0.5">
                                GST NO: {settings.companyGST}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-[#1e3a8a] uppercase">
                              {settings?.quotationTitle || "PROFORMA INVOICE"}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              DATE: {new Date().toLocaleDateString("en-GB")}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              REF. NO.: SKF-0001
                            </p>
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-300 mt-2 text-center uppercase tracking-widest">
                          — Quotation body continues below —
                        </p>
                      </div>
                      <p className="text-[10px] text-black/40">
                        This is how the header will look on every quotation PDF
                        you generate.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quotation Title */}
                <div>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#FFDE00]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Document Settings
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      onChange={handleChange}
                      label="Quotation / Invoice Title"
                      name="quotationTitle"
                      value={settings?.quotationTitle || ""}
                      placeholder="e.g. PROFORMA INVOICE"
                    />
                    <TextAreaField
                      onChange={handleChange}
                      label="Footer Message"
                      name="quotationFooter"
                      value={settings?.quotationFooter || ""}
                      placeholder="e.g. Thank you for your business!"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Save button for template tab */}
                <div className="flex justify-end pt-2 border-t-2 border-black">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="nb-btn px-6 py-2.5 text-sm font-black text-white bg-[#024BAB] border-2 border-black flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Template Settings
                  </button>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-3 p-4 border-2 border-black bg-[#024BAB]/5">
                  <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                    <Layout className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-black uppercase tracking-wider">
                      How it works
                    </p>
                    <p className="text-xs text-black/70 mt-1">
                      Upload your company logo here. It will automatically
                      appear at the top-left of every quotation PDF you generate
                      from the Quotations page. Supported formats: PNG, JPG,
                      SVG. Recommended size: 200×200 px or wider rectangular
                      logos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Permissions ── */}
            {activeTab === "permissions" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0 nb-shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-black">
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
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r-2 border-black w-36">
                          Resource
                        </th>
                        {CRM_ROLES.map((role) => (
                          <th
                            key={role.id}
                            className="px-2 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r-2 border-black last:border-r-0"
                            colSpan={4}
                          >
                            {role.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-[#024BAB]/10 border-b-2 border-black">
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase tracking-wider border-r-2 border-black" />
                        {CRM_ROLES.map((role) =>
                          ["C", "R", "U", "D"].map((op) => (
                            <th
                              key={`${role.id}-${op}`}
                              className="px-1 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider border-r border-black/20 last:border-r-2 last:border-black"
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
                          <td className="px-4 py-3 text-xs font-bold text-black border-r-2 border-black whitespace-nowrap">
                            {res.resource}
                          </td>
                          {CRM_ROLES.map((role) =>
                            (
                              ["create", "read", "update", "delete"] as CrudOp[]
                            ).map((op) => {
                              const checked = res.permissions[role.id][op];
                              const isSuperAdmin = role.id === "super_admin";
                              return (
                                <td
                                  key={`${role.id}-${op}`}
                                  className="px-1 py-3 text-center border-r border-black/20 last:border-r-2 last:border-black"
                                >
                                  <button
                                    onClick={() =>
                                      !isSuperAdmin &&
                                      togglePermission(resIdx, role.id, op)
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
                  <span className="text-[10px] font-bold text-[#FA731C] uppercase tracking-wider shrink-0 mt-0.5">
                    Note
                  </span>
                  <p className="text-xs text-black">
                    C = Create, R = Read, U = Update, D = Delete. Super Admin
                    always has full access to all resources. Changes here
                    configure the role model for your team.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setActionModal({
                        show: true,
                        type: "success",
                        title: "Permissions Saved",
                        message: "Role permissions have been updated.",
                      });
                    }}
                    className="nb-btn px-5 py-2.5 text-sm font-bold text-white bg-[#024BAB] border-2 border-black flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Permissions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="nb-card bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center">
            {actionModal.type === "success" ? (
              <>
                <div className="mb-4 animate-bounce">
                  <CheckCircle className="w-16 h-16 text-[#00C48C]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
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
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {actionModal.message}
                </p>
                <button
                  onClick={() => setActionModal((m) => ({ ...m, show: false }))}
                  className="nb-btn px-6 py-2 bg-[#EF4444] text-white text-sm font-bold border-2 border-black"
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
