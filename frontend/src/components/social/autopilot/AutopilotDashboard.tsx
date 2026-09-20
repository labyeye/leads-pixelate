import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, Plus, Send, ThumbsDown, Zap } from "lucide-react";
import { aiUsageAPI, autopilotAPI, type AIUsage, type CampaignSummary } from "@/services/api";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityChart, COLORS, RangePicker } from "./AutopilotCharts";
import { useCampaigns } from "./CampaignContext";
import { useAutopilot } from "./useAutopilot";
import { useAutopilotStats, type RangeDays } from "./useAutopilotStats";

const daysLeft = (d: string) => Math.max(1, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type Entitlement = { state: string; endsAt: string | null };
function pillFor(enabled: boolean, ent: Entitlement) {
  if (!enabled) return { text: "Paused", cls: "bg-slate-200 text-black" };
  if (ent.state === "trial" && ent.endsAt) return { text: `Free trial · ${daysLeft(ent.endsAt)} day(s) left`, cls: "bg-[#FFDE00] text-black" };
  if (ent.state === "paid") return { text: "Live", cls: "bg-[#00C48C] text-black" };
  return { text: "Needs a plan", cls: "bg-[#FF3366] text-white" };
}

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
    <div className={cn("nb-card p-4 bg-white space-y-1", highlight && "border-[#FA731C] border-4")} data-testid={`kpi-${label}`}>
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

// One row of the campaign list on the "All campaigns" dashboard.
function CampaignCard({
  c,
  ent,
  accounts,
  onOpen,
  onToggle,
  busy,
}: {
  c: CampaignSummary;
  ent: Entitlement;
  accounts: number;
  onOpen: () => void;
  onToggle: (on: boolean) => void;
  busy: boolean;
}) {
  const pill = c.onboarded ? pillFor(c.enabled, ent) : { text: "Setup needed", cls: "bg-orange-100 text-orange-800" };
  return (
    <li className="nb-card p-4 bg-white space-y-2" data-testid={`campaign-${c.name}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="text-left font-display font-bold text-base text-black hover:underline">
          {c.name}
        </button>
        {c.onboarded && (
          <Switch aria-label={`${c.name} on or off`} checked={c.enabled} disabled={busy} onCheckedChange={onToggle} />
        )}
      </div>
      <span className={cn("inline-block px-2 py-0.5 text-[11px] font-bold border-2 border-black", pill.cls)}>{pill.text}</span>
      <p className="text-xs text-muted-foreground">
        {accounts} account{accounts === 1 ? "" : "s"} · {c.monthPosts} post{c.monthPosts === 1 ? "" : "s"} this month
        {c.running ? " · creating a post…" : ""}
      </p>
      {c.lastError && !c.running && <p className="text-xs text-red-700 line-clamp-2">Last run failed: {c.lastError}</p>}
      {!c.onboarded && (
        <Link to={`/social-autopilot/setup?campaign=${c.id}`} className="text-xs font-bold text-[#024BAB] underline">
          Finish setup
        </Link>
      )}
    </li>
  );
}

// Home of Autopilot: what it did, what needs the owner, plan usage and the queue, for one campaign
// or for all of them together.
export function AutopilotDashboard({ toast }: { toast: any }) {
  const { overview, selection, select, reloadOverview, openNewCampaign } = useCampaigns();
  const [days, setDays] = useState<RangeDays>(30);
  const [fast, setFast] = useState(false);
  const all = selection === "all";
  const campaignId = selection && !all ? selection : undefined;
  const { status, reload } = useAutopilot(campaignId ?? null, fast ? 3000 : 15_000);
  const { stats, error, reload: reloadStats } = useAutopilotStats(days, campaignId);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    aiUsageAPI
      .get()
      .then((r) => setUsage(r.data))
      .catch(() => setUsage(null)); // usage is a nice-to-have here
  }, []);

  const running = !!status && (status.running || status.analysis.status === "running");
  if (running !== fast) setFast(running);

  const campaigns = overview?.campaigns ?? [];
  if (!overview || !campaigns.length) {
    return (
      <div className="nb-card p-8 bg-white text-center space-y-3">
        <h2 className="font-display font-bold text-xl text-black">Create your first Autopilot campaign</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A campaign is one brand or set of accounts. Give it a name, tell Autopilot about the brand, add references and
          competitors, and it starts creating posts.
        </p>
        <Button onClick={openNewCampaign}>
          <Plus className="w-4 h-4 mr-1" /> New campaign
        </Button>
      </div>
    );
  }

  if (!all && !status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // A campaign that has not been set up yet: finish setup first (brand intro, scan, logos, schedule).
  if (status && status.onboarded === false) return <Navigate to={`/social-autopilot/setup?campaign=${status.campaign.id}`} replace />;

  const ent = status?.entitlement ?? overview.entitlement;
  const entitled = ent.state === "trial" || ent.state === "paid";
  const enabled = !!status?.settings.enabled;
  const pill = pillFor(enabled, ent);
  const canAdd = campaigns.length < overview.limits.campaigns;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast({ title: ok });
      await Promise.all([reloadOverview(), reloadStats(), status ? reload() : Promise.resolve()]);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const t = stats?.totals;
  const meter = usage?.autopilot;
  const pct = meter && meter.limit > 0 ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;
  const kpiHint = `last ${days} days`;

  return (
    <div className="space-y-6">
      {/* status strip */}
      {all ? (
        <div className="nb-card p-4 bg-white flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <p className="text-sm">
            <b>{campaigns.length}</b> campaigns · <b>{campaigns.filter((c) => c.enabled).length}</b> running · the plan's monthly posts are
            shared by all of them
          </p>
          {canAdd && (
            <Button variant="outline" size="sm" onClick={openNewCampaign}>
              <Plus className="w-4 h-4 mr-1" /> New campaign
            </Button>
          )}
        </div>
      ) : (
        status && (
          <>
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
                        : "Turn this campaign on to start creating posts."}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {enabled && entitled && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === "run" || status.running}
                    onClick={() => run("run", () => autopilotAPI.campaign(status.campaign.id).run(), "Generating a post…")}
                  >
                    {busy === "run" || status.running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                    Create a post now
                  </Button>
                )}
                <label className="flex items-center gap-2 text-sm font-bold">
                  {enabled ? "On" : "Off"}
                  <Switch
                    aria-label="Autopilot on or off"
                    checked={enabled}
                    disabled={busy === "toggle" || (ent.state === "expired" && !enabled)}
                    onCheckedChange={(on) =>
                      run("toggle", () => autopilotAPI.campaign(status.campaign.id).update({ enabled: on }), on ? "Autopilot is on" : "Autopilot paused")
                    }
                  />
                </label>
              </div>
            </div>
            {status.lastError && !status.running && (
              <p className="text-sm text-red-700 border-2 border-red-300 bg-red-50 p-3">
                Last run failed: {status.lastError}. It retries on its own, or use “Create a post now”.
              </p>
            )}
          </>
        )
      )}

      {/* campaigns */}
      {all && (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Campaigns">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              ent={overview.entitlement}
              accounts={c.accountIds.length}
              busy={busy === c.id}
              onOpen={() => select(c.id)}
              onToggle={(on) => run(c.id, () => autopilotAPI.campaign(c.id).update({ enabled: on }), on ? `${c.name} is on` : `${c.name} paused`)}
            />
          ))}
        </ul>
      )}

      {/* numbers */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-bold text-xl text-black">Overview</h2>
          <RangePicker value={days} onChange={setDays} />
        </div>
        {error && !stats && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Created" value={t?.generated ?? "—"} hint={kpiHint} color={COLORS.generated} icon={<Zap className="w-3.5 h-3.5 text-white" />} />
          <Kpi label="Posted" value={t?.posted ?? "—"} hint="published" color={COLORS.posted} icon={<Send className="w-3.5 h-3.5 text-black" />} />
          <Kpi
            label="Needs approval"
            value={t?.pending ?? "—"}
            hint={t?.pending ? "waiting below" : "all clear"}
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
                Shared by all campaigns. Up to {meter.daysPerWeek} posting day{meter.daysPerWeek === 1 ? "" : "s"} a week per campaign
                {meter.campaigns ? `, ${meter.campaigns.used} of ${meter.campaigns.limit} campaigns used` : ""}.
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
        <AutopilotPosts toast={toast} onChange={reloadStats} campaignId={campaignId} campaigns={all ? campaigns : undefined} />
      </section>
    </div>
  );
}
