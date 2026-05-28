import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { servicesAPI, clientsAPI, productsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColors: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  "In Progress": "bg-primary/10 text-primary",
  Completed: "bg-success/10 text-success",
  "On Hold": "bg-warning/10 text-warning",
  Cancelled: "bg-destructive/10 text-destructive",
};

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      toast({
        title: "Error fetching",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
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
        toast({
          title: "Success",
          description: "Allocation deleted successfully",
        });
        fetchServices();
      }
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetFormAndCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.allocatedClient ||
      formData.allocatedClient === "none" ||
      !formData.product ||
      formData.product === "none"
    ) {
      toast({
        title: "Validation Error",
        description: "Please select both a valid Client and a Product.",
        variant: "destructive",
      });
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
        toast({
          title: "Success",
          description: editingId
            ? "Service updated successfully"
            : "Service allocated successfully",
        });
        resetFormAndCloseModal();
        fetchServices();
      }
    } catch (error: any) {
      toast({
        title: "Error saving item",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
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

  return (
    <AppLayout title="Service Allocations">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 animate-fade-in">
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search allocations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
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
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => resetFormAndCloseModal()}
            >
              <Plus className="w-3.5 h-3.5" /> Allocate Service
            </Button>
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

                <div className="grid grid-cols-2 gap-4">
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

      <div
        className="bg-card rounded-xl border border-border card-shadow overflow-hidden animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Client Focus
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Product Type & Price
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Progress
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Loading allocations...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <p className="text-sm text-muted-foreground">
                      No service allocations found.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => (
                  <tr
                    key={item._id || item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">
                        {item.allocatedClient?.name || "Unknown"}
                      </p>
                      {item.allocatedClient?.company && (
                        <span className="text-xs text-muted-foreground">
                          {item.allocatedClient.company}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="font-semibold text-foreground max-w-[200px] truncate">
                        {item.product?.name || "Unknown Product"}
                      </p>
                      {item.product?.price && (
                        <span className="text-[10px] text-muted-foreground border px-1.5 py-0.5 mt-1 inline-block rounded-md">
                          ₹{item.product.price.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.timeline && (
                        <p className="text-xs text-muted-foreground mb-1">
                          TL: {item.timeline}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px] max-w-[100px]">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${item.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] whitespace-nowrap text-muted-foreground">
                          {item.progress || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-1 rounded-md",
                          statusColors[item.status] ||
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditClick(item)}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={() =>
                              handleDeleteClick(item._id || item.id)
                            }
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
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
