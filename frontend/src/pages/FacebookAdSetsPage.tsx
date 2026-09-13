import { AppLayout } from "@/components/layout/AppLayout";
import { facebookAPI, campaignAssignmentAPI } from "@/services/api";
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
  Users,
  UserCheck,
  Info,
  Target,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  MetaAdSet,
  MetaCampaign,
  Insight,
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

const OPTIMIZATION_GOALS = [
  "LINK_CLICKS",
  "IMPRESSIONS",
  "REACH",
  "LANDING_PAGE_VIEWS",
  "LEAD_GENERATION",
  "OFFSITE_CONVERSIONS",
];

export default function FacebookAdSetsPage() {
  const { toast } = useToast();
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MetaAdSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetaAdSet | null>(null);
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adSetsRes, campaignsRes] = await Promise.all([
        facebookAPI.getAllAdSets(),
        facebookAPI.getMetaCampaigns(),
      ]);
      const data = adSetsRes.data || [];
      setAdSets(data);
      setCampaigns(campaignsRes.data || []);
      fetchInsightsFor(data.map((s: MetaAdSet) => s.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchInsightsFor]);

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

  useEffect(() => {
    fetchAll();
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (adSets.length > 0) fetchInsightsFor(adSets.map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOpts.datePreset, periodOpts.since, periodOpts.until]);

  const filtered = useMemo(() => {
    return adSets.filter((s) => {
      if (
        search.trim() &&
        !s.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        !s.campaignName?.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      return matchesDeliveryFilter(s.effective_status || s.status, deliveryFilter);
    });
  }, [adSets, search, deliveryFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try {
      await facebookAPI.deleteAdSet(deleteTarget.id);
      setAdSets((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast({ title: "Ad set deleted" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleToggleStatus = async (s: MetaAdSet) => {
    const next = (s.effective_status || s.status) === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setActionId(s.id);
    try {
      await facebookAPI.updateAdSet(s.id, { status: next });
      setAdSets((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, status: next, effective_status: next } : x)),
      );
      toast({ title: next === "ACTIVE" ? "Ad set resumed" : "Ad set paused" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const adSetColumns: MetaTableColumn<MetaAdSet>[] = [
    {
      header: "Off / On",
      width: "70px",
      align: "center",
      render: (s) => (
        <DeliveryToggle
          active={(s.effective_status || s.status) === "ACTIVE"}
          disabled={actionId === s.id}
          onToggle={() => handleToggleStatus(s)}
        />
      ),
    },
    {
      header: "Ad Set",
      render: (s) => (
        <div className="min-w-[220px]">
          <span className="font-bold text-sm">{s.name}</span>
          <p className="text-[11px] text-muted-foreground">
            {s.campaignName} · {s.adAccountName}
          </p>
        </div>
      ),
    },
    {
      header: "Delivery",
      render: (s) => {
        const st = statusBadge(s.effective_status || s.status);
        return (
          <span className={`text-[10px] px-2 py-0.5 border-2 font-bold whitespace-nowrap ${st.cls}`}>
            {st.label}
          </span>
        );
      },
    },
    {
      header: "Assigned To",
      render: (s) =>
        assignments[s.campaign_id] ? (
          <span className="text-[10px] bg-[#00C48C]/10 text-[#00C48C] px-1.5 py-0.5 border border-[#00C48C] font-bold flex items-center gap-1 whitespace-nowrap w-fit">
            <UserCheck className="w-3 h-3" />
            {assignments[s.campaign_id]}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        ),
    },
    {
      header: "Optimization",
      render: (s) =>
        s.optimization_goal ? (
          <span className="text-[10px] bg-[#FA731C]/10 text-[#FA731C] px-2 py-0.5 border border-[#FA731C] font-bold whitespace-nowrap">
            {s.optimization_goal.replace(/_/g, " ")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Results",
      align: "right",
      render: (s) => (
        <span className="flex items-center justify-end gap-1 font-semibold text-[#00C48C]">
          <TrendingUp className="w-3 h-3" />
          {(insights[s.id]?.results ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Cost / Result",
      align: "right",
      render: (s) => {
        const ins = insights[s.id];
        const cost = ins && ins.results > 0 ? ins.spend / ins.results : null;
        return cost !== null ? `₹${cost.toFixed(2)}` : "—";
      },
    },
    {
      header: "Budget",
      align: "right",
      render: (s) =>
        s.daily_budget
          ? `₹${(+s.daily_budget / 100).toLocaleString()}/day`
          : s.lifetime_budget
            ? `₹${(+s.lifetime_budget / 100).toLocaleString()} total`
            : "—",
    },
    {
      header: "Amount Spent",
      align: "right",
      render: (s) => `₹${(insights[s.id]?.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    {
      header: "Age",
      align: "center",
      render: (s) =>
        s.targeting?.age_min && s.targeting?.age_max ? (
          <span className="flex items-center justify-center gap-1 whitespace-nowrap">
            <Users className="w-3 h-3" />
            {s.targeting.age_min}–{s.targeting.age_max}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Ends",
      render: (s) =>
        s.start_time ? (
          <span className="whitespace-nowrap text-[11px]">
            {format(new Date(s.start_time), "dd MMM")} →{" "}
            {s.end_time ? format(new Date(s.end_time), "dd MMM yyyy") : "ongoing"}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Actions",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setEditing(s);
              setFormOpen(true);
            }}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(s)}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-red-100 text-red-600 transition-colors"
            title="Delete"
          >
            {actionId === s.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            Facebook Ad Sets
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Every ad set across every campaign
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
          {campaigns.length > 0 && (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="border-2 border-black bg-[#FA731C] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Ad Set
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
              <p className="text-sm font-bold mb-1">Couldn't load ad sets</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground font-bold">
              {filtered.length} ad set{filtered.length === 1 ? "" : "s"}
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
              icon={Target}
              title="No Ad Sets"
              desc={
                campaigns.length === 0
                  ? "No campaigns assigned to you yet."
                  : "No ad sets match your filters."
              }
            />
          ) : (
            <MetaTable columns={adSetColumns} rows={filtered} />
          )}
        </div>
      )}

      <AdSetFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        adSet={editing}
        campaigns={campaigns}
        onSaved={() => {
          setFormOpen(false);
          fetchAll();
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Ad Set?</DialogTitle>
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

function AdSetFormDialog({
  open,
  onClose,
  adSet,
  campaigns,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  adSet: MetaAdSet | null;
  campaigns: MetaCampaign[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("PAUSED");
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [budget, setBudget] = useState("");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [optimizationGoal, setOptimizationGoal] = useState("LINK_CLICKS");
  const [billingEvent, setBillingEvent] = useState("IMPRESSIONS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setCampaignId(adSet?.campaign_id || campaigns[0]?.id || "");
    setName(adSet?.name || "");
    setStatus(adSet?.status || "PAUSED");
    setBudgetType(adSet?.daily_budget ? "daily" : "lifetime");
    setBudget(
      adSet?.daily_budget
        ? String(+adSet.daily_budget / 100)
        : adSet?.lifetime_budget
          ? String(+adSet.lifetime_budget / 100)
          : "",
    );
    setAgeMin(String(adSet?.targeting?.age_min || 18));
    setAgeMax(String(adSet?.targeting?.age_max || 65));
    setOptimizationGoal(adSet?.optimization_goal || "LINK_CLICKS");
    setBillingEvent(adSet?.billing_event || "IMPRESSIONS");
    setStartDate(adSet?.start_time ? format(new Date(adSet.start_time), "yyyy-MM-dd") : "");
    setEndDate(adSet?.end_time ? format(new Date(adSet.end_time), "yyyy-MM-dd") : "");
  }, [open, adSet, campaigns]);

  const handleSave = async () => {
    if (!name.trim() || (!adSet && !campaignId)) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        status,
        targeting: { age_min: +ageMin, age_max: +ageMax },
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        ...(startDate && { start_time: new Date(startDate).toISOString() }),
        ...(endDate && { end_time: new Date(endDate).toISOString() }),
        ...(budget && {
          ...(budgetType === "daily"
            ? { daily_budget: String(+budget * 100) }
            : { lifetime_budget: String(+budget * 100) }),
        }),
      };
      if (adSet) {
        await facebookAPI.updateAdSet(adSet.id, data);
        toast({ title: "Ad set updated" });
      } else {
        await facebookAPI.createAdSet({ ...data, campaign_id: campaignId });
        toast({ title: "Ad set created" });
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{adSet ? "Edit Ad Set" : "New Ad Set"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!adSet && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Campaign *
              </label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1">
              Ad Set Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Young Adults 18-35"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          </div>
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
              placeholder="e.g. 500"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1">
              Age Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                min="13"
                max="65"
                className="border-2 border-black px-3 py-2 text-sm text-center w-full"
              />
              <span className="text-xs font-bold text-muted-foreground">to</span>
              <input
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                min="13"
                max="65"
                className="border-2 border-black px-3 py-2 text-sm text-center w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Optimization Goal
              </label>
              <Select value={optimizationGoal} onValueChange={setOptimizationGoal}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIMIZATION_GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Billing Event
              </label>
              <Select value={billingEvent} onValueChange={setBillingEvent}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                  <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
            disabled={saving || !name.trim() || (!adSet && !campaignId)}
            className="border-2 border-black bg-[#FA731C] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {adSet ? "Update" : "Create"} Ad Set
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
