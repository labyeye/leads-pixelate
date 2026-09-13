import { AppLayout } from "@/components/layout/AppLayout";
import {
  facebookAPI,
  usersAPI,
  campaignAssignmentAPI,
} from "@/services/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Facebook } from "lucide-react";
import {
  MetaCampaign,
  Insight,
  parseInsight,
  statusBadge,
  usePeriodFilter,
  PeriodFilterBar,
} from "@/lib/metaAdsShared";
import {
  CampaignAssignmentTable,
  type AssignableCampaignRow,
} from "@/components/campaigns/CampaignAssignmentTable";

interface TeamUser {
  _id: string;
  name: string;
}

export default function FacebookCampaignManagementPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const periodState = usePeriodFilter();
  const { periodOpts } = periodState;

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

  const fetchAssignments = useCallback(async () => {
    const res = await campaignAssignmentAPI.getAll("facebook");
    const map: Record<string, any> = {};
    (res.data || []).forEach((a: any) => {
      map[`facebook:${a.campaignId}`] = a;
    });
    setAssignments(map);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignsRes, usersRes] = await Promise.all([
        facebookAPI.getMetaCampaigns(),
        usersAPI.getAll(),
      ]);
      const data = campaignsRes.data || [];
      setCampaigns(data);
      setUsers(usersRes.data || []);
      fetchInsightsFor(data.map((c) => c.id));
      await fetchAssignments();
    } catch {
      toast({
        title: "Failed to load",
        description: "Could not load campaigns or team members.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchInsightsFor, fetchAssignments, toast]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (campaigns.length > 0) fetchInsightsFor(campaigns.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOpts.datePreset, periodOpts.since, periodOpts.until]);

  const handleAssign = async (row: AssignableCampaignRow, userId: string) => {
    const campaign = campaigns.find((c) => c.id === row.key.split(":")[1]);
    if (!campaign) return;
    setSavingKey(row.key);
    try {
      const res = await campaignAssignmentAPI.upsert({
        platform: "facebook",
        campaignId: campaign.id,
        campaignName: campaign.name,
        adAccountId: (campaign as any).adAccountId,
        assignedTo: userId || null,
      });
      setAssignments((prev) => ({ ...prev, [row.key]: res.data }));
      toast({
        title: userId ? "Campaign assigned" : "Campaign unassigned",
        description: campaign.name,
      });
    } catch (err: any) {
      toast({
        title: "Failed to assign",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const rows: AssignableCampaignRow[] = useMemo(
    () =>
      campaigns.map((c) => {
        const i = insights[c.id];
        return {
          key: `facebook:${c.id}`,
          platform: "facebook",
          name: c.name,
          subLabel: c.adAccountName,
          status: statusBadge(c.effective_status || c.status),
          spend: i?.spend,
          results: i?.results,
        };
      }),
    [campaigns, insights],
  );

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Facebook Campaign Management
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Who's handling which campaign, and how it's performing
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

      <CampaignAssignmentTable
        rows={rows}
        loading={loading}
        users={users}
        assignments={assignments}
        savingKey={savingKey}
        onAssign={handleAssign}
        emptyIcon={Facebook}
        emptyTitle="No Campaigns"
        emptyDesc="Connect Facebook and run a campaign to assign it here."
      />
    </AppLayout>
  );
}
