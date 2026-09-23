import { AppLayout } from "@/components/layout/AppLayout";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { facebookAPI, leadsAPI, whatsappAPI, campaignAPI } from "@/services/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  MousePointerClick,
  BarChart3,
  Send,
  Megaphone,
  Facebook,
} from "lucide-react";
import {
  MetaCampaign,
  Insight,
  parseInsight,
  usePeriodFilter,
  PeriodFilterBar,
} from "@/lib/metaAdsShared";

export default function CampaignReportsPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [linkedinLeadCount, setLinkedinLeadCount] = useState(0);
  const [waSent, setWaSent] = useState(0);
  const [waDelivered, setWaDelivered] = useState(0);
  const [crmRunning, setCrmRunning] = useState(0);
  const [loading, setLoading] = useState(false);

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
    try {
      const [metaRes, linkedinRes, waRes, crmRes] = await Promise.allSettled([
        facebookAPI.getMetaCampaigns(),
        leadsAPI.getAll({ source: "LinkedIn", limit: "1" }),
        whatsappAPI.getCampaigns(),
        campaignAPI.getAll(),
      ]);

      if (metaRes.status === "fulfilled") {
        const data = metaRes.value.data || [];
        setCampaigns(data);
        fetchInsightsFor(data.map((c) => c.id));
      }
      if (linkedinRes.status === "fulfilled") {
        setLinkedinLeadCount(linkedinRes.value.count || 0);
      }
      if (waRes.status === "fulfilled") {
        const list = waRes.value.data || [];
        setWaSent(list.reduce((s: number, c: any) => s + (c.sentCount || 0), 0));
        setWaDelivered(
          list.reduce((s: number, c: any) => s + (c.deliveredCount || 0), 0),
        );
      }
      if (crmRes.status === "fulfilled") {
        setCrmRunning(
          (crmRes.value.data || []).filter((c: any) => c.status === "RUNNING")
            .length,
        );
      }
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

  const metaTotals = useMemo(() => {
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

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Reports & Analytics
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Cross-channel marketing performance — {periodLabel.toLowerCase()}
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

      <div className="border-2 bg-white p-5 mb-4">
        <h3 className="font-display font-bold text-base text-black mb-3 flex items-center gap-2">
          <Facebook className="w-4 h-4 text-[#024BAB]" /> Meta Ads
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            title="Spend"
            value={`₹${metaTotals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`${campaigns.length} campaigns`}
            icon={DollarSign}
            bg="bg-[#024BAB]"
          />
          <KpiCard
            title="Results"
            value={metaTotals.results.toLocaleString()}
            sub="Leads / conversions"
            icon={TrendingUp}
            bg="bg-[#00C48C]"
          />
          <KpiCard
            title="Clicks"
            value={metaTotals.clicks.toLocaleString()}
            sub={`CTR ${metaTotals.impressions > 0 ? ((metaTotals.clicks / metaTotals.impressions) * 100).toFixed(2) : "0.00"}%`}
            icon={MousePointerClick}
            bg="bg-[#FB923C]"
          />
          <KpiCard
            title="Impressions"
            value={metaTotals.impressions.toLocaleString()}
            sub={periodLabel}
            icon={BarChart3}
            bg="bg-[#A3E635]"
          />
        </div>
      </div>

      <div className="border-2 bg-white p-5 mb-4">
        <h3 className="font-display font-bold text-base text-black mb-3 flex items-center gap-2">
          <LinkedInIcon className="w-4 h-4" /> LinkedIn
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            title="Leads (All Time)"
            value={linkedinLeadCount}
            sub="Via Lead Sync"
            icon={TrendingUp}
            bg="bg-[#0A66C2]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-3 flex items-center gap-2">
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard title="Sent" value={waSent} sub="All campaigns" icon={Send} bg="bg-green-600" />
            <KpiCard
              title="Delivered"
              value={waDelivered}
              sub={
                waSent > 0
                  ? `${Math.round((waDelivered / waSent) * 100)}% delivery rate`
                  : "No sends yet"
              }
              icon={TrendingUp}
              bg="bg-[#00C48C]"
            />
          </div>
        </div>

        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-3 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#FA731C]" /> CRM Campaigns
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <KpiCard
              title="Running"
              value={crmRunning}
              sub="Active CRM campaigns"
              icon={Megaphone}
              bg="bg-[#FA731C]"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
