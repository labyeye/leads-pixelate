import { AppLayout } from "@/components/layout/AppLayout";
import { roleLabels, UserRole } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Camera,
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
import { usersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNotify } from "@/components/ui/Notification";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_NB: Record<string, string> = {
  super_admin: "bg-[#024BAB] text-white border-black",
  admin: "bg-black text-white border-black",
  sales_executive: "bg-[#FF751F] text-white border-black",
  service_manager: "bg-white text-black border-black",
  accountant: "bg-white text-black border-black",
};

const ROLE_COUNTS = [
  "super_admin",
  "admin",
  "sales_executive",
  "service_manager",
  "accountant",
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "sales_executive" as UserRole,
    phone: "",
    department: "",
    avatar: "",
  });

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
    if (formData.phone && !/^[6-9]\d{9}$/.test(formData.phone)) {
      notify.error(
        "Invalid Phone",
        "Enter a valid 10-digit Indian mobile number.",
      );
      return;
    }
    if (!formData.role) {
      notify.error("Role is required");
      return;
    }

    try {
      setSaving(true);
      let res;
      if (editingUserId) {
        const { confirmPassword: _, ...payload } = formData as any;
        if (!payload.password) delete payload.password;
        res = await usersAPI.update(editingUserId, payload);
      } else {
        const { confirmPassword: _, ...payload } = formData as any;
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
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "sales_executive",
      phone: "",
      department: "",
      avatar: "",
    });
  };

  const handleEditClick = (user: any) => {
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "sales_executive",
      phone: user.phone || "",
      department: user.department || "",
      avatar: user.avatar || "",
    });
    setEditingUserId(user._id || user.id);
    setIsModalOpen(true);
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
                setFormData({
                  name: "",
                  email: "",
                  password: "",
                  role: "sales_executive",
                  phone: "",
                  department: "",
                  avatar: "",
                });
              }}
              className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md border-2 border-black rounded-none p-0 gap-0">
            <form onSubmit={handleSubmitUser}>
              <DialogHeader className="border-b-2 border-black bg-[#024BAB] px-5 py-4">
                <DialogTitle className="text-white font-black uppercase tracking-wider text-base">
                  {editingUserId ? "Edit User" : "Add New User"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 p-5 bg-white">
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
                    value={formData.role}
                    onValueChange={(v: UserRole) =>
                      setFormData({ ...formData, role: v })
                    }
                  >
                    <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 focus:ring-offset-0 bg-white font-bold h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                      {Object.entries(roleLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="font-bold">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NbInput
                    label="Phone"
                    id="phone"
                    value={formData.phone}
                    onChange={(e: any) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setFormData({ ...formData, phone: v });
                    }}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    inputMode="numeric"
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
        {ROLE_COUNTS.map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="border-2 p-4 text-center">
              <p className="text-3xl font-black text-black">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-black/30" />
                ) : (
                  count
                )}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mt-1">
                {roleLabels[role]}
              </p>
            </div>
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
                  { h: "Last Login", cls: "hidden lg:table-cell" },
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
                  <td colSpan={7} className="text-center py-14">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black/30 mt-2">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                          {roleLabels[user.role as UserRole] || user.role}
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
                        {user.lastLogin ? (
                          new Date(user.lastLogin).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="text-black/30">—</span>
                        )}
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
