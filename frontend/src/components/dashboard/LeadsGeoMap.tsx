import { useEffect, useMemo, useState } from "react";
import { MapPin, Trophy, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardAPI } from "@/services/api";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import mapPaths from "@/assets/mapPaths.json";

type Row = { name: string; leads: number; won: number; rate: number };
type Geo = {
  total: number;
  states: Row[];
  countries: Row[];
  cities: Row[];
  unknownState: number;
  unknownCountry: number;
};

const RANGES = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "90", label: "Last 90 days" },
] as const;

const SCALES = {
  leads: ["#EAF1FB", "#024BAB"],
  won: ["#E6F7EF", "#00A86B"],
} as const;

// Mix two hex colours; t in 0..1.
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

function rangeOf(key: string) {
  if (key === "all") return undefined;
  const to = new Date();
  const from =
    key === "month"
      ? new Date(to.getFullYear(), to.getMonth(), 1)
      : new Date(to.getTime() - 90 * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function LeadsGeoMap() {
  const [view, setView] = useState<"india" | "world">("india");
  const [metric, setMetric] = useState<"leads" | "won">("leads");
  const [range, setRange] = useState<string>("all");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    dashboardAPI
      .getGeo(rangeOf(range))
      .then((r) => live && r?.success && setGeo(r.data))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [range]);

  const rows: Row[] = useMemo(
    () => (view === "india" ? geo?.states : geo?.countries) || [],
    [geo, view],
  );
  const byName = useMemo(() => new Map(rows.map((r) => [r.name, r])), [rows]);
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  const map = (mapPaths as any)[view] as {
    w: number;
    h: number;
    regions: { id: string; d: string }[];
  };

  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const totalWon = rows.reduce((a, r) => a + r.won, 0);
  // Best converter: needs a fair sample so one lucky lead does not win.
  const minSample = Math.max(5, Math.round(totalLeads * 0.01));
  const best = [...rows]
    .filter((r) => r.leads >= minSample && r.won > 0)
    .sort((a, b) => b.rate - a.rate || b.won - a.won)[0];
  const top = rows[0];
  const list = [...rows].sort((a, b) => b[metric] - a[metric] || b.leads - a.leads).slice(0, 8);
  const unknown = view === "india" ? geo?.unknownState : geo?.unknownCountry;
  const [c0, c1] = SCALES[metric];

  const fillOf = (name: string) => {
    const r = byName.get(name);
    const v = r ? r[metric] : 0;
    if (!v) return "#F3F4F6";
    // sqrt keeps small regions visible next to one giant one.
    return mix(c0, c1, 0.15 + 0.85 * Math.sqrt(v / max));
  };

  const hovered = hover ? byName.get(hover.name) : undefined;

  return (
    <div className="border-2 bg-white p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-medium text-base text-black">
            Where leads come from
          </h3>
          <p className="text-xs text-muted-foreground">
            {view === "india" ? "By state" : "By country (from phone code)"} ·
            darker = more {metric === "leads" ? "leads" : "clients won"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle
            value={view}
            onChange={(v) => {
              setView(v as any);
              setPicked(null);
            }}
            options={[
              { key: "india", label: "India" },
              { key: "world", label: "World" },
            ]}
          />
          <Toggle
            value={metric}
            onChange={(v) => setMetric(v as any)}
            options={[
              { key: "leads", label: "Leads" },
              { key: "won", label: "Won" },
            ]}
          />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-8 border-2 border-black bg-white px-2 text-xs font-medium"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div
          className="lg:col-span-7 relative"
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${map.w} ${map.h}`}
            className={cn(
              "w-full h-auto transition-opacity",
              loading && "opacity-40",
              view === "india" ? "max-h-[440px]" : "max-h-[360px]",
            )}
            role="img"
            aria-label={`Leads by ${view === "india" ? "state" : "country"}`}
          >
            {map.regions.map((r) => {
              const on = picked === r.id || hover?.name === r.id;
              return (
                <path
                  key={r.id}
                  d={r.d}
                  fill={fillOf(r.id)}
                  stroke="#000"
                  strokeWidth={on ? 1.6 : view === "india" ? 0.6 : 0.35}
                  className="cursor-pointer"
                  style={{ transition: "fill 500ms ease" }}
                  onMouseMove={(e) => {
                    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement)
                      .parentElement!.getBoundingClientRect();
                    setHover({ name: r.id, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                  onClick={() => setPicked((p) => (p === r.id ? null : r.id))}
                />
              );
            })}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute z-10 border-2 border-black bg-white px-3 py-2 text-xs shadow-[3px_3px_0_0_#000]"
              style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}
            >
              <p className="font-medium text-black">{hover.name}</p>
              {hovered ? (
                <p className="text-muted-foreground tabular-nums">
                  {hovered.leads.toLocaleString("en-IN")} leads · {hovered.won} won ·{" "}
                  {hovered.rate}%
                </p>
              ) : (
                <p className="text-muted-foreground">No leads</p>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>0</span>
            <span
              className="h-2 w-32 border border-black"
              style={{ background: `linear-gradient(90deg, ${c0}, ${c1})` }}
            />
            <span className="tabular-nums">{max.toLocaleString("en-IN")}</span>
            {!!unknown && (
              <span className="ml-auto">
                {unknown.toLocaleString("en-IN")} leads have no{" "}
                {view === "india" ? "state" : "country code"}
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Mini
              icon={MapPin}
              color="#024BAB"
              label="Most leads"
              value={top?.name || "—"}
              sub={top ? `${top.leads.toLocaleString("en-IN")} leads` : ""}
            />
            <Mini
              icon={Trophy}
              color="#00A86B"
              label="Best converting"
              value={best?.name || "—"}
              sub={best ? `${best.rate}% · ${best.won} won` : "No wins yet"}
            />
            <Mini
              icon={Globe2}
              color="#FF751F"
              label={view === "india" ? "States" : "Countries"}
              value={<AnimatedValue value={rows.length} />}
              sub={`${totalWon} won of ${totalLeads.toLocaleString("en-IN")}`}
            />
          </div>

          <div className="border-2 border-black">
            <div className="grid grid-cols-[1fr_70px_50px_56px] gap-2 px-3 py-2 border-b-2 border-black bg-[#F8FAFC] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>{view === "india" ? "State" : "Country"}</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Won</span>
              <span className="text-right">Conv.</span>
            </div>
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {loading ? "Loading…" : "No location data yet"}
              </p>
            ) : (
              list.map((r) => {
                const pct = (r[metric] / max) * 100;
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setPicked((p) => (p === r.name ? null : r.name))}
                    className={cn(
                      "w-full grid grid-cols-[1fr_70px_50px_56px] gap-2 items-center px-3 py-1.5 text-left text-sm border-b last:border-b-0 hover:bg-[#024BAB]/[0.04]",
                      picked === r.name && "bg-[#024BAB]/[0.07]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-black">{r.name}</span>
                      <span className="block h-1 mt-1 bg-gray-100">
                        <span
                          className="block h-full"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            background: c1,
                            transition: "width 600ms ease",
                          }}
                        />
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <AnimatedValue value={r.leads} />
                    </span>
                    <span className="text-right tabular-nums text-[#00A86B]">
                      <AnimatedValue value={r.won} />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {r.rate}%
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex border-2 border-black">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "h-7 px-3 text-xs font-medium",
            value === o.key ? "bg-[#024BAB] text-white" : "bg-white text-black hover:bg-gray-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Mini({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="border-2 border-black p-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="w-4 h-4 flex items-center justify-center" style={{ background: color }}>
          <Icon className="w-3 h-3 text-white" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-black truncate">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}
