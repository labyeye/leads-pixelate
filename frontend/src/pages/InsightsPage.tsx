import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardAPI, settingsAPI } from "@/services/api";
import { cn } from "@/lib/utils";

const BLUE = "#024BAB";
const GREEN = "#00C48C";
const ORANGE = "#FA731C";

// ₹ in lakh / crore, the way owners read it.
const inr = (n: number) => {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
};
const mins = (m: number) =>
  m >= 1440
    ? `${(m / 1440).toFixed(1)} d`
    : m >= 60
      ? `${(m / 60).toFixed(1)} h`
      : `${m} min`;

function Card({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
        className,
      )}
    >
      <header className="border-b-2 border-black bg-slate-100 px-3 py-2">
        <h3 className="text-sm font-semibold text-black">{title}</h3>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </header>
      <div className="flex flex-1 flex-col justify-center p-3">{children}</div>
    </section>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="col-span-12 mt-2 flex items-baseline gap-2 border-b-2 border-black pb-1 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-black">
        {title}
      </h2>
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="border-2 border-black bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="text-xl font-semibold tabular-nums mt-0.5"
        style={{ color: tone }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
    {text}
  </div>
);

const DAYS = [30, 90, 180, 365];
const tooltipStyle = {
  border: "2px solid #000",
  borderRadius: 0,
  fontSize: 12,
};
const PIE = [
  "#024BAB",
  "#FA731C",
  "#00C48C",
  "#8B5CF6",
  "#EF4444",
  "#0EA5E9",
  "#F59E0B",
  "#64748B",
];
const ChartBox = ({
  h = 220,
  children,
}: {
  h?: number;
  children: React.ReactElement;
}) => (
  <div style={{ height: h }}>
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  </div>
);
// Donut with a legend underneath: for "share of total" questions.
function Donut({
  data,
  empty,
}: {
  data: { name: string; value: number }[];
  empty: string;
}) {
  const total = data.reduce((a, r) => a + r.value, 0);
  if (!total) return <Empty text={empty} />;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={2}
              stroke="#0A0A0A"
              strokeWidth={2}
            >
              {data.map((r, i) => (
                <Cell key={r.name} fill={PIE[i % PIE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-semibold leading-none tabular-nums">
            {total}
          </p>
          <p className="text-[10px] text-muted-foreground">total</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {data.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 border border-black"
              style={{ background: PIE[i % PIE.length] }}
            />
            <span className="truncate">{r.name}</span>
            <span className="ml-auto tabular-nums font-medium">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One page for everything the owner needs: target progress, funnel, sources, team, why leads are lost.
export default function InsightsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [days, setDays] = useState(90);
  const [d, setD] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const loadTargets = () =>
    dashboardAPI
      .getTargets()
      .then((r) => setT(r.data))
      .catch(() => {});
  useEffect(() => {
    if (!isAdmin) return;
    loadTargets();
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    dashboardAPI
      .getInsights(days)
      .then((r) => setD(r.data))
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [days, isAdmin]);

  const funnelRows = useMemo(() => {
    if (!d) return [];
    const f = d.funnel;
    const steps = [
      ["Leads", f.leads],
      ["Contacted", f.contacted],
      ["Discussion", f.discussion],
      ["Visit / Demo", f.visit],
      ["Quotation", f.quotation],
      ["Won", f.won],
    ] as [string, number][];
    return steps.map(([name, n], i) => ({
      name,
      n,
      ofTop: f.leads ? Math.round((n / f.leads) * 100) : 0,
      ofPrev:
        i === 0
          ? 100
          : steps[i - 1][1]
            ? Math.round((n / steps[i - 1][1]) * 100)
            : 0,
    }));
  }, [d]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const remaining = t ? Math.max(0, t.target - t.month.won) : 0;
  const pctDone = t?.target
    ? Math.min(100, Math.round((t.month.won / t.target) * 100))
    : 0;
  const beDone = t?.breakEven
    ? Math.min(100, Math.round((t.month.won / t.breakEven) * 100))
    : 0;
  const showMachines = d?.preset?.insights?.items !== false;

  return (
    <AppLayout title="Insights">
      <div className="p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-semibold text-black">Insights</h1>
          <div className="flex border-2 border-black bg-white">
            {DAYS.map((x) => (
              <button
                key={x}
                onClick={() => setDays(x)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-r-2 border-black last:border-r-0",
                  days === x ? "text-white" : "hover:bg-slate-100",
                )}
                style={days === x ? { backgroundColor: BLUE } : undefined}
              >
                {x === 365 ? "1 year" : `${x} days`}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTargetsOpen(true)}
            className="h-8 gap-1.5 border-2 border-black text-xs"
          >
            Set targets &amp; costs
          </Button>
        </div>

        {loading || !d ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-3">
            <Section title="Goal & growth" />
            {/* 1. Are we on the way to the target? */}
            <Card
              className="col-span-12 xl:col-span-4"
              title="This month's target"
              sub={
                t
                  ? `${t.month.orders} orders · ${t.month.daysLeft} days left`
                  : undefined
              }
            >
              {!t || (!t.target && !t.breakEven) ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Set a monthly target and your fixed costs to see progress
                    and break-even.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setTargetsOpen(true)}
                    className="border-2 border-black"
                    style={{ backgroundColor: BLUE }}
                  >
                    Set targets
                  </Button>
                </div>
              ) : (
                <div>
                  <ChartBox h={240}>
                    <BarChart
                      data={[
                        { name: "Won", value: t.month.won },
                        {
                          name: "+ Likely",
                          value: t.month.won + t.pipeline.forecast,
                        },
                        {
                          name: "+ Pipeline",
                          value: t.month.won + t.pipeline.value,
                        },
                      ]}
                      margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        domain={[
                          0,
                          (max: number) =>
                            Math.max(max, t.target || 0, t.breakEven || 0) *
                            1.1,
                        ]}
                        tickFormatter={(v) =>
                          v >= 1e7
                            ? `${+(v / 1e7).toFixed(1)}Cr`
                            : v >= 1e5
                              ? `${+(v / 1e5).toFixed(1)}L`
                              : v
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: any) => inr(v)}
                      />
                      {t.target > 0 && (
                        <ReferenceLine
                          y={t.target}
                          stroke={GREEN}
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          label={{
                            value: `Target ${inr(t.target)}`,
                            fontSize: 10,
                            fill: "#047857",
                            position: "insideTopLeft",
                          }}
                        />
                      )}
                      {t.breakEven > 0 && (
                        <ReferenceLine
                          y={t.breakEven}
                          stroke={ORANGE}
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          label={{
                            value: `Break-even ${inr(t.breakEven)}`,
                            fontSize: 10,
                            fill: "#C2410C",
                            position: "insideBottomLeft",
                          }}
                        />
                      )}
                      <Bar dataKey="value" stroke="#0A0A0A" strokeWidth={2}>
                        <Cell fill={GREEN} />
                        <Cell fill={BLUE} />
                        <Cell fill="#93C5FD" />
                      </Bar>
                    </BarChart>
                  </ChartBox>
                  {t.ordersNeeded > 0 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Needs ~{t.ordersNeeded} orders → ~{t.leadsNeeded} leads a
                      month
                    </p>
                  )}
                </div>
              )}
            </Card>
            {/* 3. Leads & won over time */}
            <Card
              className="col-span-12 xl:col-span-8"
              title="Leads & won over time"
              sub={`Per ${d.days > 90 ? "month" : "week"}`}
            >
              {d.trend.length === 0 ? (
                <Empty text="No leads in this period." />
              ) : (
                <ChartBox h={240}>
                  <LineChart
                    data={d.trend}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke={BLUE}
                      strokeWidth={3}
                      dot={{
                        r: 3,
                        stroke: "#0A0A0A",
                        strokeWidth: 2,
                        fill: BLUE,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="won"
                      name="Won"
                      stroke={GREEN}
                      strokeWidth={3}
                      dot={{
                        r: 3,
                        stroke: "#0A0A0A",
                        strokeWidth: 2,
                        fill: GREEN,
                      }}
                    />
                  </LineChart>
                </ChartBox>
              )}
            </Card>
            <Section title="Funnel & sources" />
            {/* 2. Funnel */}
            <Card
              className="col-span-12 xl:col-span-5"
              title="Funnel"
              sub="Count at each step; % of previous step on the right"
            >
              <div className="space-y-2">
                {funnelRows.map((r) => (
                  <div key={r.name} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 font-medium">{r.name}</span>
                    <div className="relative h-6 flex-1 border-2 border-black bg-slate-100">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(r.ofTop, r.n ? 2 : 0)}%`,
                          backgroundColor: r.name === "Won" ? GREEN : BLUE,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-semibold tabular-nums">
                      {r.n}
                    </span>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {r.ofPrev}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            {/* 4. Sources */}
            <Card
              className="col-span-12 xl:col-span-7"
              title="Which source brings orders"
              sub="Leads vs won"
            >
              {d.sources.length === 0 ? (
                <Empty text="No leads in this period." />
              ) : (
                <ChartBox h={240}>
                  <BarChart
                    data={d.sources}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
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
                      contentStyle={tooltipStyle}
                      formatter={(v: any, n: any, p: any) => [
                        n === "Won" && p.payload.costPerOrder
                          ? `${v} · ${inr(p.payload.costPerOrder)} per order`
                          : v,
                        n,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="leads"
                      name="Leads"
                      fill={BLUE}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                    <Bar
                      dataKey="won"
                      name="Won"
                      fill={GREEN}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ChartBox>
              )}
            </Card>
            <Section title="Team & pipeline" />
            {/* 5. Team */}
            <Card
              className="col-span-12 xl:col-span-6"
              title="Win rate by salesperson"
              sub="Won vs lost leads · AI Agent = the leads it called"
            >
              {d.team.perAgent.length === 0 ? (
                <Empty text="No leads in this period." />
              ) : (
                <ChartBox h={Math.max(240, d.team.perAgent.length * 52)}>
                  <BarChart
                    data={d.team.perAgent}
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
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: any, n: any, p: any) => [
                        n === "Won" ? `${v} (win ${p.payload.winRate}%)` : v,
                        n,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="won"
                      name="Won"
                      fill={GREEN}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                    <Bar
                      dataKey="lost"
                      name="Lost"
                      fill="#EF4444"
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ChartBox>
              )}
            </Card>
            {/* 7. Pipeline by stage */}
            <Card
              className="col-span-12 xl:col-span-6"
              title="Open pipeline by stage"
              sub="Expected value of leads still open"
            >
              {d.pipelineByStage.length === 0 ? (
                <Empty text="No open leads." />
              ) : (
                <ChartBox h={240}>
                  <BarChart
                    data={d.pipelineByStage}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
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
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1e7 ? `${v / 1e7}Cr` : v >= 1e5 ? `${v / 1e5}L` : v
                      }
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: any) => inr(v)}
                    />
                    <Bar
                      dataKey="value"
                      name="Value"
                      fill={ORANGE}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ChartBox>
              )}
            </Card>
            <Section title="Losses & risks" />
            {/* 6. Why leads are lost */}
            <Card
              className="col-span-12 xl:col-span-6"
              title="Why leads are lost"
              sub={
                d.lost.count
                  ? `${d.lost.count} lost${d.lost.value ? ` · ${inr(d.lost.value)}` : ""}`
                  : undefined
              }
            >
              <Donut
                data={d.lost.reasons.map((r: any) => ({
                  name: r.name,
                  value: r.count,
                }))}
                empty="No lost leads in this period."
              />
              {d.lost.competitors.length > 0 && (
                <p className="mt-2 border-t-2 border-black pt-2 text-xs">
                  <span className="font-medium">Lost to: </span>
                  {d.lost.competitors
                    .slice(0, 4)
                    .map((c: any) => `${c.name} (${c.count})`)
                    .join(", ")}
                </p>
              )}
            </Card>
            {/* 9. Stuck leads */}
            <Card
              className="col-span-12 xl:col-span-6"
              title="Stuck leads"
              sub={`${d.stuck.count} open with no movement for ${d.stuck.days}+ days`}
            >
              {d.stuck.items.length === 0 ? (
                <Empty text="Nothing stuck." />
              ) : (
                <ul className="divide-y divide-black/10 text-xs">
                  {d.stuck.items.slice(0, 6).map((l: any) => (
                    <li key={l._id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {l.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {l.owner}
                      </span>
                      <span
                        className="w-12 shrink-0 text-right font-semibold tabular-nums"
                        style={{ color: l.days > 30 ? "#EF4444" : ORANGE }}
                      >
                        {l.days} d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {/* 8. Machines */}
            {showMachines && (
              <Card
                className="col-span-12"
                title={d.preset?.terms?.items || "Machines"}
                sub="Leads, quotations and won"
              >
                {d.machines.length === 0 ? (
                  <Empty text="No leads in this period." />
                ) : (
                  <ChartBox
                    h={Math.max(200, Math.min(d.machines.length, 6) * 44)}
                  >
                    <BarChart
                      data={d.machines.slice(0, 6)}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 8, bottom: 0 }}
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
                        width={110}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="leads"
                        name="Leads"
                        fill={BLUE}
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                      <Bar
                        dataKey="quotations"
                        name="Quotations"
                        fill="#8B5CF6"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                      <Bar
                        dataKey="won"
                        name="Won"
                        fill={GREEN}
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                    </BarChart>
                  </ChartBox>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={targetsOpen} onOpenChange={setTargetsOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-2 border-black">
          <DialogHeader>
            <DialogTitle>Targets &amp; costs</DialogTitle>
          </DialogHeader>
          {targetsOpen && (
            <TargetsForm
              initial={t?.settings}
              onSaved={async () => {
                await loadTargets();
                setTargetsOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

type Row = { label?: string; source?: string; amount: number };

// Monthly revenue target, margin, fixed costs and per-source spend. Saved to Settings → salesTargets.
function TargetsForm({
  initial,
  onSaved,
}: {
  initial?: any;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<{
    monthlyRevenue: number;
    marginPct: number;
    fixedExpenses: Row[];
    sourceCosts: Row[];
  }>({
    monthlyRevenue: initial?.monthlyRevenue || 0,
    marginPct: initial?.marginPct || 0,
    fixedExpenses: initial?.fixedExpenses || [],
    sourceCosts: initial?.sourceCosts || [],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await settingsAPI.update({ salesTargets: form } as any);
      toast({ title: "Targets saved" });
      onSaved();
    } catch (e: any) {
      toast({
        title: "Couldn't save",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const setRow = (
    key: "fixedExpenses" | "sourceCosts",
    i: number,
    patch: Partial<Row>,
  ) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  const delRow = (key: "fixedExpenses" | "sourceCosts", i: number) =>
    setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));
  const fixedTotal = form.fixedExpenses.reduce(
    (a, r) => a + (Number(r.amount) || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Monthly revenue target (₹)
          <input
            type="number"
            min={0}
            value={form.monthlyRevenue}
            onChange={(e) =>
              setForm({ ...form, monthlyRevenue: Number(e.target.value) || 0 })
            }
            className="mt-1 h-9 w-full border-2 border-black px-2 text-sm normal-case"
          />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Margin on an order (%)
          <input
            type="number"
            min={0}
            max={100}
            value={form.marginPct}
            onChange={(e) =>
              setForm({ ...form, marginPct: Number(e.target.value) || 0 })
            }
            className="mt-1 h-9 w-full border-2 border-black px-2 text-sm normal-case"
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Break-even = fixed costs ÷ margin
        {form.marginPct > 0 && fixedTotal > 0
          ? ` = ${inr(Math.round(fixedTotal / (form.marginPct / 100)))} a month`
          : ""}
        .
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            [
              "fixedExpenses",
              "Fixed costs per month",
              "label",
              "e.g. Salaries",
            ],
            [
              "sourceCosts",
              "Lead source spend per month",
              "source",
              "e.g. IndiaMART",
            ],
          ] as const
        ).map(([key, heading, field, ph]) => (
          <div key={key} className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {heading}
            </p>
            {form[key].map((r, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={(r as any)[field] || ""}
                  onChange={(e) =>
                    setRow(key, i, { [field]: e.target.value } as any)
                  }
                  placeholder={ph}
                  className="h-9 min-w-0 flex-1 border-2 border-black px-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={r.amount}
                  onChange={(e) =>
                    setRow(key, i, { amount: Number(e.target.value) || 0 })
                  }
                  className="h-9 w-24 border-2 border-black px-2 text-xs"
                />
                <button
                  onClick={() => delRow(key, i)}
                  className="h-9 w-9 border-2 border-black hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5 text-red-600" />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  [key]: [...f[key], { [field]: "", amount: 0 } as any],
                }))
              }
              className="flex items-center gap-1 text-xs font-medium text-[#024BAB] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        ))}
      </div>

      <Button
        onClick={save}
        disabled={saving}
        className="gap-1.5 border-2 border-black"
        style={{ backgroundColor: BLUE }}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}{" "}
        Save
      </Button>
    </div>
  );
}
