import { AppLayout } from "@/components/layout/AppLayout";
import { activityAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
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
  Activity,
  Search,
  RefreshCw,
  Loader2,
  LogIn,
  ShieldAlert,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Key,
  User,
  FileText,
  Printer,
  Package,
  Briefcase,
  Wrench,
  ArrowRight,
  Wifi,
  WifiOff,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";

interface ActivityLog {
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

const ACTION_META: Record<
  string,
  {
    label: string;
    badge: string;
    dot: string;
    icon: React.ElementType;
  }
> = {
  LOGIN: {
    label: "LOGIN",
    badge: "bg-success/10 text-success border border-success/20",
    dot: "bg-success",
    icon: LogIn,
  },
  LOGIN_FAILED: {
    label: "FAILED",
    badge: "bg-destructive/10 text-destructive border border-destructive/20",
    dot: "bg-destructive",
    icon: ShieldAlert,
  },
  LOGOUT: {
    label: "LOGOUT",
    badge: "bg-muted text-muted-foreground border border-border",
    dot: "bg-muted-foreground",
    icon: LogOut,
  },
  REGISTER: {
    label: "REGISTER",
    badge: "bg-sky-100 text-sky-700 border border-sky-200",
    dot: "bg-sky-500",
    icon: User,
  },
  CREATE: {
    label: "CREATE",
    badge: "bg-primary/10 text-primary border border-primary/20",
    dot: "bg-primary",
    icon: Plus,
  },
  UPDATE: {
    label: "UPDATE",
    badge: "bg-warning/10 text-warning border border-warning/20",
    dot: "bg-warning",
    icon: Pencil,
  },
  DELETE: {
    label: "DELETE",
    badge: "bg-destructive/10 text-destructive border border-destructive/20",
    dot: "bg-destructive",
    icon: Trash2,
  },
  NOTE_ADDED: {
    label: "NOTE",
    badge: "bg-violet-100 text-violet-700 border border-violet-200",
    dot: "bg-violet-500",
    icon: FileText,
  },
  LEAD_CONVERTED: {
    label: "CONVERTED",
    badge: "bg-pink-100 text-pink-700 border border-pink-200",
    dot: "bg-pink-500",
    icon: ArrowRight,
  },
  PASSWORD_CHANGED: {
    label: "PASSWORD",
    badge: "bg-orange-100 text-orange-700 border border-orange-200",
    dot: "bg-orange-500",
    icon: Key,
  },
  PROFILE_UPDATED: {
    label: "PROFILE",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
    icon: User,
  },
  INDIAMART_SYNC: {
    label: "SYNC",
    badge: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    dot: "bg-cyan-500",
    icon: RefreshCw,
  },
  PRINT_LOGGED: {
    label: "PRINT",
    badge: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200",
    dot: "bg-fuchsia-500",
    icon: Printer,
  },
};

const MODULE_META: Record<string, { icon: React.ElementType; color: string }> =
  {
    Auth: { icon: ShieldAlert, color: "text-muted-foreground" },
    User: { icon: User, color: "text-sky-600" },
    Lead: { icon: Activity, color: "text-warning" },
    Client: { icon: User, color: "text-teal-600" },
    Product: { icon: Briefcase, color: "text-violet-600" },
    FactoryProduct: { icon: Package, color: "text-pink-600" },
    Service: { icon: Wrench, color: "text-orange-600" },
    Quotation: { icon: FileText, color: "text-blue-600" },
    Inventory: { icon: Package, color: "text-success" },
    Printing: { icon: Printer, color: "text-fuchsia-600" },
  };

const ALL_MODULES = Object.keys(MODULE_META);
const ALL_ACTIONS = Object.keys(ACTION_META);
const POLL_INTERVAL = 10_000;
function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 card-shadow">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          accent,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">
          {value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────
function LogRow({ log, isNew }: { log: ActivityLog; isNew?: boolean }) {
  const actionMeta = ACTION_META[log.action] || {
    label: log.action,
    badge: "bg-muted text-muted-foreground border border-border",
    dot: "bg-muted-foreground",
    icon: Activity,
  };
  const modMeta = MODULE_META[log.module] || {
    icon: Activity,
    color: "text-muted-foreground",
  };
  const ModIcon = modMeta.icon;
  const ActionIcon = actionMeta.icon;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr] sm:grid-cols-[160px_90px_120px_1fr_100px] gap-x-4 gap-y-1 items-center",
        "px-5 py-3 border-b border-border last:border-0 transition-all group",
        "hover:bg-muted/40",
        isNew && "animate-fade-in",
        log.action === "LOGIN_FAILED" && "bg-destructive/[0.03]",
        log.action === "DELETE" && "bg-destructive/[0.02]",
      )}
    >
      {/* Timestamp */}
      <div className="hidden sm:flex items-center gap-2 min-w-0">
        <div
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", actionMeta.dot)}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </span>
      </div>

      {/* On mobile: dot + timeago */}
      <div className="flex sm:hidden items-center gap-2">
        <div
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", actionMeta.dot)}
        />
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(log.timestamp)}
        </span>
      </div>

      {/* Action badge */}
      <div className="hidden sm:block">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide",
            actionMeta.badge,
          )}
        >
          <ActionIcon className="w-2.5 h-2.5" />
          {actionMeta.label}
        </span>
      </div>

      {/* Module */}
      <div
        className={cn(
          "hidden sm:flex items-center gap-1.5 text-xs font-medium",
          modMeta.color,
        )}
      >
        <ModIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{log.module}</span>
      </div>

      {/* Description (full width on mobile) */}
      <div className="col-span-1 sm:col-span-1 min-w-0">
        {/* Mobile: show action + module inline */}
        <div className="flex items-center gap-1.5 mb-0.5 sm:hidden">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
              actionMeta.badge,
            )}
          >
            {actionMeta.label}
          </span>
          <span className={cn("text-[10px] font-medium", modMeta.color)}>
            {log.module}
          </span>
        </div>
        <p className="text-sm text-foreground leading-snug">
          {log.description}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
          {formatTimestamp(log.timestamp)}
        </p>
      </div>

      {/* User */}
      <div className="hidden sm:block text-right min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {log.userName}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {log.userRole}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function MonitorPage() {
  const { toast } = useToast();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Fetch Logs ────────────────────────────────────────────
  const fetchLogs = useCallback(
    async (resetPage = false, silent = false) => {
      try {
        if (!silent) setLoading(true);
        const p = resetPage ? 1 : page;
        if (resetPage) setPage(1);

        const params: Record<string, string> = {
          page: String(p),
          limit: "100",
        };
        if (filterModule !== "all") params.module = filterModule;
        if (filterAction !== "all") params.action = filterAction;
        if (search) params.search = search;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await activityAPI.getLogs(params);
        const incoming: ActivityLog[] = res.data || [];

        // Detect truly new entries (not seen before)
        if (knownIdsRef.current.size > 0) {
          const freshIds = new Set<string>();
          incoming.forEach((l) => {
            if (!knownIdsRef.current.has(l._id)) freshIds.add(l._id);
          });
          if (freshIds.size > 0) setNewIds(freshIds);
          setTimeout(() => setNewIds(new Set()), 3000);
        }

        // Update known ids
        incoming.forEach((l) => knownIdsRef.current.add(l._id));

        setLogs(incoming);
        setTotalPages(res.pages || 1);
        setTotal(res.total || 0);
        setLastRefresh(new Date());
      } catch (e: any) {
        if (e.status !== 403) {
          toast({
            title: "Monitor Error",
            description: e.message,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [page, filterModule, filterAction, search, startDate, endDate, toast],
  );

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await activityAPI.getStats();
      setStats(res.data);
    } catch {
      /* silent */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Initial + filter change
  useEffect(() => {
    fetchLogs(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterModule, filterAction, startDate, endDate]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => fetchLogs(true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Pagination refetch
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Live poll
  useEffect(() => {
    if (liveMode) {
      pollerRef.current = setInterval(() => {
        fetchLogs(false, true);
        fetchStats();
      }, POLL_INTERVAL);
    } else {
      if (pollerRef.current) clearInterval(pollerRef.current);
    }
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [liveMode, fetchLogs, fetchStats]);

  const clearFilters = () => {
    setSearch("");
    setFilterModule("all");
    setFilterAction("all");
    setStartDate("");
    setEndDate("");
  };
  const hasFilters =
    search ||
    filterModule !== "all" ||
    filterAction !== "all" ||
    startDate ||
    endDate;

  // ─── Render ───────────────────────────────────────────────
  return (
    <AppLayout title="Activity Monitor">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                liveMode ? "bg-success animate-pulse" : "bg-muted-foreground",
              )}
            />
            <h1 className="text-xl font-bold text-foreground">
              Activity Monitor
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Every system event — logins, creates, updates, deletes &amp; more ·{" "}
            {lastRefresh && `Last refresh: ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              liveMode
                ? "bg-success/10 border-success/30 text-success"
                : "bg-muted border-border text-muted-foreground",
            )}
          >
            {liveMode ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {liveMode ? "LIVE" : "PAUSED"}
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fetchLogs(false, false);
              fetchStats();
            }}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-fade-in">
        <StatCard
          icon={Activity}
          label="Total Events"
          value={statsLoading ? "—" : (stats?.totalLogs ?? 0)}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Clock}
          label="Last 24h"
          value={statsLoading ? "—" : (stats?.last24hCount ?? 0)}
          accent="bg-secondary/10 text-secondary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Logins (24h)"
          value={statsLoading ? "—" : (stats?.recentLogins ?? 0)}
          accent="bg-success/10 text-success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Failed (24h)"
          value={statsLoading ? "—" : (stats?.loginFails ?? 0)}
          accent="bg-destructive/10 text-destructive"
          sub="login attempts"
        />
      </div>

      {/* ── Filters ── */}
      <div
        className="bg-card border border-border rounded-xl px-5 py-3.5 mb-4 animate-fade-in flex flex-wrap items-center gap-3"
        style={{ animationDelay: "50ms" }}
      >
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

        {/* Search */}
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 w-52">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search description / user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Module */}
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Modules
            </SelectItem>
            {ALL_MODULES.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action */}
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Actions
            </SelectItem>
            {ALL_ACTIONS.map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {ACTION_META[a]?.label || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Dates */}
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 w-36 text-xs"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {total} event{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Log Table ── */}
      <div
        className="bg-card border border-border rounded-xl card-shadow overflow-hidden animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        {/* Column headers — desktop */}
        <div className="hidden sm:grid grid-cols-[160px_90px_120px_1fr_100px] gap-x-4 px-5 py-2.5 bg-muted/30 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          <span>Timestamp</span>
          <span>Action</span>
          <span>Module</span>
          <span>Description</span>
          <span className="text-right">User</span>
        </div>

        {/* Log rows */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 420px)", minHeight: "300px" }}
        >
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Loading activity logs...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <Activity className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "No logs match your filters."
                  : "No activity yet."}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {logs.map((log) => (
                <LogRow key={log._id} log={log} isNew={newIds.has(log._id)} />
              ))}
              {/* Refresh indicator */}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-2 bg-muted/40 border-t border-border">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Refreshing...
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Breakdown charts ── */}
      {stats && !statsLoading && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 animate-fade-in"
          style={{ animationDelay: "150ms" }}
        >
          {/* By Module */}
          <div className="bg-card border border-border rounded-xl card-shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Events by Module
              </h3>
            </div>
            <div className="space-y-3">
              {(stats.byModule || []).map((row: any) => {
                const meta = MODULE_META[row._id] || {
                  icon: Activity,
                  color: "text-muted-foreground",
                };
                const ModIcon = meta.icon;
                const pct =
                  stats.totalLogs > 0
                    ? Math.round((row.count / stats.totalLogs) * 100)
                    : 0;
                return (
                  <div key={row._id}>
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          meta.color,
                        )}
                      >
                        <ModIcon className="w-3.5 h-3.5" />
                        {row._id}
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {row.count}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Action */}
          <div className="bg-card border border-border rounded-xl card-shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-secondary" />
              <h3 className="text-sm font-semibold text-foreground">
                Events by Action
              </h3>
            </div>
            <div className="space-y-3">
              {(stats.byAction || []).map((row: any) => {
                const meta = ACTION_META[row._id] || {
                  label: row._id,
                  badge: "bg-muted text-muted-foreground border border-border",
                  dot: "bg-muted-foreground",
                  icon: Activity,
                };
                const ActionIcon = meta.icon;
                const pct =
                  stats.totalLogs > 0
                    ? Math.round((row.count / stats.totalLogs) * 100)
                    : 0;
                return (
                  <div key={row._id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase",
                            meta.badge,
                          )}
                        >
                          <ActionIcon className="w-2.5 h-2.5" />
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {row.count}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          meta.dot,
                        )}
                        style={{ width: `${pct}%`, opacity: 0.7 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
