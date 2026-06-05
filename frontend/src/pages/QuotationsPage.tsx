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
import { useState, useEffect } from "react";
import { quotationsAPI, settingsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateInvoicePDF, getInvoicePDF } from "@/lib/generateInvoicePDF";

const STATUS_NB: Record<string, string> = {
  Draft: "bg-white text-black border-black",
  Sent: "bg-[#024BAB] text-white border-black",
  Approved: "bg-[#FFDE00] text-black border-black",
  Rejected: "bg-black text-white border-black",
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
  className: cls,
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
        className={cn("border-2 w-full px-3 py-2 text-sm resize-none", cls)}
      />
    ) : (
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={cn("border-2 w-full px-3 py-2 text-sm", cls)}
      />
    )}
  </div>
);

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
    if (!window.confirm("Delete this quotation?")) return;
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

  const resetForm = () => {
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
        description: "Fill required fields & services",
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
        resetForm();
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
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

  const subtotal = formData.services.reduce(
    (a, s) => a + Number(s.price) * Number(s.quantity),
    0,
  );
  const discount = Number(formData.discount);
  const tax = (subtotal - discount) * 0.18;
  const total = subtotal - discount + tax;

  return (
    <AppLayout title="Quotations">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 border-2 px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search quotations..."
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
              onClick={resetForm}
              className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Quotation
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[700px] border-2 border-black rounded-none shadow-[6px_6px_0px_#000] p-0 gap-0 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="border-b-2 border-black bg-[#024BAB] px-5 py-4 sticky top-0 z-10">
                <DialogTitle className="text-white font-black uppercase tracking-wider text-base">
                  {editingQId ? "Edit Quotation" : "Create New Quotation"}
                </DialogTitle>
              </DialogHeader>

              <div className="p-5 bg-white space-y-5">
                {/* Buyer Details */}
                <div>
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Buyer Details
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NbInput
                      label="Name"
                      id="clientName"
                      value={formData.clientName}
                      onChange={(e: any) =>
                        setField("clientName", e.target.value)
                      }
                      placeholder="e.g. Raj Kumar"
                      required
                    />
                    <NbInput
                      label="Company (optional)"
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e: any) =>
                        setField("companyName", e.target.value)
                      }
                      placeholder="e.g. Raj Enterprises"
                    />
                    <div className="col-span-2">
                      <NbInput
                        label="Address (optional)"
                        id="address"
                        value={formData.address}
                        onChange={(e: any) =>
                          setField("address", e.target.value)
                        }
                        placeholder="Full address..."
                        as="textarea"
                      />
                    </div>
                    <NbInput
                      label="GST No (optional)"
                      id="gst"
                      value={formData.gst}
                      onChange={(e: any) => setField("gst", e.target.value)}
                      placeholder="09AAGCB9274N1ZW"
                    />
                    <NbInput
                      label="Mobile (optional)"
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e: any) => setField("mobile", e.target.value)}
                      placeholder="9999999999"
                    />
                    <NbInput
                      label="Aadhar (optional)"
                      id="aadhar"
                      value={formData.aadhar}
                      onChange={(e: any) => setField("aadhar", e.target.value)}
                      placeholder="4832 3663 2950"
                    />
                    <NbInput
                      label="PAN (optional)"
                      id="pan"
                      value={formData.pan}
                      onChange={(e: any) => setField("pan", e.target.value)}
                      placeholder="DGWPS1511K"
                    />
                  </div>
                </div>

                {/* Quotation Details */}
                <div>
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Quotation Details
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <NbInput
                        label="Project / Title"
                        id="projectTitle"
                        value={formData.projectTitle}
                        onChange={(e: any) =>
                          setField("projectTitle", e.target.value)
                        }
                        placeholder="e.g. Supply of Machinery"
                        required
                      />
                    </div>
                    <NbInput
                      label="Lead Tag (optional)"
                      id="leadTag"
                      value={formData.leadTag}
                      onChange={(e: any) => setField("leadTag", e.target.value)}
                      placeholder="e.g. IndiaMART"
                    />
                    <NbInput
                      label="Date"
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e: any) => setField("date", e.target.value)}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-5 bg-primary" />
                      <p className="text-xs font-black uppercase tracking-widest text-black">
                        Line Items
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setField("services", [
                          ...formData.services,
                          { name: "", price: 0, quantity: 1 },
                        ])
                      }
                      className="border-2 bg-primary text-white px-3 py-1 text-xs font-black"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="border-2 border-black bg-white">
                    <div className="grid grid-cols-12 gap-0 border-b-2 border-black bg-primary">
                      <div className="col-span-6 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Description
                      </div>
                      <div className="col-span-3 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Price ₹
                      </div>
                      <div className="col-span-2 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Qty
                      </div>
                      <div className="col-span-1" />
                    </div>
                    {formData.services.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "grid grid-cols-12 gap-0",
                          idx < formData.services.length - 1 &&
                            "border-b-2 border-black",
                        )}
                      >
                        <div className="col-span-6 border-r-2 border-black">
                          <input
                            value={item.name}
                            onChange={(e) =>
                              handleServiceChange(idx, "name", e.target.value)
                            }
                            placeholder="Item description"
                            required
                            className="w-full px-3 py-2.5 text-sm font-medium bg-white outline-none focus:bg-[#FFDE00]/20"
                          />
                        </div>
                        <div className="col-span-3 border-r-2 border-black">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.price}
                            onChange={(e) =>
                              handleServiceChange(
                                idx,
                                "price",
                                Number(e.target.value),
                              )
                            }
                            placeholder="0"
                            required
                            className="w-full px-3 py-2.5 text-sm font-bold bg-white outline-none focus:bg-[#FFDE00]/20"
                          />
                        </div>
                        <div className="col-span-2 border-r-2 border-black">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleServiceChange(
                                idx,
                                "quantity",
                                Number(e.target.value),
                              )
                            }
                            placeholder="1"
                            required
                            className="w-full px-3 py-2.5 text-sm font-bold bg-white outline-none focus:bg-[#FFDE00]/20"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const s = [...formData.services];
                              if (s.length > 1) {
                                s.splice(idx, 1);
                                setField("services", s);
                              }
                            }}
                            className="w-6 h-6 border-2 border-black bg-[#F82B2B] text-white text-xs font-black hover:bg-red-600 transition-colors flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-3 border-2 border-black bg-white">
                    <div className="flex justify-between items-center px-4 py-2 border-b border-black/20">
                      <span className="text-xs font-black uppercase tracking-widest text-black">
                        Subtotal
                      </span>
                      <span className="text-sm font-black text-black">
                        ₹{subtotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2 border-b border-black/20">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest text-black">
                          Discount
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={formData.discount}
                          onChange={(e) =>
                            setField("discount", Number(e.target.value))
                          }
                          className="w-24 border-2 border-black px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                        />
                      </div>
                      <span className="text-sm font-black text-black">
                        −₹{discount.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2 border-b border-black/20">
                      <span className="text-xs font-black uppercase tracking-widest text-black">
                        GST 18%
                      </span>
                      <span className="text-sm font-black text-black">
                        ₹
                        {tax.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-[#024BAB]">
                      <span className="text-xs font-black uppercase tracking-widest text-white">
                        Total
                      </span>
                      <span className="text-lg font-black text-white">
                        ₹
                        {total.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="w-48">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-black">
                      Status
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setField("status", v)}
                    >
                      <SelectTrigger className="border-2 border-black rounded-none focus:ring-0 bg-white font-bold h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black rounded-none">
                        {["Draft", "Sent", "Approved", "Rejected"].map((s) => (
                          <SelectItem key={s} value={s} className="font-bold">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t-2 border-black px-5 py-3 bg-white sticky bottom-0 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePreviewPDF(formData)}
                  disabled={
                    !formData.clientName || !formData.projectTitle || saving
                  }
                  className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm font-black flex items-center gap-1.5 disabled:opacity-50"
                >
                  {previewingId === "new" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}{" "}
                  Preview
                </button>
                <div className="flex gap-2 ml-auto">
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
                    {editingQId ? "Update Quotation" : "Save Quotation"}
                  </button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Total",
            val: quotations.length,
            bg: "bg-white text-primary",
          },
          {
            label: "Draft",
            val: quotations.filter((q) => q.status === "Draft").length,
            bg: "bg-white text-secondary",
          },
          {
            label: "Approved",
            val: quotations.filter((q) => q.status === "Approved").length,
            bg: "bg-white text-green-600",
          },
          {
            label: "Rejected",
            val: quotations.filter((q) => q.status === "Rejected").length,
            bg: "bg-white text-red-600",
          },
        ].map(({ label, val, bg }) => (
          <div
            key={label}
            className={cn("border-2 border-black p-3 text-center", bg)}
          >
            <p className="text-2xl font-black">{loading ? "—" : val}</p>
            <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-80">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-2 border-black bg-[#024BAB]">
                {[
                  "Number & Date",
                  "Buyer / Project",
                  "Total (incl. Tax)",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-5 py-3 text-[10px] font-black text-white uppercase tracking-widest",
                      i >= 2 ? "text-right" : "text-left",
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
                    No quotations found.
                  </td>
                </tr>
              ) : (
                filtered.map((q, i) => (
                  <tr
                    key={q._id || q.id}
                    className={cn(
                      "border-b-2 border-black last:border-b-0 hover:bg-[#FFDE00]/10 transition-colors",
                      i % 2 === 1 && "bg-[#024BAB]/5",
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-black text-black text-sm">
                        {q.number}
                      </p>
                      <p className="text-xs text-black/50 font-medium">
                        {new Date(q.date).toLocaleDateString("en-IN")}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-black text-black text-sm">
                        {q.companyName || q.clientName}
                      </p>
                      <p className="text-xs text-black/50">
                        {q.companyName ? `${q.clientName} · ` : ""}
                        {q.projectTitle}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-black text-sm">
                      ₹
                      {Number(q.total || 0).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "text-[10px] font-black px-2 py-1 border-2 uppercase tracking-wider",
                          STATUS_NB[q.status] ||
                            "bg-white text-black border-black",
                        )}
                      >
                        {q.status}
                      </span>
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
                          className="border-2 border-black rounded-none bg-white min-w-[160px] p-0"
                        >
                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(q)}
                            className="font-bold text-black hover:bg-[#024BAB] hover:text-white focus:bg-[#024BAB] focus:text-white rounded-none cursor-pointer px-4 py-2.5"
                          >
                            {printingId === (q._id || q.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="w-4 h-4 mr-2" />
                            )}
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePreviewPDF(q)}
                            className="font-bold text-black hover:bg-[#FFDE00] hover:text-black focus:bg-[#FFDE00] focus:text-black rounded-none cursor-pointer border-t border-black/20 px-4 py-2.5"
                          >
                            {previewingId === (q._id || q.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            Preview PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditClick(q)}
                            className="font-bold text-black hover:bg-[#024BAB] hover:text-white focus:bg-[#024BAB] focus:text-white rounded-none cursor-pointer border-t border-black/20 px-4 py-2.5"
                          >
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(q._id || q.id)}
                            className="font-bold text-black hover:bg-black hover:text-white focus:bg-black focus:text-white rounded-none cursor-pointer border-t-2 border-black px-4 py-2.5"
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

      {/* PDF Preview Dialog */}
      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="sm:max-w-[950px] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 border-2 border-black rounded-none shadow-[6px_6px_0px_#000] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-[#024BAB]">
            <span className="text-white font-black uppercase tracking-widest text-sm">
              Quotation Preview
            </span>
            <button
              onClick={() => window.print()}
              className="border-2 bg-[#FFDE00] text-black px-4 py-1.5 text-xs font-black"
            >
              Print
            </button>
          </div>
          <div className="flex-1 min-h-0 w-full bg-white relative">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-none"
                title="Quotation Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
