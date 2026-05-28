import { AppLayout } from "@/components/layout/AppLayout";
import React from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  FileDown,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { quotationsAPI, settingsAPI } from "@/services/api";
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
import { generateInvoicePDF, getInvoicePDF } from "@/lib/generateInvoicePDF";

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-primary/10 text-primary",
  Approved: "bg-success/10 text-success",
  Rejected: "bg-destructive/10 text-destructive",
};

const initialFormState = {
  clientName: "",
  companyName: "",
  address: "",
  gst: "",
  aadhar: "",
  pan: "",
  mobile: "",
  projectTitle: "",
  leadTag: "",
  date: new Date().toISOString().split("T")[0],
  services: [{ name: "", price: 0, quantity: 1 }],
  discount: 0,
  status: "Draft",
};

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [quotations, setQuotations] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [formData, setFormData] = useState(initialFormState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotations();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.get();
      setSettings(res.data);
    } catch {}
  };

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await quotationsAPI.getAll();
      setQuotations(res.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (q: any) => {
    setFormData({
      clientName: q.clientName || "",
      companyName: q.companyName || "",
      address: q.address || "",
      gst: q.gst || "",
      aadhar: q.aadhar || "",
      pan: q.pan || "",
      mobile: q.mobile || "",
      projectTitle: q.projectTitle || "",
      leadTag: q.leadTag || "",
      date: q.date
        ? new Date(q.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      services: q.services?.length
        ? q.services
        : [{ name: "", price: 0, quantity: 1 }],
      discount: q.discount || 0,
      status: q.status || "Draft",
    });
    setEditingQId(q._id || q.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this quotation?"))
      return;
    try {
      const res = await quotationsAPI.delete(id);
      if (res.success) {
        toast({ title: "Deleted" });
        fetchQuotations();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetFormAndCloseModal = () => {
    setIsModalOpen(false);
    setEditingQId(null);
    setFormData(initialFormState);
  };

  const setField = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleServiceChange = (index: number, field: string, value: any) => {
    const s = [...formData.services];
    s[index] = { ...s[index], [field]: value };
    setField("services", s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.clientName ||
      !formData.projectTitle ||
      formData.services.some((s) => !s.name || s.price <= 0)
    ) {
      toast({
        title: "Validation Error",
        description: "Fill required fields & services correctly",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const subtotal = formData.services.reduce(
        (a, s) => a + Number(s.price) * Number(s.quantity),
        0,
      );
      const tax = (subtotal - Number(formData.discount)) * 0.18;
      const total = subtotal - Number(formData.discount) + tax;
      const payload = { ...formData, subtotal, tax, total };
      const res = editingQId
        ? await quotationsAPI.update(editingQId, payload)
        : await quotationsAPI.create(payload);
      if (res.success) {
        toast({ title: "Saved!" });
        resetFormAndCloseModal();
        fetchQuotations();
      }
    } catch (error: any) {
      toast({
        title: "Error saving",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async (q: any) => {
    try {
      setPrintingId(q._id || q.id);
      await generateInvoicePDF(q, settings);
      toast({ title: "PDF Downloaded" });
    } catch {
      toast({ title: "PDF Error", variant: "destructive" });
    } finally {
      setPrintingId(null);
    }
  };

  const handlePreviewPDF = async (q: any) => {
    try {
      setPreviewingId(q._id || q.id || "new");
      const doc = await getInvoicePDF(q, settings || {});
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewOpen(true);
    } catch (err: any) {
      toast({
        title: "Preview Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPreviewingId(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsPreviewOpen(false);
  };

  const filtered = quotations.filter(
    (q) =>
      (q.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.number || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.projectTitle || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Quotations">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 animate-fade-in">
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
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
              onClick={resetFormAndCloseModal}
            >
              <Plus className="w-3.5 h-3.5" /> New Quotation
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingQId ? "Edit Quotation" : "Create New Quotation"}
                </DialogTitle>
                <DialogDescription>
                  Fill buyer details manually. Leave any optional field blank —
                  it won't appear in the PDF.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 py-4">
                {}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-border inline-block" /> Buyer
                    Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Dharmendra Singh Parihar"
                        value={formData.clientName}
                        onChange={(e) => setField("clientName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        Company Name{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. Parihar Enterprises"
                        value={formData.companyName}
                        onChange={(e) =>
                          setField("companyName", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2 grid gap-1.5">
                      <Label>
                        Address{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <textarea
                        rows={2}
                        placeholder={
                          "e.g. S/O Lalan Singh Parihar, Raipur Karchuliyan\nPO: Raipur Karchulion, Dist: Rewa, MP — 486114"
                        }
                        value={formData.address}
                        onChange={(e) => setField("address", e.target.value)}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        GST No{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. 09AAGCB9274N1ZW"
                        value={formData.gst}
                        onChange={(e) => setField("gst", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        Mobile No{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. 7389592218"
                        value={formData.mobile}
                        onChange={(e) => setField("mobile", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        Aadhar Number{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. 4832 3663 2950"
                        value={formData.aadhar}
                        onChange={(e) => setField("aadhar", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        PAN Number{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. DGWPS1511K"
                        value={formData.pan}
                        onChange={(e) => setField("pan", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-border inline-block" />{" "}
                    Quotation Details
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2 grid gap-1.5">
                      <Label>
                        Project / Title{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        required
                        placeholder="e.g. Supply of Machinery"
                        value={formData.projectTitle}
                        onChange={(e) =>
                          setField("projectTitle", e.target.value)
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>
                        Lead Tag{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. Indiamart"
                        value={formData.leadTag}
                        onChange={(e) => setField("leadTag", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setField("date", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {}
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">Line Items</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setField("services", [
                          ...formData.services,
                          { name: "", price: 0, quantity: 1 },
                        ])
                      }
                    >
                      + Add Item
                    </Button>
                  </div>
                  {formData.services.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Description / Item Name"
                          required
                          value={item.name}
                          onChange={(e) =>
                            handleServiceChange(idx, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Price ₹"
                          required
                          value={item.price}
                          onChange={(e) =>
                            handleServiceChange(
                              idx,
                              "price",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleServiceChange(
                              idx,
                              "quantity",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const s = [...formData.services];
                          if (s.length > 1) {
                            s.splice(idx, 1);
                            setField("services", s);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* ── BOTTOM ROW ── */}
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="grid gap-1.5">
                    <Label>Discount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) =>
                        setField("discount", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setField("status", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Sent">Sent</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md p-3">
                    18% GST applied automatically.
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <div className="flex-1 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePreviewPDF(formData)}
                    disabled={
                      !formData.clientName || !formData.projectTitle || saving
                    }
                  >
                    {previewingId === "new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Preview
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFormAndCloseModal}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingQId ? "Update Quotation" : "Save Quotation"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── TABLE ── */}
      <div
        className="bg-card rounded-xl border border-border card-shadow overflow-hidden animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Number & Date",
                  "Buyer & Project",
                  "Total (incl. Tax)",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      i >= 2 ? "text-right" : "text-left",
                      i === 4 ? "text-right" : "",
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
                  <td colSpan={5} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Loading quotations...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <p className="text-sm text-muted-foreground">
                      No quotations found.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((q, i) => (
                  <tr
                    key={q._id || q.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">
                        {q.number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(q.date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-foreground font-medium">
                        {q.companyName ? q.companyName : q.clientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {q.companyName ? q.clientName + " · " : ""}
                        {q.projectTitle}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-foreground">
                      ₹{Number(q.total || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-1 rounded-md",
                          statusColors[q.status] ||
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {q.status}
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
                            onClick={() => handleDownloadPDF(q)}
                          >
                            {printingId === (q._id || q.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="w-4 h-4 mr-2" />
                            )}
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePreviewPDF(q)}>
                            {previewingId === (q._id || q.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            Preview PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClick(q)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={() => handleDeleteClick(q._id || q.id)}
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

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="sm:max-w-[950px] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden border-border/60">
          <DialogHeader className="p-4 border-b border-border bg-card">
            <DialogTitle className="flex items-center justify-between">
              Quotation Preview
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="mr-8"
              >
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 w-full bg-white relative">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-none"
                title="Quotation Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
