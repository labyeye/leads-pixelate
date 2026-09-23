import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { activityAPI } from "@/services/api";
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { Navigate } from "react-router-dom";

interface ActivityLog {
  _id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  ip?: string;
  timestamp: string;
}

const ACTION_COLOR: Record<string, string> = {
  LOGIN: "text-emerald-600",
  LOGOUT: "text-slate-500",
  LOGIN_FAILED: "text-red-600",
  CREATE: "text-emerald-600",
  UPDATE: "text-amber-600",
  STATUS_UPDATED: "text-amber-600",
  DELETE: "text-red-600",
  RESTORE: "text-emerald-600",
  PERMANENT_DELETE: "text-red-700",
  PASSWORD_CHANGED: "text-blue-600",
  PASSWORD_RESET: "text-blue-600",
  PASSWORD_RESET_REQUESTED: "text-blue-600",
  PROFILE_UPDATED: "text-blue-600",
  NOTE_ADDED: "text-slate-500",
  LEAD_CONVERTED: "text-emerald-600",
  REGISTER: "text-emerald-600",
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const res = await activityAPI.getLogs(params);
      if (res.success) setLogs(res.data as ActivityLog[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, moduleFilter, actionFilter, isAdmin]);

  const modules = useMemo(
    () => Array.from(new Set(logs.map((l) => l.module))).filter(Boolean),
    [logs],
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).filter(Boolean),
    [logs],
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <TerminalIcon className="w-4 h-4 text-slate-400 ml-2" />
            <span className="font-mono text-sm text-slate-500">
              activity-log — admin@nestleads
            </span>
            <button
              onClick={load}
              className="ml-auto flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              refresh
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-slate-200 bg-white">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="grep by name, email, description…"
                className="w-full pl-8 pr-3 py-1.5 text-sm font-mono border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-2 py-1.5 text-sm font-mono border border-slate-200 rounded-md bg-slate-50 focus:outline-none"
            >
              <option value="">--module=all</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  --module={m}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2 py-1.5 text-sm font-mono border border-slate-200 rounded-md bg-slate-50 focus:outline-none"
            >
              <option value="">--action=all</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  --action={a}
                </option>
              ))}
            </select>
          </div>

          {/* Log feed */}
          <div className="font-mono text-[13px] leading-relaxed max-h-[70vh] overflow-y-auto px-4 py-3 bg-white">
            {loading && logs.length === 0 && (
              <p className="text-slate-400">loading logs…</p>
            )}
            {!loading && logs.length === 0 && (
              <p className="text-slate-400">no matching activity.</p>
            )}
            {logs.map((log) => (
              <div key={log._id} className="flex gap-2 py-0.5 hover:bg-slate-50">
                <span className="text-slate-400 shrink-0">
                  [{formatTimestamp(log.timestamp)}]
                </span>
                <span
                  className={`shrink-0 font-semibold ${ACTION_COLOR[log.action] || "text-slate-600"}`}
                >
                  {log.action}
                </span>
                <span className="text-slate-400 shrink-0">
                  ({log.module})
                </span>
                <span className="text-slate-700 truncate">
                  {log.description || `${log.userName} — ${log.userEmail}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
