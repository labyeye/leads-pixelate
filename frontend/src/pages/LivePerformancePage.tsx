import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Bar as RBar,
  BarChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  Inbox,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  Repeat,
  Save,
  Sparkles,
  Target,
  UserPlus,
  Wifi,
  WifiOff,
  AlertTriangle,
  Bot,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardAPI, settingsAPI } from "@/services/api";
import { cn } from "@/lib/utils";

interface TeamRow {
  _id: string;
  name: string;
  avatar?: string;
  role: string;
  calls: number;
  conversations: number;
  quotations: number;
  visits: number;
  statusUpdates: number;
  done: number;
  connected: number;
  talkSeconds: number;
  lastCallAt: string | null;
  statusChanges: number;
  isAI?: boolean; // the AI calling agent: listed with the team, not held to the human targets
}

interface Target {
  count: number;
  perMinutes: number;
}

interface LiveData {
  now: string;
  windowMin: number;
  targets: {
    calls: number;
    perMinutes: number;
    amberPct: number;
    countBy: "updates" | "calls";
    conversations: Target;
    quotations: Target;
    visits: Target;
  };
  totals: {
    calls: number;
    done: number;
    conversations: number;
    quotations: number;
    visits: number;
    connected: number;
    talkSeconds: number;
    newLeads: number;
    statusChanges: number;
    pendingWorked: number;
    pendingNow: number;
    aiCalls: number;
  };
  team: TeamRow[];
  trend: { t: string; calls: number; leads: number; worked?: number }[];
  custom?: boolean;
  bucketMin?: number;
  agentRange?: {
    name: string;
    isAI?: boolean;
    assigned: number;
    worked: number;
    pending: number;
    pct: number;
  }[];
  recentLeads: {
    _id: string;
    name: string;
    company?: string;
    source: string;
    status: string;
    createdAt: string;
    assignedTo?: { name: string } | null;
  }[];
  updates: {
    leadId?: string;
    action: "UPDATE" | "STATUS_UPDATED" | "NOTE_ADDED" | "LEAD_CONVERTED";
    description: string;
    by: string;
    at: string;
  }[];
  statusCounts: Record<string, number>;
}

type ExtraKey = "conversations" | "quotations" | "visits";
const EXTRAS: { key: ExtraKey; label: string }[] = [
  { key: "conversations", label: "Conversations" },
  { key: "quotations", label: "Quotations sent" },
  { key: "visits", label: "Visits scheduled" },
];
const PERIODS = [
  { min: 60, label: "per hour" },
  { min: 240, label: "per 4 hours" },
  { min: 480, label: "per 8 hours" },
  { min: 1440, label: "per day" },
  { min: 10080, label: "per week" },
];

const fmtMin = (m: number) =>
  m < 60
    ? `${Math.round(m)}m`
    : m < 1440
      ? `${Math.round((m / 60) * 10) / 10}h`
      : `${Math.round((m / 1440) * 10) / 10}d`;

const WINDOWS = [
  { min: 60, label: "1 hour" },
  { min: 240, label: "4 hours" },
  { min: 480, label: "8 hours" },
  { min: 1440, label: "24 hours" },
  { min: 10080, label: "7 days" },
];

// Date helpers for the custom range filter (local dates, yyyy-mm-dd).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtDay = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
const MONTH_PRESETS = (() => {
  const now = new Date();
  const m = (offset: number) => {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end =
      offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
    return { from: ymd(start), to: ymd(end) };
  };
  return [
    { key: "today", label: "Today", range: { from: ymd(now), to: ymd(now) } },
    { key: "this-month", label: "This month", range: m(0) },
    { key: "last-month", label: "Last month", range: m(1) },
  ];
})();
// The last 12 months, newest first, for the sales-vs-target card.
const LAST_12_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
  return {
    key: monthKey(d),
    label:
      i === 0
        ? "This month"
        : i === 1
          ? "Last month"
          : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
});

type Tone = "green" | "amber" | "red";
const TONE: Record<
  Tone,
  { hex: string; bg: string; label: string; hint: string }
> = {
  green: {
    hex: "#16a34a",
    bg: "#dcfce7",
    label: "On target",
    hint: "At or above target pace",
  },
  amber: {
    hex: "#f59e0b",
    bg: "#fef3c7",
    label: "Behind",
    hint: "Below target, still close",
  },
  red: {
    hex: "#dc2626",
    bg: "#fee2e2",
    label: "Off pace",
    hint: "Well below target",
  },
};

const BLUE = "#024BAB";
const ORANGE = "#f97316";

const toneFor = (pct: number, amberPct: number): Tone =>
  pct >= 100 ? "green" : pct >= amberPct ? "amber" : "red";

function ago(iso: string | null, nowIso: string) {
  if (!iso) return "no calls yet";
  const s = Math.max(
    0,
    Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const talk = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

const title = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const minutesLabel = (m: number) =>
  m % 1440 === 0
    ? `${m / 1440} day${m === 1440 ? "" : "s"}`
    : m % 60 === 0
      ? `${m / 60} hr`
      : `${m} min`;

// ₹ in lakh / crore; `axis` gives the short form for chart ticks.
const inrShort = (n: number, axis = false) => {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1e7)
    return `₹${(v / 1e7).toFixed(axis ? 1 : 2)}${axis ? "Cr" : " Cr"}`;
  if (Math.abs(v) >= 1e5)
    return `₹${(v / 1e5).toFixed(axis ? 1 : 2)}${axis ? "L" : " L"}`;
  return `₹${v.toLocaleString("en-IN")}`;
};

export default function LivePerformancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [windowMin, setWindowMin] = useState(60);
  // Custom date range (yyyy-mm-dd, both days included). null = the rolling window above.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [customKey, setCustomKey] = useState(""); // which preset is on, "custom" for picked dates
  const [customDraft, setCustomDraft] = useState(() => ({
    from: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: ymd(new Date()),
  }));
  const [customOpen, setCustomOpen] = useState(false);
  const [moneyMonth, setMoneyMonth] = useState(monthKey(new Date()));
  const [live, setLive] = useState(true);
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState<any>(null);
  const [money, setMoney] = useState<any>(null);

  // Target editor draft; null = not editing.
  const [draft, setDraft] = useState<{
    calls: string;
    perMinutes: string;
    amberPct: string;
    countBy: "updates" | "calls";
    extra: Record<ExtraKey, { count: string; perMinutes: string }>;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // The exact range every card on the page follows.
  const rangeISO = useMemo(
    () =>
      custom
        ? {
            from: new Date(`${custom.from}T00:00:00`).toISOString(),
            to: new Date(`${custom.to}T23:59:59.999`).toISOString(),
          }
        : undefined,
    [custom],
  );
  const rangeLabel = custom
    ? MONTH_PRESETS.find((p) => p.key === customKey)?.label ||
      (custom.from === custom.to
        ? fmtDay(custom.from)
        : `${fmtDay(custom.from)} – ${fmtDay(custom.to)}`)
    : `last ${WINDOWS.find((w) => w.min === windowMin)?.label}`;
  const pickRange = (
    key: string,
    r: { from: string; to: string } | null,
  ) => {
    setCustomKey(key);
    setCustom(r);
    setCustomOpen(false);
    // The sales card follows the month the range ends in.
    setMoneyMonth(monthKey(r ? new Date(`${r.to}T00:00:00`) : new Date()));
  };

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await dashboardAPI.getLive(windowMin, rangeISO);
        if (res.success) {
          setData(res.data);
          setError("");
        }
      } catch (e: any) {
        setError(e?.message || "Couldn't load live data");
      } finally {
        setLoading(false);
      }
    },
    [windowMin, rangeISO],
  );

  // Response speed follows the page range (a rolling window ends now).
  useEffect(() => {
    if (!isAdmin) return;
    const r = rangeISO || {
      from: new Date(Date.now() - windowMin * 60000).toISOString(),
      to: new Date().toISOString(),
    };
    dashboardAPI
      .getInsights(30, r)
      .then((res: any) => setSpeed(res.data))
      .catch(() => {});
  }, [isAdmin, rangeISO, windowMin]);

  useEffect(() => {
    if (!isAdmin) return;
    dashboardAPI
      .getTargets(moneyMonth)
      .then((r: any) => setMoney(r.data))
      .catch(() => {});
  }, [isAdmin, moneyMonth]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [load, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !live) return;
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, 10000);
    return () => clearInterval(id);
  }, [load, live, isAdmin]);

  const view = useMemo(() => {
    if (!data) return null;
    const { targets, team, totals } = data;
    // Target is "calls per perMinutes", so scale it to the window being viewed.
    const perAgent = (targets.calls * data.windowMin) / targets.perMinutes;
    const rows = team.map((t) => {
      const pct = perAgent > 0 ? (t.done / perAgent) * 100 : 0;
      return { ...t, pct, tone: toneFor(pct, targets.amberPct) };
    });
    const teamTarget = perAgent * Math.max(team.filter((m) => !m.isAI).length, 1);
    const teamPct = teamTarget > 0 ? (totals.done / teamTarget) * 100 : 0;
    const groups: Record<Tone, typeof rows> = { green: [], amber: [], red: [] };
    rows.forEach((r) => groups[r.tone].push(r));
    return {
      perAgent,
      rows,
      teamTarget,
      teamPct,
      groups,
      teamTone: toneFor(teamPct, targets.amberPct),
    };
  }, [data]);

  const agentRange = data?.agentRange || [];
  const chart = useMemo(
    () =>
      (data?.trend || []).map((p) => {
        const d = new Date(p.t);
        const step = data!.bucketMin || data!.windowMin;
        const label = data!.custom
          ? step >= 1440
            ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : data!.windowMin >= 10080
            ? d.toLocaleDateString([], { weekday: "short", day: "numeric" })
            : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { ...p, label };
      }),
    [data],
  );

  // New leads vs how many of them were worked, per bucket of the range.
  const received = useMemo(
    () =>
      chart.map((p) => ({
        month: p.label,
        leads: p.leads,
        contacted: p.worked || 0,
        contactedRate: p.leads ? Math.round(((p.worked || 0) / p.leads) * 100) : 0,
      })),
    [chart],
  );

  const startEdit = () =>
    data &&
    setDraft({
      calls: String(data.targets.calls),
      perMinutes: String(data.targets.perMinutes),
      amberPct: String(data.targets.amberPct),
      countBy: data.targets.countBy,
      extra: Object.fromEntries(
        EXTRAS.map((x) => [
          x.key,
          {
            count: String(data.targets[x.key].count),
            perMinutes: String(data.targets[x.key].perMinutes),
          },
        ]),
      ) as Record<ExtraKey, { count: string; perMinutes: string }>,
    });

  const saveTargets = async () => {
    if (!draft) return;
    const calls = Math.round(Number(draft.calls));
    const perMinutes = Math.round(Number(draft.perMinutes));
    const amberPct = Math.round(Number(draft.amberPct));
    if (
      !(calls >= 1 && calls <= 10000) ||
      !(perMinutes >= 5 && perMinutes <= 10080) ||
      !(amberPct >= 1 && amberPct <= 99)
    ) {
      toast({
        title: "Check the target values",
        description:
          "Calls 1–10000, time 5–10080 minutes, amber threshold 1–99%.",
        variant: "destructive",
      });
      return;
    }
    const extra = Object.fromEntries(
      EXTRAS.map((x) => [
        x.key,
        {
          count: Math.round(Number(draft.extra[x.key].count) || 0),
          perMinutes: Math.round(Number(draft.extra[x.key].perMinutes)) || 1440,
        },
      ]),
    );
    if (Object.values(extra).some((v: any) => v.count < 0 || v.count > 10000)) {
      toast({
        title: "Check the target values",
        description: "Targets must be 0–10000 (0 = no target).",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.update({
        callTargets: {
          calls,
          perMinutes,
          amberPct,
          countBy: draft.countBy,
          ...extra,
        },
      });
      toast({
        title: "Target saved",
        description: `${calls} calls per ${minutesLabel(perMinutes)} per agent.`,
      });
      setDraft(null);
      load(true);
    } catch (e: any) {
      toast({
        title: "Couldn't save target",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  const t = data?.targets;
  const unit = t?.countBy === "calls" ? "calls" : "status updates";
  const connectRate =
    data && data.totals.calls
      ? Math.round((data.totals.connected / data.totals.calls) * 100)
      : 0;

  return (
    <AppLayout title="Live Performance">
      <style>{ANIM_CSS}</style>
      <div className="p-3 md:p-4 max-w-full mx-auto space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold text-black">
              Live Performance
            </h1>
            <p className="text-xs text-muted-foreground">
              {custom ? "Showing" : "Rolling"} {rangeLabel} ·{" "}
              {data
                ? `updated ${ago(data.now, new Date().toISOString())}`
                : "loading…"}
              {t && (
                <>
                  {" "}
                  · Target {t.calls} {unit} / {minutesLabel(t.perMinutes)} per
                  agent
                </>
              )}
            </p>
          </div>
          <div className="flex border-2 border-black bg-white">
            {WINDOWS.map((w) => (
              <button
                key={w.min}
                onClick={() => {
                  setWindowMin(w.min);
                  pickRange("", null);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-r-2 border-black last:border-r-0 transition-colors",
                  !custom && windowMin === w.min
                    ? "text-white"
                    : "hover:bg-slate-100",
                )}
                style={
                  !custom && windowMin === w.min
                    ? { backgroundColor: BLUE }
                    : undefined
                }
              >
                {w.label}
              </button>
            ))}
            {MONTH_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => pickRange(p.key, p.range)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-r-2 border-black transition-colors",
                  customKey === p.key ? "text-white" : "hover:bg-slate-100",
                )}
                style={
                  customKey === p.key ? { backgroundColor: BLUE } : undefined
                }
              >
                {p.label}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setCustomOpen((v) => !v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  customKey === "custom" ? "text-white" : "hover:bg-slate-100",
                )}
                style={
                  customKey === "custom" ? { backgroundColor: BLUE } : undefined
                }
              >
                {customKey === "custom" && custom
                  ? `${fmtDay(custom.from)} – ${fmtDay(custom.to)}`
                  : "Custom"}
              </button>
              {customOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 w-64 border-2 border-black bg-white p-3 space-y-2 shadow-[4px_4px_0_#000]">
                  <label className="block text-xs font-medium text-black">
                    From
                    <input
                      type="date"
                      value={customDraft.from}
                      max={customDraft.to}
                      onChange={(e) =>
                        setCustomDraft((d) => ({ ...d, from: e.target.value }))
                      }
                      className="mt-1 w-full h-8 border-2 border-black px-2 text-xs"
                    />
                  </label>
                  <label className="block text-xs font-medium text-black">
                    To
                    <input
                      type="date"
                      value={customDraft.to}
                      min={customDraft.from}
                      max={ymd(new Date())}
                      onChange={(e) =>
                        setCustomDraft((d) => ({ ...d, to: e.target.value }))
                      }
                      className="mt-1 w-full h-8 border-2 border-black px-2 text-xs"
                    />
                  </label>
                  <button
                    disabled={
                      !customDraft.from ||
                      !customDraft.to ||
                      customDraft.from > customDraft.to
                    }
                    onClick={() => pickRange("custom", { ...customDraft })}
                    className="w-full h-8 text-xs font-medium text-white border-2 border-black disabled:opacity-50"
                    style={{ backgroundColor: BLUE }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setLive((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-2 border-black",
              live
                ? "bg-green-100 text-green-800"
                : "bg-white text-muted-foreground",
            )}
          >
            {live ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {live ? "LIVE · 10s" : "PAUSED"}
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            disabled={!data}
            className="gap-1.5 text-xs h-8 border-2 border-black"
          >
            <Target className="w-3.5 h-3.5" />
            Target
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => load()}
            disabled={loading}
            className="gap-1.5 text-xs h-8 border-2 border-black"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="border-2 border-black bg-red-50 text-red-700 px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {!data || !view || !t ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Target modal */}
            <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
              <DialogContent className="max-w-3xl border-2 border-black">
                <DialogHeader>
                  <DialogTitle>Set targets</DialogTitle>
                  <DialogDescription>
                    Per agent, for the time period you choose.
                  </DialogDescription>
                </DialogHeader>
                {draft && (
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Count">
                      <select
                        value={draft.countBy}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            countBy: e.target.value as "updates" | "calls",
                          })
                        }
                        className="h-9 border-2 border-black bg-white px-2 text-sm"
                      >
                        <option value="updates">Lead status updates</option>
                        <option value="calls">CRM calls only</option>
                      </select>
                    </Field>
                    <Field label="Target per agent">
                      <Input
                        type="number"
                        min={1}
                        value={draft.calls}
                        onChange={(e) =>
                          setDraft({ ...draft, calls: e.target.value })
                        }
                        className="h-9 w-28 border-2 border-black"
                      />
                    </Field>
                    <Field label="In (minutes)">
                      <Input
                        type="number"
                        min={5}
                        value={draft.perMinutes}
                        onChange={(e) =>
                          setDraft({ ...draft, perMinutes: e.target.value })
                        }
                        className="h-9 w-28 border-2 border-black"
                      />
                    </Field>
                    <Field label="Amber from (% of target)">
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={draft.amberPct}
                        onChange={(e) =>
                          setDraft({ ...draft, amberPct: e.target.value })
                        }
                        className="h-9 w-28 border-2 border-black"
                      />
                    </Field>
                    <div className="basis-full grid grid-cols-1 md:grid-cols-3 gap-3 border-t-2 border-black pt-3">
                      {EXTRAS.map((x) => (
                        <div key={x.key} className="space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {x.label} per agent (0 = no target)
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={draft.extra[x.key].count}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  extra: {
                                    ...draft.extra,
                                    [x.key]: {
                                      ...draft.extra[x.key],
                                      count: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="h-9 w-24 border-2 border-black"
                            />
                            <select
                              value={draft.extra[x.key].perMinutes}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  extra: {
                                    ...draft.extra,
                                    [x.key]: {
                                      ...draft.extra[x.key],
                                      perMinutes: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="h-9 border-2 border-black bg-white px-2 text-sm flex-1"
                            >
                              {PERIODS.map((p) => (
                                <option key={p.min} value={p.min}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveTargets}
                        disabled={saving}
                        className="gap-1.5 h-9 border-2 border-black"
                        style={{ backgroundColor: BLUE }}
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save target
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft(null)}
                        className="h-9 border-2 border-black"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Status cards (left) + graphs (right) */}
            <div className="flex flex-col gap-3">
              <div className="order-2 grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
                <div
                  className="xl:col-span-12 lp-one h-full grid grid-cols-1 xl:grid-cols-12 gap-3"
                  style={{ "--d": "0.8s" } as React.CSSProperties}
                >
                  {/* Performance table */}
                  {(() => {
                    type Col = {
                      key: "calls" | ExtraKey;
                      label: string;
                      count: number;
                      perMinutes: number;
                    };
                    const cols: Col[] = [
                      {
                        key: "calls",
                        label: "Calls",
                        count: t.calls,
                        perMinutes: t.perMinutes,
                      },
                      ...EXTRAS.map((x) => ({
                        key: x.key,
                        label: x.label,
                        ...t[x.key],
                      })),
                    ];
                    const expected = (c: Col) =>
                      (c.count * data.windowMin) / c.perMinutes;
                    const value = (
                      r: { done: number } & Record<ExtraKey, number>,
                      c: Col,
                    ) => (c.key === "calls" ? r.done : r[c.key]);
                    const cell = (done: number, exp: number) => {
                      if (exp <= 0)
                        return {
                          text: String(done),
                          color: undefined as string | undefined,
                          bg: undefined as string | undefined,
                        };
                      const tone = toneFor((done / exp) * 100, t.amberPct);
                      return {
                        text: `${done} / ${Math.round(exp * 10) / 10}`,
                        color: TONE[tone].hex,
                        bg: TONE[tone].bg,
                      };
                    };
                    const agents = Math.max(data.team.filter((m) => !m.isAI).length, 1);
                    return (
                      <>
                      <div className="xl:col-span-7 border-2 border-black bg-white overflow-x-auto h-full flex flex-col">
                        <div className="px-3 py-1.5 border-b-2 border-black bg-slate-100">
                          <p className="text-sm font-semibold text-black">
                            Team performance · {rangeLabel}
                          </p>
                        </div>
                        <table className="w-full flex-1 text-xs min-w-[480px]">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b-2 border-black">
                              <th className="text-left px-3 py-1 font-medium">
                                Agent
                              </th>
                              {cols.map((c) => (
                                <th
                                  key={c.key}
                                  className="text-right px-3 py-1 font-medium"
                                >
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.team.map((r) => (
                              <tr
                                key={r._id}
                                className={cn("border-b border-slate-200", r.isAI && "bg-[#024BAB]/5")}
                              >
                                <td className="px-3 py-1 font-medium text-black">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-6 h-6 border-2 border-black overflow-hidden shrink-0 rounded-full text-white flex items-center justify-center text-[10px] font-bold", r.isAI ? "bg-black" : "bg-[#024BAB]")}>
                                      {r.isAI ? (
                                        <Bot className="w-3.5 h-3.5" />
                                      ) : r.avatar ? (
                                        <img
                                          src={r.avatar}
                                          alt={r.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        r.name?.[0]?.toUpperCase()
                                      )}
                                    </div>
                                    {r.name}
                                    {r.isAI && (
                                      <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">
                                        {r.calls} {r.calls === 1 ? "call" : "calls"} · {r.connected} answered
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {cols.map((c) => {
                                  const x = cell(value(r, c), r.isAI ? 0 : expected(c));
                                  return (
                                    <td
                                      key={c.key}
                                      className="px-3 py-1 text-right tabular-nums font-medium"
                                      style={{
                                        color: x.color,
                                        backgroundColor: x.bg,
                                      }}
                                    >
                                      {x.text}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            <tr className="bg-slate-100 font-semibold border-t-2 border-black">
                              <td className="px-3 py-1 text-black">
                                Team total
                              </td>
                              {cols.map((c) => {
                                const total =
                                  c.key === "calls"
                                    ? data.totals.done
                                    : data.totals[c.key];
                                const x = cell(total, expected(c) * agents);
                                return (
                                  <td
                                    key={c.key}
                                    className="px-3 py-1 text-right tabular-nums"
                                    style={{ color: x.color }}
                                  >
                                    {x.text}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="xl:col-span-5 flex flex-col gap-3 h-full">
                        <div className="border-2 border-black bg-white flex-1 flex flex-col min-h-[200px]">
                          <div className="px-3 py-1.5 border-b-2 border-black bg-slate-100">
                            <p className="text-sm font-semibold text-black">
                              How fast we respond
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              % of new leads in this period that got a first update within 1 hour · higher is better
                            </p>
                          </div>
                          <div className="flex-1 p-2 min-h-[150px]">
                            {!speed || !speed.response.daily?.length ? (
                              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No worked leads yet.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={speed.response.daily}
                                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                                  <YAxis
                                    domain={[0, 100]}
                                    ticks={[0, 25, 50, 75, 100]}
                                    tickFormatter={(v: number) => `${v}%`}
                                    tick={{ fontSize: 11 }}
                                    width={40}
                                  />
                                  <Tooltip
                                    contentStyle={{ border: "2px solid #000", borderRadius: 0, fontSize: 12 }}
                                    formatter={(v: any, _n: any, item: any) => [
                                      `${v}% · ${item.payload.leads} leads, ${item.payload.worked} worked · median ${fmtMin(item.payload.medianMinutes)}`,
                                      "Within 1h",
                                    ]}
                                  />
                                  <ReferenceLine
                                    y={80}
                                    stroke="#16a34a"
                                    strokeDasharray="5 4"
                                    label={{ value: "Goal 80%", fontSize: 10, fill: "#16a34a", position: "insideTopRight" }}
                                  />
                                  <Line
                                    type="linear"
                                    dataKey="within1hPct"
                                    stroke="#024BAB"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                        <div className="border-2 border-black bg-white flex-1 flex flex-col min-h-[200px]">
                          <div className="px-3 py-1.5 border-b-2 border-black bg-slate-100">
                            <p className="text-sm font-semibold text-black">
                              Response rate per agent
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              % of their new leads answered within 1 hour · {rangeLabel} · AI Agent = leads it answered first
                            </p>
                          </div>
                          <div className="flex-1 p-2 min-h-[150px]">
                            {!speed || !speed.response.perAgent?.length ? (
                              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No worked leads yet.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={speed.response.perAgent} layout="vertical" margin={{ left: 0, right: 12 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                                  <Tooltip
                                    contentStyle={{ border: "2px solid #000", borderRadius: 0, fontSize: 12 }}
                                    formatter={(v: any, _n: any, item: any) => [`${v}% · median ${fmtMin(item.payload.medianMinutes)} · ${item.payload.leads} leads`, "Within 1h"]}
                                  />
                                  <RBar dataKey="within1hPct" stroke="#0A0A0A" strokeWidth={2}>
                                    {speed.response.perAgent.map((r: any, i: number) => (
                                      <Cell key={i} fill={r.within1hPct >= 80 ? "#00C48C" : r.within1hPct >= 50 ? "#FACC15" : "#EF4444"} />
                                    ))}
                                  </RBar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="order-1 lp-in grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="border-2 border-black bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {t?.countBy === "calls" ? "Calls" : "Status updates"} & new
                    leads trend
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chart}
                        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="gCalls"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={BLUE}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor={BLUE}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                          <linearGradient
                            id="gLeads"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={ORANGE}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor={ORANGE}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            border: "2px solid #000",
                            borderRadius: 0,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="calls"
                          name={
                            t?.countBy === "calls" ? "Calls" : "Status updates"
                          }
                          stroke={BLUE}
                          strokeWidth={2}
                          fill="url(#gCalls)"
                        />
                        <Area
                          type="monotone"
                          dataKey="leads"
                          name="New leads"
                          stroke={ORANGE}
                          strokeWidth={2}
                          fill="url(#gLeads)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border-2 border-black bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Leads Received vs Worked
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    New leads vs contacted · {rangeLabel}
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={received}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="l"
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="r"
                          orientation="right"
                          domain={[0, 100]}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            border: "2px solid #000",
                            borderRadius: 0,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          yAxisId="l"
                          type="monotone"
                          dataKey="leads"
                          name="Received"
                          stroke="#024BAB"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            stroke: "#0A0A0A",
                            strokeWidth: 2,
                            fill: "#024BAB",
                          }}
                        />
                        <Line
                          yAxisId="l"
                          type="monotone"
                          dataKey="contacted"
                          name="Worked"
                          stroke="#00C48C"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            stroke: "#0A0A0A",
                            strokeWidth: 2,
                            fill: "#00C48C",
                          }}
                        />
                        <Line
                          yAxisId="r"
                          type="monotone"
                          dataKey="contactedRate"
                          name="Worked %"
                          stroke="#FA731C"
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={{
                            r: 3,
                            stroke: "#0A0A0A",
                            strokeWidth: 2,
                            fill: "#FA731C",
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Sales vs target and who is bringing the business, side by side */}
            {money && (
              <div className="order-1 grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
                <div className="border-2 border-black bg-white p-3 h-full">
                  <div className="flex flex-wrap items-baseline gap-x-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Sales vs target &amp; break-even
                    </p>
                    <select
                      value={moneyMonth}
                      onChange={(e) => setMoneyMonth(e.target.value)}
                      className="h-7 border-2 border-black bg-white px-1.5 text-xs font-medium"
                    >
                      {LAST_12_MONTHS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <Link
                      to="/insights"
                      className="ml-auto text-xs font-medium text-[#024BAB]"
                    >
                      Targets →
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {inrShort(money.month.won)} won
                    {money.target ? ` of ${inrShort(money.target)} target` : ""}
                    {money.breakEven
                      ? ` · break-even ${inrShort(money.breakEven)}`
                      : ""}
                    {money.target
                      ? (() => {
                          const day =
                            money.month.dayNow ?? new Date().getDate();
                          const pace =
                            (money.target * day) / (money.daily?.length || 30);
                          if (money.month.isCurrent === false)
                            return money.month.won >= money.target
                              ? " · target met"
                              : ` · ${inrShort(money.target - money.month.won)} short of target`;
                          return money.month.won >= pace
                            ? " · ahead of pace"
                            : ` · ${inrShort(pace - money.month.won)} behind pace`;
                        })()
                      : ""}
                  </p>
                  {!money.target && !money.breakEven ? (
                    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                      Set a monthly target and fixed costs in Insights → Targets
                      to see this.
                    </div>
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={money.daily}
                          margin={{ top: 8, right: 12, left: -6, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            interval={2}
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => inrShort(v, true)}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "2px solid #000",
                              borderRadius: 0,
                              fontSize: 12,
                            }}
                            formatter={(v: any) => inrShort(v)}
                            labelFormatter={(d) => `Day ${d}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="won"
                            name="Won so far"
                            stroke="#00C48C"
                            strokeWidth={3}
                            dot={false}
                            connectNulls={false}
                          />
                          {money.target > 0 && (
                            <Line
                              type="linear"
                              dataKey="pace"
                              name="Target pace"
                              stroke="#FA731C"
                              strokeWidth={2}
                              strokeDasharray="5 4"
                              dot={false}
                            />
                          )}
                          {money.breakEven > 0 && (
                            <Line
                              type="linear"
                              dataKey="breakEven"
                              name="Break-even (expenses)"
                              stroke="#EF4444"
                              strokeWidth={2}
                              strokeDasharray="2 4"
                              dot={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="border-2 border-black bg-white p-3 h-full">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Who is bringing the business
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Won orders in {money?.month?.label || "this month"}, by value · AI Agent = leads it called
                  </p>
                  {money.byAgent.length === 0 ? (
                    <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                      No won orders yet this month.
                    </div>
                  ) : (
                    <div
                      style={{
                        height: Math.max(176, money.byAgent.length * 44),
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={money.byAgent}
                          layout="vertical"
                          margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => inrShort(v, true)}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={90}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "2px solid #000",
                              borderRadius: 0,
                              fontSize: 12,
                            }}
                            formatter={(v: any, _n: any, p: any) => [
                              `${inrShort(v)} · ${p.payload.orders} order${p.payload.orders === 1 ? "" : "s"}`,
                              "Won",
                            ]}
                          />
                          <RBar
                            dataKey="value"
                            name="Won value"
                            fill="#00C48C"
                            stroke="#0A0A0A"
                            strokeWidth={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Who hit the target and who didn't */}

            {/* <div className="grid grid-cols-1 gap-4">
              <div className="border-2 border-black bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Recent leads
                </p>
                <ul className="divide-y divide-slate-200">
                  {data.recentLeads.length === 0 && (
                    <li className="text-sm text-muted-foreground py-4">
                      No leads yet.
                    </li>
                  )}
                  {data.recentLeads.map((l) => (
                    <li key={l._id} className="py-2 flex items-start gap-2">
                      <span
                        className="mt-1.5 w-2 h-2 shrink-0"
                        style={{ backgroundColor: BLUE }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-black truncate">
                          {l.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {l.source} · {title(l.status)} ·{" "}
                          {l.assignedTo?.name || "Unassigned"}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {ago(l.createdAt, data.now)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div> */}

            {/* Assigned vs worked, work done per agent and calls picked up: one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              {/* Assigned vs worked */}
              <div className="border-2 border-black bg-white p-3 h-full">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Assigned vs worked · {rangeLabel}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Leads created in this period (worked = past Pending
                    Contact)
                  </p>
                  {agentRange.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-medium">
                      No assigned leads this month
                    </div>
                  ) : (
                    <div
                      style={{
                        height: Math.max(192, agentRange.length * 36),
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={agentRange}
                          layout="vertical"
                          margin={{ top: 4, right: 30, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={90}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "2px solid #000",
                              borderRadius: 0,
                              fontSize: 12,
                            }}
                            formatter={(v: any, n: any, p: any) =>
                              n === "Worked"
                                ? [`${v} (${p.payload.pct}%)`, n]
                                : [v, n]
                            }
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <RBar
                            dataKey="assigned"
                            name="Assigned"
                            fill="#024BAB"
                            stroke="#0A0A0A"
                            strokeWidth={2}
                          />
                          <RBar
                            dataKey="worked"
                            name="Worked"
                            fill="#00C48C"
                            stroke="#0A0A0A"
                            strokeWidth={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
              </div>

            {/* Charts for this window */}
            <>
              <div className="border-2 border-black bg-white p-3 h-full">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                  Work done per agent
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Against the target of {Math.round(view.perAgent * 10) / 10}{" "}
                  for this window
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.team.map((r) => ({
                        name: r.name,
                        Done: r.done,
                        Target: r.isAI ? undefined : Math.round(view.perAgent * 10) / 10,
                      }))}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          border: "2px solid #000",
                          borderRadius: 0,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <RBar
                        dataKey="Done"
                        fill="#024BAB"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                      <RBar
                        dataKey="Target"
                        fill="#E5E7EB"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border-2 border-black bg-white p-3 h-full">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                  Calls picked up
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {data.totals.calls} calls in this window
                </p>
                {data.totals.calls === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No calls yet.
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative h-40 w-40 shrink-0">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Picked up",
                                value: data.totals.connected,
                              },
                              {
                                name: "Not picked",
                                value: Math.max(
                                  0,
                                  data.totals.calls - data.totals.connected,
                                ),
                              },
                            ]}
                            dataKey="value"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={2}
                            stroke="#0A0A0A"
                            strokeWidth={2}
                          >
                            <Cell fill="#00C48C" />
                            <Cell fill="#EF4444" />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              border: "2px solid #000",
                              borderRadius: 0,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold leading-none">
                          {connectRate}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          pick-up
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      <li className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 border border-black"
                          style={{ background: "#00C48C" }}
                        />
                        Picked up{" "}
                        <b className="ml-auto tabular-nums">
                          {data.totals.connected}
                        </b>
                      </li>
                      <li className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 border border-black"
                          style={{ background: "#EF4444" }}
                        />
                        Not picked{" "}
                        <b className="ml-auto tabular-nums">
                          {Math.max(
                            0,
                            data.totals.calls - data.totals.connected,
                          )}
                        </b>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </>
            </div>

            {/* Updates in this window: full row */}
            <div className="border-2 border-black bg-white">
              <div className="px-3 py-2 border-b-2 border-black bg-slate-100 flex items-center gap-2">
                <p className="text-sm font-semibold text-black">
                  Updates · {rangeLabel}
                </p>
                <span className="text-xs text-muted-foreground">
                  {data.totals.statusChanges} updates ·{" "}
                  {data.totals.pendingWorked} leads moved out of Pending Contact
                </span>
              </div>
              {data.updates.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No lead updates in this window.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                  {data.updates.map((u, i) => {
                    const dot =
                      u.action === "STATUS_UPDATED"
                        ? BLUE
                        : u.action === "NOTE_ADDED"
                          ? "#7c3aed"
                          : u.action === "LEAD_CONVERTED"
                            ? "#16a34a"
                            : "#64748b";
                    return (
                      <li
                        key={`${u.leadId}-${u.at}-${i}`}
                        className="px-4 py-2.5 flex items-center gap-3"
                      >
                        <span
                          className="w-2.5 h-2.5 shrink-0 border border-black"
                          style={{ backgroundColor: dot }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-black truncate">
                            {u.description}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            by {u.by}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {ago(u.at, data.now)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Pipeline snapshot */}
          </>
        )}
      </div>
    </AppLayout>
  );
}

const ANIM_CSS = `
@keyframes lpUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.lp-in>*{animation:lpUp .5s ease-out both}
.lp-in>*:nth-child(1){animation-delay:var(--d,0s)}
.lp-in>*:nth-child(2){animation-delay:calc(var(--d,0s) + .12s)}
.lp-in>*:nth-child(3){animation-delay:calc(var(--d,0s) + .24s)}
.lp-one{animation:lpUp .5s ease-out both;animation-delay:var(--d,0s)}
@media (prefers-reduced-motion:reduce){.lp-in>*,.lp-one{animation:none}}
`;

function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(Math.max((now - t0) / 700, 0), 1);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return <>{n}</>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Bar({
  pct,
  color,
  tall,
}: {
  pct: number;
  color: string;
  tall?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full border-2 border-black bg-slate-100",
        tall ? "h-5" : "h-3.5",
      )}
    >
      <div
        className="h-full transition-all duration-700"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
