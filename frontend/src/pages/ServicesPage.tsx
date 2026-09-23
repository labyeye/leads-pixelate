import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Briefcase,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { servicesAPI, clientsAPI, productsAPI } from "@/services/api";
import { useNotify } from "@/components/ui/Notification";
import { usePermission } from "@/hooks/usePermission";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700 border-gray-400",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-400",
  Completed: "bg-green-100 text-green-800 border-green-400",
  "On Hold": "bg-yellow-100 text-yellow-800 border-yellow-400",
  Cancelled: "bg-red-100 text-red-800 border-red-400",
};

export default function ServicesPage() {
  const { can } = usePermission();
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const notify = useNotify();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialFormState = {
    allocatedClient: "",
    product: "",
    status: "Pending",
    timeline: "",
    progress: 0,
    notes: "",
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchServices();
    fetchClients();
    fetchProducts();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await clientsAPI.getAll();
      setClients(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll();
      setProducts(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await servicesAPI.getAll();
      setServices(res.data || []);
    } catch (error: any) {
      notify.error("Error fetching", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item: any) => {
    setFormData({
      allocatedClient: item.allocatedClient?._id || item.allocatedClient || "",
      product: item.product?._id || item.product || "",
      status: item.status || "Pending",
      timeline: item.timeline || "",
      progress: item.progress || 0,
      notes: item.notes || "",
    });
    setEditingId(item._id || item.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this service allocation?",
      )
    )
      return;
    try {
      const res = await servicesAPI.delete(id);
      if (res.success) {
        notify.success(
          "Allocation Deleted",
          "Service allocation has been removed.",
        );
        fetchServices();
      }
    } catch (error: any) {
      notify.error("Delete Failed", error.message);
    }
  };

  const resetFormAndCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allocatedClient || formData.allocatedClient === "none") {
      notify.error("Client is required", "Please select a client.");
      return;
    }
    if (!formData.product || formData.product === "none") {
      notify.error(
        "Product is required",
        "Please select a product or service.",
      );
      return;
    }
    const prog = Number(formData.progress);
    if (isNaN(prog) || prog < 0 || prog > 100) {
      notify.error("Invalid Progress", "Progress must be between 0 and 100.");
      return;
    }

    try {
      setSaving(true);
      let res;
      if (editingId) {
        res = await servicesAPI.update(editingId, formData);
      } else {
        res = await servicesAPI.create(formData);
      }

      if (res.success) {
        notify.success(
          editingId ? "Allocation Updated" : "Service Allocated",
          editingId
            ? "Service allocation has been updated."
            : "Service has been allocated to the client.",
        );
        resetFormAndCloseModal();
        fetchServices();
      }
    } catch (error: any) {
      notify.error("Save Failed", error.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const filtered = services.filter(
    (s) =>
      (s.allocatedClient?.name || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (s.product?.name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const countBy = (st: string) => services.filter((x) => x.status === st).length;

  return (
    <AppLayout title="Service Allocations">
      <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          title="Total Allocations"
          value={loading ? "—" : services.length}
          icon={Briefcase}
          bg="bg-[#024BAB]"
        />
        <KpiCard
          title="In Progress"
          value={loading ? "—" : countBy("In Progress")}
          icon={Clock}
          bg="bg-[#FFB800]"
        />
        <KpiCard
          title="Completed"
          value={loading ? "—" : countBy("Completed")}
          icon={CheckCircle2}
          bg="bg-[#00C48C]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 border-2 border-black px-3 h-10 bg-white flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="Search allocations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium placeholder:text-gray-400"
          />
        </div>

        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetFormAndCloseModal();
          }}
        >
          <DialogTrigger asChild>
            {can("Services", "create") && (
              <button
                onClick={() => resetFormAndCloseModal()}
                className="flex items-center justify-center gap-1.5 h-10 px-4 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all w-full sm:w-auto sm:ml-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Allocate Service
              </button>
            )}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Allocation" : "Allocate New Service"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update service delivery details."
                    : "Assign a product or service implementation to a distinct client."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="allocatedClient">
                    Select Client <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.allocatedClient}
                    onValueChange={(v) =>
                      setFormData({ ...formData, allocatedClient: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign a Client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c._id || c.id} value={c._id || c.id}>
                          {c.name} {c.company ? `(${c.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product">
                    Select Product / Service{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.product}
                    onValueChange={(v) =>
                      setFormData({ ...formData, product: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from catalog..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p._id || p.id} value={p._id || p.id}>
                          {p.name} - ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) =>
                        setFormData({ ...formData, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="progress">Progress %</Label>
                    <Input
                      id="progress"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.progress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          progress: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="timeline">Timeline / Duration</Label>
                  <Input
                    id="timeline"
                    value={formData.timeline}
                    onChange={(e) =>
                      setFormData({ ...formData, timeline: e.target.value })
                    }
                    placeholder="e.g. 2 Weeks"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Implementation Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFormAndCloseModal}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update Allocation" : "Save Allocation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-2 border-black bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#024BAB] text-white">
                {["#", "Client", "Company", "Product / Service", "Price", "Timeline", "Progress", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-r-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-2">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Briefcase className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                    <p className="text-sm font-black uppercase tracking-widest text-gray-400">
                      {search ? "No allocations match your search" : "No service allocations yet"}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => (
                  <tr
                    key={item._id || item.id}
                    className={cn(
                      "border-b-2 border-black last:border-b-0 transition-colors",
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/60",
                    )}
                  >
                    <td className="px-4 py-3 text-xs font-black text-gray-400 w-10">{i + 1}</td>
                    <td className="px-4 py-3 font-black text-black whitespace-nowrap">
                      {item.allocatedClient?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {item.allocatedClient?.company || <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 font-black text-black whitespace-nowrap max-w-[220px] truncate">
                      {item.product?.name || "Unknown Product"}
                    </td>
                    <td className="px-4 py-3 font-black text-black whitespace-nowrap">
                      {item.product?.price ? `₹${item.product.price.toLocaleString("en-IN")}` : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {item.timeline || <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 border border-black bg-white overflow-hidden">
                          <div className="h-full bg-[#024BAB]" style={{ width: `${item.progress || 0}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-black">{item.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-wide px-2 py-1 border-2",
                          statusColors[item.status] || statusColors.Pending,
                        )}
                      >
                        {item.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {can("Services", "update") && (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white hover:bg-[#024BAB] hover:text-white transition-colors hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {can("Services", "delete") && (
                          <button
                            onClick={() => handleDeleteClick(item._id || item.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white text-red-600 hover:bg-red-600 hover:text-white transition-colors hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="border-t-2 border-black px-4 py-2 bg-gray-50 text-black text-[10px] font-black uppercase tracking-widest flex justify-between">
            <span>
              {filtered.length} allocation{filtered.length !== 1 ? "s" : ""}
            </span>
            <span>
              {countBy("In Progress")} in progress · {countBy("Completed")} completed
            </span>
          </div>
        )}
      </div>
      </div>
    </AppLayout>
  );
}
