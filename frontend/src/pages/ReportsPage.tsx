import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/components/ui/use-toast";
import { leadsAPI, reportsAPI, usersAPI } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Download,
  FileText,
  Loader2,
  Search,
  SlidersHorizontal,
  Users,
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

type Tab = "leads" | "activity" | "team";
type Period = "today" | "week" | "month" | "year" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── Leads tab filters ──
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    source: "all",
    assignedTo: "all",
    startDate: "",
    endDate: "",
  });

  // ── Activity tab state ──
  const [activityPeriod, setActivityPeriod] = useState<Period>("today");
  const [activityUser, setActivityUser] = useState("all");
  const [activityCustomFrom, setActivityCustomFrom] = useState("");
  const [activityCustomTo, setActivityCustomTo] = useState("");
  const [activityData, setActivityData] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // ── Team tab state ──
  const [teamPeriod, setTeamPeriod] = useState<Period>("month");
  const [teamLeads, setTeamLeads] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    usersAPI.getAll().then((res) => setUsers(res.data || []));
    fetchLeads();
  }, []);

  // Fetch activity when Activity tab is active or filters change
  useEffect(() => {
    if (activeTab === "activity") fetchActivity();
  }, [activeTab, activityPeriod, activityUser]);

  // Fetch team data when Team tab is active or period changes
  useEffect(() => {
    if (activeTab === "team") fetchTeamLeads();
  }, [activeTab, teamPeriod]);

  // ── Leads tab ──
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
      toast({ title: "Error loading leads", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    const reset = { search: "", status: "all", source: "all", assignedTo: "all", startDate: "", endDate: "" };
    setFilters(reset);
    fetchLeads(reset);
  };

  // ── Activity tab ──
  const fetchActivity = async () => {
    if (activityPeriod === "custom" && (!activityCustomFrom || !activityCustomTo)) return;
    try {
      setActivityLoading(true);
      const params: Record<string, string> = {};
      if (activityPeriod === "custom") {
        params.fromDate = activityCustomFrom;
        params.toDate = activityCustomTo;
      } else {
        params.period = activityPeriod;
      }
      if (activityUser !== "all") params.userId = activityUser;
      const res = await reportsAPI.getStatusHistory(params);
      setActivityData(res.data || []);
    } catch (err: any) {
      toast({ title: "Error loading activity", description: err.message, variant: "destructive" });
    } finally {
      setActivityLoading(false);
    }
  };

  // ── Team tab ──
  const fetchTeamLeads = async () => {
    try {
      setTeamLoading(true);
      const now = new Date();
      const params: Record<string, string> = { limit: "99999" };
      if (teamPeriod === "today") {
        const d = now.toISOString().slice(0, 10);
        params.startDate = d;
        params.endDate = d;
      } else if (teamPeriod === "week") {
        const from = new Date(now);
        from.setDate(now.getDate() - 6);
        params.startDate = from.toISOString().slice(0, 10);
        params.endDate = now.toISOString().slice(0, 10);
      } else if (teamPeriod === "month") {
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        params.endDate = now.toISOString().slice(0, 10);
      } else if (teamPeriod === "year") {
        params.startDate = `${now.getFullYear()}-01-01`;
        params.endDate = now.toISOString().slice(0, 10);
      }
      const res = await leadsAPI.getAll(params);
      setTeamLeads(res.data || []);
    } catch (err: any) {
      toast({ title: "Error loading team data", description: err.message, variant: "destructive" });
    } finally {
      setTeamLoading(false);
    }
  };

  // ── Team stats computation ──
  const teamStats = (() => {
    const map: Record<string, { name: string; total: number; won: number; drop: number; pending: number; discussion: number; quotation: number; visited: number }> = {};
    for (const lead of teamLeads) {
      const uid = lead.assignedTo?._id || "unassigned";
      const uname = lead.assignedTo?.name || "Unassigned";
      if (!map[uid]) map[uid] = { name: uname, total: 0, won: 0, drop: 0, pending: 0, discussion: 0, quotation: 0, visited: 0 };
      map[uid].total++;
      const s = lead.status || "";
      if (s === "WON") map[uid].won++;
      else if (s === "DROP") map[uid].drop++;
      else if (s === "PENDING CONTACT") map[uid].pending++;
      else if (s.startsWith("DISCUSSION")) map[uid].discussion++;
      else if (s.startsWith("QUOTATION")) map[uid].quotation++;
      else if (s === "VISITED" || s === "VISIT SCHEDULED") map[uid].visited++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // ── Exports ──
  const exportCSV = () => {
    const headers = ["Name", "Company", "Phone", "Email", "Source", "Status", "Assigned To", "Location", "Follow-up Date", "Created At"];
    const rows = leads.map((l) => [
      l.name || "", l.company || "", l.phone || "", l.email || "",
      l.source || "", l.status || "", l.assignedTo?.name || "Unassigned",
      l.location || "",
      l.followUpDate ? new Date(l.followUpDate).toLocaleDateString("en-IN") : "",
      l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportActivityCSV = () => {
    const headers = ["Lead Name", "Company", "Phone", "Changed To", "Changed By", "Assigned To", "Remarks", "Time"];
    const rows = activityData.map((r) => [
      r.leadName || "", r.leadCompany || "", r.leadPhone || "",
      r.changedToStatus || "", r.changedBy || "", r.assignedTo || "",
      r.remarks || "",
      r.timestamp ? new Date(r.timestamp).toLocaleString("en-IN") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `status-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!tableRef.current) return;
    try {
      setExporting(true);
      const canvas = await html2canvas(tableRef.current, { scale: 1.5, useCORS: true });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(`LEADS REPORT  —  ${new Date().toLocaleDateString("en-IN")}`, 20, 22);
      pdf.addImage(img, "PNG", 0, 32, w, h);
      pdf.save(`leads-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      toast({ title: "PDF export failed", description: err.message, variant: "destructive" });
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

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "leads", label: "Leads Report", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "activity", label: "Status Activity", icon: <Activity className="w-3.5 h-3.5" /> },
    { key: "team", label: "Team Report", icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <AppLayout title="Reports">
      <div className="space-y-5">
        {/* ── Tab bar ── */}
        <div className="flex border-2 border-black overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest border-r-2 border-black last:border-r-0 transition-colors",
                activeTab === t.key
                  ? "bg-primary text-white"
                  : "bg-white text-black hover:bg-gray-50",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════
            TAB 1 — LEADS REPORT
        ════════════════════════════════════════ */}
        {activeTab === "leads" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { key: "total", label: "Total Leads", text: "text-primary" },
                { key: "won", label: "Won", text: "text-green-600" },
                { key: "drop", label: "Dropped", text: "text-red-600" },
                { key: "pending", label: "Pending Contact", text: "text-black" },
              ].map(({ key, label, text }) => (
                <div
                  key={key}
                  className="border-2 border-black p-4 text-center bg-white transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                >
                  <p className={cn("text-4xl font-black tabular-nums", text)}>
                    {loading ? "—" : counts[key as keyof typeof counts]}
                  </p>
                  <p className={cn("text-xs font-bold uppercase tracking-widest mt-1", text)}>{label}</p>
                </div>
              ))}
            </div>

            {/* Filter panel */}
            <div className="border-2 border-black bg-white">
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
                    <div className="xl:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Search</label>
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
                          <button onClick={() => setFilter("search", "")} className="shrink-0">
                            <X className="w-3 h-3 text-black" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Status</label>
                      <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
                        <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none">
                          <SelectItem value="all" className="font-bold">All Statuses</SelectItem>
                          {STATUSES.map((s) => <SelectItem key={s} value={s} className="font-medium">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Source</label>
                      <Select value={filters.source} onValueChange={(v) => setFilter("source", v)}>
                        <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                          <SelectValue placeholder="All Sources" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none">
                          <SelectItem value="all" className="font-bold">All Sources</SelectItem>
                          {SOURCES.map((s) => <SelectItem key={s} value={s} className="font-medium">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Assigned To</label>
                      <Select value={filters.assignedTo} onValueChange={(v) => setFilter("assignedTo", v)}>
                        <SelectTrigger className="h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                          <SelectValue placeholder="All Members" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none">
                          <SelectItem value="all" className="font-bold">All Members</SelectItem>
                          {users.map((u) => <SelectItem key={u._id} value={u._id} className="font-medium">{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">From — To</label>
                      <div className="flex gap-1">
                        <input type="date" value={filters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black min-w-0" />
                        <input type="date" value={filters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black min-w-0" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1 border-t-2 border-black mt-3">
                    <button
                      onClick={() => fetchLeads()}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50"
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Apply Filters
                    </button>
                    {activeFilterCount > 0 && (
                      <button onClick={handleReset} className="flex items-center gap-1 px-4 py-2 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                        <X className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-white">
                <p className="text-xs font-black uppercase tracking-widest text-black">
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
                  ) : (
                    `${leads.length} lead${leads.length !== 1 ? "s" : ""} found`
                  )}
                </p>
                <div className="flex gap-2">
                  <button onClick={exportCSV} disabled={loading || leads.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400 text-black font-black uppercase text-[10px] tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button onClick={exportPDF} disabled={loading || leads.length === 0 || exporting} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400 text-black font-black uppercase text-[10px] tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
                  </button>
                </div>
              </div>

              <div ref={tableRef} className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary text-white">
                      {["#", "Name / Email", "Company", "Phone", "Source", "Status", "Assigned To", "Follow-up", "Created"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-black" /><p className="text-sm font-bold text-black mt-2 uppercase tracking-widest">Loading leads...</p></td></tr>
                    ) : leads.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16"><p className="text-sm font-black uppercase tracking-widest text-black">No leads found.</p><p className="text-xs text-gray-500 mt-1">Try adjusting your filters.</p></td></tr>
                    ) : (
                      leads.map((lead, i) => (
                        <tr key={lead._id || i} className={cn("border-b-2 border-black last:border-b-0 transition-colors", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                          <td className="px-4 py-3 text-xs font-black text-gray-400 whitespace-nowrap">{i + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-black text-black text-sm">{lead.name || "—"}</p>
                            {lead.email && <p className="text-[10px] text-gray-500 font-medium">{lead.email}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{lead.company || "—"}</td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{lead.phone || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2 border-black bg-gray-100">{lead.source || "—"}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2", statusBadge(lead.status))}>{lead.status || "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{lead.assignedTo?.name || <span className="text-gray-400 italic font-medium text-xs">Unassigned</span>}</td>
                          <td className="px-4 py-3 text-xs font-bold text-black whitespace-nowrap">
                            {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-black whitespace-nowrap">
                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : <span className="text-gray-400">—</span>}
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
                  <span>Won: {counts.won} · Drop: {counts.drop} · Pending: {counts.pending}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            TAB 2 — STATUS ACTIVITY
        ════════════════════════════════════════ */}
        {activeTab === "activity" && (
          <>
            {/* Period + Person filters */}
            <div className="border-2 border-black bg-white">
              <div className="px-4 py-3 border-b-2 border-black bg-primary text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Status Activity Filters
              </div>
              <div className="p-4 space-y-4">
                {/* Period buttons */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black">Period</label>
                  <div className="flex flex-wrap gap-2">
                    {PERIODS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setActivityPeriod(p.key)}
                        className={cn(
                          "px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-black transition-all",
                          activityPeriod === p.key
                            ? "bg-primary text-white shadow-none translate-x-[2px] translate-y-[2px]"
                            : "bg-white text-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {activityPeriod === "custom" && (
                  <div className="flex gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">From</label>
                      <input type="date" value={activityCustomFrom} onChange={(e) => setActivityCustomFrom(e.target.value)} className="border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">To</label>
                      <input type="date" value={activityCustomTo} onChange={(e) => setActivityCustomTo(e.target.value)} className="border-2 border-black px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black bg-white text-black" />
                    </div>
                    <button onClick={fetchActivity} disabled={!activityCustomFrom || !activityCustomTo} className="px-4 py-2 bg-primary text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40">
                      Apply
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black">Team Member</label>
                    <Select value={activityUser} onValueChange={(v) => setActivityUser(v)}>
                      <SelectTrigger className="w-48 h-9 border-2 border-black rounded-none text-sm font-bold shadow-none focus:ring-2 focus:ring-black">
                        <SelectValue placeholder="All Members" />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black rounded-none">
                        <SelectItem value="all" className="font-bold">All Members</SelectItem>
                        {users.map((u) => <SelectItem key={u._id} value={u._id} className="font-medium">{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <button onClick={fetchActivity} disabled={activityLoading} className="flex items-center gap-2 px-5 py-2 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 h-9">
                    {activityLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Activity table */}
            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-white">
                <p className="text-xs font-black uppercase tracking-widest text-black">
                  {activityLoading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
                  ) : (
                    `${activityData.length} status change${activityData.length !== 1 ? "s" : ""}`
                  )}
                </p>
                <button onClick={exportActivityCSV} disabled={activityLoading || activityData.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400 text-black font-black uppercase text-[10px] tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary text-white">
                      {["#", "Lead Name", "Company", "Phone", "Status Changed To", "Changed By", "Assigned To", "Remarks", "Date & Time"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activityLoading ? (
                      <tr><td colSpan={9} className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-black" /></td></tr>
                    ) : activityData.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16">
                        <p className="text-sm font-black uppercase tracking-widest text-black">No activity found.</p>
                        <p className="text-xs text-gray-500 mt-1">Try a different period or team member.</p>
                      </td></tr>
                    ) : (
                      activityData.map((row, i) => (
                        <tr key={i} className={cn("border-b-2 border-black last:border-b-0", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                          <td className="px-4 py-3 text-xs font-black text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-black text-black text-sm">{row.leadName || "—"}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{row.leadCompany || "—"}</td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{row.leadPhone || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2", statusBadge(row.changedToStatus))}>
                              {row.changedToStatus || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{row.changedBy || <span className="text-gray-400 italic text-xs">System</span>}</td>
                          <td className="px-4 py-3 text-sm font-bold text-black whitespace-nowrap">{row.assignedTo || <span className="text-gray-400 italic text-xs">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                            <span className="line-clamp-2">{row.remarks || <span className="text-gray-400 italic">—</span>}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-black whitespace-nowrap">
                            {row.timestamp ? (
                              <>
                                <p>{new Date(row.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                <p className="text-gray-500 font-medium">{new Date(row.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                              </>
                            ) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            TAB 3 — TEAM REPORT
        ════════════════════════════════════════ */}
        {activeTab === "team" && (
          <>
            {/* Period selector */}
            <div className="border-2 border-black bg-white">
              <div className="px-4 py-3 border-b-2 border-black bg-primary text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" /> Team Performance Period
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {PERIODS.filter((p) => p.key !== "custom").map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setTeamPeriod(p.key)}
                      className={cn(
                        "px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-black transition-all",
                        teamPeriod === p.key
                          ? "bg-primary text-white shadow-none translate-x-[2px] translate-y-[2px]"
                          : "bg-white text-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Team stats table */}
            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="px-4 py-3 border-b-2 border-black bg-white flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-black">
                  {teamLoading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
                  ) : (
                    `${teamStats.length} team member${teamStats.length !== 1 ? "s" : ""} · ${teamLeads.length} leads`
                  )}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary text-white">
                      {["#", "Team Member", "Total Leads", "Won", "Drop", "Pending", "Discussion", "Quotation", "Visit"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamLoading ? (
                      <tr><td colSpan={9} className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-black" /></td></tr>
                    ) : teamStats.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16">
                        <p className="text-sm font-black uppercase tracking-widest text-black">No data found.</p>
                      </td></tr>
                    ) : (
                      teamStats.map((member, i) => (
                        <tr key={i} className={cn("border-b-2 border-black last:border-b-0", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                          <td className="px-4 py-3 text-xs font-black text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-black text-black text-sm">{member.name}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-lg font-black text-primary tabular-nums">{member.total}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-green-600 tabular-nums">{member.won}</span>
                            {member.total > 0 && <span className="text-[10px] text-gray-400 ml-1">({Math.round((member.won / member.total) * 100)}%)</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-red-500 tabular-nums">{member.drop}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-yellow-600 tabular-nums">{member.pending}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-purple-600 tabular-nums">{member.discussion}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-orange-500 tabular-nums">{member.quotation}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-black text-blue-600 tabular-nums">{member.visited}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {teamStats.length > 0 && (
                <div className="border-t-2 border-black px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest flex justify-between">
                  <span>Team: {teamStats.length} members</span>
                  <span>
                    Total: {teamLeads.length} · Won: {teamStats.reduce((s, m) => s + m.won, 0)} · Drop: {teamStats.reduce((s, m) => s + m.drop, 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Per-person mini cards */}
            {!teamLoading && teamStats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamStats.map((member, i) => (
                  <div key={i} className="border-2 border-black bg-white p-4 space-y-3 hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all shadow-[3px_3px_0px_#000]">
                    <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <p className="font-black text-black uppercase tracking-wide">{member.name}</p>
                      <span className="text-2xl font-black text-primary tabular-nums">{member.total}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Won", value: member.won, color: "text-green-600" },
                        { label: "Drop", value: member.drop, color: "text-red-500" },
                        { label: "Pending", value: member.pending, color: "text-yellow-600" },
                        { label: "Discussion", value: member.discussion, color: "text-purple-600" },
                        { label: "Quotation", value: member.quotation, color: "text-orange-500" },
                        { label: "Visit", value: member.visited, color: "text-blue-600" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="border border-black p-1.5">
                          <p className={cn("text-lg font-black tabular-nums", color)}>{value}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    {member.total > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-black uppercase">
                          <span className="text-green-600">WON {Math.round((member.won / member.total) * 100)}%</span>
                          <span className="text-red-500">DROP {Math.round((member.drop / member.total) * 100)}%</span>
                        </div>
                        <div className="h-2 border border-black bg-gray-100 overflow-hidden flex">
                          <div className="bg-green-400 h-full transition-all" style={{ width: `${(member.won / member.total) * 100}%` }} />
                          <div className="bg-red-400 h-full transition-all" style={{ width: `${(member.drop / member.total) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
