import { AppLayout } from "@/components/layout/AppLayout";
import {
  linkedinAdsAPI,
  usersAPI,
  campaignAssignmentAPI,
} from "@/services/api";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw } from "lucide-react";
import { statusBadge } from "@/lib/metaAdsShared";
import {
  CampaignAssignmentTable,
  type AssignableCampaignRow,
} from "@/components/campaigns/CampaignAssignmentTable";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";

interface TeamUser {
  _id: string;
  name: string;
}

interface RowMeta {
  id: string;
  name: string;
  status: string;
  adAccountId: string;
  adAccountName: string;
}

export default function LinkedInCampaignManagementPage() {
  const { toast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [campaigns, setCampaigns] = useState<RowMeta[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    const res = await campaignAssignmentAPI.getAll("linkedin");
    const map: Record<string, any> = {};
    (res.data || []).forEach((a: any) => {
      map[`linkedin:${a.campaignId}`] = a;
    });
    setAssignments(map);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, usersRes] = await Promise.all([
        linkedinAdsAPI.getConnectedAccounts(),
        usersAPI.getAll(),
      ]);
      setUsers(usersRes.data || []);
      setHasToken(accountsRes.hasToken);

      const accounts = accountsRes.data || [];
      const results = await Promise.allSettled(
        accounts.map((a: any) => linkedinAdsAPI.getCampaigns(a.adAccountId)),
      );
      const rows: RowMeta[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const account = accounts[i];
          for (const c of r.value.data || []) {
            rows.push({
              ...c,
              adAccountId: account.adAccountId,
              adAccountName: account.adAccountName,
            });
          }
        }
      });
      setCampaigns(rows);
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
  }, [fetchAssignments, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAssign = async (row: AssignableCampaignRow, userId: string) => {
    const campaign = campaigns.find((c) => c.id === row.key.split(":")[1]);
    if (!campaign) return;
    setSavingKey(row.key);
    try {
      const res = await campaignAssignmentAPI.upsert({
        platform: "linkedin",
        campaignId: campaign.id,
        campaignName: campaign.name,
        adAccountId: campaign.adAccountId,
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

  const rows: AssignableCampaignRow[] = campaigns.map((c) => ({
    key: `linkedin:${c.id}`,
    platform: "linkedin",
    name: c.name,
    subLabel: c.adAccountName,
    status: statusBadge(c.status),
  }));

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            LinkedIn Campaign Management
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Who's handling which campaign
            {!hasToken && !loading
              ? " — connect LinkedIn Ads first"
              : ""}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-[#0A66C2]/10 transition-colors"
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
        emptyIcon={LinkedInIcon as any}
        emptyTitle="No Campaigns"
        emptyDesc={
          hasToken
            ? "No campaigns found on your connected LinkedIn ad accounts."
            : "Connect a LinkedIn Ads account from the Campaigns › LinkedIn page first."
        }
      />
    </AppLayout>
  );
}
