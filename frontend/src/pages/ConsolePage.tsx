import { AppLayout } from "@/components/layout/AppLayout";
import { activityAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Terminal,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  User,
  ShieldAlert,
  FileText,
  Package,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Log {
  _id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  targetId?: string;
  ip?: string;
  timestamp: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  LOGIN:            { label: "Login",          color: "text-green-700",  bg: "bg-green-100",  border: "border-green-400",  Icon: LogIn },
  LOGIN_FAILED:     { label: "Login Failed",   color: "text-red-700",    bg: "bg-red-100",    border: "border-red-400",    Icon: ShieldAlert },
  LOGOUT:           { label: "Logout",         color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-400",   Icon: LogOut },
  REGISTER:         { label: "Register",       color: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-400",   Icon: User },
  CREATE:           { label: "Created",        color: "text-emerald-700",bg: "bg-emerald-100",border: "border-emerald-400",Icon: Plus },
  UPDATE:           { label: "Updated",        color: "text-amber-700",  bg: "bg-amber-100",  border: "border-amber-400",  Icon: Pencil },
  DELETE:           { label: "Deleted",        color: "text-red-700",    bg: "bg-red-100",    border: "border-red-400",    Icon: Trash2 },
  NOTE_ADDED:       { label: "Note Added",     color: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-400",   Icon: FileText },
  LEAD_CONVERTED:   { label: "Lead Converted", color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-400", Icon: TrendingUp },
  PASSWORD_CHANGED: { label: "Password",       color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-400", Icon: ShieldAlert },
  PROFILE_UPDATED:  { label: "Profile",        color: "text-cyan-700",   bg: "bg-cyan-100",   border: "border-cyan-400",   Icon: User },
  INDIAMART_SYNC:   { label: "Sync",           color: "text-indigo-700", bg: "bg-indigo-100", border: "border-indigo-400", Icon: RefreshCw },
  PRINT_LOGGED:     { label: "Print",          color: "text-gray-700",   bg: "bg-gray-100",   border: "border-gray-400",   Icon: FileText },
};

const MODULE_CONFIG: Record<string, { Icon: any; color: string }> = {
  Auth:           { Icon: ShieldAlert, color: "text-red-500" },
  User:           { Icon: User,        color: "text-blue-500" },
  Lead:           { Icon: Activity,    color: "text-green-500" },
  Client:         { Icon: Building2,   color: "text-purple-500" },
  Product:        { Icon: Package,     color: "text-orange-500" },
  FactoryProduct: { Icon: Package,     color: "text-amber-500" },
  Service:        { Icon: FileText,    color: "text-cyan-500" },
  Quotation:      { Icon: FileText,    color: "text-indigo-500" },
  Inventory:      { Icon: Package,     color: "text-teal-500" },
  Printing:       { Icon: FileText,    color: "text-gray-500" },
};

const ROLE_BADGE: Record<string, string> = {
  super_admin:     "bg-red-100 text-red-700 border-red-300",
  admin:           "bg-blue-100 text-blue-700 border-blue-300",
  sales_executive: "bg-green-100 text-green-700 border-green-300",
  service_manager: "bg-purple-100 text-purple-700 border-purple-300",
  accountant:      "bg-orange-100 text-orange-700 border-orange-300",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConsolePage() {
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Logs
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterModule, setFilterModule] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");

  const LIMIT = 50;

  const fetchStats = useCallback(async () => {
    try {
      const res = await activityAPI.getStats();
      setStats(res.data);
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(LIMIT),
      };
      if (filterAction !== "ALL") params.action = filterAction;
      if (filterModule !== "ALL") params.module = filterModule;
      if (filterDate) { params.startDate = filterDate; params.endDate = filterDate; }
      if (search) params.search = search;

      const res = await activityAPI.getLogs(params);
      setLogs(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      toast({ title: "Failed to load logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, search, filterAction, filterModule, filterDate, toast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput(""); setSearch("");
    setFilterAction("ALL"); setFilterModule("ALL");
    setFilterDate(""); setPage(1);
  };

  const hasFilters = search || filterAction !== "ALL" || filterModule !== "ALL" || filterDate;

  return (
    <AppLayout title="NestLeads Console">
      <div className="flex flex-col h-full overflow-hidden bg-[#fafafa]">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-6 py-4 bg-black border-b-2 border-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#024BAB] border-2 border-white flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white font-mono tracking-wide">
                NESTLEADS CONSOLE
              </h1>
              <p className="text-[10px] text-gray-400 font-mono">
                SUPER ADMIN · ACTIVITY LOG VIEWER · READ-ONLY
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {total > 0 && (
              <span className="text-xs font-mono text-gray-400">
                {total.toLocaleString()} total events
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => { fetchLogs(); fetchStats(); }}
              className="border-white text-white hover:bg-white/10 bg-transparent h-8 text-xs font-mono gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> REFRESH
            </Button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-b-2 border-black shrink-0">
            {[
              { label: "TOTAL EVENTS",    value: stats.totalLogs,    color: "bg-white",        text: "text-black" },
              { label: "LAST 24H",        value: stats.last24hCount, color: "bg-[#024BAB]",    text: "text-white" },
              { label: "LAST 7 DAYS",     value: stats.last7dCount,  color: "bg-white",        text: "text-black" },
              { label: "LOGINS TODAY",    value: stats.recentLogins, color: "bg-green-400",    text: "text-black" },
              { label: "FAILED LOGINS",   value: stats.loginFails,   color: stats.loginFails > 0 ? "bg-red-500" : "bg-white", text: stats.loginFails > 0 ? "text-white" : "text-black" },
            ].map((s, i) => (
              <div key={i} className={cn("flex flex-col justify-center px-5 py-3 border-r-2 border-black last:border-r-0", s.color)}>
                <p className={cn("text-2xl font-black font-mono", s.text)}>{s.value?.toLocaleString() ?? 0}</p>
                <p className={cn("text-[10px] font-bold font-mono tracking-widest opacity-70", s.text)}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b-2 border-black bg-white shrink-0">
          {/* Search */}
          <div className="flex gap-0 border-2 border-black">
            <input
              placeholder="Search user, description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="text-xs font-mono px-3 py-1.5 w-52 outline-none bg-white"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 bg-black text-white hover:bg-[#024BAB] transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action filter */}
          <div className="border-2 border-black">
            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs font-mono border-0 rounded-none w-36 focus:ring-0">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="font-mono text-xs">ALL ACTIONS</SelectItem>
                {Object.keys(ACTION_CONFIG).map((a) => (
                  <SelectItem key={a} value={a} className="font-mono text-xs">{ACTION_CONFIG[a].label.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Module filter */}
          <div className="border-2 border-black">
            <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs font-mono border-0 rounded-none w-32 focus:ring-0">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="font-mono text-xs">ALL MODULES</SelectItem>
                {Object.keys(MODULE_CONFIG).map((m) => (
                  <SelectItem key={m} value={m} className="font-mono text-xs">{m.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date filter */}
          <div className="border-2 border-black">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
              className="h-8 text-xs font-mono px-2 outline-none bg-white"
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-mono text-red-600 hover:text-red-800 border-2 border-red-400 px-2 py-1 hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> CLEAR
            </button>
          )}

          <span className="ml-auto text-xs font-mono text-muted-foreground">
            Page {page} of {pages} · {logs.length} shown
          </span>
        </div>

        {/* ── Log table ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-xs font-mono text-muted-foreground ml-2">LOADING LOGS...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Terminal className="w-12 h-12 text-gray-300" />
              <p className="text-sm font-mono text-muted-foreground">NO EVENTS FOUND</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-mono text-[#024BAB] underline">
                  CLEAR FILTERS
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-black text-white">
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest w-36">TIMESTAMP</th>
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest w-28">ACTION</th>
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest w-24">MODULE</th>
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest">USER</th>
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest">DESCRIPTION</th>
                  <th className="text-left px-4 py-2.5 font-bold tracking-widest w-28">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const ac = ACTION_CONFIG[log.action] || { label: log.action, color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300", Icon: Activity };
                  const mc = MODULE_CONFIG[log.module] || { Icon: Activity, color: "text-gray-500" };
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={log._id}
                      className={cn(
                        "border-b border-gray-200 hover:bg-yellow-50 transition-colors group",
                        isEven ? "bg-white" : "bg-gray-50/50",
                        log.action === "LOGIN_FAILED" && "bg-red-50/40",
                        log.action === "DELETE" && "bg-red-50/20",
                      )}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-[11px] font-bold text-gray-700">
                              {format(new Date(log.timestamp), "dd MMM yyyy")}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {format(new Date(log.timestamp), "HH:mm:ss")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Action badge */}
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 border-2 font-bold text-[10px] tracking-wide",
                          ac.color, ac.bg, ac.border
                        )}>
                          <ac.Icon className="w-2.5 h-2.5 shrink-0" />
                          {ac.label.toUpperCase()}
                        </span>
                      </td>

                      {/* Module */}
                      <td className="px-4 py-2.5">
                        {log.module ? (
                          <span className={cn("flex items-center gap-1 font-bold text-[11px]", mc.color)}>
                            <mc.Icon className="w-3 h-3 shrink-0" />
                            {log.module}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* User */}
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-bold text-[11px] text-black">{log.userName || "System"}</p>
                          <p className="text-[10px] text-gray-400">{log.userEmail}</p>
                          {log.userRole && (
                            <span className={cn(
                              "inline-block text-[9px] font-bold px-1.5 py-0 border mt-0.5",
                              ROLE_BADGE[log.userRole] || "bg-gray-100 text-gray-600 border-gray-300"
                            )}>
                              {log.userRole.replace(/_/g, " ").toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="text-[11px] text-gray-700 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                          {log.description || "—"}
                        </p>
                        {log.targetId && (
                          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">ID: {log.targetId}</p>
                        )}
                      </td>

                      {/* IP */}
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] text-gray-400 font-mono">{log.ip || "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t-2 border-black bg-white shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 text-xs font-mono font-bold border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> PREV
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                let p: number;
                if (pages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= pages - 3) p = pages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "w-8 h-8 text-xs font-mono font-bold border-2 transition-colors",
                      p === page
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black hover:bg-black hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="flex items-center gap-1.5 text-xs font-mono font-bold border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              NEXT <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
