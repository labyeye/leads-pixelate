import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/components/ui/use-toast";
import { leadsAPI, usersAPI } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  "PENDING CONTACT",
  "1",
  "2",
  "3",
  "COMPLETED",
  "DISCUSSION",
  "DISCUSSION 1",
  "DISCUSSION 2",
  "DISCUSSION 3",
  "DISCUSSION COMPLETED",
  "QUOTATION",
  "QUOTATION 1",
  "QUOTATION 2",
  "QUOTATION 3",
  "QUOTATION COMPLETED",
  "VISIT SCHEDULED",
  "VISITED",
  "WON",
  "DROP",
];
const SOURCES = [
  "IndiaMART",
  "TradeIndia",
  "Justdial",
  "Website",
  "Facebook",
  "Manual",
];

const STATUS_BADGE: Record<string, string> = {
  WON: "bg-green-400 text-black border-black",
  DROP: "bg-red-400 text-black border-black",
  "PENDING CONTACT": "bg-yellow-300 text-black border-black",
  "VISIT SCHEDULED": "bg-blue-300 text-black border-black",
  VISITED: "bg-indigo-300 text-black border-black",
  DISCUSSION: "bg-purple-300 text-black border-black",
  QUOTATION: "bg-orange-300 text-black border-black",
};
function statusBadge(s: string) {
  return STATUS_BADGE[s] || "bg-gray-200 text-black border-black";
}

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "Total Leads",
    bg: "bg-white",
    text: "text-primary",
  },
  { key: "won", label: "Won", bg: "bg-white", text: "text-green-600" },
  { key: "drop", label: "Dropped", bg: "bg-white", text: "text-red-600" },
  {
    key: "pending",
    label: "Pending Contact",
    bg: "bg-white",
    text: "text-black",
  },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    source: "all",
    assignedTo: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    usersAPI.getAll().then((res) => setUsers(res.data || []));
    fetchLeads();
  }, []);

  const fetchLeads = async (overrides?: Partial<typeof filters>) => {
    const f = { ...filters, ...overrides };
    try {
      setLoading(true);
      const params: Record<string, string> = { limit: "99999" };
      if (f.search) params.search = f.search;
      if (f.status && f.status !== "all") params.status = f.status;
      if (f.source && f.source !== "all") params.source = f.source;
      if (f.assignedTo && f.assignedTo !== "all")
        params.assignedTo = f.assignedTo;
      if (f.startDate) params.startDate = f.startDate;
      if (f.endDate) params.endDate = f.endDate;
      const res = await leadsAPI.getAll(params);
      setLeads(res.data || []);
    } catch (err: any) {
      toast({
        title: "Error loading leads",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    const reset = {
      search: "",
      status: "all",
      source: "all",
      assignedTo: "all",
      startDate: "",
      endDate: "",
    };
    setFilters(reset);
    fetchLeads(reset);
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Company",
      "Phone",
      "Email",
      "Source",
      "Status",
      "Assigned To",
      "Location",
      "Follow-up Date",
      "Created At",
    ];
    const rows = leads.map((l) => [
      l.name || "",
      l.company || "",
      l.phone || "",
      l.email || "",
      l.source || "",
      l.status || "",
      l.assignedTo?.name || "Unassigned",
      l.location || "",
      l.followUpDate
        ? new Date(l.followUpDate).toLocaleDateString("en-IN")
        : "",
      l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!tableRef.current) return;
    try {
      setExporting(true);
      const canvas = await html2canvas(tableRef.current, {
        scale: 1.5,
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: "a4",
      });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(
        `LEADS REPORT  —  ${new Date().toLocaleDateString("en-IN")}`,
        20,
        22,
      );
      pdf.addImage(img, "PNG", 0, 32, w, h);
      pdf.save(`leads-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      toast({
        title: "PDF export failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const counts = {
    total: leads.length,
    won: leads.filter((l) => l.status === "WON").length,
    drop: leads.filter((l) => l.status === "DROP").length,
    pending: leads.filter((l) => l.status === "PENDING CONTACT").length,
  };

  const activeFilterCount = [
    filters.search,
    filters.status !== "all" ? filters.status : "",
    filters.source !== "all" ? filters.source : "",
    filters.assignedTo !== "all" ? filters.assignedTo : "",
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  return (
    <AppLayout title="Reports">
      <div className="space-y-5">
        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SUMMARY_CARDS.map(({ key, label, bg, text }) => (
            <div
              key={key}
              className={cn(
                "border-2 border-black p-4 text-center shadow-[4px_4px_0px_#000] transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]",
                bg,
              )}
            >
              <p className={cn("text-4xl font-black tabular-nums", text)}>
                {loading ? "—" : counts[key as keyof typeof counts]}
              </p>
              <p
                className={cn(
                  "text-xs font-bold uppercase tracking-widest mt-1",
                  text,
                )}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filter panel ── */}
        <div className="border-2 border-black shadow-[4px_4px_0px_#000] bg-white">
          {/* Header bar */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 border-b-2 border-black bg-primary text-white font-white uppercase tracking-widest text-xs hover:bg-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-yellow-300 text-black text-[10px] font-black px-1.5 py-0.5 border border-black">
                  {activeFilterCount} active
                </span>
              )}
            </span>
            <span>{filtersOpen ? "▲" : "▼"}</span>
          </button>

          {filtersOpen && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Search */}
                <div className="xl:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">
                    Search
                  </label>
                  <div className="flex items-center gap-2 border-2 border-black px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-black">
                    <Search className="w-3.5 h-3.5 text-black shrink-0" />
                    <input
                      type="text"
                      placeholder="Name, phone, email..."
                      value={filters.search}
                      onChange={(e) => setFilter("search", e.target.value)}
                      className="text-sm bg-transparent outline-none w-full text-black placeholder:text-gray-400 font-medium"
                    />
                    {filters.search && (
                      <button
                        onClick={() => setFilter("search", "")}
                        className="shrink-0"
                      >
                        <X className="w-3 h-3 text-black" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">
                    Status
                  </label>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => setFilter("status", v)}
                  >
                    <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                      <SelectItem value="all" className="font-bold">
                        All Statuses
                      </SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="font-medium">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">
                    Source
                  </label>
                  <Select
                    value={filters.source}
                    onValueChange={(v) => setFilter("source", v)}
                  >
                    <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                      <SelectItem value="all" className="font-bold">
                        All Sources
                      </SelectItem>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s} className="font-medium">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned To */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">
                    Assigned To
                  </label>
                  <Select
                    value={filters.assignedTo}
                    onValueChange={(v) => setFilter("assignedTo", v)}
                  >
                    <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                      <SelectValue placeholder="All Members" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_#000]">
                      <SelectItem value="all" className="font-bold">
                        All Members
                      </SelectItem>
                      {users.map((u) => (
                        <SelectItem
                          key={u._id}
                          value={u._id}
                          className="font-medium"
                        >
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">
                    From — To
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilter("startDate", e.target.value)}
                      className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black min-w-0"
                    />
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilter("endDate", e.target.value)}
                      className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black min-w-0"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t-2 border-black mt-3">
                <button
                  onClick={() => fetchLeads()}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Apply Filters
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 px-4 py-2 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="border-2 border-black shadow-[4px_4px_0px_#000] bg-white overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-white">
            <p className="text-xs font-black uppercase tracking-widest text-black">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                </span>
              ) : (
                `${leads.length} lead${leads.length !== 1 ? "s" : ""} found`
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                disabled={loading || leads.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400 text-black font-black uppercase text-[10px] tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={exportPDF}
                disabled={loading || leads.length === 0 || exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400 text-black font-black uppercase text-[10px] tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
            </div>
          </div>

          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary text-white">
                  {[
                    "#",
                    "Name / Email",
                    "Company",
                    "Phone",
                    "Source",
                    "Status",
                    "Assigned To",
                    "Follow-up",
                    "Created",
                  ].map((h) => (
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
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-black" />
                      <p className="text-sm font-bold text-black mt-2 uppercase tracking-widest">
                        Loading leads...
                      </p>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <p className="text-sm font-black uppercase tracking-widest text-black">
                        No leads found.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Try adjusting your filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead, i) => (
                    <tr
                      key={lead._id || i}
                      className={cn(
                        "border-b-2 border-black last:border-b-0 transition-colors",
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                      )}
                    >
                      <td className="px-4 py-3 text-xs font-black text-gray-400 whitespace-nowrap">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-black text-black text-sm">
                          {lead.name || "—"}
                        </p>
                        {lead.email && (
                          <p className="text-[10px] text-gray-500 font-medium">
                            {lead.email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">
                        {lead.company || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">
                        {lead.phone || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2 border-black bg-gray-100">
                          {lead.source || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2",
                            statusBadge(lead.status),
                          )}
                        >
                          {lead.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">
                        {lead.assignedTo?.name || (
                          <span className="text-gray-400 italic font-medium text-xs">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-black whitespace-nowrap">
                        {lead.followUpDate ? (
                          new Date(lead.followUpDate).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-black whitespace-nowrap">
                        {lead.createdAt ? (
                          new Date(lead.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {leads.length > 0 && (
            <div className="border-t-2 border-black px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest flex justify-between">
              <span>Total: {leads.length} leads</span>
              <span>
                Won: {counts.won} · Drop: {counts.drop} · Pending:{" "}
                {counts.pending}
              </span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
