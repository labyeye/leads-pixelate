import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Phone, Sparkles, Target, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { aiUsageAPI, type AIUsage } from "@/services/api";
import { cn } from "@/lib/utils";

// Plan limits at or above this mean "unlimited" (team members use 999, everything else 999999).
const UNLIMITED = 999_999;
const TEAM_UNLIMITED = 999;
const fmtNum = (n: number) => n.toLocaleString("en-IN");
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function tone(pct: number) {
  if (pct >= 90) return { bar: "bg-[#FF3366]", text: "text-[#FF3366]" };
  if (pct >= 70) return { bar: "bg-[#FA731C]", text: "text-[#FA731C]" };
  return { bar: "bg-[#00C48C]", text: "text-black" };
}

function Meter({
  icon,
  title,
  used,
  limit,
  unit,
  unlimitedAt = UNLIMITED,
  children,
}: {
  icon: JSX.Element;
  title: string;
  used: number;
  limit: number;
  unit: string;
  unlimitedAt?: number;
  children?: React.ReactNode;
}) {
  const unlimited = limit >= unlimitedAt;
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const t = tone(pct);
  return (
    <div className="nb-card p-4 bg-white space-y-3" data-testid={`meter-${title}`}>
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 border-2 border-black bg-[#044BAB] flex items-center justify-center shrink-0">{icon}</span>
        <h3 className="font-display font-bold text-base text-black">{title}</h3>
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black">
          {fmtNum(used)}
          <span className="text-base font-medium text-muted-foreground">
            {" "}
            / {unlimited ? "Unlimited" : fmtNum(limit)} {unit}
          </span>
        </p>
        <div
          className="h-3 mt-2 border-2 border-black bg-black/10"
          role="progressbar"
          aria-label={`${title} used`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full transition-all", t.bar)} style={{ width: `${unlimited ? 0 : pct}%` }} />
        </div>
        <p className={cn("text-xs font-bold mt-1.5", t.text)}>
          {unlimited ? "No limit on your plan" : `${pct}% used · ${fmtNum(Math.max(0, limit - used))} left this month`}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function AIUsagePage() {
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    aiUsageAPI
      .get()
      .then((res) => setUsage(res.data))
      .catch((err) => setError(err.message || "Could not load usage"));
  }, []);

  const near = usage
    ? (
        [
          ["Autopilot posts", usage.autopilot, UNLIMITED],
          ["AI voice calls", usage.aiCalls, UNLIMITED],
          ["Leads", usage.leads, UNLIMITED],
          ["Team members", usage.team, TEAM_UNLIMITED],
        ] as const
      )
        .filter(([, m, at]) => m.limit < at && m.limit > 0 && m.used >= 0.8 * m.limit)
        .map(([name]) => name)
    : [];

  return (
    <AppLayout title="AI Usage">
      <div className="max-w-5xl mx-auto space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!usage && !error && (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
          </div>
        )}

        {usage && (
          <>
            <div className="nb-card p-4 sm:p-5 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your plan</p>
                <h2 className="font-display font-bold text-2xl text-black">
                  {usage.plan.id === "trial" ? "Free trial" : `${capitalise(usage.plan.id)} plan`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {usage.plan.expiresAt ? `${usage.plan.id === "trial" ? "Trial ends" : "Renews / expires"} ${fmtDate(usage.plan.expiresAt)}. ` : ""}
                  Usage resets on {fmtDate(usage.month.resetsAt)}.
                </p>
              </div>
              <Link to="/billing" className="nb-btn bg-black text-white px-4 py-2 text-sm flex items-center gap-1.5 self-start sm:self-auto">
                Change plan <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {near.length > 0 && (
              <div className="flex items-start gap-2 border-2 border-black bg-[#FFDE00]/60 p-3 text-sm font-medium text-black">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  You're close to your plan limit for {near.join(", ")}.{" "}
                  <Link to="/billing" className="underline font-bold">
                    Upgrade
                  </Link>{" "}
                  to keep going.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Meter
                icon={<Sparkles className="w-4 h-4 text-white" />}
                title="Social Autopilot posts"
                used={usage.autopilot.used}
                limit={usage.autopilot.limit}
                unit="posts"
              >
                <ul className="text-xs text-black space-y-1 border-t-2 border-black/10 pt-2">
                  <li>
                    Posting days: up to <b>{usage.autopilot.daysPerWeek}</b> a week per campaign
                  </li>
                  {usage.autopilot.campaigns && (
                    <li>
                      Campaigns:{" "}
                      <b>
                        {usage.autopilot.campaigns.used} / {usage.autopilot.campaigns.limit}
                      </b>{" "}
                      (the posts above are shared by all campaigns)
                    </li>
                  )}
                  <li>
                    Status:{" "}
                    <b>
                      {!usage.autopilot.enabled
                        ? "Off"
                        : usage.autopilot.state === "trial"
                          ? `Free trial until ${fmtDate(usage.autopilot.endsAt)}`
                          : usage.autopilot.state === "paid"
                            ? "Active"
                            : "Needs a plan"}
                    </b>
                    {!usage.autopilot.enabled && (
                      <>
                        {" · "}
                        <Link to="/social-autopilot" className="underline font-bold text-[#024BAB]">
                          Set it up
                        </Link>
                      </>
                    )}
                  </li>
                  <li className="text-muted-foreground">Counts every post Autopilot creates, including ones you ask it to redo.</li>
                </ul>
              </Meter>

              <Meter
                icon={<Phone className="w-4 h-4 text-black" />}
                title="AI voice calls"
                used={usage.aiCalls.used}
                limit={usage.aiCalls.limit}
                unit="calls"
              />
              <Meter
                icon={<Target className="w-4 h-4 text-black" />}
                title="Leads this month"
                used={usage.leads.used}
                limit={usage.leads.limit}
                unit="leads"
              />
              <Meter
                icon={<Users className="w-4 h-4 text-black" />}
                title="Team members"
                used={usage.team.used}
                limit={usage.team.limit}
                unit="members"
                unlimitedAt={TEAM_UNLIMITED}
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
