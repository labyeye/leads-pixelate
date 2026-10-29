import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardAPI, settingsAPI } from "@/services/api";
import { cn } from "@/lib/utils";

interface TeamRow {
  _id: string;
  name: string;
  role: string;
  calls: number;
  statusUpdates: number;
  done: number;
  connected: number;
  talkSeconds: number;
  lastCallAt: string | null;
  statusChanges: number;
}

interface LiveData {
  now: string;
  windowMin: number;
  targets: { calls: number; perMinutes: number; amberPct: number; countBy: "updates" | "calls" };
  totals: {
    calls: number;
    done: number;
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

const WINDOWS = [
  { min: 60, label: "1 hour" },
  { min: 240, label: "4 hours" },
  { min: 480, label: "8 hours" },
  { min: 1440, label: "24 hours" },
  { min: 10080, label: "7 days" },
];

type Tone = "green" | "amber" | "red";
const TONE: Record<Tone, { hex: string; bg: string; label: string; hint: string }> = {
  green: { hex: "#16a34a", bg: "#dcfce7", label: "On target", hint: "At or above target pace" },
  amber: { hex: "#f59e0b", bg: "#fef3c7", label: "Behind", hint: "Below target, still close" },
  red: { hex: "#dc2626", bg: "#fee2e2", label: "Off pace", hint: "Well below target" },
};

const BLUE = "#024BAB";
const ORANGE = "#f97316";

const toneFor = (pct: number, amberPct: number): Tone =>
  pct >= 100 ? "green" : pct >= amberPct ? "amber" : "red";

function ago(iso: string | null, nowIso: string) {
  if (!iso) return "no calls yet";
  const s = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 1000));
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
  m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : m % 60 === 0 ? `${m / 60} hr` : `${m} min`;

export default function LivePerformancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [windowMin, setWindowMin] = useState(60);
  const [live, setLive] = useState(true);
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Target editor draft; null = not editing.
  const [draft, setDraft] = useState<{ calls: string; perMinutes: string; amberPct: string; countBy: "updates" | "calls" } | null>(null);
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
    return { perAgent, rows, teamTarget, teamPct, groups, teamTone: toneFor(teamPct, targets.amberPct) };
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
    });

  const saveTargets = async () => {
    if (!draft) return;
    const calls = Math.round(Number(draft.calls));
    const perMinutes = Math.round(Number(draft.perMinutes));
    const amberPct = Math.round(Number(draft.amberPct));
    if (!(calls >= 1 && calls <= 10000) || !(perMinutes >= 5 && perMinutes <= 10080) || !(amberPct >= 1 && amberPct <= 99)) {
      toast({
        title: "Check the target values",
        description: "Calls 1–10000, time 5–10080 minutes, amber threshold 1–99%.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.update({ callTargets: { calls, perMinutes, amberPct, countBy: draft.countBy } });
      toast({ title: "Target saved", description: `${calls} calls per ${minutesLabel(perMinutes)} per agent.` });
      setDraft(null);
      load(true);
    } catch (e: any) {
      toast({ title: "Couldn't save target", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  const t = data?.targets;
  const unit = t?.countBy === "calls" ? "calls" : "status updates";
  const connectRate =
    data && data.totals.calls ? Math.round((data.totals.connected / data.totals.calls) * 100) : 0;

  return (
    <AppLayout title="Live Performance">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold text-black">Live Performance</h1>
            <p className="text-xs text-muted-foreground">
              Rolling last {WINDOWS.find((w) => w.min === windowMin)?.label} ·{" "}
              {data ? `updated ${ago(data.now, new Date().toISOString())}` : "loading…"}
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
                style={windowMin === w.min ? { backgroundColor: BLUE } : undefined}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setLive((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-2 border-black",
              live ? "bg-green-100 text-green-800" : "bg-white text-muted-foreground",
            )}
          >
            {live ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {live ? "LIVE · 10s" : "PAUSED"}
          </button>
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading} className="gap-1.5 text-xs h-8 border-2 border-black">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
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
            {/* Target setter */}
            <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {draft ? (
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Count">
                    <select
                      value={draft.countBy}
                      onChange={(e) => setDraft({ ...draft, countBy: e.target.value as "updates" | "calls" })}
                      className="h-9 border-2 border-black bg-white px-2 text-sm"
                    >
                      <option value="updates">Lead status updates</option>
                      <option value="calls">CRM calls only</option>
                    </select>
                  </Field>
                  <Field label="Target per agent">
                    <Input type="number" min={1} value={draft.calls} onChange={(e) => setDraft({ ...draft, calls: e.target.value })} className="h-9 w-28 border-2 border-black" />
                  </Field>
                  <Field label="In (minutes)">
                    <Input type="number" min={5} value={draft.perMinutes} onChange={(e) => setDraft({ ...draft, perMinutes: e.target.value })} className="h-9 w-28 border-2 border-black" />
                  </Field>
                  <Field label="Amber from (% of target)">
                    <Input type="number" min={1} max={99} value={draft.amberPct} onChange={(e) => setDraft({ ...draft, amberPct: e.target.value })} className="h-9 w-28 border-2 border-black" />
                  </Field>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveTargets} disabled={saving} className="gap-1.5 h-9 border-2 border-black" style={{ backgroundColor: BLUE }}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save target
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDraft(null)} className="h-9 border-2 border-black">
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground basis-full">
                    Green at 100% or more of target · amber from {draft.amberPct || "…"}% · red below that.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: ORANGE }}>
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="mr-auto">
                    <p className="text-sm font-medium text-black">
                      Target: {t.calls} {unit} per {minutesLabel(t.perMinutes)} per agent
                    </p>
                    <p className="text-xs text-muted-foreground">
                      For this {WINDOWS.find((w) => w.min === windowMin)?.label} window that is{" "}
                      <b>{Math.round(view.perAgent * 10) / 10}</b> calls each and{" "}
                      <b>{Math.round(view.teamTarget)}</b> for the team ({data.team.length} agents). Amber from {t.amberPct}%.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={startEdit} className="border-2 border-black h-8 text-xs">
                    Change target
                  </Button>
                </div>
              )}
            </div>

            {/* Three status buckets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["green", "amber", "red"] as Tone[]).map((tone) => {
                const list = view.groups[tone];
                const c = TONE[tone];
                return (
                  <div key={tone} className="border-2 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: c.bg }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 border-2 border-black flex items-center justify-center text-white text-xl font-semibold tabular-nums" style={{ backgroundColor: c.hex }}>
                        {list.length}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-black uppercase tracking-wider">{c.label}</p>
                        <p className="text-xs text-black/60">{c.hint}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
                      {list.length === 0 ? (
                        <span className="text-xs text-black/50">Nobody here</span>
                      ) : (
                        list.map((r) => (
                          <span key={r._id} className="text-xs font-medium bg-white border-2 border-black px-2 py-0.5">
                            {r.name} · {r.done}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Team progress */}
            <div className="border-2 border-black bg-white p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Team progress to target</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: TONE[view.teamTone].hex }}>
                  {data.totals.done} / {Math.round(view.teamTarget)} {unit} · {Math.round(view.teamPct)}%
                </p>
              </div>
              <Bar pct={view.teamPct} color={TONE[view.teamTone].hex} tall />
            </div>

            {/* Who hit the target and who didn't */}
            {(() => {
              const met = view.rows.filter((r) => r.tone === "green");
              const notMet = view.rows
                .filter((r) => r.tone !== "green")
                .sort((a, b) => a.pct - b.pct);
              const need = (r: (typeof view.rows)[number]) =>
                Math.max(1, Math.ceil(view.perAgent - r.done));
              return (
                <div className="border-2 border-black bg-white">
                  <div className="px-4 py-3 border-b-2 border-black bg-slate-100 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-black">
                      {met.length} of {view.rows.length} agents met the target
                    </p>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round(view.perAgent * 10) / 10} calls each in this window)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x-2 divide-black">
                    <div className="p-4">
                      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: TONE.green.hex }}>
                        Met target ({met.length})
                      </p>
                      {met.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
                      <ul className="space-y-1.5">
                        {met.map((r) => (
                          <li key={r._id} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-black">{r.name}</span>
                            <span className="tabular-nums text-xs" style={{ color: TONE.green.hex }}>
                              {r.done} {unit} · +{Math.round((r.done - view.perAgent) * 10) / 10} ahead
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-medium uppercase tracking-wider mb-2 text-red-600">
                        Not met ({notMet.length})
                      </p>
                      {notMet.length === 0 && <p className="text-sm text-muted-foreground">Everyone is on target.</p>}
                      <ul className="space-y-1.5">
                        {notMet.map((r) => (
                          <li key={r._id} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-black flex items-center gap-2">
                              <span className="w-2.5 h-2.5 border border-black" style={{ backgroundColor: TONE[r.tone].hex }} />
                              {r.name}
                            </span>
                            <span className="tabular-nums text-xs" style={{ color: TONE[r.tone].hex }}>
                              {r.done} {unit} · {need(r)} short
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <StatCard icon={Inbox} label="Pending worked" value={data.totals.pendingWorked} sub={`${data.totals.pendingNow} still pending`} color="#e11d48" />
              <StatCard icon={PhoneCall} label="CRM calls" value={data.totals.calls} color={BLUE} />
              <StatCard icon={PhoneIncoming} label="Connected" value={data.totals.connected} sub={`${connectRate}% pick-up`} color="#16a34a" />
              <StatCard icon={Clock} label="Talk time" value={talk(data.totals.talkSeconds)} color="#7c3aed" />
              <StatCard icon={UserPlus} label="New leads" value={data.totals.newLeads} color={ORANGE} />
              <StatCard icon={Repeat} label="Lead updates" value={data.totals.statusChanges} color="#0891b2" />
              <StatCard icon={Sparkles} label="AI calls" value={data.totals.aiCalls} color="#db2777" />
            </div>

            {/* Trend + recent leads */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 border-2 border-black bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{t?.countBy === "calls" ? "Calls" : "Status updates"} & new leads trend</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ border: "2px solid #000", borderRadius: 0, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="calls" name={t?.countBy === "calls" ? "Calls" : "Status updates"} stroke={BLUE} strokeWidth={2} fill="url(#gCalls)" />
                      <Area type="monotone" dataKey="leads" name="New leads" stroke={ORANGE} strokeWidth={2} fill="url(#gLeads)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border-2 border-black bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Recent leads</p>
                <ul className="divide-y divide-slate-200">
                  {data.recentLeads.length === 0 && <li className="text-sm text-muted-foreground py-4">No leads yet.</li>}
                  {data.recentLeads.map((l) => (
                    <li key={l._id} className="py-2 flex items-start gap-2">
                      <span className="mt-1.5 w-2 h-2 shrink-0" style={{ backgroundColor: BLUE }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-black truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {l.source} · {title(l.status)} · {l.assignedTo?.name || "Unassigned"}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{ago(l.createdAt, data.now)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Updates in this window */}
            <div className="border-2 border-black bg-white">
              <div className="px-4 py-3 border-b-2 border-black bg-slate-100 flex items-center gap-2">
                <p className="text-sm font-semibold text-black">
                  Updates in the last {WINDOWS.find((w) => w.min === windowMin)?.label}
                </p>
                <span className="text-xs text-muted-foreground">
                  {data.totals.statusChanges} updates · {data.totals.pendingWorked} leads moved out of Pending Contact
                </span>
              </div>
              {data.updates.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No lead updates in this window.</p>
              ) : (
                <ul className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                  {data.updates.map((u, i) => {
                    const dot =
                      u.action === "STATUS_UPDATED" ? BLUE : u.action === "NOTE_ADDED" ? "#7c3aed" : u.action === "LEAD_CONVERTED" ? "#16a34a" : "#64748b";
                    return (
                      <li key={`${u.leadId}-${u.at}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
                        <span className="w-2.5 h-2.5 shrink-0 border border-black" style={{ backgroundColor: dot }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-black truncate">{u.description}</p>
                          <p className="text-xs text-muted-foreground truncate">by {u.by}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{ago(u.at, data.now)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Agent table */}
            <div className="border-2 border-black bg-white overflow-x-auto">
              <div className="hidden md:grid grid-cols-[1.4fr_2fr_80px_90px_90px_110px] gap-x-4 px-4 py-2.5 bg-slate-100 border-b-2 border-black text-[11px] font-medium text-muted-foreground uppercase tracking-wider min-w-[760px]">
                <span>Agent</span>
                <span>Progress to target</span>
                <span className="text-right">Connected</span>
                <span className="text-right">Talk time</span>
                <span className="text-right">Updates</span>
                <span className="text-right">Last call</span>
              </div>
              {view.rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">No active agents found.</p>}
              {view.rows.map((r) => (
                <div key={r._id} className="grid grid-cols-1 md:grid-cols-[1.4fr_2fr_80px_90px_90px_110px] gap-x-4 gap-y-1 px-4 py-3 items-center border-b border-slate-200 last:border-b-0 min-w-[760px] md:min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 shrink-0 border border-black" style={{ backgroundColor: TONE[r.tone].hex }} />
                    <span className="text-sm font-medium text-black truncate">{r.name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{r.role.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Bar pct={r.pct} color={TONE[r.tone].hex} />
                    </div>
                    <span className="text-xs tabular-nums w-24 text-right text-black">
                      {r.done}/{Math.round(view.perAgent * 10) / 10} · {Math.round(r.pct)}%
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-right">{r.connected}</span>
                  <span className="text-sm tabular-nums text-right">{talk(r.talkSeconds)}</span>
                  <span className="text-sm tabular-nums text-right">{r.statusChanges}</span>
                  <span className="text-xs text-muted-foreground text-right">{ago(r.lastCallAt, data.now)}</span>
                </div>
              ))}
            </div>

            {/* Pipeline snapshot */}
            <div className="border-2 border-black bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Pipeline right now</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, n]) => (
                    <span key={s} className="text-xs border-2 border-black px-2 py-1 bg-slate-50">
                      {title(s)} <b className="tabular-nums ml-1">{n}</b>
                    </span>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Bar({ pct, color, tall }: { pct: number; color: string; tall?: boolean }) {
  return (
    <div className={cn("relative w-full border-2 border-black bg-slate-100", tall ? "h-5" : "h-3.5")}>
      <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
    </div>
  );
}
