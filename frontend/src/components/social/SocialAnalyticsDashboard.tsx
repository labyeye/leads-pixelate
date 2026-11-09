import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Eye,
  Facebook,
  Heart,
  Image as ImageIcon,
  Instagram,
  Loader2,
  Users,
  Zap,
} from "lucide-react";
import { socialAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { cn } from "@/lib/utils";

const BLUE = "#024BAB";
const ORANGE = "#FA731C";
const GREEN = "#1FA85A";
const PURPLE = "#8B5CF6";
const INK = "#0A0A0A";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

const num = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-IN");
const compact = (n: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);

const score = (e: any = {}) =>
  (e.likes || 0) + (e.comments || 0) + (e.saved || 0) + (e.shares || 0);

/** Counts up to `value` once it arrives, so cards feel alive on load. */
function useCountUp(value: number, ms = 900) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / ms, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Fades a block up with a stagger. */
function Reveal({
  i = 0,
  className,
  children,
}: {
  i?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("animate-fade-in motion-reduce:animate-none", className)}
      style={{ animationDelay: `${i * 70}ms` }}
    >
      {children}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full border-2 border-black bg-white p-4 nb-shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex border-2 border-black bg-white">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === o.value ? "bg-[#024BAB] text-white" : "hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  const pct = before ? Math.round(((now - before) / before) * 100) : 100;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 border border-black px-1.5 py-0.5 text-[10px] font-medium",
        up ? "bg-[#DDF5E7] text-[#12703A]" : "bg-[#FDE2E2] text-[#B42318]",
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  now,
  before,
  icon: Icon,
  color,
  i,
  note,
}: {
  label: string;
  value: number;
  now?: number;
  before?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  i: number;
  note: string;
}) {
  const shown = useCountUp(value);
  return (
    <Reveal i={i}>
      <div className="group border-2 border-black bg-white p-4 nb-shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div
            className="flex h-9 w-9 items-center justify-center border-2 border-black transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <p className="text-3xl font-medium leading-none">{compact(shown)}</p>
          {now !== undefined && before !== undefined && <Delta now={now} before={before} />}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{note}</p>
      </div>
    </Reveal>
  );
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: any }> = {
  instagram: { label: "Instagram", color: PURPLE, icon: Instagram },
  facebook: { label: "Facebook", color: BLUE, icon: Facebook },
  linkedin: { label: "LinkedIn", color: "#0A66C2", icon: LinkedInIcon },
};

const ChartTip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div className="border-2 border-black bg-white px-2.5 py-1.5 text-xs nb-shadow-sm">
      <p className="mb-0.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {num(p.value)}
        </p>
      ))}
    </div>
  ) : null;

export function SocialAnalyticsDashboard({
  isAdmin,
  toast,
}: {
  isAdmin: boolean;
  toast: any;
}) {
  const [data, setData] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [followers, setFollowers] = useState<any>(null);
  const [range, setRange] = useState<30 | 90 | 180>(30);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ig-import-accounts") || "[]");
    } catch {
      return [];
    }
  });

  const openPicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) return;
    socialAPI
      .getAccounts()
      .then((r) => {
        const list = (r.data || []).filter((a: any) => a.platform === "instagram" && a.isActive !== false);
        setIgAccounts(list);
        // Keep only ticks that still exist; first time, nothing is ticked.
        setPicked((cur) => cur.filter((id) => list.some((a: any) => a._id === id)));
      })
      .catch(() => {});
  };
  const togglePicked = (id: string) =>
    setPicked((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem("ig-import-accounts", JSON.stringify(next));
      } catch {
        /* remembering the choice is a convenience only */
      }
      return next;
    });

  const load = useCallback(() => {
    socialAPI
      .getAnalytics()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Live from Meta, so it loads on its own and fills the charts when ready.
    socialAPI.getEngagement().then((r) => setEngagement(r.data)).catch(() => {});
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    socialAPI.getFollowers(range).then((r) => setFollowers(r.data)).catch(() => {});
  }, [range]);

  const importInstagram = async () => {
    if (!picked.length) {
      toast({ title: "Pick at least one account to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    setPickerOpen(false);
    try {
      const res = await socialAPI.importInstagram(picked);
      toast({
        title: "Instagram synced",
        description: `${res.data.created} new post(s) imported, ${res.data.updated} refreshed.`,
      });
      load();
    } catch (err: any) {
      toast({
        title: "Could not import from Instagram",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = () => {
    const rows = engagement?.rows || [];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;
    const csv = [
      ["Posted", "Type", "Platforms", "Caption", "Views", "Reach", "Likes", "Comments", "Saved", "Shares", "Link"].join(","),
      ...rows.map((r: any) =>
        [
          r.postedAt ? new Date(r.postedAt).toISOString().slice(0, 10) : "",
          r.postType,
          (r.platforms || []).join("/"),
          r.caption,
          r.engagement?.views,
          r.engagement?.reach,
          r.engagement?.likes,
          r.engagement?.comments,
          r.engagement?.saved,
          r.engagement?.shares,
          r.permalink,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `social-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totals = engagement?.totals;
  const trends = engagement?.trends;
  const totalEngagement = (totals?.likes || 0) + (totals?.comments || 0) + (totals?.saved || 0) + (totals?.shares || 0);

  const growth = useMemo(
    () =>
      (followers?.points || []).map((p: any) => ({
        label: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        Followers: p.total ?? 0,
        Gained: Math.max(p.gained, 0),
      })),
    [followers],
  );

  const mix = [
    { name: "Likes", value: totals?.likes || 0, color: ORANGE },
    { name: "Comments", value: totals?.comments || 0, color: BLUE },
    { name: "Saved", value: totals?.saved || 0, color: GREEN },
    { name: "Shares", value: totals?.shares || 0, color: PURPLE },
  ];
  const mixTotal = mix.reduce((a, m) => a + m.value, 0);

  const byType = Object.entries(engagement?.byType || {}).map(([type, v]: [string, any]) => ({
    type: type[0].toUpperCase() + type.slice(1),
    Posts: v.count,
    Engagement: (v.likes || 0) + (v.comments || 0),
  }));

  const heat = engagement?.heatmap as { avg: number; count: number }[][] | undefined;
  const heatMax = Math.max(1, ...(heat || []).flat().map((c) => c.avg));
  const best = useMemo(() => {
    let b: { d: number; s: number; avg: number } | null = null;
    (heat || []).forEach((row, d) =>
      row.forEach((c, s) => {
        if (c.count && (!b || c.avg > b.avg)) b = { d, s, avg: c.avg };
      }),
    );
    return b;
  }, [heat]);

  const statuses: Record<string, number> = data?.statusBreakdown || {};
  const statusTotal = Object.values(statuses).reduce((a, b) => a + b, 0) || 1;
  const statusRows = [
    { key: "POSTED", label: "Posted", color: GREEN },
    { key: "SCHEDULED", label: "Scheduled", color: PURPLE },
    { key: "PENDING_APPROVAL", label: "Pending", color: ORANGE },
    { key: "DRAFT", label: "Draft", color: "#9CA3AF" },
    { key: "FAILED", label: "Failed", color: "#DC2626" },
  ].filter((s) => statuses[s.key]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">Social Media Analytics</h2>
            <p className="text-xs text-muted-foreground">
              Performance, engagement and growth across your connected platforms.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!engagement?.rows?.length}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            {isAdmin && (
              <Popover open={pickerOpen} onOpenChange={openPicker}>
                <PopoverTrigger asChild>
                  <Button size="sm" disabled={importing}>
                    {importing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Instagram className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {importing ? "Importing…" : "Import from Instagram"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 border-2 border-black p-0 nb-shadow-sm">
                  <div className="flex items-center justify-between border-b-2 border-black px-3 py-2">
                    <p className="text-xs font-medium">Choose accounts to import</p>
                    <button
                      className="text-[11px] text-[#024BAB] hover:underline"
                      onClick={() => {
                        const all = picked.length === igAccounts.length ? [] : igAccounts.map((a) => a._id);
                        setPicked(all);
                        try {
                          localStorage.setItem("ig-import-accounts", JSON.stringify(all));
                        } catch {
                          /* convenience only */
                        }
                      }}
                    >
                      {picked.length === igAccounts.length && igAccounts.length ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {igAccounts.map((a) => (
                      <label
                        key={a._id}
                        className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 text-xs last:border-b-0 hover:bg-muted/50"
                      >
                        <Checkbox checked={picked.includes(a._id)} onCheckedChange={() => togglePicked(a._id)} />
                        {a.profilePicture ? (
                          <img src={a.profilePicture} alt="" className="h-6 w-6 rounded-full border border-black object-cover" />
                        ) : (
                          <span className="h-6 w-6 rounded-full border border-black bg-muted" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{a.accountName}</span>
                      </label>
                    ))}
                    {!igAccounts.length && (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No Instagram accounts connected.
                      </p>
                    )}
                  </div>
                  <div className="border-t-2 border-black p-2">
                    <Button size="sm" className="w-full" onClick={importInstagram} disabled={!picked.length}>
                      Import {picked.length ? `${picked.length} account${picked.length > 1 ? "s" : ""}` : ""}
                    </Button>
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                      Latest 100 posts per account.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          i={1}
          label="Total Followers"
          value={followers?.current || 0}
          now={followers?.current || 0}
          before={(followers?.current || 0) - (followers?.gainedInRange || 0)}
          icon={Users}
          color={BLUE}
          note={`${followers?.gainedInRange >= 0 ? "+" : ""}${num(followers?.gainedInRange)} in ${range} days`}
        />
        <StatCard
          i={2}
          label="Total Engagement"
          value={totalEngagement}
          now={trends?.current?.engagement}
          before={trends?.previous?.engagement}
          icon={Heart}
          color={ORANGE}
          note="Likes, comments, saves, shares · vs last 30 days"
        />
        <StatCard
          i={3}
          label="Total Reach"
          value={totals?.reach || 0}
          now={trends?.current?.reach}
          before={trends?.previous?.reach}
          icon={Eye}
          color={GREEN}
          note="Unique accounts reached · vs last 30 days"
        />
        <StatCard
          i={4}
          label="Total Views"
          value={totals?.views || 0}
          now={trends?.current?.views}
          before={trends?.previous?.views}
          icon={BarChart3}
          color={PURPLE}
          note={`${num(totals?.published)} published posts`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal i={5} className="lg:col-span-1">
          <Panel
            title="Audience Growth"
            action={
              <Segmented
                value={range}
                onChange={(v) => setRange(Number(v) as 30 | 90 | 180)}
                options={[
                  { value: 30, label: "30D" },
                  { value: 90, label: "90D" },
                  { value: 180, label: "6M" },
                ]}
              />
            }
          >
            <div className="h-52">
              {growth.length ? (
                <ResponsiveContainer>
                  <AreaChart data={growth} margin={{ left: -18, right: 4, top: 4 }}>
                    <defs>
                      <linearGradient id="gFollowers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={compact} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="Followers" stroke={BLUE} strokeWidth={2.5} fill="url(#gFollowers)" animationDuration={1200} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="Follower history starts after the first sync." />
              )}
            </div>
          </Panel>
        </Reveal>

        <Reveal i={6}>
          <Panel title="Engagement by Post Type">
            <div className="h-52">
              {byType.some((t) => t.Posts) ? (
                <ResponsiveContainer>
                  <BarChart data={byType} margin={{ left: -18, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="type" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(250,115,28,0.08)" }} />
                    <Bar dataKey="Engagement" fill={ORANGE} stroke={INK} strokeWidth={2} animationDuration={1000} />
                    <Bar dataKey="Posts" fill={BLUE} stroke={INK} strokeWidth={2} animationDuration={1300} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text={engagement ? "No published posts yet." : "Loading…"} />
              )}
            </div>
          </Panel>
        </Reveal>

        <Reveal i={7}>
          <Panel title="Engagement Mix">
            <div className="flex h-52 items-center gap-3">
              {mixTotal ? (
                <>
                  <div className="relative h-40 w-40 shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={mix} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke={INK} strokeWidth={2} animationDuration={1200}>
                          {mix.map((m) => (
                            <Cell key={m.name} fill={m.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-lg font-medium leading-none">{compact(mixTotal)}</p>
                      <p className="text-[10px] text-muted-foreground">interactions</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    {mix.map((m) => (
                      <div key={m.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 border border-black" style={{ background: m.color }} />
                        <span className="text-muted-foreground">{m.name}</span>
                        <span className="font-medium">{Math.round((m.value / mixTotal) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty text={engagement ? "No interactions yet." : "Loading…"} />
              )}
            </div>
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal i={8}>
          <Panel title="Platform Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-black text-left text-muted-foreground">
                    <th className="py-2 font-medium">Platform</th>
                    <th className="py-2 font-medium">Followers</th>
                    <th className="py-2 font-medium">Posts</th>
                    <th className="py-2 font-medium">Engagement</th>
                    <th className="py-2 font-medium">Reach</th>
                    <th className="py-2 text-right font-medium">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {(engagement?.platforms || []).map((p: any, i: number) => {
                    const m = PLATFORM_META[p.platform];
                    const Icon = m.icon;
                    return (
                      <tr
                        key={p.platform}
                        className="animate-fade-in border-b border-border transition-colors hover:bg-muted/40 motion-reduce:animate-none"
                        style={{ animationDelay: `${400 + i * 90}ms` }}
                      >
                        <td className="py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 border-2 border-black px-2 py-0.5 font-medium text-white"
                            style={{ background: m.color }}
                          >
                            <Icon className="h-3 w-3" />
                            {m.label}
                          </span>
                        </td>
                        <td className="py-2.5">{compact(p.followers)}</td>
                        <td className="py-2.5">{p.posts}</td>
                        <td className="py-2.5">{compact(p.engagement)}</td>
                        <td className="py-2.5">{compact(p.reach)}</td>
                        <td className="py-2.5 text-right">
                          {p.followersBefore === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Delta now={p.followers} before={p.followersBefore} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!engagement && <p className="py-4 text-xs text-muted-foreground">Loading…</p>}
            </div>
          </Panel>
        </Reveal>

        <Reveal i={9}>
          <Panel
            title="Optimal Posting Time"
            action={
              best && (
                <span className="inline-flex items-center gap-1 border border-black bg-[#FFF1E6] px-2 py-0.5 text-[10px] font-medium">
                  <Zap className="h-3 w-3 text-[#FA731C]" />
                  Best: {DAYS[best.d]} {SLOTS[best.s]}
                </span>
              )
            }
          >
            {heat && best ? (
              <div>
                <div className="grid grid-cols-[28px_repeat(8,1fr)] gap-1">
                  <span />
                  {SLOTS.map((s) => (
                    <span key={s} className="text-center text-[9px] text-muted-foreground">
                      {s}
                    </span>
                  ))}
                  {heat.map((row, d) => (
                    <div key={d} className="contents">
                      <span className="self-center text-[10px] text-muted-foreground">{DAYS[d]}</span>
                      {row.map((c, s) => (
                        <div
                          key={s}
                          title={c.count ? `${DAYS[d]} ${SLOTS[s]} · avg ${c.avg} interactions · ${c.count} post(s)` : "No posts"}
                          className={cn(
                            "aspect-[4/3] animate-pop-in border transition-transform hover:z-10 hover:scale-125 motion-reduce:animate-none",
                            best.d === d && best.s === s ? "border-2 border-black" : "border-transparent",
                          )}
                          style={{
                            animationDelay: `${(d * 8 + s) * 14}ms`,
                            background: c.count
                              ? `rgba(250,115,28,${0.15 + 0.85 * (c.avg / heatMax)})`
                              : "#F3F4F6",
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  Average interactions per post by day and time (IST). Darker is better; grey means nothing posted then.
                </p>
              </div>
            ) : (
              <Empty text={engagement ? "Publish a few posts to see your best times." : "Loading…"} />
            )}
          </Panel>
        </Reveal>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal i={10}>
          <Panel title="Posts by Status">
            <div className="space-y-3">
              {statusRows.map((s, i) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground">{statuses[s.key]}</span>
                  </div>
                  <div className="h-2.5 border border-black bg-muted">
                    <div
                      className="h-full transition-[width] duration-1000 ease-out"
                      style={{
                        width: `${Math.round((statuses[s.key] / statusTotal) * 100)}%`,
                        background: s.color,
                        transitionDelay: `${i * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {!statusRows.length && <Empty text="No posts yet." />}
            </div>
          </Panel>
        </Reveal>

        <Reveal i={11} className="lg:col-span-2">
          <Panel title="Top Posts">
            <div className="space-y-2.5">
              {(engagement?.topPosts || []).map((p: any, i: number) => (
                <a
                  key={p._id}
                  href={p.permalink || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex animate-fade-in items-center gap-3 border border-border p-2 text-xs transition-all hover:-translate-y-0.5 hover:border-black hover:bg-muted/30 motion-reduce:animate-none"
                  style={{ animationDelay: `${500 + i * 80}ms` }}
                >
                  <span className="w-5 text-center font-medium text-muted-foreground">{i + 1}</span>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 border border-black object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-muted">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.caption}</p>
                    <p className="text-muted-foreground">
                      {p.postedAt ? new Date(p.postedAt).toLocaleDateString("en-IN") : ""}
                      {p.source === "imported" ? " · Imported" : ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 grid-cols-4 gap-4 text-center sm:grid">
                    {[
                      ["Views", p.engagement?.views],
                      ["Likes", p.engagement?.likes],
                      ["Cmts", p.engagement?.comments],
                      ["Saved", p.engagement?.saved],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <p className="text-sm font-medium">{compact(Number(v) || 0)}</p>
                        <p className="text-muted-foreground">{k}</p>
                      </div>
                    ))}
                  </div>
                </a>
              ))}
              {!engagement?.topPosts?.length && (
                <Empty text={engagement ? "No published posts yet. Import from Instagram to see them here." : "Loading…"} />
              )}
            </div>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[60px] w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
