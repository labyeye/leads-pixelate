import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AutopilotStats } from "@/services/api";
import type { RangeDays } from "./useAutopilotStats";

export const COLORS = {
  generated: "#024BAB",
  posted: "#00C48C",
  pending: "#FA731C",
  scheduled: "#A855F7",
  rejected: "#FF3366",
  failed: "#64748B",
};

export function RangePicker({ value, onChange }: { value: RangeDays; onChange: (d: RangeDays) => void }) {
  return (
    <div className="flex border-2 border-black self-start" role="group" aria-label="Date range">
      {([7, 30, 90] as RangeDays[]).map((d, i) => (
        <button
          key={d}
          type="button"
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={`px-3 py-1.5 text-xs font-bold ${i > 0 ? "border-l-2 border-black" : ""} ${
            value === d ? "bg-[#024BAB] text-white" : "bg-white text-black hover:bg-[#FFDE00]"
          }`}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

const shortDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Posts made, posted and rejected, one group of bars per day.
export function ActivityChart({ series, height = 260 }: { series: AutopilotStats["series"]; height?: number }) {
  const empty = series.every((s) => !s.generated && !s.posted && !s.rejected);
  if (empty) {
    return (
      <p className="text-sm text-muted-foreground border-2 border-dashed border-black/30 p-6 text-center">
        No posts in this period yet.
      </p>
    );
  }
  return (
    <div style={{ height }} role="img" aria-label="Posts per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(l) => shortDate(String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="generated" name="Created" fill={COLORS.generated} maxBarSize={14} />
          <Bar dataKey="posted" name="Posted" fill={COLORS.posted} maxBarSize={14} />
          <Bar dataKey="rejected" name="Rejected" fill={COLORS.rejected} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Where the period's posts ended up.
export function StatusDonut({ totals }: { totals: AutopilotStats["totals"] }) {
  const data = [
    { name: "Posted", value: totals.posted, color: COLORS.posted },
    { name: "Waiting for approval", value: totals.pending, color: COLORS.pending },
    { name: "Scheduled", value: totals.scheduled, color: COLORS.scheduled },
    { name: "Rejected", value: totals.rejected, color: COLORS.rejected },
    { name: "Failed", value: totals.failed, color: COLORS.failed },
  ].filter((d) => d.value > 0);
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Nothing to show yet.</p>;
  }
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div style={{ width: 160, height: 160 }} role="img" aria-label="Post outcomes">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} stroke="#000" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="w-3 h-3 border border-black" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <b className="ml-auto pl-4">{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
