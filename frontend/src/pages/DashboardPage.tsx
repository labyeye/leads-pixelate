import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { dashboardAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  LineChart,
  Line,
  LabelList,
  Legend,
} from "recharts";
import {
  Target,
  Plus,
  Loader2,
  Flame,
  Clock,
  AlertTriangle,
  Users,
  CheckCircle2,
  ChevronRight,
  Zap,
  TrendingUp,
  UserPlus,
  CalendarCheck,
  PhoneOff,
  XCircle,
  Trophy,
  Radio,
  Facebook,
  Instagram,
  Linkedin,
  Globe,
  PenLine,
  Store,
  Phone,
  FileText,
} from "lucide-react";
import nestleadslogosmall from "../../public/favicon.png";
import logoIndiamart from "../assets/images/logos/indiamart.png";
import logoFacebook from "../assets/images/logos/facebook.png";
import logoInstagram from "../assets/images/logos/instagram.webp";
import logoMeta from "../assets/images/logos/meta.png";
import logoLinkedin from "../assets/images/logos/linkedIn.webp";
import logoJustdial from "../assets/images/logos/justdial.webp";
import logoTradeindia from "../assets/images/logos/tradeindia.webp";

type Period = "today" | "week" | "month";

const SOURCE_COLORS: Record<string, string> = {
  IndiaMART: "#FB923C",
  Facebook: "#3B82F6",
  Instagram: "#C026D3",
  Meta: "#1D4ED8",
  LinkedIn: "#0A66C2",
  TradeIndia: "#00C48C",
  Justdial: "#EF4444",
  Website: "#A855F7",
  Manual: "#6B7280",
};

const AGENT_COLORS = ["#024BAB", "#00C48C", "#FA731C", "#C026D3", "#EF4444"];

const SOURCE_LOGOS: Record<string, string> = {
  IndiaMART: logoIndiamart,
  TradeIndia: logoTradeindia,
  Facebook: logoFacebook,
  Meta: logoMeta,
  Instagram: logoInstagram,
  LinkedIn: logoLinkedin,
  Justdial: logoJustdial,
};

const SOURCE_ICONS: Record<string, any> = {
  IndiaMART: Store,
  TradeIndia: Store,
  Facebook,
  Meta: Facebook,
  Instagram,
  LinkedIn: Linkedin,
  Justdial: Phone,
  Website: Globe,
  Manual: PenLine,
};

function SalesFunnel({
  stages,
}: {
  stages: Array<{ label: string; count: number; color: string }>;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const width = Math.max((stage.count / max) * 100, 4);
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-28 text-right text-xs font-medium text-black shrink-0">
              {stage.label}
            </div>
            <div className="flex-1 h-8 border-2 border-black bg-white relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 border-r-2 border-black flex items-center pl-2 transition-all duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: stage.color + "44",
                }}
              />
              <span className="absolute inset-y-0 left-3 flex items-center text-xs font-medium text-black z-10">
                {stage.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TodayFollowUpsList({ leads }: { leads: any[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-36 text-center">
        <CheckCircle2 className="w-8 h-8 mb-2 text-[#00C48C]" />
        <p className="text-sm font-medium text-black">All clear for today!</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          No follow-ups scheduled
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {leads.slice(0, 6).map((lead) => (
        <Link key={lead._id} to="/leads">
          <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black hover: transition-all">
            <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-medium text-black shrink-0">
              {(lead.name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate">
                {lead.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {lead.company || lead.phone}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function Leaderboard({ performers }: { performers: any[] }) {
  if (performers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-36 text-center text-muted-foreground">
        <Users className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm font-medium">No performance data yet</p>
      </div>
    );
  }
  const medalColors = ["bg-[#FFD700]", "bg-[#C0C0C0]", "bg-[#CD7F32]"];
  return (
    <div className="space-y-2">
      {performers.map((p, i) => {
        const convRate =
          p.leadsCount > 0
            ? Math.round((p.conversions / p.leadsCount) * 100)
            : 0;
        return (
          <div
            key={p._id}
            className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black transition-all"
          >
            <span
              className={cn(
                "w-7 h-7 shrink-0 rounded-full border-2 border-black flex items-center justify-center text-xs font-medium text-black",
                medalColors[i] || "bg-white",
              )}
            >
              {i + 1}
            </span>
            <div className="w-9 h-9 border-2 rounded-full border-black shrink-0 overflow-hidden bg-[#044bab]">
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-medium text-white">
                  {(p.name || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-white border border-black overflow-hidden">
                  <div
                    className="h-full bg-[#044bab]"
                    style={{ width: `${convRate}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-black shrink-0">
                  {convRate}%
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-black">{p.conversions}</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {p.leadsCount} leads
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function RecentLeadsList({ leads }: { leads: any[] }) {
  if (leads.length === 0)
    return (
      <div className="flex items-center justify-center h-36 text-sm text-muted-foreground">
        No leads yet
      </div>
    );
  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <Link key={lead._id} to="/leads">
          <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black transition-all">
            <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-medium text-white shrink-0">
              {(lead.name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate">{lead.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {lead.company || lead.phone}
                {lead.source ? ` · ${lead.source}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-medium text-black border border-black px-1.5 py-0.5 truncate max-w-[110px]">
                {lead.status}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {lead.createdAt ? timeAgo(lead.createdAt) : ""}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

const QUOTE_TONE: Record<string, string> = {
  Sent: "bg-blue-100 text-blue-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Draft: "bg-slate-100 text-slate-700",
};

// Newest quotations; shows only as many rows as fit beside Recent Leads, so no empty space is left.
function RecentQuotations({ quotations, rows, className }: { quotations: any[]; rows: number; className?: string }) {
  const list = quotations.slice(0, rows);
  return (
    <div className={cn("border-2 bg-white p-5 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-medium text-base text-black">Recent Quotations</h3>
          <p className="text-xs text-muted-foreground">Latest {list.length} created</p>
        </div>
        <Link to="/quotations">
          <button className="text-xs font-medium text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors">View all →</button>
        </Link>
      </div>
      {list.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-6">No quotations yet</div>
      ) : (
        <div className="flex-1 flex flex-col justify-between gap-2">
          {list.map((q) => (
            <Link key={q._id} to="/quotations">
              <div className="flex items-center gap-3 p-2 border-2 border-transparent hover:border-black transition-all">
                <div className="w-9 h-9 bg-[#FA731C] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
                  <FileText className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black truncate">{q.companyName || q.clientName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {q.number} · {q.projectTitle}
                    {q.createdBy?.name ? ` · ${q.createdBy.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-black">₹{Number(q.total || 0).toLocaleString("en-IN")}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 border border-black", QUOTE_TONE[q.status] || "bg-white")}>{q.status}</span>
                    <span className="text-[10px] text-muted-foreground">{q.createdAt ? timeAgo(q.createdAt) : ""}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const LIVE_WINDOWS = [
  { min: 60, label: "1h" },
  { min: 240, label: "4h" },
  { min: 480, label: "8h" },
  { min: 1440, label: "24h" },
];
const liveTalk = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Admin-only compact summary of the Live Performance page: ranked agents, done counts, call share bar.
function LiveSummary() {
  const [windowMin, setWindowMin] = useState(480);
  const [live, setLive] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      dashboardAPI
        .getLive(windowMin)
        .then((r) => alive && r.success && setLive(r.data))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [windowMin]);

  const team: any[] = live ? [...live.team].sort((a, b) => b.done - a.done || b.calls - a.calls) : [];
  const maxDone = Math.max(1, ...team.map((r) => r.done));
  const tot = live?.totals;
  const connectRate = tot && tot.calls ? Math.round((tot.connected / tot.calls) * 100) : 0;
  const heads = ["Agent", "Calls", "Connected", "Talk time", "Conversations", "Quotations", "Visits", "Last call"];

  return (
    <div className="border-2 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display font-medium text-base text-black">Live Performance</h3>
          <p className="text-xs text-muted-foreground">
            {tot ? `${tot.calls} calls · ${connectRate}% picked up · ${tot.conversations} conversations · ${tot.quotations} quotations` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border-2 border-black">
            {LIVE_WINDOWS.map((w) => (
              <button
                key={w.min}
                onClick={() => setWindowMin(w.min)}
                className={cn("px-2.5 py-1 text-xs font-medium", windowMin === w.min ? "bg-[#024BAB] text-white" : "bg-white hover:bg-slate-100")}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Link to="/live-performance">
            <button className="text-xs font-medium text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors">Full view →</button>
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-muted-foreground">
              {heads.map((h, i) => (
                <th key={h} className={cn("py-2 px-2 font-medium", i === 0 ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((r, i) => (
              <tr key={r._id} className="border-b border-slate-200">
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2.5 min-w-[190px]">
                    <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <div className="w-8 h-8 border-2 border-black overflow-hidden shrink-0 bg-[#024BAB] text-white flex items-center justify-center text-xs font-bold">
                      {r.avatar ? <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" /> : r.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-black truncate">{r.name}</p>
                      <div className="h-1 bg-slate-100 border border-black/30 mt-1">
                        <div className="h-full bg-[#024BAB]" style={{ width: `${(r.done / maxDone) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-bold tabular-nums">{r.calls}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.connected}</td>
                <td className="py-2 px-2 text-right tabular-nums">{liveTalk(r.talkSeconds || 0)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.conversations}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.quotations}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.visits}</td>
                <td className="py-2 px-2 text-right text-xs text-muted-foreground whitespace-nowrap">{r.lastCallAt ? timeAgo(r.lastCallAt) : "—"}</td>
              </tr>
            ))}
            {live && team.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No agents yet</td></tr>
            )}
          </tbody>
          {tot && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold border-t-2 border-black">
                <td className="py-2 px-2">Team total</td>
                <td className="py-2 px-2 text-right tabular-nums">{tot.calls}</td>
                <td className="py-2 px-2 text-right tabular-nums">{tot.connected}</td>
                <td className="py-2 px-2 text-right tabular-nums">{liveTalk(tot.talkSeconds || 0)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{tot.conversations}</td>
                <td className="py-2 px-2 text-right tabular-nums">{tot.quotations}</td>
                <td className="py-2 px-2 text-right tabular-nums">{tot.visits}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black  px-3 py-2 text-xs">
      <p className="font-medium text-black mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color }}
          />
          <span className="font-medium text-black capitalize">
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");

  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex h-[80vh] items-center justify-center">
          <img
            src={nestleadslogosmall}
            alt="NestLeads"
            className="hidden items-center justify-center w-10 h-10 shrink-0 animate-bounce"
          />
        </div>
      </AppLayout>
    );
  }

  const {
    stats,
    leadsChartData,
    funnelStages,
    sourceData,
    recentLeads,
    todayFollowUps,
    userPerformance,
    recentQuotations,
    performerTrend,
  } = data;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
        ? "Good afternoon"
        : "Good evening";

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const sc = data.statusCounts || {};
  const visits = (sc["VISIT SCHEDULED"] || 0) + (sc["VISITED"] || 0);
  const dropped = sc["DROP"] || 0;
  const topSource = Object.entries(data.sourceCounts || {}).sort(
    (a: any, b: any) => b[1] - a[1],
  )[0] as [string, number] | undefined;
  const topAgent = (userPerformance || [])[0];
  const pct = (n: number) =>
    stats.totalLeads > 0 ? Math.round((n / stats.totalLeads) * 100) : 0;

  const newLeadsValue =
    period === "today"
      ? stats.newLeadsToday
      : period === "week"
        ? stats.newLeadsThisWeek
        : stats.leadsThisMonth;

  return (
    <AppLayout title="Dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-medium text-2xl text-black">
            {greeting}, {user?.name?.split(" ")[0]}
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Here's what's happening with your leads right now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border-2 border-black  overflow-hidden">
            {(["today", "week", "month"] as Period[]).map((p, i) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "text-xs px-3 py-2 font-medium transition-colors capitalize",
                  i > 0 && "border-l-2 border-black",
                  period === p
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#024BAB]/10",
                )}
              >
                {p === "today" ? "Today" : p === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          <Link to="/leads">
            <button className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </Link>
        </div>
      </div>

      {(stats.overdueFollowUps > 0 ||
        stats.uncontactedLeads > 0 ||
        stats.hotLeads > 0) && (
        <div className="flex flex-wrap gap-2 mb-6 p-3 border-2 border-[#EF4444] bg-[#FFF0F0] ">
          <span className="text-xs font-medium text-[#EF4444] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Action needed
          </span>
          {stats.hotLeads > 0 && (
            <Link to="/leads">
              <span className="nb-badge nb-tag-orange flex items-center gap-1 text-[11px]">
                <Flame className="w-3 h-3" /> {stats.hotLeads} hot leads
              </span>
            </Link>
          )}
          {stats.overdueFollowUps > 0 && (
            <Link to="/leads">
              <span className="nb-badge nb-tag-red flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3" /> {stats.overdueFollowUps} overdue
              </span>
            </Link>
          )}
          {stats.uncontactedLeads > 0 && (
            <Link to="/leads">
              <span className="nb-badge nb-tag-blue flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3 h-3" /> {stats.uncontactedLeads}{" "}
                uncontacted
              </span>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          title="Total Leads"
          value={stats.totalLeads}
          sub={`${newLeadsValue} new this ${period}`}
          icon={Target}
          bg="bg-[#024BAB]"
          trend={
            stats.leadGrowth > 0
              ? "up"
              : stats.leadGrowth < 0
                ? "down"
                : undefined
          }
          trendLabel={`${Math.abs(stats.leadGrowth)}%`}
          to="/leads"
        />
        <KpiCard
          title="Hot Leads"
          value={stats.hotLeads}
          sub="Need immediate action"
          icon={Flame}
          bg="bg-[#FB923C]"
          urgent={stats.hotLeads > 0}
          to="/leads"
        />
        <KpiCard
          title="Today's Follow-ups"
          value={todayFollowUps?.length ?? 0}
          sub="Scheduled for today"
          icon={Clock}
          bg="bg-[#A3E635]"
          to="/leads"
        />
        <KpiCard
          title="Won This Month"
          value={stats.convertedClients ?? 0}
          sub={`${stats.totalLeads > 0 ? Math.round(((stats.convertedClients ?? 0) / stats.totalLeads) * 100) : 0}% conversion rate`}
          icon={TrendingUp}
          bg="bg-[#00C48C]"
          trend={stats.convertedClients ? "up" : undefined}
          trendLabel={`${stats.totalLeads > 0 ? Math.round(((stats.convertedClients ?? 0) / stats.totalLeads) * 100) : 0}%`}
          to="/leads"
        />
        <KpiCard
          title={`New Leads (${period === "today" ? "Today" : period === "week" ? "Week" : "Month"})`}
          value={newLeadsValue ?? 0}
          sub="Added in selected period"
          icon={UserPlus}
          bg="bg-[#3B82F6]"
          to="/leads"
        />
        <KpiCard
          title="Overdue Follow-ups"
          value={stats.overdueFollowUps ?? 0}
          sub="Missed, call them now"
          icon={AlertTriangle}
          bg="bg-[#EF4444]"
          urgent={stats.overdueFollowUps > 0}
          to="/leads"
        />
        <KpiCard
          title="Uncontacted"
          value={stats.uncontactedLeads ?? 0}
          sub="Not called yet"
          icon={PhoneOff}
          bg="bg-[#A855F7]"
          urgent={stats.uncontactedLeads > 0}
          to="/leads"
        />
        <KpiCard
          title="Site Visits"
          value={visits}
          sub={`${sc["VISIT SCHEDULED"] || 0} scheduled, ${sc["VISITED"] || 0} done`}
          icon={CalendarCheck}
          bg="bg-[#14B8A6]"
          to="/leads"
        />
        <KpiCard
          title="Dropped Leads"
          value={dropped}
          sub={`${pct(dropped)}% of all leads`}
          icon={XCircle}
          bg="bg-[#6B7280]"
          to="/leads"
        />
        <KpiCard
          title="Top Source"
          value={topSource ? topSource[0] : "-"}
          sub={topSource ? `${topSource[1]} leads (${pct(topSource[1])}%)` : "No data yet"}
          icon={Radio}
          bg="bg-[#FB923C]"
          to="/leads"
        />
        <KpiCard
          title="Top Performer"
          value={topAgent?.name?.split(" ")[0] ?? "-"}
          sub={topAgent ? `${topAgent.conversions} won of ${topAgent.leadsCount} leads` : "No data yet"}
          icon={Trophy}
          bg="bg-[#EAB308]"
        />
        <KpiCard
          title="Team Members"
          value={stats.totalUsers ?? 0}
          sub="Active users"
          icon={Users}
          bg="bg-[#024BAB]"
        />
      </div>

      {/* Clients won + monthly performers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="border-2 bg-white p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display font-medium text-base text-black">Clients Won · Monthly</h3>
              <p className="text-xs text-muted-foreground">
                {(leadsChartData || []).reduce((a: number, m: any) => a + m.converted, 0)} clients won in the last 6 months, with win rate
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={leadsChartData} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} width={36} unit="%" />
              <Tooltip content={<NbTooltip />} cursor={{ fill: "#00C48C22" }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11, fontWeight: 500 }} />
              <Bar yAxisId="l" dataKey="converted" name="Clients won" fill="#00C48C" stroke="#0A0A0A" strokeWidth={2}>
                <LabelList dataKey="converted" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
              </Bar>
              <Line yAxisId="r" type="monotone" dataKey="conversionRate" name="Win rate %" stroke="#FA731C" strokeWidth={3} dot={{ r: 4, stroke: "#0A0A0A", strokeWidth: 2, fill: "#FA731C" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="border-2 bg-white p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display font-medium text-base text-black">Monthly Performers</h3>
              <p className="text-xs text-muted-foreground">Clients won per agent, last 6 months</p>
            </div>
            <Link to="/users">
              <button className="text-xs font-medium text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors">Team →</button>
            </Link>
          </div>
          {!performerTrend || performerTrend.agents.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-medium">No clients won yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={performerTrend.data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<NbTooltip />} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11, fontWeight: 500 }} />
                {performerTrend.agents.map((name: string, i: number) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                    strokeWidth={3}
                    dot={{ r: 4, stroke: "#0A0A0A", strokeWidth: 2, fill: AGENT_COLORS[i % AGENT_COLORS.length] }}
                    activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 2 }}
                    isAnimationActive
                    animationBegin={i * 250}
                    animationDuration={1600}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Funnel + sources + overview in one row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
        <div className="xl:col-span-4 border-2 bg-white p-5">
          <h3 className="font-display font-medium text-base text-black mb-1">
            Sales Funnel
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Lead drop-off by stage
          </p>
          <SalesFunnel stages={funnelStages || []} />
        </div>

        <div className="xl:col-span-3 border-2 bg-white p-5">
          <h3 className="font-display font-medium text-base text-black mb-1">
            Lead Sources
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Where your leads come from
          </p>
          {sourceData && sourceData.length > 0 ? (
            <>
              {(() => {
                const total = sourceData.reduce((a: number, e: any) => a + e.value, 0);
                const rows = [...sourceData].sort((a: any, b: any) => b.value - a.value);
                return (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={rows}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="#0A0A0A"
                            strokeWidth={2}
                          >
                            {rows.map((entry: any) => (
                              <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] || "#024BAB"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number, n: string) => [v, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black leading-none">{total.toLocaleString("en-IN")}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">total leads</span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {rows.map((entry: any) => {
                        const Icon = SOURCE_ICONS[entry.name] || Target;
                        const color = SOURCE_COLORS[entry.name] || "#024BAB";
                        const pct = total ? (entry.value / total) * 100 : 0;
                        return (
                          <div key={entry.name} className="flex items-center gap-3">
                            {SOURCE_LOGOS[entry.name] ? (
                              <span className="w-9 h-9 border-2 border-black bg-white flex items-center justify-center shrink-0 p-1 shadow-[2px_2px_0_0_#000]">
                                <img src={SOURCE_LOGOS[entry.name]} alt={entry.name} className="w-full h-full object-contain" />
                              </span>
                            ) : (
                              <span className="w-9 h-9 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]" style={{ background: color }}>
                                <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-bold text-black truncate">{entry.name}</span>
                                <span className="text-sm font-black text-black">
                                  {entry.value.toLocaleString("en-IN")}
                                  <span className="ml-1 text-[11px] font-bold text-muted-foreground">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
                                </span>
                              </div>
                              <div className="h-1.5 border border-black bg-gray-100 mt-1">
                                <div className="h-full" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-medium">
              No data yet
            </div>
          )}
        </div>

        <div className="xl:col-span-5 border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-medium text-base text-black">
                Leads Overview
              </h3>
              <p className="text-xs text-muted-foreground">
                6-month lead volume
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-black bg-[#024BAB] inline-block" />{" "}
                Leads
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-black bg-[#00C48C] inline-block" />{" "}
                Won
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={leadsChartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<NbTooltip />} cursor={{ fill: "#024BAB22" }} />
              <Bar
                dataKey="leads"
                name="Leads"
                fill="#024BAB"
                stroke="#0A0A0A"
                strokeWidth={2}
              />
              <Bar
                dataKey="converted"
                name="Won"
                fill="#00C48C"
                stroke="#0A0A0A"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent leads + live performance in one row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="border-2 bg-white p-5 xl:col-span-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-medium text-base text-black">
                Recent Leads
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest {recentLeads?.length ?? 0} added
              </p>
            </div>
            <Link to="/leads">
              <button className="text-xs font-medium text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors ">
                View all →
              </button>
            </Link>
          </div>
          <RecentLeadsList leads={recentLeads || []} />
        </div>
        <div className="xl:col-span-7 flex flex-col gap-4">
          {isAdmin && <LiveSummary />}
          <RecentQuotations quotations={recentQuotations || []} rows={isAdmin ? 4 : 8} className="flex-1" />
        </div>
      </div>

      {/* FAB */}
      <Link to="/leads" className="fixed bottom-6 right-6 z-50">
        <button className="border-2 w-14 h-14 bg-[#024BAB] text-white flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </AppLayout>
  );
}
