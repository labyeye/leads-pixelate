import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { facebookAPI } from "@/services/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { RefreshCw, DollarSign, Target, Eye, MousePointerClick, Info } from "lucide-react";
import {
  MetaCampaign,
  Insight,
  META_STATUS,
  parseInsight,
  NbTooltip,
  usePeriodFilter,
  PeriodFilterBar,
} from "@/lib/metaAdsShared";

const STATUS_COLORS: Record<string, string> = {
  Active: "#A3E635",
  Paused: "#FFDE00",
  Archived: "#9CA3AF",
  Deleted: "#EF4444",
  "In Review": "#3B82F6",
  Issues: "#EF4444",
  Disapproved: "#EF4444",
};

export default function FacebookDashboardPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodState = usePeriodFilter();
  const { periodOpts, periodLabel } = periodState;

  const fetchInsightsFor = useCallback(
    async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => facebookAPI.getMetaCampaignInsights(id, periodOpts)),
      );
      setInsights((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === "fulfilled") next[ids[i]] = parseInsight(r.value.data);
        });
        return next;
      });
    },
    [periodOpts],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await facebookAPI.getMetaCampaigns();
      const data = res.data || [];
      setCampaigns(data);
      fetchInsightsFor(data.map((c) => c.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchInsightsFor]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (campaigns.length > 0) fetchInsightsFor(campaigns.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOpts.datePreset, periodOpts.since, periodOpts.until]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => {
        const i = insights[c.id];
        if (i) {
          acc.spend += i.spend;
          acc.results += i.results;
          acc.impressions += i.impressions;
          acc.clicks += i.clicks;
        }
        return acc;
      },
      { spend: 0, results: 0, impressions: 0, clicks: 0 },
    );
  }, [campaigns, insights]);

  const statusData = useMemo(() => {
    const buckets: Record<string, number> = {};
    campaigns.forEach((c) => {
      const raw = c.effective_status || c.status;
      const label = META_STATUS[raw]?.label || raw;
      buckets[label] = (buckets[label] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  const spendChartData = useMemo(() => {
    return [...campaigns]
      .map((c) => ({
        name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
        spend: insights[c.id]?.spend || 0,
        results: insights[c.id]?.results || 0,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [campaigns, insights]);

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Facebook Dashboard
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Meta Ads spend, results and performance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodFilterBar {...periodState} />
          <button
            onClick={fetchAll}
            disabled={loading}
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-[#024BAB]/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-2 border-black bg-white p-5">
          <div className="flex gap-3">
            <div className="w-9 h-9 bg-[#FA731C] border-2 border-black flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold mb-1">
                {error.includes("permission")
                  ? "Ads Permission Required"
                  : "Facebook Not Connected"}
              </p>
              <p className="text-xs text-muted-foreground mb-3">{error}</p>
              <a href="/integrations">
                <button className="border-2 border-black px-3 py-1.5 text-xs font-bold hover:bg-[#024BAB]/10 transition-colors">
                  Go to Integrations
                </button>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard
              title="Total Spend"
              value={`₹${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub={`${campaigns.length} campaigns`}
              icon={DollarSign}
              bg="bg-[#024BAB]"
            />
            <KpiCard
              title="Results"
              value={totals.results.toLocaleString()}
              sub="Leads / conversions"
              icon={Target}
              bg="bg-[#00C48C]"
            />
            <KpiCard
              title="Clicks"
              value={totals.clicks.toLocaleString()}
              sub={`CTR ${totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00"}%`}
              icon={MousePointerClick}
              bg="bg-[#FB923C]"
            />
            <KpiCard
              title="Impressions"
              value={totals.impressions.toLocaleString()}
              sub={periodLabel}
              icon={Eye}
              bg="bg-[#A3E635]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 border-2 bg-white p-5">
              <h3 className="font-display font-bold text-base text-black mb-1">
                Campaign Status
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Distribution across all campaigns
              </p>
              {statusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={62}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      >
                        {statusData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] || "#024BAB"}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                    {statusData.map((entry) => (
                      <span
                        key={entry.name}
                        className="flex items-center gap-1 text-[11px] font-bold text-black"
                      >
                        <span
                          className="w-2.5 h-2.5 border border-black shrink-0"
                          style={{
                            background: STATUS_COLORS[entry.name] || "#024BAB",
                          }}
                        />
                        {entry.name} ({entry.value})
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm font-bold text-center gap-1 px-4">
                  <span>No campaign data yet</span>
                  <span className="text-xs font-normal">
                    Connect your Facebook Ad Account in{" "}
                    <Link to="/integrations" className="text-[#024BAB] underline">
                      Integrations
                    </Link>{" "}
                    or try a different date range.
                  </span>
                </div>
              )}
            </div>

            <div className="lg:col-span-3 border-2 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-base text-black">
                    Spend & Results by Campaign
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Top 8 campaigns · {periodLabel}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-black bg-[#024BAB] inline-block" />{" "}
                    Spend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-black bg-[#00C48C] inline-block" />{" "}
                    Results
                  </span>
                </div>
              </div>
              {spendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={spendChartData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip content={<NbTooltip />} cursor={{ fill: "#024BAB22" }} />
                    <Bar dataKey="spend" name="Spend" fill="#024BAB" stroke="#0A0A0A" strokeWidth={2} />
                    <Bar dataKey="results" name="Results" fill="#00C48C" stroke="#0A0A0A" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm font-bold text-center gap-1 px-4">
                  <span>No campaign data yet</span>
                  <span className="text-xs font-normal">
                    Connect your Facebook Ad Account in{" "}
                    <Link to="/integrations" className="text-[#024BAB] underline">
                      Integrations
                    </Link>{" "}
                    or try a different date range.
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
