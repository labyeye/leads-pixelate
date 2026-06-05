import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { dashboardAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
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
} from "recharts";
import {
  Target,
  Plus,
  Loader2,
  Flame,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  CheckCircle2,
  ChevronRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import nestleadslogosmall from "../../public/favicon.png";

type Period = "today" | "week" | "month";

const SOURCE_COLORS: Record<string, string> = {
  IndiaMART: "#FB923C",
  Facebook: "#3B82F6",
  TradeIndia: "#00C48C",
  Justdial: "#EF4444",
  Website: "#A855F7",
  Manual: "#6B7280",
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  bg,
  trend,
  trendLabel,
  to,
  urgent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  trend?: "up" | "down";
  trendLabel?: string;
  to?: string;
  urgent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "border-2 p-4 flex flex-col gap-3 nb-card-hover",
        urgent && "bg-[#FFF0F0]",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
            bg,
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 border-2 border-black ",
              trend === "up"
                ? "bg-[#A3E635] text-black"
                : "bg-[#EF4444] text-white",
            )}
          >
            {trend === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
          {title}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

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
            <div className="w-28 text-right text-xs font-bold text-black shrink-0">
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
              <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-black z-10">
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
        <p className="text-sm font-bold text-black">All clear for today!</p>
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
            <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-bold text-black shrink-0">
              {(lead.name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">
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
        <p className="text-sm font-bold">No performance data yet</p>
      </div>
    );
  }
  const medals = ["🥇", "🥈", "🥉"];
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
            <span className="text-base w-7 shrink-0">
              {medals[i] || `#${i + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-[#024BAB]/30 border border-black overflow-hidden">
                  <div
                    className="h-full bg-[#024BAB]"
                    style={{ width: `${convRate}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-black shrink-0">
                  {convRate}%
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-black">{p.conversions}</p>
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

const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black  px-3 py-2 text-xs">
      <p className="font-bold text-black mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color }}
          />
          <span className="font-bold text-black capitalize">
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
    todayFollowUps,
    userPerformance,
  } = data;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
        ? "Good afternoon"
        : "Good evening";

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
          <h2 className="font-display font-bold text-2xl text-black">
            {greeting}, {user?.name?.split(" ")[0]} 👋
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
                  "text-xs px-3 py-2 font-bold transition-colors capitalize",
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
          <span className="text-xs font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1">
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
          trend="up"
          trendLabel={`${stats.totalLeads > 0 ? Math.round(((stats.convertedClients ?? 0) / stats.totalLeads) * 100) : 0}%`}
          to="/leads"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-2 border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Sales Funnel
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Lead drop-off by stage
          </p>
          <SalesFunnel stages={funnelStages || []} />
        </div>

        <div className="lg:col-span-3 border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Leads Overview
              </h3>
              <p className="text-xs text-muted-foreground">
                6-month lead volume
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
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
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontWeight: 700 }}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Lead Sources
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Where your leads come from
          </p>
          {sourceData && sourceData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {sourceData.map((entry: any, i: number) => (
                      <Cell
                        key={entry.name}
                        fill={SOURCE_COLORS[entry.name] || "#024BAB"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                {sourceData.map((entry: any) => (
                  <span
                    key={entry.name}
                    className="flex items-center gap-1 text-[11px] font-bold text-black"
                  >
                    <span
                      className="w-2.5 h-2.5 border border-black shrink-0"
                      style={{
                        background: SOURCE_COLORS[entry.name] || "#024BAB",
                      }}
                    />
                    {entry.name} ({entry.value})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-bold">
              No data yet
            </div>
          )}
        </div>

        {/* Today's follow-ups */}
        <div className="border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Today's Follow-ups
              </h3>
              <p className="text-xs text-muted-foreground">
                {todayFollowUps?.length ?? 0} scheduled
              </p>
            </div>
            <Link to="/followup-calendar">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors ">
                View all →
              </button>
            </Link>
          </div>
          <TodayFollowUpsList leads={todayFollowUps || []} />
        </div>

        {/* Team leaderboard */}
        <div className="border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Team Leaderboard
              </h3>
              <p className="text-xs text-muted-foreground">
                Conversions this month
              </p>
            </div>
            <Link to="/users">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB]/10 transition-colors ">
                Team →
              </button>
            </Link>
          </div>
          <Leaderboard performers={userPerformance || []} />
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
