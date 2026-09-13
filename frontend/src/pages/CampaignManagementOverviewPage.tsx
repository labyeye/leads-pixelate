import { AppLayout } from "@/components/layout/AppLayout";
import {
  facebookAPI,
  linkedinAdsAPI,
  usersAPI,
  campaignAssignmentAPI,
} from "@/services/api";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Megaphone } from "lucide-react";
import { statusBadge, parseInsight } from "@/lib/metaAdsShared";
import {
  CampaignAssignmentTable,
  type AssignableCampaignRow,
} from "@/components/campaigns/CampaignAssignmentTable";

interface TeamUser {
  _id: string;
  name: string;
}

export default function CampaignManagementOverviewPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AssignableCampaignRow[]>([]);
  const [campaignMeta, setCampaignMeta] = useState<
    Record<string, { id: string; name: string; adAccountId?: string }>
  >({});
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fbRes, usersRes, liAccountsRes, fbAssignRes, liAssignRes] =
        await Promise.all([
          facebookAPI.getMetaCampaigns(),
          usersAPI.getAll(),
          linkedinAdsAPI.getConnectedAccounts(),
          campaignAssignmentAPI.getAll("facebook"),
          campaignAssignmentAPI.getAll("linkedin"),
        ]);
      setUsers(usersRes.data || []);

      const fbCampaigns = fbRes.data || [];
      const fbInsights = await Promise.allSettled(
        fbCampaigns.map((c) => facebookAPI.getMetaCampaignInsights(c.id, {})),
      );

      const nextMeta: typeof campaignMeta = {};
      const nextRows: AssignableCampaignRow[] = [];

      fbCampaigns.forEach((c, i) => {
        const key = `facebook:${c.id}`;
        const insight =
          fbInsights[i].status === "fulfilled"
            ? parseInsight((fbInsights[i] as any).value.data)
            : undefined;
        nextMeta[key] = { id: c.id, name: c.name, adAccountId: (c as any).adAccountId };
        nextRows.push({
          key,
          platform: "facebook",
          name: c.name,
          subLabel: c.adAccountName,
          status: statusBadge(c.effective_status || c.status),
          spend: insight?.spend,
          results: insight?.results,
        });
      });

      const liAccounts = liAccountsRes.data || [];
      const liResults = await Promise.allSettled(
        liAccounts.map((a: any) => linkedinAdsAPI.getCampaigns(a.adAccountId)),
      );
      liResults.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const account = liAccounts[i];
        for (const c of r.value.data || []) {
          const key = `linkedin:${c.id}`;
          nextMeta[key] = { id: c.id, name: c.name, adAccountId: account.adAccountId };
          nextRows.push({
            key,
            platform: "linkedin",
            name: c.name,
            subLabel: account.adAccountName,
            status: statusBadge(c.status),
          });
        }
      });

      setCampaignMeta(nextMeta);
      setRows(nextRows);

      const assignMap: Record<string, any> = {};
      (fbAssignRes.data || []).forEach((a: any) => {
        assignMap[`facebook:${a.campaignId}`] = a;
      });
      (liAssignRes.data || []).forEach((a: any) => {
        assignMap[`linkedin:${a.campaignId}`] = a;
      });
      setAssignments(assignMap);
    } catch {
      toast({
        title: "Failed to load",
        description: "Could not load campaigns or team members.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAssign = async (row: AssignableCampaignRow, userId: string) => {
    const meta = campaignMeta[row.key];
    if (!meta) return;
    setSavingKey(row.key);
    try {
      const res = await campaignAssignmentAPI.upsert({
        platform: row.platform,
        campaignId: meta.id,
        campaignName: meta.name,
        adAccountId: meta.adAccountId,
        assignedTo: userId || null,
      });
      setAssignments((prev) => ({ ...prev, [row.key]: res.data }));
      toast({
        title: userId ? "Campaign assigned" : "Campaign unassigned",
        description: meta.name,
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

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Campaign Management
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            All Facebook and LinkedIn campaigns in one place
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-[#024BAB]/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <CampaignAssignmentTable
        rows={rows}
        loading={loading}
        users={users}
        assignments={assignments}
        savingKey={savingKey}
        onAssign={handleAssign}
        emptyIcon={Megaphone}
        emptyTitle="No Campaigns"
        emptyDesc="Connect Facebook or LinkedIn and run a campaign to see it here."
        showPlatformColumn
      />
    </AppLayout>
  );
}
