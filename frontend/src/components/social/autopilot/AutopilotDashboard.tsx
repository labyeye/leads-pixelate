import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, Send, ThumbsDown, Zap } from "lucide-react";
import { aiUsageAPI, autopilotAPI, type AIUsage } from "@/services/api";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityChart, COLORS, RangePicker } from "./AutopilotCharts";
import { useAutopilot } from "./useAutopilot";
import { useAutopilotStats, type RangeDays } from "./useAutopilotStats";

const daysLeft = (d: string) => Math.max(1, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Kpi({
  label,
  value,
  hint,
  color,
  icon,
  highlight,
}: {
  label: string;
  value: number | string;
  hint?: string;
  color: string;
  icon: JSX.Element;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn("nb-card p-4 bg-white space-y-1", highlight && "border-[#FA731C] border-4")}
      data-testid={`kpi-${label}`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span className="w-6 h-6 border-2 border-black flex items-center justify-center" style={{ background: color }}>
          {icon}
        </span>
        {label}
      </div>
      <p className="font-display font-bold text-3xl text-black">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Home of Autopilot: what it did, what needs you, what is coming, and how much of the plan is used.
export function AutopilotDashboard({ toast }: { toast: any }) {
  const [days, setDays] = useState<RangeDays>(30);
  const [fast, setFast] = useState(false);
  const { status, reload } = useAutopilot(fast ? 3000 : 15_000);
  const { stats, error, reload: reloadStats } = useAutopilotStats(days);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [toggling, setToggling] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    aiUsageAPI
      .get()
      .then((r) => setUsage(r.data))
      .catch(() => setUsage(null)); // usage is a nice-to-have here
  }, []);

  const running = !!status && (status.running || status.analysis.status === "running");
  if (running !== fast) setFast(running);

  if (!status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // New here: set Autopilot up first (brand intro, scan, logos, schedule).
  if (status.onboarded === false) return <Navigate to="/social-autopilot/setup" replace />;

  const ent = status.entitlement;
  const entitled = ent.state === "trial" || ent.state === "paid";
  const enabled = status.settings.enabled;
  const pill = !enabled
    ? { text: "Paused", cls: "bg-slate-200 text-black" }
    : ent.state === "trial" && ent.endsAt
      ? { text: `Free trial · ${daysLeft(ent.endsAt)} day(s) left`, cls: "bg-[#FFDE00] text-black" }
      : ent.state === "paid"
        ? { text: "Live", cls: "bg-[#00C48C] text-black" }
        : { text: "Needs a plan", cls: "bg-[#FF3366] text-white" };

  const run = async (fn: () => Promise<unknown>, ok: string, done: () => void) => {
    try {
      await fn();
      toast({ title: ok });
      await Promise.all([reload(), reloadStats()]);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      done();
    }
  };
  const toggle = (on: boolean) => {
    setToggling(true);
    return run(() => autopilotAPI.update({ enabled: on }), on ? "Autopilot is on" : "Autopilot paused", () => setToggling(false));
  };
  const runNow = () => {
    setStarting(true);
    return run(() => autopilotAPI.run(), "Generating a post…", () => setStarting(false));
  };

  const t = stats?.totals;
  const meter = usage?.autopilot;
  const pct = meter && meter.limit > 0 ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* status strip */}
      <div className="nb-card p-4 bg-white flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("px-2.5 py-1 text-xs font-bold border-2 border-black", pill.cls)}>{pill.text}</span>
          <span className="text-sm text-muted-foreground">
            {status.running
              ? "Creating your next post…"
              : stats?.next
                ? `Next: ${when(stats.next.scheduledAt)} · ${stats.next.status === "PENDING_APPROVAL" ? "needs your approval" : "scheduled"}`
                : enabled
                  ? "Nothing scheduled yet. New posts are prepared a day ahead."
                  : "Turn Autopilot on to start creating posts."}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {enabled && entitled && (
            <Button variant="outline" size="sm" onClick={runNow} disabled={starting || status.running}>
              {starting || status.running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              Create a post now
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm font-bold">
            {enabled ? "On" : "Off"}
            <Switch
              aria-label="Autopilot on or off"
              checked={enabled}
              disabled={toggling || (ent.state === "expired" && !enabled)}
              onCheckedChange={toggle}
            />
          </label>
        </div>
      </div>
      {status.lastError && !status.running && (
        <p className="text-sm text-red-700 border-2 border-red-300 bg-red-50 p-3">
          Last run failed: {status.lastError}. It retries on its own, or use “Create a post now”.
        </p>
      )}

      {/* numbers */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-bold text-xl text-black">Overview</h2>
          <RangePicker value={days} onChange={setDays} />
        </div>
        {error && !stats && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Created" value={t?.generated ?? "—"} hint={`last ${days} days`} color={COLORS.generated} icon={<Zap className="w-3.5 h-3.5 text-white" />} />
          <Kpi label="Posted" value={t?.posted ?? "—"} hint="published" color={COLORS.posted} icon={<Send className="w-3.5 h-3.5 text-black" />} />
          <Kpi
            label="Needs approval"
            value={t?.pending ?? "—"}
            hint={t?.pending ? "waiting for you below" : "all clear"}
            color={COLORS.pending}
            icon={<Clock className="w-3.5 h-3.5 text-black" />}
            highlight={!!t?.pending}
          />
          <Kpi label="Scheduled" value={t?.scheduled ?? "—"} hint="going out soon" color={COLORS.scheduled} icon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />} />
          <Kpi label="Rejected" value={t?.rejected ?? "—"} hint={t?.failed ? `${t.failed} failed to post` : "by you"} color={COLORS.rejected} icon={<ThumbsDown className="w-3.5 h-3.5 text-white" />} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="nb-card p-4 bg-white lg:col-span-2 space-y-3">
          <h3 className="font-display font-bold text-base text-black">Posts per day</h3>
          {stats ? <ActivityChart series={stats.series} /> : <div className="h-[260px] animate-pulse bg-black/5" />}
        </section>

        <section className="nb-card p-4 bg-white space-y-3" aria-label="Plan usage">
          <h3 className="font-display font-bold text-base text-black">Plan usage</h3>
          {meter ? (
            <>
              <p className="font-display font-bold text-3xl text-black">
                {meter.used}
                <span className="text-base font-medium text-muted-foreground"> / {meter.limit} posts this month</span>
              </p>
              <div className="h-3 border-2 border-black bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Posts used this month">
                <div className="h-full" style={{ width: `${pct}%`, background: pct >= 90 ? COLORS.rejected : pct >= 70 ? COLORS.pending : COLORS.posted }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Up to {meter.daysPerWeek} posting day{meter.daysPerWeek === 1 ? "" : "s"} a week on your plan.
              </p>
              <Link to="/ai-usage" className="text-xs font-bold text-[#024BAB] underline">
                See all AI usage
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Usage is not available right now.</p>
          )}
          {stats?.rates.approvalRate != null && (
            <p className="text-xs border-t-2 border-black/10 pt-2">
              You approve <b>{stats.rates.approvalRate}%</b> of the posts you review.
            </p>
          )}
        </section>
      </div>

      {/* queue */}
      <section id="queue" className="space-y-3">
        <h2 className="font-display font-bold text-xl text-black">Queue</h2>
        <AutopilotPosts toast={toast} onChange={reloadStats} />
      </section>
    </div>
  );
}
