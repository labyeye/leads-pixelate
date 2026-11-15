import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Bar as RBar,
  BarChart,
  Line,
  LineChart,
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
  trend: { t: string; calls: number; leads: number }[];
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

const WINDOWS = [
  { min: 60, label: "1 hour" },
  { min: 240, label: "4 hours" },
  { min: 480, label: "8 hours" },
  { min: 1440, label: "24 hours" },
  { min: 10080, label: "7 days" },
];

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

export default function LivePerformancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [windowMin, setWindowMin] = useState(60);
  const [live, setLive] = useState(true);
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthly, setMonthly] = useState<any[]>([]);
  const [agentMonthly, setAgentMonthly] = useState<any[]>([]);

  // Target editor draft; null = not editing.
  const [draft, setDraft] = useState<{
    calls: string;
    perMinutes: string;
    amberPct: string;
    countBy: "updates" | "calls";
    extra: Record<ExtraKey, { count: string; perMinutes: string }>;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await dashboardAPI.getLive(windowMin);
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
    [windowMin],
  );

  useEffect(() => {
    if (!isAdmin) return;
    dashboardAPI
      .getStats()
      .then((r: any) => {
        setMonthly(r?.data?.leadsChartData || []);
        setAgentMonthly(r?.data?.agentMonthly || []);
      })
      .catch(() => {});
  }, [isAdmin]);

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
    const teamTarget = perAgent * Math.max(team.length, 1);
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

  const chart = useMemo(
    () =>
      (data?.trend || []).map((p) => {
        const d = new Date(p.t);
        const label =
          data!.windowMin >= 10080
            ? d.toLocaleDateString([], { weekday: "short", day: "numeric" })
            : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { ...p, label };
      }),
    [data],
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
              Rolling last {WINDOWS.find((w) => w.min === windowMin)?.label} ·{" "}
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
                onClick={() => setWindowMin(w.min)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-r-2 border-black last:border-r-0 transition-colors",
                  windowMin === w.min ? "text-white" : "hover:bg-slate-100",
                )}
                style={
                  windowMin === w.min ? { backgroundColor: BLUE } : undefined
                }
              >
                {w.label}
              </button>
            ))}
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
                  className="xl:col-span-3 lp-in grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-2"
                  style={{ "--d": "0.4s" } as React.CSSProperties}
                >
                  {(["green", "amber", "red"] as Tone[]).map((tone) => {
                    const list = view.groups[tone];
                    const c = TONE[tone];
                    return (
                      <div
                        key={tone}
                        className="border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        style={{ backgroundColor: c.bg }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 border-2 border-black flex items-center justify-center text-white text-base font-semibold tabular-nums"
                            style={{ backgroundColor: c.hex }}
                          >
                            <CountUp value={list.length} delay={400} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-black uppercase tracking-wider">
                              {c.label}
                            </p>
                            <p className="text-xs text-black/60">{c.hint}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {list.length === 0 ? (
                            <span className="text-xs text-black/50">
                              Nobody here
                            </span>
                          ) : (
                            list.map((r) => (
                              <span
                                key={r._id}
                                className="text-[11px] font-medium bg-white border-2 border-black px-1.5 py-0"
                              >
                                {r.name} · {r.done}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="xl:col-span-9 lp-one h-full"
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
                    const agents = Math.max(data.team.length, 1);
                    return (
                      <div className="border-2 border-black bg-white overflow-x-auto h-full flex flex-col">
                        <div className="px-3 py-1.5 border-b-2 border-black bg-slate-100">
                          <p className="text-xs font-semibold text-black">
                            Team performance · last{" "}
                            {WINDOWS.find((w) => w.min === windowMin)?.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Done / target for this window. A conversation is a
                            lead moved out of New Lead; a quotation is a lead
                            moved to the Quotation stage.
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
                                className="border-b border-slate-200"
                              >
                                <td className="px-3 py-1 font-medium text-black">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 border-2 border-black overflow-hidden shrink-0 bg-[#024BAB] text-white flex items-center justify-center text-[10px] font-bold">
                                      {r.avatar ? (
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
                                  </div>
                                </td>
                                {cols.map((c) => {
                                  const x = cell(value(r, c), expected(c));
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
                    );
                  })()}
                </div>
              </div>
              <div className="order-1 lp-in grid grid-cols-1 xl:grid-cols-3 gap-3">
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
                    Monthly leads vs contacted
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthly}
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

                <div className="border-2 border-black bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                    Salesperson Target · This Month
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Assigned vs worked this month (worked = past Pending
                    Contact)
                  </p>
                  {agentMonthly.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-medium">
                      No assigned leads this month
                    </div>
                  ) : (
                    <div
                      style={{
                        height: Math.max(192, agentMonthly.length * 36),
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={agentMonthly}
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
              </div>
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

            {/* Updates in this window */}
            <div className="border-2 border-black bg-white">
              <div className="px-3 py-2 border-b-2 border-black bg-slate-100 flex items-center gap-2">
                <p className="text-sm font-semibold text-black">
                  Updates in the last{" "}
                  {WINDOWS.find((w) => w.min === windowMin)?.label}
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
