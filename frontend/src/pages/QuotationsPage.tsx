import { AppLayout } from "@/components/layout/AppLayout";
import React from "react";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Plus,
  Search,
  FileDown,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  FileText,
  FileClock,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
} from "lucide-react";
import {
  ExportFieldsDialog,
  type ExportField,
} from "@/components/export/ExportFieldsDialog";

function quotationTotal(q: any): number {
  const subtotal = (q.services || []).reduce(
    (a: number, s: any) => a + Number(s.price) * Number(s.quantity),
    0,
  );
  const discount = Number(q.discount) || 0;
  return subtotal - discount + (subtotal - discount) * 0.18;
}

const QUOTATION_EXPORT_FIELDS: ExportField[] = [
  { key: "number", label: "Number", get: (q) => q.number || "" },
  { key: "clientName", label: "Client Name", get: (q) => q.clientName || "" },
  { key: "companyName", label: "Company", get: (q) => q.companyName || "" },
  { key: "mobile", label: "Mobile", default: false, get: (q) => q.mobile || "" },
  {
    key: "projectTitle",
    label: "Project Title",
    get: (q) => q.projectTitle || "",
  },
  { key: "status", label: "Status", get: (q) => q.status || "" },
  {
    key: "total",
    label: "Total (incl. tax)",
    get: (q) => quotationTotal(q).toFixed(2),
  },
  {
    key: "date",
    label: "Date",
    get: (q) => (q.date ? new Date(q.date).toLocaleDateString("en-IN") : ""),
  },
  { key: "gst", label: "GST", default: false, get: (q) => q.gst || "" },
  { key: "address", label: "Address", default: false, get: (q) => q.address || "" },
];
import { useState, useEffect } from "react";
import { quotationsAPI, settingsAPI, clientsAPI, productsAPI } from "@/services/api";
import { AddressFields, blankAddress, joinAddress } from "@/components/quotations/AddressFields";
import { ImportQuotationsDialog } from "@/components/quotations/ImportQuotationsDialog";
import { useNotify } from "@/components/ui/Notification";
import { usePermission } from "@/hooks/usePermission";
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
import { downloadQuotationPDF, quotationPdfBlob } from "@/lib/quotationPdf";

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
  ...blankAddress,
  gst: "",
  aadhar: "",
  pan: "",
  mobile: "",
  projectTitle: "",
  leadTag: "",
  date: new Date().toISOString().split("T")[0],
  services: [{ name: "", hsnCode: "", price: 0, quantity: 1 }],
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
        {...rest}
      />
    )}
  </div>
);

export default function QuotationsPage() {
  const { can } = usePermission();
  const [search, setSearch] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const notify = useNotify();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    fetchQuotations();
    fetchSettings();
    clientsAPI
      .getAll()
      .then((res) => setClients(res.data || []))
      .catch(() => {});
    productsAPI.getAll().then((r) => setProducts(r.data || [])).catch(() => {});
  }, []);

  // Picking a saved client fills the buyer fields (still editable); "new" clears them.
  const handleClientSelect = (id: string) => {
    setSelectedClientId(id);
    const c = clients.find((x) => x._id === id);
    setFormData((prev) => ({
      ...prev,
      clientName: c?.name || "",
      companyName: c?.company || "",
      address: c?.address || "",
      ...blankAddress,
      addressLine: c?.address || "",
      gst: c?.gst || "",
      mobile: (c?.phone || "").replace(/\D/g, "").slice(-10),
      aadhar: "",
      pan: "",
    }));
  };

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
      notify.error("Error fetching quotations", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (q: any) => {
    setFormData({
      clientName: q.clientName || "",
      companyName: q.companyName || "",
      address: q.address || "",
      addressLine: q.addressLine ?? (q.city || q.state || q.zip ? "" : q.address || ""),
      city: q.city || "",
      state: q.state || "",
      zip: q.zip || "",
      country: q.country || "India",
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
        ? q.services.map((s: any) => ({ ...s, hsnCode: s.hsnCode || "" }))
        : [{ name: "", hsnCode: "", price: 0, quantity: 1 }],
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
        notify.success("Quotation Deleted", "The quotation has been removed.");
        fetchQuotations();
      }
    } catch (error: any) {
      notify.error("Delete Failed", error.message);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingQId(null);
    setSelectedClientId("");
    setFormData(initialFormState);
  };
  const setField = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // Typing/picking a catalogue product name fills its price and HSN. Quotations never touch stock; only a confirmed sales order does.
  const handleNameChange = (index: number, name: string) => {
    const p = products.find((x) => x.name === name);
    const s = [...formData.services];
    s[index] = { ...s[index], name, ...(p ? { price: p.price, hsnCode: p.hsnCode || "" } : {}) };
    setField("services", s);
  };

  const handleServiceChange = (index: number, field: string, value: any) => {
    const s = [...formData.services];
    s[index] = { ...s[index], [field]: value };
    setField("services", s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim()) {
      notify.error("Client Name is required");
      return;
    }
    if (!formData.projectTitle.trim()) {
      notify.error("Project Title is required");
      return;
    }
    if (formData.services.length === 0) {
      notify.error("Add at least one service item");
      return;
    }
    const badSvc = formData.services.find((s) => !s.name.trim());
    if (badSvc) {
      notify.error("Service name missing", "Every line item must have a name.");
      return;
    }
    const badPrice = formData.services.find((s) => Number(s.price) <= 0);
    if (badPrice) {
      notify.error(
        "Invalid price",
        "Each service item must have a price greater than 0.",
      );
      return;
    }
    const badQty = formData.services.find((s) => Number(s.quantity) < 1);
    if (badQty) {
      notify.error(
        "Invalid quantity",
        "Quantity must be at least 1 for each item.",
      );
      return;
    }
    if (formData.mobile && !/^[6-9]\d{9}$/.test(formData.mobile)) {
      notify.error(
        "Invalid Mobile",
        "Enter a valid 10-digit Indian mobile number.",
      );
      return;
    }
    if (
      formData.gst &&
      !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(formData.gst)
    ) {
      notify.error(
        "Invalid GST Number",
        "GSTIN must be 15 characters (e.g. 07AAAAA0000A1Z5).",
      );
      return;
    }
    if (formData.aadhar && !/^\d{12}$/.test(formData.aadhar)) {
      notify.error("Invalid Aadhar", "Aadhar must be exactly 12 digits.");
      return;
    }
    if (formData.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(formData.pan)) {
      notify.error(
        "Invalid PAN",
        "PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).",
      );
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
      const payload = { ...formData, address: joinAddress(formData), subtotal, tax, total };
      const res = editingQId
        ? await quotationsAPI.update(editingQId, payload)
        : await quotationsAPI.create(payload);
      if (res.success) {
        notify.success(
          editingQId ? "Quotation Updated" : "Quotation Created",
          editingQId
            ? "Changes have been saved."
            : `Quotation for ${formData.clientName} has been created.`,
        );
        resetForm();
        fetchQuotations();
      }
    } catch (error: any) {
      notify.error("Save Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async (q: any) => {
    try {
      setPrintingId(q._id || q.id);
      await downloadQuotationPDF(q, settings);
      notify.success("PDF Downloaded");
    } catch {
      notify.error("PDF Error", "Could not generate PDF.");
    } finally {
      setPrintingId(null);
    }
  };

  const handlePreviewPDF = async (q: any) => {
    try {
      setPreviewingId(q._id || q.id || "new");
      const blob = await quotationPdfBlob(q, settings || {});
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewOpen(true);
    } catch (err: any) {
      notify.error("Preview Error", err.message);
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
      {}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
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

        {can("Quotations", "create") && (
          <button
            onClick={() => setShowImportDialog(true)}
            className="border-2 bg-white text-black px-4 py-2 text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
        )}

        <button
          onClick={() => setShowExportDialog(true)}
          disabled={filtered.length === 0}
          className="border-2 bg-white text-black px-4 py-2 text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> Export
        </button>

        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}
        >
          {can("Quotations", "create") && (
            <DialogTrigger asChild>
              <button
                onClick={resetForm}
                className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" /> New Quotation
              </button>
            </DialogTrigger>
          )}

          <DialogContent className="sm:max-w-[700px] border-2 border-black rounded-none shadow-[6px_6px_0px_#000] p-0 gap-0 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="border-b-2 border-black bg-[#024BAB] px-5 py-4 sticky top-0 z-10">
                <DialogTitle className="text-white uppercase tracking-wider text-base">
                  {editingQId ? "Edit Quotation" : "Create New Quotation"}
                </DialogTitle>
              </DialogHeader>

              <div className="p-5 bg-white space-y-5">
                {}
                <div>
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Buyer Details
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {!editingQId && (
                      <div className="col-span-1 sm:col-span-4 space-y-1">
                        <label
                          htmlFor="existingClient"
                          className="block text-[10px] font-black uppercase tracking-widest text-black"
                        >
                          Select Client
                        </label>
                        <select
                          id="existingClient"
                          value={selectedClientId}
                          onChange={(e) => handleClientSelect(e.target.value)}
                          className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                        >
                          <option value="">
                            — New client (enter details below) —
                          </option>
                          {clients.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                              {c.company ? ` — ${c.company}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
                    <AddressFields
                      value={formData}
                      onChange={(patch) =>
                        setFormData((prev) => ({ ...prev, ...patch }))
                      }
                    />
                    <NbInput
                      label="GST No (optional)"
                      id="gst"
                      value={formData.gst}
                      onChange={(e: any) =>
                        setField(
                          "gst",
                          e.target.value.toUpperCase().slice(0, 15),
                        )
                      }
                      placeholder="09AAGCB9274N1ZW"
                      maxLength={15}
                    />
                    <NbInput
                      label="Mobile (optional)"
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e: any) =>
                        setField(
                          "mobile",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="9999999999"
                      maxLength={10}
                      inputMode="numeric"
                    />
                    <NbInput
                      label="Aadhar (optional)"
                      id="aadhar"
                      value={formData.aadhar}
                      onChange={(e: any) =>
                        setField(
                          "aadhar",
                          e.target.value.replace(/\D/g, "").slice(0, 12),
                        )
                      }
                      placeholder="481236632950"
                      maxLength={12}
                      inputMode="numeric"
                    />
                    <NbInput
                      label="PAN (optional)"
                      id="pan"
                      value={formData.pan}
                      onChange={(e: any) =>
                        setField(
                          "pan",
                          e.target.value.toUpperCase().slice(0, 10),
                        )
                      }
                      placeholder="DGWPS1511K"
                      maxLength={10}
                    />
                  </div>
                </div>

                {}
                <div>
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-black">
                    <div className="w-1 h-5 bg-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black">
                      Quotation Details
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

                {}
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
                          { name: "", hsnCode: "", price: 0, quantity: 1 },
                        ])
                      }
                      className="border-2 bg-primary text-white px-3 py-1 text-xs font-black"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="border-2 border-black bg-white overflow-x-auto">
                    <div className="grid grid-cols-12 gap-0 border-b-2 border-black bg-primary min-w-[480px]">
                      <div className="col-span-4 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Description
                      </div>
                      <div className="col-span-2 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        HSN/SAC
                      </div>
                      <div className="col-span-3 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Price ₹
                      </div>
                      <div className="col-span-2 px-3 py-2 text-[10px] font-black text-white uppercase tracking-widest border-r-2 border-white/20">
                        Qty
                      </div>
                      <div className="col-span-1" />
                    </div>
                    <datalist id="q-products">
                      {products.map((p) => (
                        <option key={p._id} value={p.name} />
                      ))}
                    </datalist>
                    {formData.services.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "grid grid-cols-12 gap-0 min-w-[480px]",
                          idx < formData.services.length - 1 &&
                            "border-b-2 border-black",
                        )}
                      >
                        <div className="col-span-4 border-r-2 border-black">
                          <input
                            value={item.name}
                            list="q-products"
                            onChange={(e) =>
                              handleNameChange(idx, e.target.value)
                            }
                            placeholder="Item description"
                            required
                            className="w-full px-3 py-2.5 text-sm font-medium bg-white outline-none focus:bg-[#FFDE00]/20"
                          />
                        </div>
                        <div className="col-span-2 border-r-2 border-black">
                          <input
                            value={item.hsnCode || ""}
                            onChange={(e) =>
                              handleServiceChange(
                                idx,
                                "hsnCode",
                                e.target.value,
                              )
                            }
                            placeholder="998315"
                            className="w-full px-3 py-2.5 text-sm font-mono bg-white outline-none focus:bg-[#FFDE00]/20"
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

                  {}
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

                {}
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

      {}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard
          title="Total"
          value={loading ? "—" : quotations.length}
          icon={FileText}
          bg="bg-[#024BAB]"
        />
        <KpiCard
          title="Draft"
          value={
            loading
              ? "—"
              : quotations.filter((q) => q.status === "Draft").length
          }
          icon={FileClock}
          bg="bg-[#FFDE00]"
        />
        <KpiCard
          title="Approved"
          value={
            loading
              ? "—"
              : quotations.filter((q) => q.status === "Approved").length
          }
          icon={CheckCircle2}
          bg="bg-[#00C48C]"
        />
        <KpiCard
          title="Rejected"
          value={
            loading
              ? "—"
              : quotations.filter((q) => q.status === "Rejected").length
          }
          icon={XCircle}
          bg="bg-[#EF4444]"
        />
      </div>

      {}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-2 border-black bg-[#024BAB]">
                {[
                  "Number & Date",
                  "Client",
                  "Contact",
                  "GST",
                  "Project",
                  "Items",
                  "Subtotal",
                  "Discount",
                  "Tax (18%)",
                  "Total (incl. Tax)",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap",
                      i >= 6 ? "text-right" : "text-left",
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
                  <td colSpan={12} className="text-center py-14">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                    <p className="text-xs font-black uppercase tracking-widest text-black/30 mt-2">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
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
                    <td className="px-4 py-3.5">
                      <p className="font-black text-black text-sm">
                        {q.clientName}
                      </p>
                      <p className="text-xs text-black/50">{q.companyName}</p>
                      <p className="text-xs text-black/50 max-w-[200px] truncate">
                        {q.address}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium whitespace-nowrap">
                      {q.mobile || <span className="text-black/30">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono whitespace-nowrap">
                      {q.gst || <span className="text-black/30">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-bold max-w-[180px]">
                      <p className="truncate">{q.projectTitle}</p>
                      {q.leadTag && (
                        <p className="text-black/50 font-medium">{q.leadTag}</p>
                      )}
                    </td>
                    <td
                      className="px-4 py-3.5 text-xs max-w-[200px]"
                      title={(q.services || [])
                        .map((s: any) => `${s.name} x${s.quantity}`)
                        .join("\n")}
                    >
                      <p className="font-black">
                        {(q.services || []).length} item
                        {(q.services || []).length === 1 ? "" : "s"}
                      </p>
                      <p className="text-black/50 truncate">
                        {(q.services || []).map((s: any) => s.name).join(", ")}
                      </p>
                    </td>
                    {(() => {
                      const sub = (q.services || []).reduce(
                        (a: number, s: any) =>
                          a + Number(s.price) * Number(s.quantity),
                        0,
                      );
                      const disc = Number(q.discount) || 0;
                      const money = (n: number) =>
                        `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
                      return (
                        <>
                          <td className="px-4 py-3.5 text-right text-xs font-bold whitespace-nowrap">
                            {money(sub)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-xs font-bold whitespace-nowrap">
                            {money(disc)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-xs font-bold whitespace-nowrap">
                            {money((sub - disc) * 0.18)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-black text-sm whitespace-nowrap">
                            {money(quotationTotal(q))}
                          </td>
                        </>
                      );
                    })()}
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
                          {can("Quotations", "update") && (
                            <DropdownMenuItem
                              onClick={() => handleEditClick(q)}
                              className="font-bold text-black hover:bg-[#024BAB] hover:text-white focus:bg-[#024BAB] focus:text-white rounded-none cursor-pointer border-t border-black/20 px-4 py-2.5"
                            >
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {can("Quotations", "delete") && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(q._id || q.id)}
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

      {}
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

      <ImportQuotationsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={fetchQuotations}
      />
      <ExportFieldsDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title="Export Quotations"
        fields={QUOTATION_EXPORT_FIELDS}
        data={filtered}
        filenamePrefix="quotations"
      />
    </AppLayout>
  );
}
