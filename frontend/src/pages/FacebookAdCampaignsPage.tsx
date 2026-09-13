import { AppLayout } from "@/components/layout/AppLayout";
import { facebookAPI, campaignAssignmentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Info,
  Facebook,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  MetaCampaign,
  Insight,
  META_OBJECTIVES,
  parseInsight,
  statusBadge,
  EmptyState,
  usePeriodFilter,
  PeriodFilterBar,
  DeliveryFilterBar,
  DeliveryFilter,
  matchesDeliveryFilter,
  DeliveryToggle,
  MetaTable,
  MetaTableColumn,
} from "@/lib/metaAdsShared";

export default function FacebookAdCampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [adAccounts, setAdAccounts] = useState<{ id: string; name: string }[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MetaCampaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetaCampaign | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

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
    try {
      const res = await campaignAssignmentAPI.getAll("facebook");
      const map: Record<string, string> = {};
      (res.data || []).forEach((a: any) => {
        if (a.assignedTo?.name) map[a.campaignId] = a.assignedTo.name;
      });
      setAssignments(map);
    } catch {
      // non-critical, skip silently
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await facebookAPI.getMetaCampaigns();
      const data = res.data || [];
      setCampaigns(data);
      setAdAccounts(res.adAccounts || []);
      fetchInsightsFor(data.map((c) => c.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchInsightsFor]);

  useEffect(() => {
    fetchAll();
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (campaigns.length > 0) fetchInsightsFor(campaigns.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOpts.datePreset, periodOpts.since, periodOpts.until]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase()))
        return false;
      return matchesDeliveryFilter(c.effective_status || c.status, deliveryFilter);
    });
  }, [campaigns, search, deliveryFilter]);

  const handleToggleStatus = async (c: MetaCampaign) => {
    const next = (c.effective_status || c.status) === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setActionId(c.id);
    try {
      await facebookAPI.updateCampaign(c.id, { status: next });
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, status: next, effective_status: next } : x)),
      );
      toast({ title: next === "ACTIVE" ? "Campaign resumed" : "Campaign paused" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try {
      await facebookAPI.deleteCampaign(deleteTarget.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast({ title: "Campaign deleted" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const campaignColumns: MetaTableColumn<MetaCampaign>[] = [
    {
      header: "Off / On",
      width: "70px",
      align: "center",
      render: (c) => (
        <DeliveryToggle
          active={(c.effective_status || c.status) === "ACTIVE"}
          disabled={actionId === c.id}
          onToggle={() => handleToggleStatus(c)}
        />
      ),
    },
    {
      header: "Campaign",
      render: (c) => {
        return (
          <div className="min-w-[220px]">
            <span className="font-bold text-sm">{c.name}</span>
            <p className="text-[11px] text-muted-foreground">
              {c.adAccountName}
              {c.objective &&
                ` · ${META_OBJECTIVES[c.objective] || c.objective.replace(/_/g, " ")}`}
            </p>
          </div>
        );
      },
    },
    {
      header: "Assigned To",
      render: (c) =>
        assignments[c.id] ? (
          <span className="text-[10px] bg-[#00C48C]/10 text-[#00C48C] px-1.5 py-0.5 border border-[#00C48C] font-bold flex items-center gap-1 whitespace-nowrap w-fit">
            <UserCheck className="w-3 h-3" />
            {assignments[c.id]}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        ),
    },
    {
      header: "Delivery",
      render: (c) => {
        const st = statusBadge(c.effective_status || c.status);
        return (
          <span className={`text-[10px] px-2 py-0.5 border-2 font-bold whitespace-nowrap ${st.cls}`}>
            {st.label}
          </span>
        );
      },
    },
    {
      header: "Results",
      align: "right",
      render: (c) => (
        <span className="flex items-center justify-end gap-1 font-semibold text-[#00C48C]">
          <TrendingUp className="w-3 h-3" />
          {(insights[c.id]?.results ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Cost / Result",
      align: "right",
      render: (c) => {
        const ins = insights[c.id];
        const cost = ins && ins.results > 0 ? ins.spend / ins.results : null;
        return cost !== null ? `₹${cost.toFixed(2)}` : "—";
      },
    },
    {
      header: "Budget",
      align: "right",
      render: (c) =>
        c.daily_budget
          ? `₹${(+c.daily_budget / 100).toLocaleString()}/day`
          : c.lifetime_budget
            ? `₹${(+c.lifetime_budget / 100).toLocaleString()} total`
            : "—",
    },
    {
      header: "Amount Spent",
      align: "right",
      render: (c) => `₹${(insights[c.id]?.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    {
      header: "Impressions",
      align: "right",
      render: (c) => (insights[c.id]?.impressions ?? 0).toLocaleString(),
    },
    {
      header: "Ends",
      render: (c) =>
        c.start_time ? (
          <span className="whitespace-nowrap text-[11px]">
            {format(new Date(c.start_time), "dd MMM")} →{" "}
            {c.stop_time ? format(new Date(c.stop_time), "dd MMM yyyy") : "ongoing"}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Actions",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setEditing(c);
              setFormOpen(true);
            }}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(c)}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-red-100 text-red-600 transition-colors"
            title="Delete"
          >
            {actionId === c.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
          <a
            href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
            title="Open in Ads Manager"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Facebook Ad Campaigns
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Full history — every campaign, active or not
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
          {isAdmin && (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          )}
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
        <div className="border-2 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground font-bold">
              {filtered.length} campaign{filtered.length === 1 ? "" : "s"}
            </p>
            <DeliveryFilterBar
              value={deliveryFilter}
              onChange={setDeliveryFilter}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Facebook}
              title="No Campaigns"
              desc={
                isAdmin
                  ? "No campaigns match your filters."
                  : "No campaigns have been assigned to you yet — ask an admin to assign one from Task Management."
              }
            />
          ) : (
            <MetaTable columns={campaignColumns} rows={filtered} />
          )}
        </div>
      )}

      <CampaignFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        campaign={editing}
        adAccounts={adAccounts}
        onSaved={() => {
          setFormOpen(false);
          fetchAll();
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove <strong>{deleteTarget?.name}</strong> from Facebook.
            This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="border-2 border-black bg-white text-black px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!!actionId}
              className="border-2 border-black bg-red-600 text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionId && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function CampaignFormDialog({
  open,
  onClose,
  campaign,
  adAccounts,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campaign: MetaCampaign | null;
  adAccounts: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [status, setStatus] = useState("PAUSED");
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [stopDate, setStopDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setAdAccountId(adAccounts[0]?.id || "");
    setName(campaign?.name || "");
    setObjective(campaign?.objective || "OUTCOME_TRAFFIC");
    setStatus(campaign?.status || "PAUSED");
    setBudgetType(campaign?.daily_budget ? "daily" : "lifetime");
    setBudget(
      campaign?.daily_budget
        ? String(+campaign.daily_budget / 100)
        : campaign?.lifetime_budget
          ? String(+campaign.lifetime_budget / 100)
          : "",
    );
    setStartDate(
      campaign?.start_time ? format(new Date(campaign.start_time), "yyyy-MM-dd") : "",
    );
    setStopDate(
      campaign?.stop_time ? format(new Date(campaign.stop_time), "yyyy-MM-dd") : "",
    );
  }, [open, campaign, adAccounts]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        status,
        ...(startDate && { start_time: new Date(startDate).toISOString() }),
        ...(stopDate && { stop_time: new Date(stopDate).toISOString() }),
        ...(budget && {
          ...(budgetType === "daily"
            ? { daily_budget: String(+budget * 100) }
            : { lifetime_budget: String(+budget * 100) }),
        }),
      };
      if (campaign) {
        await facebookAPI.updateCampaign(campaign.id, data);
        toast({ title: "Campaign updated" });
      } else {
        await facebookAPI.createCampaign({ ...data, adAccountId, objective });
        toast({ title: "Campaign created" });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "New Campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!campaign && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Ad Account *
              </label>
              <Select value={adAccountId} onValueChange={setAdAccountId}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue placeholder="Select ad account" />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1">
              Campaign Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale 2026"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          </div>
          {!campaign && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Objective *
              </label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(META_OBJECTIVES).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Budget Type
              </label>
              <Select
                value={budgetType}
                onValueChange={(v) => setBudgetType(v as "daily" | "lifetime")}
              >
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1">
              Budget (₹)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                End Date
              </label>
              <input
                type="date"
                value={stopDate}
                onChange={(e) => setStopDate(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || (!campaign && !adAccountId)}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {campaign ? "Update" : "Create"} Campaign
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
