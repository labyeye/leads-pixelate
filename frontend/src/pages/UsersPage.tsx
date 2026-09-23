import { AppLayout } from "@/components/layout/AppLayout";
import { roleLabels, UserRole } from "@/types/crm";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Camera,
  Shield,
  ShieldCheck,
  Briefcase,
  Wrench,
  Calculator,
  FileText,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { usersAPI, uploadAPI, rolesAPI, Role } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNotify } from "@/components/ui/Notification";

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "resume", label: "Resume" },
  { value: "id_proof", label: "ID Proof" },
  { value: "address_proof", label: "Address Proof" },
  { value: "offer_letter", label: "Offer Letter" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM_DATA = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "sales_executive" as UserRole,
  roleId: "" as string,
  phone: "",
  department: "",
  avatar: "",
  designation: "",
  dateOfJoining: "",
  dateOfBirth: "",
  gender: "",
  employmentType: "",
  addressLine1: "",
  addressCity: "",
  addressState: "",
  addressPincode: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  panNumber: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
};

// The form keeps everything flat (simple inputs, simple state); the API
// wants address/emergencyContact/bankDetails nested. Reshape at submit time.
function buildUserPayload(formData: typeof EMPTY_FORM_DATA) {
  const {
    confirmPassword: _confirmPassword,
    role: _role,
    roleId,
    addressLine1,
    addressCity,
    addressState,
    addressPincode,
    emergencyContactName,
    emergencyContactPhone,
    bankAccountName,
    bankAccountNumber,
    bankIfsc,
    bankName,
    ...rest
  } = formData;
  return {
    ...rest,
    ...(roleId === "__super_admin__"
      ? { role: "super_admin" }
      : { roleId }),
    address: {
      line1: addressLine1,
      city: addressCity,
      state: addressState,
      pincode: addressPincode,
    },
    emergencyContact: {
      name: emergencyContactName,
      phone: emergencyContactPhone,
    },
    bankDetails: {
      accountName: bankAccountName,
      accountNumber: bankAccountNumber,
      ifsc: bankIfsc,
      bankName,
    },
  } as any;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_NB: Record<string, string> = {
  super_admin: "bg-[#024BAB] text-white border-black",
  admin: "bg-black text-white border-black",
  sales_executive: "bg-[#FF751F] text-white border-black",
  service_manager: "bg-white text-black border-black",
  accountant: "bg-white text-black border-black",
};

const ROLE_COUNTS = [
  { role: "super_admin", icon: ShieldCheck, bg: "bg-[#024BAB]" },
  { role: "admin", icon: Shield, bg: "bg-[#5B8DEF] text-white" },
  { role: "sales_executive", icon: Briefcase, bg: "bg-[#FF751F]" },
  { role: "service_manager", icon: Wrench, bg: "bg-[#A3E635]" },
  { role: "accountant", icon: Calculator, bg: "bg-[#00C48C]" },
] as const;

const NbInput = ({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  ...rest
}: any) => (
  <div className="space-y-1">
    <label
      htmlFor={id}
      className="block text-[10px] font-black uppercase tracking-widest text-black"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="border-2 w-full px-3 py-2 text-sm"
      {...rest}
    />
  </div>
);

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const notify = useNotify();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<
    "basic" | "employment" | "documents"
  >("basic");
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docType, setDocType] = useState("resume");
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    rolesAPI
      .getAll()
      .then((res) => res.success && setRoles(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getAll();
      setUsers(res.data || []);
    } catch (error: any) {
      notify.error("Error fetching users", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify.error("Name is required");
      return;
    }
    if (!formData.email.trim()) {
      notify.error("Email is required");
      return;
    }
    if (!EMAIL_RE.test(formData.email)) {
      notify.error("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (!editingUserId) {
      if (!formData.password) {
        notify.error("Password is required");
        return;
      }
      if (formData.password.length < 6) {
        notify.error(
          "Password too short",
          "Password must be at least 6 characters.",
        );
        return;
      }
      if (!formData.confirmPassword) {
        notify.error("Please confirm your password");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        notify.error("Passwords do not match");
        return;
      }
    }
    if (editingUserId && formData.password) {
      if (formData.password.length < 6) {
        notify.error(
          "Password too short",
          "New password must be at least 6 characters.",
        );
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        notify.error("Passwords do not match");
        return;
      }
    }
    if (
      formData.phone &&
      !/^[6-9]\d{9}$/.test(formData.phone) &&
      !(formData.phone.length >= 8 && formData.phone.length <= 15)
    ) {
      notify.error("Invalid Phone", "Enter a valid phone number.");
      return;
    }
    if (!formData.roleId) {
      notify.error("Role is required");
      return;
    }

    try {
      setSaving(true);
      const payload = buildUserPayload(formData);
      let res;
      if (editingUserId) {
        if (!payload.password) delete payload.password;
        res = await usersAPI.update(editingUserId, payload);
      } else {
        res = await usersAPI.create(payload);
      }
      if (res.success) {
        notify.success(
          editingUserId ? "User Updated" : "User Created",
          editingUserId
            ? `${formData.name}'s profile has been updated.`
            : `${formData.name} has been added to the team.`,
        );
        resetForm();
        fetchUsers();
      }
    } catch (error: any) {
      notify.error("Save Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setModalTab("basic");
    setFormData(EMPTY_FORM_DATA);
    setDocuments([]);
  };

  const toDateInput = (v: string | null | undefined) =>
    v ? new Date(v).toISOString().slice(0, 10) : "";

  const handleEditClick = async (user: any) => {
    const id = user._id || user.id;
    setEditingUserId(id);
    setModalTab("basic");
    setIsModalOpen(true);
    // Row data from the list omits bankDetails (privacy) — fetch the full
    // record so the edit form has everything.
    try {
      const res = await usersAPI.getById(id);
      const full = res.data || user;
      setFormData({
        ...EMPTY_FORM_DATA,
        name: full.name || "",
        email: full.email || "",
        role: full.role || "sales_executive",
        roleId:
          full.role === "super_admin"
            ? "__super_admin__"
            : full.roleId?._id ||
              roles.find((r) => r.tier === full.role && r.isDefault)?._id ||
              "",
        phone: full.phone || "",
        department: full.department || "",
        avatar: full.avatar || "",
        designation: full.designation || "",
        dateOfJoining: toDateInput(full.dateOfJoining),
        dateOfBirth: toDateInput(full.dateOfBirth),
        gender: full.gender || "",
        employmentType: full.employmentType || "",
        addressLine1: full.address?.line1 || "",
        addressCity: full.address?.city || "",
        addressState: full.address?.state || "",
        addressPincode: full.address?.pincode || "",
        emergencyContactName: full.emergencyContact?.name || "",
        emergencyContactPhone: full.emergencyContact?.phone || "",
        panNumber: full.panNumber || "",
        bankAccountName: full.bankDetails?.accountName || "",
        bankAccountNumber: full.bankDetails?.accountNumber || "",
        bankIfsc: full.bankDetails?.ifsc || "",
        bankName: full.bankDetails?.bankName || "",
      });
      setDocuments(full.documents || []);
    } catch (error: any) {
      notify.error("Failed to load user", error.message);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm("Permanently delete this user? This cannot be undone."))
      return;
    try {
      const res = await usersAPI.delete(id);
      if (res.success) {
        notify.success(
          "User Deleted",
          "The user has been permanently removed.",
        );
        fetchUsers();
      }
    } catch (error: any) {
      notify.error("Delete Failed", error.message);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Team">
      {}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 border-2 px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-black placeholder:text-black/40 font-medium"
          />
        </div>

        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <button
              onClick={() => {
                setEditingUserId(null);
                setModalTab("basic");
                setFormData(EMPTY_FORM_DATA);
                setDocuments([]);
              }}
              className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg border-2 border-black rounded-none p-0 gap-0">
            <form onSubmit={handleSubmitUser}>
              <DialogHeader className="border-b-2 border-black bg-[#024BAB] px-5 py-4">
                <DialogTitle className="text-white font-black uppercase tracking-wider text-base">
                  {editingUserId ? "Edit User" : "Add New User"}
                </DialogTitle>
              </DialogHeader>

              {}
              <div className="flex border-b-2 border-black bg-white px-5">
                {(
                  [
                    { id: "basic", label: "Basic" },
                    { id: "employment", label: "Employment" },
                    ...(editingUserId
                      ? [{ id: "documents", label: "Documents" } as const]
                      : []),
                  ] as { id: typeof modalTab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setModalTab(t.id)}
                    className={cn(
                      "py-2.5 px-1 mr-5 text-xs font-black uppercase tracking-wider border-b-2 transition-colors",
                      modalTab === t.id
                        ? "border-[#FA731C] text-black"
                        : "border-transparent text-muted-foreground hover:text-black",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 p-5 bg-white max-h-[60vh] overflow-y-auto">
                {modalTab === "basic" && (
                <>
                <NbInput
                  label="Full Name"
                  id="name"
                  value={formData.name}
                  onChange={(e: any) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="John Doe"
                  required
                />
                <NbInput
                  label="Email"
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e: any) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="john@example.com"
                  required
                />
                <NbInput
                  label={
                    editingUserId
                      ? "Password (leave blank to keep)"
                      : "Password"
                  }
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e: any) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={
                    editingUserId
                      ? "Leave blank to keep unchanged"
                      : "Min. 6 characters"
                  }
                  required={!editingUserId}
                />
                {(!editingUserId || formData.password) && (
                  <NbInput
                    label="Confirm Password"
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Re-enter password"
                    required={!editingUserId}
                  />
                )}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.roleId}
                    onValueChange={(v: string) =>
                      setFormData({ ...formData, roleId: v })
                    }
                  >
                    <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 focus:ring-offset-0 bg-white font-bold h-10">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                      {roles.map((r) => (
                        <SelectItem
                          key={r._id}
                          value={r._id}
                          className="font-bold"
                        >
                          {r.name}
                        </SelectItem>
                      ))}
                      {currentUser?.role === "super_admin" && (
                        <SelectItem
                          value="__super_admin__"
                          className="font-bold"
                        >
                          Super Admin
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <PhoneInput
                    label="Phone"
                    value={formData.phone}
                    onChange={(v) => setFormData({ ...formData, phone: v })}
                    placeholder="10-digit mobile"
                  />
                  <NbInput
                    label="Department"
                    id="dept"
                    value={formData.department}
                    onChange={(e: any) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    placeholder="e.g. Sales"
                  />
                </div>
                {}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 border-2 border-black overflow-hidden shrink-0 bg-[#024BAB] flex items-center justify-center">
                      {formData.avatar ? (
                        <img
                          src={formData.avatar}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <label className="cursor-pointer border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-black hover:text-white transition-colors">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            notify.error(
                              "Image Too Large",
                              "Max file size is 2MB.",
                            );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setFormData((f) => ({
                              ...f,
                              avatar: reader.result as string,
                            }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Image · max 2MB
                    </span>
                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((f) => ({ ...f, avatar: "" }))
                        }
                        className="text-xs font-bold text-red-500 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                </>
                )}

                {modalTab === "employment" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <NbInput
                        label="Designation"
                        id="designation"
                        value={formData.designation}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            designation: e.target.value,
                          })
                        }
                        placeholder="e.g. Senior Sales Executive"
                      />
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-black">
                          Employment Type
                        </label>
                        <Select
                          value={formData.employmentType}
                          onValueChange={(v) =>
                            setFormData({ ...formData, employmentType: v })
                          }
                        >
                          <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 focus:ring-offset-0 bg-white font-bold h-10">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                            {[
                              { value: "full_time", label: "Full-time" },
                              { value: "part_time", label: "Part-time" },
                              { value: "contract", label: "Contract" },
                              { value: "intern", label: "Intern" },
                            ].map((o) => (
                              <SelectItem
                                key={o.value}
                                value={o.value}
                                className="font-bold"
                              >
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <NbInput
                        label="Date of Joining"
                        id="dateOfJoining"
                        type="date"
                        value={formData.dateOfJoining}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            dateOfJoining: e.target.value,
                          })
                        }
                      />
                      <NbInput
                        label="Date of Birth"
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            dateOfBirth: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-black">
                        Gender
                      </label>
                      <Select
                        value={formData.gender}
                        onValueChange={(v) =>
                          setFormData({ ...formData, gender: v })
                        }
                      >
                        <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 focus:ring-offset-0 bg-white font-bold h-10">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                          {["male", "female", "other"].map((g) => (
                            <SelectItem key={g} value={g} className="font-bold capitalize">
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-t-2 border-black pt-3 -mb-1">
                      Address
                    </p>
                    <NbInput
                      label="Address Line"
                      id="addressLine1"
                      value={formData.addressLine1}
                      onChange={(e: any) =>
                        setFormData({
                          ...formData,
                          addressLine1: e.target.value,
                        })
                      }
                      placeholder="House no, street, area"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <NbInput
                        label="City"
                        id="addressCity"
                        value={formData.addressCity}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            addressCity: e.target.value,
                          })
                        }
                      />
                      <NbInput
                        label="State"
                        id="addressState"
                        value={formData.addressState}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            addressState: e.target.value,
                          })
                        }
                      />
                      <NbInput
                        label="Pincode"
                        id="addressPincode"
                        value={formData.addressPincode}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            addressPincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                          })
                        }
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-t-2 border-black pt-3 -mb-1">
                      Emergency Contact
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <NbInput
                        label="Contact Name"
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            emergencyContactName: e.target.value,
                          })
                        }
                      />
                      <PhoneInput
                        label="Contact Phone"
                        value={formData.emergencyContactPhone}
                        onChange={(v) =>
                          setFormData({
                            ...formData,
                            emergencyContactPhone: v,
                          })
                        }
                      />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-t-2 border-black pt-3 -mb-1">
                      Identity &amp; Payroll
                    </p>
                    <NbInput
                      label="PAN Number"
                      id="panNumber"
                      value={formData.panNumber}
                      onChange={(e: any) =>
                        setFormData({
                          ...formData,
                          panNumber: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <NbInput
                        label="Bank Account Name"
                        id="bankAccountName"
                        value={formData.bankAccountName}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            bankAccountName: e.target.value,
                          })
                        }
                      />
                      <NbInput
                        label="Bank Account Number"
                        id="bankAccountNumber"
                        value={formData.bankAccountNumber}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            bankAccountNumber: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        inputMode="numeric"
                      />
                      <NbInput
                        label="IFSC Code"
                        id="bankIfsc"
                        value={formData.bankIfsc}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            bankIfsc: e.target.value.toUpperCase(),
                          })
                        }
                        maxLength={11}
                      />
                      <NbInput
                        label="Bank Name"
                        id="bankName"
                        value={formData.bankName}
                        onChange={(e: any) =>
                          setFormData({ ...formData, bankName: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}

                {modalTab === "documents" && editingUserId && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 focus:ring-offset-0 bg-white font-bold h-10 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                          {DOCUMENT_TYPES.map((d) => (
                            <SelectItem
                              key={d.value}
                              value={d.value}
                              className="font-bold"
                            >
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="cursor-pointer border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-black hover:text-white transition-colors flex items-center gap-1.5">
                        {docUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Upload
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          className="hidden"
                          disabled={docUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file || !editingUserId) return;
                            if (file.size > 10 * 1024 * 1024) {
                              notify.error(
                                "File Too Large",
                                "Max file size is 10MB.",
                              );
                              return;
                            }
                            setDocUploading(true);
                            try {
                              const uploaded = await uploadAPI.upload(file);
                              const res = await usersAPI.addDocument(
                                editingUserId,
                                {
                                  name: file.name,
                                  type: docType,
                                  url: uploaded.url,
                                },
                              );
                              setDocuments(res.data || []);
                              notify.success("Document uploaded");
                            } catch (error: any) {
                              notify.error("Upload Failed", error.message);
                            } finally {
                              setDocUploading(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      PDF, Word or image · max 10MB per file
                    </p>

                    {documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No documents uploaded yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc._id}
                            className="flex items-center gap-2 border-2 border-black p-2.5"
                          >
                            <FileText className="w-4 h-4 shrink-0 text-[#024BAB]" />
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-0 truncate text-xs font-bold underline"
                            >
                              {doc.name}
                            </a>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                              {DOCUMENT_TYPES.find((d) => d.value === doc.type)
                                ?.label || doc.type}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editingUserId) return;
                                try {
                                  const res = await usersAPI.removeDocument(
                                    editingUserId,
                                    doc._id,
                                  );
                                  setDocuments(res.data || []);
                                } catch (error: any) {
                                  notify.error("Delete Failed", error.message);
                                }
                              }}
                              className="shrink-0 text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="border-t-2 border-black px-5 py-3 flex gap-2 bg-white">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border-2 bg-white text-black px-4 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-5 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingUserId ? "Update User" : "Save User"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {ROLE_COUNTS.map(({ role, icon, bg }) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <KpiCard
              key={role}
              title={roleLabels[role]}
              value={loading ? "—" : count}
              icon={icon}
              bg={bg}
            />
          );
        })}
      </div>

      {}
      <div className="border-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]">
                {[
                  { h: "User", cls: "" },
                  { h: "Emp ID", cls: "hidden sm:table-cell" },
                  { h: "Role", cls: "" },
                  { h: "Department", cls: "hidden md:table-cell" },
                  { h: "Status", cls: "hidden lg:table-cell" },
                  { h: "Gender", cls: "hidden lg:table-cell" },
                  { h: "Phone", cls: "hidden lg:table-cell" },
                  { h: "Actions", cls: "text-right" },
                ].map(({ h, cls }) => (
                  <th
                    key={h}
                    className={cn(
                      "px-5 py-3 text-[10px] font-black text-white uppercase tracking-widest text-left",
                      cls,
                      h === "Actions" && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black/30 mt-2">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-14 text-sm font-black uppercase tracking-widest text-black/30"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((user, i) => {
                  const initials =
                    user.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "U";
                  const isSelf = (user._id || user.id) === currentUser?.id;
                  const canDelete =
                    !isSelf &&
                    (user.role !== "super_admin" ||
                      currentUser?.role === "super_admin");
                  return (
                    <tr
                      key={user._id || user.id}
                      className={cn(
                        "border-b-2 border-black last:border-b-0 hover:bg-[#024BAB]/10 transition-colors",
                        i % 2 === 1 && "bg-[#024BAB]/5",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 border-2 border-black shrink-0 overflow-hidden bg-[#024BAB]">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-black text-white">
                                {initials}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-black text-black text-sm">
                              {user.name}
                            </p>
                            <p className="text-xs text-black/50 font-medium">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-xs font-black text-black/60 font-mono">
                          {user.employeeId || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-1 border-2 uppercase tracking-wider",
                            ROLE_NB[user.role] ||
                              "bg-white text-black border-black",
                          )}
                        >
                          {user.roleId?.name ||
                            roleLabels[user.role as UserRole] ||
                            user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell font-bold text-sm text-black">
                        {user.department || (
                          <span className="text-black/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-1 border-2 border-black uppercase tracking-wider",
                            user.status === "active"
                              ? "bg-[#024BAB] text-white"
                              : "bg-white text-black",
                          )}
                        >
                          {user.status || "active"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs font-bold text-black/50">
                        {user.gender ? (
                          <span className="capitalize">{user.gender}</span>
                        ) : (
                          <span className="text-black/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs font-bold text-black/50">
                        {user.phone || <span className="text-black/30">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 border-2 border-black bg-white hover:bg-[#024BAB] hover:text-white transition-colors flex items-center justify-center">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-2 border-black rounded-none bg-white min-w-[140px] p-0"
                          >
                            <DropdownMenuItem
                              onClick={() => handleEditClick(user)}
                              className="font-bold text-black hover:bg-[#024BAB] hover:text-white focus:bg-[#024BAB] focus:text-white rounded-none cursor-pointer px-4 py-2.5"
                            >
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDeleteClick(user._id || user.id)
                                }
                                className="font-bold text-black hover:bg-black hover:text-white focus:bg-black focus:text-white rounded-none cursor-pointer border-t-2 border-black px-4 py-2.5"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
