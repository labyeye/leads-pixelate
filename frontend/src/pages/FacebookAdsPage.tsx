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
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  Info,
  ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import {
  MetaAd,
  MetaAdSet,
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

const CTA_OPTIONS = [
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "GET_QUOTE",
  "CONTACT_US",
  "BOOK_NOW",
  "DOWNLOAD",
];

export default function FacebookAdsPage() {
  const { toast } = useToast();
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [pages, setPages] = useState<{ pageId: string; pageName: string }[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MetaAd | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetaAd | null>(null);
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
      const [adsRes, adSetsRes, pagesRes] = await Promise.all([
        facebookAPI.getAllAds(),
        facebookAPI.getAllAdSets(),
        facebookAPI.getConnectedPages(),
      ]);
      const data = adsRes.data || [];
      setAds(data);
      setAdSets(adSetsRes.data || []);
      setPages(pagesRes.data || []);
      fetchInsightsFor(data.map((a: MetaAd) => a.id));
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
    if (ads.length > 0) fetchInsightsFor(ads.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOpts.datePreset, periodOpts.since, periodOpts.until]);

  const filtered = useMemo(() => {
    return ads.filter((a) => {
      if (
        search.trim() &&
        !a.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        !a.campaignName?.toLowerCase().includes(search.trim().toLowerCase()) &&
        !a.adSetName?.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      return matchesDeliveryFilter(a.effective_status || a.status, deliveryFilter);
    });
  }, [ads, search, deliveryFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try {
      await facebookAPI.deleteAd(deleteTarget.id);
      setAds((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast({ title: "Ad deleted" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleToggleStatus = async (a: MetaAd) => {
    const next = (a.effective_status || a.status) === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setActionId(a.id);
    try {
      await facebookAPI.updateAd(a.id, { status: next });
      setAds((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: next, effective_status: next } : x)),
      );
      toast({ title: next === "ACTIVE" ? "Ad resumed" : "Ad paused" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const adColumns: MetaTableColumn<MetaAd>[] = [
    {
      header: "Off / On",
      width: "70px",
      align: "center",
      render: (a) => (
        <DeliveryToggle
          active={(a.effective_status || a.status) === "ACTIVE"}
          disabled={actionId === a.id}
          onToggle={() => handleToggleStatus(a)}
        />
      ),
    },
    {
      header: "Ad",
      render: (a) => (
        <div className="flex items-center gap-2 min-w-[240px]">
          <div className="w-8 h-8 bg-[#00C48C] border-2 border-black flex items-center justify-center shrink-0 overflow-hidden">
            {a.creative?.image_url ? (
              <img src={a.creative.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-4 h-4 text-black" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm block truncate">{a.name}</span>
            <p className="text-[11px] text-muted-foreground truncate">
              {a.campaignName} · {a.adSetName}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Delivery",
      render: (a) => {
        const st = statusBadge(a.effective_status || a.status);
        return (
          <span className={`text-[10px] px-2 py-0.5 border-2 font-bold whitespace-nowrap ${st.cls}`}>
            {st.label}
          </span>
        );
      },
    },
    {
      header: "Assigned To",
      render: (a) =>
        assignments[a.campaign_id] ? (
          <span className="text-[10px] bg-[#00C48C]/10 text-[#00C48C] px-1.5 py-0.5 border border-[#00C48C] font-bold flex items-center gap-1 whitespace-nowrap w-fit">
            <UserCheck className="w-3 h-3" />
            {assignments[a.campaign_id]}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        ),
    },
    {
      header: "CTA",
      render: (a) =>
        a.creative?.call_to_action_type ? (
          <span className="text-[10px] bg-[#00C48C]/20 text-green-800 px-2 py-0.5 border border-green-700 font-bold whitespace-nowrap">
            {a.creative.call_to_action_type.replace(/_/g, " ")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Results",
      align: "right",
      render: (a) => (
        <span className="flex items-center justify-end gap-1 font-semibold text-[#00C48C]">
          <TrendingUp className="w-3 h-3" />
          {(insights[a.id]?.results ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Cost / Result",
      align: "right",
      render: (a) => {
        const ins = insights[a.id];
        const cost = ins && ins.results > 0 ? ins.spend / ins.results : null;
        return cost !== null ? `₹${cost.toFixed(2)}` : "—";
      },
    },
    {
      header: "Amount Spent",
      align: "right",
      render: (a) => `₹${(insights[a.id]?.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    {
      header: "Impressions",
      align: "right",
      render: (a) => (insights[a.id]?.impressions ?? 0).toLocaleString(),
    },
    {
      header: "Actions",
      align: "right",
      render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setEditing(a);
              setFormOpen(true);
            }}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(a)}
            className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-red-100 text-red-600 transition-colors"
            title="Delete"
          >
            {actionId === a.id ? (
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
            Facebook Ads
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Every ad across every ad set and campaign
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
          {adSets.length > 0 && (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="border-2 border-black bg-[#00C48C] text-black px-4 py-2 text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Ad
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
              <p className="text-sm font-bold mb-1">Couldn't load ads</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground font-bold">
              {filtered.length} ad{filtered.length === 1 ? "" : "s"}
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
              icon={ImageIcon}
              title="No Ads"
              desc={
                adSets.length === 0
                  ? "No ad sets available yet — create one first."
                  : "No ads match your filters."
              }
            />
          ) : (
            <MetaTable columns={adColumns} rows={filtered} />
          )}
        </div>
      )}

      <AdFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        ad={editing}
        adSets={adSets}
        pages={pages}
        onSaved={() => {
          setFormOpen(false);
          fetchAll();
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Ad?</DialogTitle>
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

function AdFormDialog({
  open,
  onClose,
  ad,
  adSets,
  pages,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  ad: MetaAd | null;
  adSets: MetaAdSet[];
  pages: { pageId: string; pageName: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [adSetId, setAdSetId] = useState("");
  const [pageId, setPageId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("PAUSED");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [cta, setCta] = useState("LEARN_MORE");

  useEffect(() => {
    if (!open) return;
    setAdSetId(ad?.adset_id || adSets[0]?.id || "");
    setPageId(pages[0]?.pageId || "");
    setName(ad?.name || "");
    setStatus(ad?.status || "PAUSED");
    setTitle(ad?.creative?.title || "");
    setBody(ad?.creative?.body || "");
    setImageUrl(ad?.creative?.image_url || "");
    setLinkUrl(ad?.creative?.link_url || "");
    setCta(ad?.creative?.call_to_action_type || "LEARN_MORE");
  }, [open, ad, adSets, pages]);

  const handleSave = async () => {
    if (!name.trim() || (!ad && !adSetId)) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        status,
        page_id: pageId || undefined,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        link_url: linkUrl.trim() || undefined,
        call_to_action_type: cta,
      };
      if (ad) {
        await facebookAPI.updateAd(ad.id, data);
        toast({ title: "Ad updated" });
      } else {
        await facebookAPI.createAd({ ...data, adset_id: adSetId });
        toast({ title: "Ad created" });
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
          <DialogTitle>{ad ? "Edit Ad" : "New Ad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!ad && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                Ad Set *
              </label>
              <Select value={adSetId} onValueChange={setAdSetId}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue placeholder="Select ad set" />
                </SelectTrigger>
                <SelectContent>
                  {adSets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.campaignName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1">
              Ad Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale — Main Banner"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          </div>
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

          <div className="border-t-2 border-black pt-3">
            <p className="text-xs font-bold uppercase tracking-wide mb-2">Creative</p>
            <div className="space-y-3">
              {pages.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                    Facebook Page
                  </label>
                  <Select value={pageId} onValueChange={setPageId}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue placeholder="Select page" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((p) => (
                        <SelectItem key={p.pageId} value={p.pageId}>
                          {p.pageName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                  Headline
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Shop the Summer Sale!"
                  className="w-full border-2 border-black px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                  Ad Body
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Discover amazing deals..."
                  rows={3}
                  className="border-2 border-black resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                  Image URL
                </label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border-2 border-black px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                  Destination URL
                </label>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://yoursite.com/sale"
                  className="w-full border-2 border-black px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1">
                  Call to Action
                </label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger className="border-2 border-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            disabled={saving || !name.trim() || (!ad && !adSetId)}
            className="border-2 border-black bg-[#00C48C] text-black px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {ad ? "Update" : "Create"} Ad
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
