import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ActivityChart, RangePicker, StatusDonut } from "./AutopilotCharts";
import { useCampaigns } from "./CampaignContext";
import { useAutopilotStats, type RangeDays } from "./useAutopilotStats";

const platformLabel: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn" };
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="nb-card p-4 bg-white" data-testid={`tile-${label}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display font-bold text-2xl text-black">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// How Autopilot performed over a period: output, outcomes, platforms, topics and the review loop.
export function AutopilotReport() {
  const { selection, overview } = useCampaigns();
  const [days, setDays] = useState<RangeDays>(30);
  const campaignId = selection && selection !== "all" ? selection : undefined;
  const { stats, error } = useAutopilotStats(days, campaignId);
  const scope = campaignId ? overview?.campaigns.find((c) => c.id === campaignId)?.name : "All campaigns";

  if (!stats) {
    return error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { totals: t, rates: r } = stats;
  const maxPlatform = Math.max(1, ...stats.platforms.map((p) => p.count));
  const decided = t.posted + t.scheduled + t.rejected + t.failed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-black">Report{scope ? ` · ${scope}` : ""}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(stats.range.since).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to today
          </p>
        </div>
        <RangePicker value={days} onChange={setDays} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Posts created" value={t.generated} />
        <Tile label="Posted" value={t.posted} hint={`${pct(t.posted, t.generated)} of created`} />
        <Tile label="Rejected" value={t.rejected} hint={`${pct(t.rejected, t.generated)} of created`} />
        <Tile label="Failed to post" value={t.failed} hint={t.failed ? "check Connected Accounts" : "none"} />
      </div>

      {!campaignId && stats.byCampaign.length > 0 && (
        <section className="nb-card p-4 bg-white space-y-3" aria-label="Campaign comparison">
          <h3 className="font-display font-bold text-base text-black">By campaign</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b-2 border-black">
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Posted</th>
                  <th className="py-2 pr-4">Rejected</th>
                  <th className="py-2">Posted share</th>
                </tr>
              </thead>
              <tbody>
                {stats.byCampaign.map((c) => (
                  <tr key={c.campaignId} className="border-b border-black/10" data-testid={`row-${c.name}`}>
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4">{c.generated}</td>
                    <td className="py-2 pr-4">{c.posted}</td>
                    <td className="py-2 pr-4">{c.rejected}</td>
                    <td className="py-2">{pct(c.posted, c.generated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="nb-card p-4 bg-white space-y-3">
        <h3 className="font-display font-bold text-base text-black">Activity</h3>
        <ActivityChart series={stats.series} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="nb-card p-4 bg-white space-y-3">
          <h3 className="font-display font-bold text-base text-black">Where the posts ended up</h3>
          <StatusDonut totals={t} />
        </section>

        <section className="nb-card p-4 bg-white space-y-3">
          <h3 className="font-display font-bold text-base text-black">Review loop</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div data-testid="tile-Approval rate">
              <dt className="text-xs text-muted-foreground">Approval rate</dt>
              <dd className="font-display font-bold text-2xl">{r.approvalRate == null ? "—" : `${r.approvalRate}%`}</dd>
              <dd className="text-xs text-muted-foreground">of posts you reviewed</dd>
            </div>
            <div data-testid="tile-Time to approve">
              <dt className="text-xs text-muted-foreground">Time to approve</dt>
              <dd className="font-display font-bold text-2xl">{r.avgApprovalHours == null ? "—" : `${r.avgApprovalHours} h`}</dd>
              <dd className="text-xs text-muted-foreground">average</dd>
            </div>
            <div data-testid="tile-Posts you changed">
              <dt className="text-xs text-muted-foreground">Posts you changed</dt>
              <dd className="font-display font-bold text-2xl">{r.revisedPosts}</dd>
              <dd className="text-xs text-muted-foreground">{pct(r.revisedPosts, t.generated)} of created</dd>
            </div>
            <div data-testid="tile-Change requests">
              <dt className="text-xs text-muted-foreground">Change requests</dt>
              <dd className="font-display font-bold text-2xl">{r.revisions}</dd>
              <dd className="text-xs text-muted-foreground">fixed and regenerated</dd>
            </div>
          </dl>
          {decided === 0 && <p className="text-xs text-muted-foreground">Numbers appear once posts have been reviewed.</p>}
        </section>

        <section className="nb-card p-4 bg-white space-y-3">
          <h3 className="font-display font-bold text-base text-black">By platform</h3>
          {stats.platforms.length ? (
            <ul className="space-y-2">
              {stats.platforms.map((p) => (
                <li key={p.platform} className="text-sm">
                  <div className="flex justify-between">
                    <span>{platformLabel[p.platform] ?? p.platform}</span>
                    <b>{p.count}</b>
                  </div>
                  <div className="h-2.5 border-2 border-black bg-black/10">
                    <div className="h-full bg-[#024BAB]" style={{ width: `${(p.count / maxPlatform) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          )}
        </section>

        <section className="nb-card p-4 bg-white space-y-3">
          <h3 className="font-display font-bold text-base text-black">Topics Autopilot covered</h3>
          {stats.topics.length ? (
            <ol className="space-y-1.5 text-sm list-decimal list-inside">
              {stats.topics.map((x) => (
                <li key={x.topic}>
                  {x.topic} <span className="text-muted-foreground">· {x.count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Topics show up once posts are created.</p>
          )}
        </section>
      </div>
    </div>
  );
}
