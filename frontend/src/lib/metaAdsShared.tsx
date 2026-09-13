import { cn } from "@/lib/utils";
import {
  DollarSign,
  BarChart3,
  TrendingUp,
  MousePointerClick,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  adAccountName: string;
  currency: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  campaign_id: string;
  campaignName?: string;
  adAccountName?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
  };
  optimization_goal?: string;
  billing_event?: string;
  created_time: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  adset_id: string;
  campaign_id: string;
  campaignName?: string;
  adSetName?: string;
  adAccountName?: string;
  creative?: {
    title?: string;
    body?: string;
    image_url?: string;
    call_to_action_type?: string;
    link_url?: string;
  };
  created_time: string;
}

export interface Insight {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number;
}

export type Period = "today" | "week" | "month" | "custom";

export const META_STATUS: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: "bg-[#A3E635] text-black border-black", label: "Active" },
  PAUSED: { cls: "bg-[#FFDE00] text-black border-black", label: "Paused" },
  DELETED: { cls: "bg-[#EF4444] text-white border-black", label: "Deleted" },
  ARCHIVED: {
    cls: "bg-gray-200 text-gray-700 border-black",
    label: "Archived",
  },
  IN_PROCESS: {
    cls: "bg-blue-100 text-blue-700 border-blue-300",
    label: "In Review",
  },
  WITH_ISSUES: {
    cls: "bg-red-100 text-red-700 border-red-300",
    label: "Issues",
  },
  CAMPAIGN_PAUSED: {
    cls: "bg-[#FFDE00] text-black border-black",
    label: "Paused",
  },
  ADSET_PAUSED: {
    cls: "bg-[#FFDE00] text-black border-black",
    label: "Paused",
  },
  PENDING_REVIEW: {
    cls: "bg-blue-100 text-blue-700 border-blue-300",
    label: "In Review",
  },
  DISAPPROVED: {
    cls: "bg-red-100 text-red-700 border-red-300",
    label: "Disapproved",
  },
};

export const META_OBJECTIVES: Record<string, string> = {
  OUTCOME_AWARENESS: "Brand Awareness",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "App Promotion",
  OUTCOME_SALES: "Sales",
};

export function parseInsight(raw: any): Insight {
  if (!raw)
    return { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, results: 0 };
  const results = Array.isArray(raw.actions)
    ? raw.actions.reduce((s: number, a: any) => s + (+a.value || 0), 0)
    : 0;
  return {
    spend: +raw.spend || 0,
    impressions: +raw.impressions || 0,
    clicks: +raw.clicks || 0,
    ctr: +raw.ctr || 0,
    cpc: +raw.cpc || 0,
    results,
  };
}

export function statusBadge(rawStatus: string) {
  return (
    META_STATUS[rawStatus] || {
      cls: "bg-gray-200 text-gray-700 border-black",
      label: rawStatus,
    }
  );
}

export const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black px-3 py-2 text-xs">
      <p className="font-bold text-black mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color }}
          />
          <span className="font-bold text-black capitalize">
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function InsightRow({ insight }: { insight?: Insight }) {
  if (!insight) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-dashed border-gray-300">
      <span className="flex items-center gap-1 font-semibold text-[#024BAB]">
        <DollarSign className="w-3 h-3" />₹
        {insight.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
        spent
      </span>
      <span className="flex items-center gap-1 font-semibold text-[#00C48C]">
        <TrendingUp className="w-3 h-3" />
        {insight.results.toLocaleString()} results
      </span>
      <span className="flex items-center gap-1">
        <BarChart3 className="w-3 h-3" />
        {insight.impressions.toLocaleString()} impressions
      </span>
      <span className="flex items-center gap-1">
        <MousePointerClick className="w-3 h-3" />
        {insight.clicks.toLocaleString()} clicks
      </span>
      <span className="flex items-center gap-1">
        CTR {insight.ctr.toFixed(2)}%
      </span>
      <span className="flex items-center gap-1">
        CPC ₹{insight.cpc.toFixed(2)}
      </span>
    </div>
  );
}

export function ViewButtons({
  onDrill,
  drillColor,
  externalUrl,
}: {
  onDrill?: () => void;
  drillColor?: string;
  externalUrl?: string;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
          title="Open in Ads Manager"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {onDrill && (
        <button
          onClick={onDrill}
          className="w-7 h-7 flex items-center justify-center border-2 border-black text-white transition-colors"
          style={{ backgroundColor: drillColor }}
          title="View details"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border-2 border-dashed border-black bg-[#fafafa]">
      <div className="w-12 h-12 border-2 border-black bg-muted flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}

// Shared period state + the filter bar UI (Today/This Week/This Month/Custom)
// used across the Facebook Dashboard/Ad Campaigns/Ad Sets/Ads pages.
export function usePeriodFilter() {
  const [period, setPeriod] = useState<Period>("month");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");

  const periodOpts = useMemo(() => {
    if (period === "custom") {
      if (customSince && customUntil) {
        return { since: customSince, until: customUntil };
      }
      return { datePreset: "last_30d" };
    }
    const presetMap: Record<Exclude<Period, "custom">, string> = {
      today: "today",
      week: "this_week",
      month: "this_month",
    };
    return { datePreset: presetMap[period] };
  }, [period, customSince, customUntil]);

  const periodLabel =
    period === "today"
      ? "Today"
      : period === "week"
        ? "This week"
        : period === "month"
          ? "This month"
          : customSince && customUntil
            ? `${customSince} to ${customUntil}`
            : "Last 30 days";

  return {
    period,
    setPeriod,
    customSince,
    setCustomSince,
    customUntil,
    setCustomUntil,
    periodOpts,
    periodLabel,
  };
}

export function PeriodFilterBar({
  period,
  setPeriod,
  customSince,
  setCustomSince,
  customUntil,
  setCustomUntil,
}: ReturnType<typeof usePeriodFilter>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center border-2 border-black overflow-hidden">
        {(["today", "week", "month", "custom"] as Period[]).map((p, i) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "text-xs px-3 py-2 font-bold transition-colors capitalize",
              i > 0 && "border-l-2 border-black",
              period === p
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#024BAB]/10",
            )}
          >
            {p === "today"
              ? "Today"
              : p === "week"
                ? "This Week"
                : p === "month"
                  ? "This Month"
                  : "Custom"}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customSince}
            onChange={(e) => setCustomSince(e.target.value)}
            className="border-2 border-black px-2 py-[7px] text-xs font-semibold"
          />
          <span className="text-xs font-bold text-muted-foreground">to</span>
          <input
            type="date"
            value={customUntil}
            onChange={(e) => setCustomUntil(e.target.value)}
            className="border-2 border-black px-2 py-[7px] text-xs font-semibold"
          />
        </div>
      )}
    </div>
  );
}

export type DeliveryFilter = "all" | "active" | "paused" | "archived" | "deleted";

export function matchesDeliveryFilter(rawStatus: string, filter: DeliveryFilter) {
  if (filter === "all") return true;
  if (filter === "active") return rawStatus === "ACTIVE";
  if (filter === "paused")
    return ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(rawStatus);
  if (filter === "archived") return rawStatus === "ARCHIVED";
  if (filter === "deleted") return rawStatus === "DELETED";
  return true;
}

// Meta Ads Manager–style on/off toggle used in the table's leftmost column.
export function DeliveryToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={active ? "Pause" : "Resume"}
      className={cn(
        "w-9 h-5 border-2 border-black relative shrink-0 transition-colors disabled:opacity-50",
        active ? "bg-[#00C48C]" : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-[1px] w-3.5 h-3.5 bg-white border border-black transition-transform",
          active ? "translate-x-[17px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export interface MetaTableColumn<T> {
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
}

// A dense, sortable-look data table matching Meta Ads Manager's Campaigns /
// Ad Sets / Ads tables (fixed header row, black grid lines, right-aligned metrics).
export function MetaTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: MetaTableColumn<T>[];
  rows: T[];
}) {
  return (
    <div className="border-2 border-black overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-[#F5F6F8] border-b-2 border-black">
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2.5 font-bold uppercase tracking-wide text-[10px] text-muted-foreground whitespace-nowrap",
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left",
                  i > 0 && "border-l border-gray-300",
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-200 last:border-b-0 hover:bg-[#024BAB]/5 transition-colors"
            >
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2.5 align-middle",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left",
                    i > 0 && "border-l border-gray-200",
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryFilterBar({
  value,
  onChange,
  search,
  onSearchChange,
}: {
  value: DeliveryFilter;
  onChange: (v: DeliveryFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="border-2 border-black px-3 py-1.5 text-xs w-40"
      />
      <div className="flex items-center border-2 border-black overflow-hidden">
        {(
          [
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "paused", label: "Paused" },
            { id: "archived", label: "Archived" },
            { id: "deleted", label: "Deleted" },
          ] as { id: DeliveryFilter; label: string }[]
        ).map((f, i) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "text-xs px-2.5 py-1.5 font-bold transition-colors",
              i > 0 && "border-l-2 border-black",
              value === f.id
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#024BAB]/10",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
