import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Building2,
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
import { clientsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/usePermission";

const PROJECT_NB: Record<string, string> = {
  Active: "bg-[#024BAB] text-white border-black",
  Completed: "bg-black text-white border-black",
  "On Hold": "bg-[#FFDE00] text-black border-black",
};
const PAYMENT_NB: Record<string, string> = {
  Paid: "bg-[#024BAB] text-white border-black",
  Pending: "bg-[#FFDE00] text-black border-black",
  Overdue: "bg-black text-white border-black",
};

const NbInput = ({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  as: As = "input",
  rows,
}: any) => (
  <div className="space-y-1">
    <label
      htmlFor={id}
      className="block text-[10px] font-black uppercase tracking-widest text-black"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {As === "textarea" ? (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows || 2}
        className="border-2 w-full px-3 py-2 text-sm resize-none"
      />
    ) : (
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="border-2 w-full px-3 py-2 text-sm"
      />
    )}
  </div>
);

const NbSelect = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1">
    <label className="block text-[10px] font-black uppercase tracking-widest text-black">
      {label}
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-2 border-black rounded-none nb-shadow-sm focus:ring-0 bg-white font-bold h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
        {options.map((o: string) => (
          <SelectItem key={o} value={o} className="font-bold">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default function ClientsPage() {
  const { can } = usePermission();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    businessType: "",
    gst: "",
    services: "",
    projectStatus: "Active",
    paymentStatus: "Pending",
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await clientsAPI.getAll();
      setClients(res.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching clients",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (client: any) => {
    setFormData({
      name: client.name || "",
      company: client.company || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      businessType: client.businessType || "",
      gst: client.gst || "",
      services: Array.isArray(client.services)
        ? client.services.join(", ")
        : "",
      projectStatus: client.projectStatus || "Active",
      paymentStatus: client.paymentStatus || "Pending",
    });
    setEditingClientId(client._id || client.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm("Delete this client?")) return;
    try {
      const res = await clientsAPI.delete(id);
      if (res.success) {
        toast({ title: "Deleted" });
        fetchClients();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingClientId(null);
    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      address: "",
      businessType: "",
      gst: "",
      services: "",
      projectStatus: "Active",
      paymentStatus: "Pending",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.company ||
      !formData.email ||
      !formData.phone ||
      !formData.address ||
      !formData.businessType
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...formData,
        services: formData.services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = editingClientId
        ? await clientsAPI.update(editingClientId, payload)
        : await clientsAPI.create(payload);
      if (res.success) {
        toast({ title: "Success" });
        resetForm();
        fetchClients();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Clients">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 border-2 px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search clients..."
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
          {can("Clients", "create") && (
            <DialogTrigger asChild>
              <button
                onClick={resetForm}
                className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Client
              </button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-lg border-2 border-black rounded-none p-0 gap-0 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="border-b-2 border-black bg-[#024BAB] px-5 py-4 sticky top-0 z-10">
                <DialogTitle className="text-white font-black uppercase tracking-wider text-base">
                  {editingClientId ? "Edit Client" : "Add New Client"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 p-5 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <NbInput
                    label="Client Name"
                    id="name"
                    value={formData.name}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Full name"
                    required
                  />
                  <NbInput
                    label="Company"
                    id="company"
                    value={formData.company}
                    onChange={(e: any) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    placeholder="Company Ltd."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NbInput
                    label="Email"
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: any) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@co.com"
                    required
                  />
                  <NbInput
                    label="Phone"
                    id="phone"
                    value={formData.phone}
                    onChange={(e: any) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+91..."
                    required
                  />
                </div>
                <NbInput
                  label="Address"
                  id="address"
                  value={formData.address}
                  onChange={(e: any) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Full address"
                  required
                  as="textarea"
                />
                <div className="grid grid-cols-2 gap-3">
                  <NbInput
                    label="Business Type"
                    id="bizType"
                    value={formData.businessType}
                    onChange={(e: any) =>
                      setFormData({ ...formData, businessType: e.target.value })
                    }
                    placeholder="e.g. Manufacturing"
                    required
                  />
                  <NbInput
                    label="GST (optional)"
                    id="gst"
                    value={formData.gst}
                    onChange={(e: any) =>
                      setFormData({ ...formData, gst: e.target.value })
                    }
                    placeholder="07AAAAA0000A1Z5"
                  />
                </div>
                <NbInput
                  label="Services (comma-separated)"
                  id="services"
                  value={formData.services}
                  onChange={(e: any) =>
                    setFormData({ ...formData, services: e.target.value })
                  }
                  placeholder="SEO, Web Design, Hosting"
                />
                <div className="grid grid-cols-2 gap-3">
                  <NbSelect
                    label="Project Status"
                    value={formData.projectStatus}
                    onChange={(v: string) =>
                      setFormData({ ...formData, projectStatus: v })
                    }
                    options={["Active", "Completed", "On Hold"]}
                  />
                  <NbSelect
                    label="Payment Status"
                    value={formData.paymentStatus}
                    onChange={(v: string) =>
                      setFormData({ ...formData, paymentStatus: v })
                    }
                    options={["Paid", "Pending", "Overdue"]}
                  />
                </div>
              </div>
              <DialogFooter className="border-t-2 border-black px-5 py-3 flex gap-2 bg-white sticky bottom-0">
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
                  {editingClientId ? "Update Client" : "Save Client"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          {
            label: "Total",
            val: clients.length,
            bg: "bg-white text-primary",
          },
          {
            label: "Active",
            val: clients.filter((c) => c.projectStatus === "Active").length,
            bg: "bg-white text-green-600",
          },
        ].map(({ label, val, bg }) => (
          <div
            key={label}
            className={cn("border-2 border-black p-4 text-center", bg)}
          >
            <p className="text-3xl font-black">{loading ? "—" : val}</p>
            <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]">
                {[
                  "Client",
                  "Contact",
                  "Status",
                  "Address / Type",
                  "Actions",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-5 py-3 text-[10px] font-black text-white uppercase tracking-widest",
                      i < 4 ? "text-left" : "text-right",
                      i === 1 ? "hidden md:table-cell" : "",
                      i === 2 ? "hidden lg:table-cell" : "",
                      i === 3 ? "hidden xl:table-cell" : "",
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
                  <td colSpan={5} className="text-center py-14">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black/30 mt-2">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-14 text-sm font-black uppercase tracking-widest text-black/30"
                  >
                    No clients found.
                  </td>
                </tr>
              ) : (
                filtered.map((client, i) => (
                  <tr
                    key={client._id || client.id}
                    className={cn(
                      "border-b-2 border-black last:border-b-0 hover:bg-[#FFDE00]/10 transition-colors",
                      i % 2 === 1 && "bg-[#024BAB]/5",
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-black text-black text-sm">
                        {client.name}
                      </p>
                      <p className="text-xs text-black/50 font-medium">
                        {client.company}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="font-bold text-black text-sm">
                        {client.email}
                      </p>
                      <p className="text-xs text-black/50">{client.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-wider",
                            PROJECT_NB[client.projectStatus] ||
                              "bg-white text-black border-black",
                          )}
                        >
                          {client.projectStatus || "Active"}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-wider",
                            PAYMENT_NB[client.paymentStatus] ||
                              "bg-white text-black border-black",
                          )}
                        >
                          {client.paymentStatus || "Pending"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <p className="text-xs font-bold text-black">
                        {client.address}
                      </p>
                      <p className="text-xs text-black/50">
                        {client.businessType}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 border-2 border-black bg-white hover:bg-[#024BAB] hover:text-white transition-colors nb-shadow-sm flex items-center justify-center">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000] bg-white min-w-[140px] p-0"
                        >
                          {can("Clients", "update") && (
                            <DropdownMenuItem
                              onClick={() => handleEditClick(client)}
                              className="font-bold text-black hover:bg-[#024BAB] hover:text-white focus:bg-[#024BAB] focus:text-white rounded-none cursor-pointer px-4 py-2.5"
                            >
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {can("Clients", "delete") && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleDeleteClick(client._id || client.id)
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
