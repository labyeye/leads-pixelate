import { AppLayout } from "@/components/layout/AppLayout";
import { campaignAPI, whatsappAPI, facebookAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Loader2,
  RefreshCw,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Trash2,
  Megaphone,
  MessageSquare,
  Facebook,
  DollarSign,
  BarChart3,
  ExternalLink,
  PlayCircle,
  Users,
  TrendingUp,
  Info,
  ChevronRight,
  ChevronLeft,
  Pause,
  Play,
  Pencil,
  Target,
  Layers,
  ImageIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface WaCampaign {
  _id: string;
  name: string;
  status: string;
  templateSnapshot?: { displayName?: string };
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  createdAt: string;
  sentAt?: string;
  createdBy?: { name: string };
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
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

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: { countries?: string[] };
  };
  optimization_goal?: string;
  billing_event?: string;
  created_time: string;
  currency?: string;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: {
    title?: string;
    body?: string;
    image_url?: string;
    call_to_action_type?: string;
    link_url?: string;
  };
  created_time: string;
}

interface MyCampaign {
  _id: string;
  name: string;
  status: string;
  type: string;
  audience: { totalContacts: number };
  metrics: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  createdAt: string;
  launchedAt?: string;
  createdBy?: { name: string };
}

type ActiveTab = "meta" | "whatsapp" | "mine";
type MetaView = "campaigns" | "adsets" | "ads";

const META_STATUS: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: "bg-[#00C48C] text-black border-black", label: "Active" },
  PAUSED: { cls: "bg-[#FFDE00] text-black border-black", label: "Paused" },
  DELETED: { cls: "bg-[#EF4444] text-white border-black", label: "Deleted" },
  ARCHIVED: {
    cls: "bg-gray-200 text-gray-700 border-black",
    label: "Archived",
  },
};

const WA_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-[#00C48C] text-black border-black",
  SENDING: "bg-blue-100 text-blue-700 border-blue-300",
  FAILED: "bg-red-100 text-red-700 border-red-300",
  PARTIAL: "bg-orange-100 text-orange-700 border-orange-300",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-300",
};

const MY_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 border-gray-300",
  RUNNING: "bg-blue-100 text-blue-700 border-blue-300",
  COMPLETED: "bg-[#00C48C] text-black border-black",
  PAUSED: "bg-[#FFDE00] text-black border-black",
  CANCELLED: "bg-[#EF4444] text-white border-black",
};

const META_OBJECTIVES: Record<string, string> = {
  OUTCOME_AWARENESS: "Brand Awareness",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "App Promotion",
  OUTCOME_SALES: "Sales",
};

export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [tab, setTab] = useState<ActiveTab>("meta");
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [waCampaigns, setWaCampaigns] = useState<WaCampaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<MyCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [crmDeleteId, setCrmDeleteId] = useState<string | null>(null);

  const [metaView, setMetaView] = useState<MetaView>("campaigns");
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(
    null,
  );
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<MetaCampaign | null>(null);
  const [adSetDialogOpen, setAdSetDialogOpen] = useState(false);
  const [editAdSet, setEditAdSet] = useState<MetaAdSet | null>(null);
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [editAd, setEditAd] = useState<MetaAd | null>(null);
  const [metaDeleteDialog, setMetaDeleteDialog] = useState<{
    type: "campaign" | "adset" | "ad";
    id: string;
  } | null>(null);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    setMetaError(null);
    try {
      const res = await facebookAPI.getMetaCampaigns();
      setMetaCampaigns(res.data || []);
    } catch (err: any) {
      setMetaError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdSets = useCallback(
    async (campaignId: string) => {
      setAdSetsLoading(true);
      try {
        const res = await facebookAPI.getAdSets(campaignId);
        setAdSets(res.data || []);
      } catch (err: any) {
        toast({
          title: "Failed to load ad sets",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setAdSetsLoading(false);
      }
    },
    [toast],
  );

  const fetchAds = useCallback(
    async (adSetId: string) => {
      setAdsLoading(true);
      try {
        const res = await facebookAPI.getAds(adSetId);
        setAds(res.data || []);
      } catch (err: any) {
        toast({
          title: "Failed to load ads",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setAdsLoading(false);
      }
    },
    [toast],
  );

  const fetchWa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setWaCampaigns(res.data || []);
    } catch {
      toast({
        title: "Failed to load WhatsApp campaigns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await campaignAPI.getAll();
      setMyCampaigns(res.data || []);
    } catch {
      toast({ title: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === "meta") fetchMeta();
    else if (tab === "whatsapp") fetchWa();
    else fetchMine();
  }, [tab]);

  const drillToAdSets = (campaign: MetaCampaign) => {
    setSelectedCampaign(campaign);
    setMetaView("adsets");
    fetchAdSets(campaign.id);
  };

  const drillToAds = (adSet: MetaAdSet) => {
    setSelectedAdSet(adSet);
    setMetaView("ads");
    fetchAds(adSet.id);
  };

  const metaBack = () => {
    if (metaView === "ads") {
      setMetaView("adsets");
      setSelectedAdSet(null);
    } else {
      setMetaView("campaigns");
      setSelectedCampaign(null);
    }
  };

  const toggleMetaStatus = async (
    type: "campaign" | "adset" | "ad",
    id: string,
    current: string,
  ) => {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      if (type === "campaign") {
        await facebookAPI.updateCampaign(id, { status: next });
        setMetaCampaigns((p) =>
          p.map((c) => (c.id === id ? { ...c, status: next } : c)),
        );
      } else if (type === "adset") {
        await facebookAPI.updateAdSet(id, { status: next });
        setAdSets((p) =>
          p.map((s) => (s.id === id ? { ...s, status: next } : s)),
        );
      } else {
        await facebookAPI.updateAd(id, { status: next });
        setAds((p) => p.map((a) => (a.id === id ? { ...a, status: next } : a)));
      }
      toast({
        title: `${next === "ACTIVE" ? "Resumed" : "Paused"} successfully`,
      });
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleMetaDelete = async () => {
    if (!metaDeleteDialog) return;
    try {
      const { type, id } = metaDeleteDialog;
      if (type === "campaign") {
        await facebookAPI.deleteCampaign(id);
        setMetaCampaigns((p) => p.filter((c) => c.id !== id));
      } else if (type === "adset") {
        await facebookAPI.deleteAdSet(id);
        setAdSets((p) => p.filter((s) => s.id !== id));
      } else {
        await facebookAPI.deleteAd(id);
        setAds((p) => p.filter((a) => a.id !== id));
      }
      toast({ title: "Deleted" });
      setMetaDeleteDialog(null);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleLaunch = async (id: string) => {
    setActionId(id);
    try {
      await campaignAPI.launch(id);
      toast({
        title: "Campaign launched!",
        description: "Messages are being sent.",
      });
      fetchMine();
    } catch (err: any) {
      toast({
        title: "Launch failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleCrmDelete = async () => {
    if (!crmDeleteId) return;
    try {
      await campaignAPI.delete(crmDeleteId);
      toast({ title: "Campaign deleted" });
      setCrmDeleteId(null);
      fetchMine();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const refresh = () => {
    if (tab === "meta") {
      if (metaView === "campaigns") fetchMeta();
      else if (metaView === "adsets" && selectedCampaign)
        fetchAdSets(selectedCampaign.id);
      else if (metaView === "ads" && selectedAdSet) fetchAds(selectedAdSet.id);
    } else if (tab === "whatsapp") fetchWa();
    else fetchMine();
  };

  const totalSent = waCampaigns.reduce((s, c) => s + (c.sentCount || 0), 0);

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-col h-full">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-background">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#FA731C] border-2 border-black nb-shadow flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">Campaigns</h1>
              <p className="text-xs text-muted-foreground">
                Meta Ads · WhatsApp · CRM
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="nb-btn"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            {tab === "mine" && (
              <Button
                size="sm"
                className="nb-btn bg-[#FA731C] text-white hover:bg-[#FA731C]/90"
                onClick={() => navigate("/campaigns/new")}
              >
                <Plus className="w-4 h-4 mr-1" /> New Campaign
              </Button>
            )}
            {tab === "meta" && metaView === "campaigns" && (
              <Button
                size="sm"
                className="nb-btn bg-[#024BAB] text-white hover:bg-[#024BAB]/90"
                onClick={() => {
                  setEditCampaign(null);
                  setCampaignDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> New Campaign
              </Button>
            )}
            {tab === "meta" && metaView === "adsets" && (
              <Button
                size="sm"
                className="nb-btn bg-[#FA731C] text-white hover:bg-[#FA731C]/90"
                onClick={() => {
                  setEditAdSet(null);
                  setAdSetDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> New Ad Set
              </Button>
            )}
            {tab === "meta" && metaView === "ads" && (
              <Button
                size="sm"
                className="nb-btn bg-[#00C48C] text-black hover:bg-[#00C48C]/90"
                onClick={() => {
                  setEditAd(null);
                  setAdDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> New Ad
              </Button>
            )}
          </div>
        </div>

        {}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b-2 border-black bg-[#fafafa]">
          {[
            {
              label: "Meta Active",
              value: metaCampaigns.filter((c) => c.status === "ACTIVE").length,
              color: "text-[#024BAB]",
              icon: Facebook,
            },
            {
              label: "WA Campaigns",
              value: waCampaigns.length,
              color: "text-green-700",
              icon: MessageSquare,
            },
            {
              label: "WA Sent",
              value: totalSent,
              color: "text-[#FA731C]",
              icon: Send,
            },
            {
              label: "CRM Running",
              value: myCampaigns.filter((c) => c.status === "RUNNING").length,
              color: "text-purple-700",
              icon: TrendingUp,
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div>
                <p className={`text-lg font-bold font-display ${s.color}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {}
        <div className="flex border-b-2 border-black px-6 bg-background">
          {(
            [
              {
                id: "meta",
                label: "Meta Ads",
                icon: Facebook,
                count: metaCampaigns.length,
              },
              {
                id: "whatsapp",
                label: "WhatsApp",
                icon: MessageSquare,
                count: waCampaigns.length,
              },
              {
                id: "mine",
                label: "CRM Campaigns",
                icon: Megaphone,
                count: myCampaigns.length,
              },
            ] as {
              id: ActiveTab;
              label: string;
              icon: React.ElementType;
              count: number;
            }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-1 mr-6 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.id
                  ? "border-[#FA731C] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-[10px] bg-black text-white px-1.5 py-0.5 font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && tab !== "meta" ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-w-3xl space-y-3">
              {}
              {tab === "meta" && (
                <MetaAdsContent
                  error={metaError}
                  view={metaView}
                  campaigns={metaCampaigns}
                  adSets={adSets}
                  ads={ads}
                  loading={loading}
                  adSetsLoading={adSetsLoading}
                  adsLoading={adsLoading}
                  selectedCampaign={selectedCampaign}
                  selectedAdSet={selectedAdSet}
                  onDrillToAdSets={drillToAdSets}
                  onDrillToAds={drillToAds}
                  onBack={metaBack}
                  onToggleStatus={toggleMetaStatus}
                  onEdit={(type, item) => {
                    if (type === "campaign") {
                      setEditCampaign(item);
                      setCampaignDialogOpen(true);
                    } else if (type === "adset") {
                      setEditAdSet(item);
                      setAdSetDialogOpen(true);
                    } else {
                      setEditAd(item);
                      setAdDialogOpen(true);
                    }
                  }}
                  onDelete={(type, id) => setMetaDeleteDialog({ type, id })}
                  navigate={navigate}
                />
              )}

              {}
              {tab === "whatsapp" && (
                <>
                  {waCampaigns.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No WhatsApp campaigns yet"
                      desc="Send your first WhatsApp campaign from the messaging page."
                    />
                  ) : (
                    waCampaigns.map((c) => {
                      const total = c.totalCount || 1;
                      const delivPct = Math.round(
                        (c.deliveredCount / total) * 100,
                      );
                      const readPct = Math.round((c.readCount / total) * 100);
                      return (
                        <div
                          key={c._id}
                          className="nb-card nb-card-hover p-4 border-l-4 border-l-green-600"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 bg-green-600 border-2 border-black flex items-center justify-center shrink-0">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h3 className="font-bold text-sm">{c.name}</h3>
                                <span
                                  className={`nb-badge text-[10px] ${WA_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600 border-gray-300"}`}
                                >
                                  {c.status}
                                </span>
                              </div>
                              {c.templateSnapshot?.displayName && (
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Template: {c.templateSnapshot.displayName}
                                </p>
                              )}
                              <div className="flex gap-4 text-xs mb-2">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-gray-500" />
                                  {c.totalCount}
                                </span>
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Send className="w-3 h-3" />
                                  {c.sentCount}
                                </span>
                                <span className="flex items-center gap-1 text-green-700">
                                  <CheckCheck className="w-3 h-3" />
                                  {c.deliveredCount}
                                </span>
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Eye className="w-3 h-3" />
                                  {c.readCount}
                                </span>
                                {c.failedCount > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <AlertCircle className="w-3 h-3" />
                                    {c.failedCount}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-14">
                                    Delivery
                                  </span>
                                  <div className="flex-1 h-2 bg-muted border border-black overflow-hidden">
                                    <div
                                      className="h-full bg-green-600"
                                      style={{ width: `${delivPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-green-700 w-8">
                                    {delivPct}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-14">
                                    Read
                                  </span>
                                  <div className="flex-1 h-2 bg-muted border border-black overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500"
                                      style={{ width: `${readPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-purple-600 w-8">
                                    {readPct}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {c.sentAt
                                  ? `Sent ${formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}`
                                  : format(
                                      new Date(c.createdAt),
                                      "dd MMM yyyy",
                                    )}
                                {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {}
              {tab === "mine" && (
                <>
                  {myCampaigns.length === 0 ? (
                    <EmptyState
                      icon={Megaphone}
                      title="No CRM campaigns yet"
                      desc="Create your first campaign to reach your leads directly from the CRM."
                      action={{
                        label: "New Campaign",
                        onClick: () => navigate("/campaigns/new"),
                      }}
                    />
                  ) : (
                    myCampaigns.map((c) => {
                      const total =
                        c.metrics.total || c.audience.totalContacts || 0;
                      const pct =
                        total > 0
                          ? Math.round((c.metrics.delivered / total) * 100)
                          : 0;
                      return (
                        <div
                          key={c._id}
                          className="nb-card nb-card-hover p-4 border-l-4 border-l-[#FA731C]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 bg-[#FA731C] border-2 border-black flex items-center justify-center shrink-0">
                              <Megaphone className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-bold text-sm">{c.name}</h3>
                                <span
                                  className={`nb-badge text-[10px] ${MY_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600 border-gray-300"}`}
                                >
                                  {c.status}
                                </span>
                                <span className="text-[10px] bg-muted px-2 py-0.5 border-2 border-black font-bold">
                                  {c.type}
                                </span>
                              </div>
                              <div className="flex gap-4 text-xs mb-2">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-gray-500" />
                                  {total} contacts
                                </span>
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Send className="w-3 h-3" />
                                  {c.metrics.sent} sent
                                </span>
                                <span className="flex items-center gap-1 text-green-700">
                                  <CheckCheck className="w-3 h-3" />
                                  {c.metrics.delivered} delivered
                                </span>
                                {c.metrics.failed > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <AlertCircle className="w-3 h-3" />
                                    {c.metrics.failed} failed
                                  </span>
                                )}
                              </div>
                              {total > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex-1 h-2 bg-muted border border-black overflow-hidden">
                                    <div
                                      className="h-full bg-[#FA731C]"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-[#FA731C] w-8">
                                    {pct}%
                                  </span>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(c.createdAt), "dd MMM yyyy")}
                                {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {c.status === "DRAFT" && (
                                <>
                                  {isAdmin && (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs nb-btn bg-[#FA731C] text-white"
                                      onClick={() => handleLaunch(c._id)}
                                      disabled={actionId === c._id}
                                    >
                                      {actionId === c._id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <PlayCircle className="w-3 h-3 mr-1" />
                                      )}
                                      Launch
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                    onClick={() => setCrmDeleteId(c._id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                              {["COMPLETED", "CANCELLED"].includes(
                                c.status,
                              ) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                  onClick={() => setCrmDeleteId(c._id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {}
      <AlertDialog
        open={!!crmDeleteId}
        onOpenChange={() => setCrmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCrmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <AlertDialog
        open={!!metaDeleteDialog}
        onOpenChange={() => setMetaDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {metaDeleteDialog?.type === "campaign"
                ? "Campaign"
                : metaDeleteDialog?.type === "adset"
                  ? "Ad Set"
                  : "Ad"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it from Meta. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMetaDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <CampaignFormDialog
        open={campaignDialogOpen}
        onClose={() => {
          setCampaignDialogOpen(false);
          setEditCampaign(null);
        }}
        campaign={editCampaign}
        toast={toast}
        onSaved={fetchMeta}
      />

      {}
      {selectedCampaign && (
        <AdSetFormDialog
          open={adSetDialogOpen}
          onClose={() => {
            setAdSetDialogOpen(false);
            setEditAdSet(null);
          }}
          adSet={editAdSet}
          campaignId={selectedCampaign.id}
          toast={toast}
          onSaved={() => fetchAdSets(selectedCampaign.id)}
        />
      )}

      {}
      {selectedAdSet && (
        <AdFormDialog
          open={adDialogOpen}
          onClose={() => {
            setAdDialogOpen(false);
            setEditAd(null);
          }}
          ad={editAd}
          adSetId={selectedAdSet.id}
          campaignId={selectedAdSet.campaign_id}
          toast={toast}
          onSaved={() => fetchAds(selectedAdSet.id)}
        />
      )}
    </AppLayout>
  );
}

function MetaAdsContent({
  error,
  view,
  campaigns,
  adSets,
  ads,
  loading,
  adSetsLoading,
  adsLoading,
  selectedCampaign,
  selectedAdSet,
  onDrillToAdSets,
  onDrillToAds,
  onBack,
  onToggleStatus,
  onEdit,
  onDelete,
  navigate,
}: {
  error: string | null;
  view: MetaView;
  campaigns: MetaCampaign[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
  loading: boolean;
  adSetsLoading: boolean;
  adsLoading: boolean;
  selectedCampaign: MetaCampaign | null;
  selectedAdSet: MetaAdSet | null;
  onDrillToAdSets: (c: MetaCampaign) => void;
  onDrillToAds: (s: MetaAdSet) => void;
  onBack: () => void;
  onToggleStatus: (
    type: "campaign" | "adset" | "ad",
    id: string,
    status: string,
  ) => void;
  onEdit: (type: "campaign" | "adset" | "ad", item: any) => void;
  onDelete: (type: "campaign" | "adset" | "ad", id: string) => void;
  navigate: (path: string) => void;
}) {
  if (error) {
    return (
      <div className="nb-card p-5">
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
            {error.includes("permission") ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-bold text-foreground">To fix this:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Go to <strong>Integrations → Facebook</strong>
                  </li>
                  <li>
                    Click <strong>Disconnect</strong> then reconnect
                  </li>
                  <li>Allow Ads permissions when prompted</li>
                </ol>
              </div>
            ) : (
              <Button
                size="sm"
                className="nb-btn"
                variant="outline"
                onClick={() => navigate("/integrations")}
              >
                Go to Integrations
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {}
      {view !== "campaigns" && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-[#f0f0f0] border-2 border-black nb-shadow-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-bold hover:text-[#024BAB] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {view === "adsets" ? "Campaigns" : "Ad Sets"}
          </button>
          {view === "adsets" && selectedCampaign && (
            <>
              <span className="text-muted-foreground font-bold">/</span>
              <span className="text-sm font-bold text-[#024BAB] truncate">
                {selectedCampaign.name}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground font-semibold">
                Ad Sets
              </span>
            </>
          )}
          {view === "ads" && selectedCampaign && selectedAdSet && (
            <>
              <span className="text-muted-foreground font-bold">/</span>
              <span className="text-sm font-bold text-[#024BAB] truncate max-w-[120px]">
                {selectedCampaign.name}
              </span>
              <span className="text-muted-foreground font-bold">/</span>
              <span className="text-sm font-bold text-[#FA731C] truncate max-w-[120px]">
                {selectedAdSet.name}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground font-semibold">
                Ads
              </span>
            </>
          )}
        </div>
      )}

      {}
      {view === "campaigns" &&
        (loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Facebook}
            title="No Meta Campaigns"
            desc="No active ad campaigns in your connected ad accounts."
          />
        ) : (
          campaigns.map((c) => {
            const st = META_STATUS[c.status] || {
              cls: "bg-gray-200 text-gray-700 border-black",
              label: c.status,
            };
            return (
              <div
                key={c.id}
                className="nb-card nb-card-hover border-l-4 border-l-[#024BAB]"
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                    <Facebook className="w-5 h-5 text-white" />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onDrillToAdSets(c)}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-sm">{c.name}</h3>
                      <span className={`nb-badge text-[10px] ${st.cls}`}>
                        {st.label}
                      </span>
                      {c.objective && (
                        <span className="text-[10px] bg-[#024BAB]/10 text-[#024BAB] px-2 py-0.5 border border-[#024BAB] font-bold">
                          {META_OBJECTIVES[c.objective] ||
                            c.objective.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {c.adAccountName}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {(c.daily_budget || c.lifetime_budget) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {c.daily_budget
                            ? `₹${(+c.daily_budget / 100).toLocaleString()}/day`
                            : `₹${(+(c.lifetime_budget || "0") / 100).toLocaleString()} total`}
                        </span>
                      )}
                      {c.budget_remaining && (
                        <span className="flex items-center gap-1 text-[#024BAB] font-semibold">
                          <BarChart3 className="w-3 h-3" />₹
                          {(+c.budget_remaining / 100).toLocaleString()} left
                        </span>
                      )}
                      {c.start_time && (
                        <span>
                          {format(new Date(c.start_time), "dd MMM")} →{" "}
                          {c.stop_time
                            ? format(new Date(c.stop_time), "dd MMM yyyy")
                            : "ongoing"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ActionButtons
                    status={c.status}
                    onToggle={() => onToggleStatus("campaign", c.id, c.status)}
                    onEdit={() => onEdit("campaign", c)}
                    onDelete={() => onDelete("campaign", c.id)}
                    onDrill={() => onDrillToAdSets(c)}
                    drillColor="#024BAB"
                    externalUrl={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.id}`}
                  />
                </div>
              </div>
            );
          })
        ))}

      {}
      {view === "adsets" &&
        (adSetsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : adSets.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Ad Sets"
            desc="No ad sets found for this campaign. Create one to start targeting."
          />
        ) : (
          adSets.map((s) => {
            const st = META_STATUS[s.status] || {
              cls: "bg-gray-200 text-gray-700 border-black",
              label: s.status,
            };
            return (
              <div
                key={s.id}
                className="nb-card nb-card-hover border-l-4 border-l-[#FA731C]"
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FA731C] border-2 border-black flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onDrillToAds(s)}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-sm">{s.name}</h3>
                      <span className={`nb-badge text-[10px] ${st.cls}`}>
                        {st.label}
                      </span>
                      {s.optimization_goal && (
                        <span className="text-[10px] bg-[#FA731C]/10 text-[#FA731C] px-2 py-0.5 border border-[#FA731C] font-bold">
                          {s.optimization_goal.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {(s.daily_budget || s.lifetime_budget) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {s.daily_budget
                            ? `₹${(+s.daily_budget / 100).toLocaleString()}/day`
                            : `₹${(+(s.lifetime_budget || "0") / 100).toLocaleString()} total`}
                        </span>
                      )}
                      {s.targeting?.age_min && s.targeting?.age_max && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Age {s.targeting.age_min}–{s.targeting.age_max}
                        </span>
                      )}
                      {s.start_time && (
                        <span>
                          {format(new Date(s.start_time), "dd MMM")} →{" "}
                          {s.end_time
                            ? format(new Date(s.end_time), "dd MMM yyyy")
                            : "ongoing"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ActionButtons
                    status={s.status}
                    onToggle={() => onToggleStatus("adset", s.id, s.status)}
                    onEdit={() => onEdit("adset", s)}
                    onDelete={() => onDelete("adset", s.id)}
                    onDrill={() => onDrillToAds(s)}
                    drillColor="#FA731C"
                  />
                </div>
              </div>
            );
          })
        ))}

      {}
      {view === "ads" &&
        (adsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : ads.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No Ads"
            desc="No ads found for this ad set. Create one to start running ads."
          />
        ) : (
          ads.map((a) => {
            const st = META_STATUS[a.status] || {
              cls: "bg-gray-200 text-gray-700 border-black",
              label: a.status,
            };
            return (
              <div
                key={a.id}
                className="nb-card nb-card-hover border-l-4 border-l-[#00C48C]"
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#00C48C] border-2 border-black flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-sm">{a.name}</h3>
                      <span className={`nb-badge text-[10px] ${st.cls}`}>
                        {st.label}
                      </span>
                      {a.creative?.call_to_action_type && (
                        <span className="text-[10px] bg-[#00C48C]/20 text-green-800 px-2 py-0.5 border border-green-700 font-bold">
                          {a.creative.call_to_action_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {a.creative?.title && (
                      <p className="text-xs font-bold mb-0.5">
                        {a.creative.title}
                      </p>
                    )}
                    {a.creative?.body && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {a.creative.body}
                      </p>
                    )}
                    {a.creative?.link_url && (
                      <p className="text-[10px] text-[#024BAB] truncate mt-0.5">
                        {a.creative.link_url}
                      </p>
                    )}
                  </div>
                  <ActionButtons
                    status={a.status}
                    onToggle={() => onToggleStatus("ad", a.id, a.status)}
                    onEdit={() => onEdit("ad", a)}
                    onDelete={() => onDelete("ad", a.id)}
                  />
                </div>
              </div>
            );
          })
        ))}
    </>
  );
}

function ActionButtons({
  status,
  onToggle,
  onEdit,
  onDelete,
  onDrill,
  drillColor,
  externalUrl,
}: {
  status: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDrill?: () => void;
  drillColor?: string;
  externalUrl?: string;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onToggle}
        className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-[#FFDE00] transition-colors"
        title={status === "ACTIVE" ? "Pause" : "Resume"}
      >
        {status === "ACTIVE" ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={onEdit}
        className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-muted transition-colors"
        title="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
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
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center border-2 border-black hover:bg-red-100 text-red-600 transition-colors"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {onDrill && (
        <button
          onClick={onDrill}
          className="w-7 h-7 flex items-center justify-center border-2 border-black text-white transition-colors"
          style={{ backgroundColor: drillColor }}
          title="View contents"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function CampaignFormDialog({
  open,
  onClose,
  campaign,
  toast,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campaign: MetaCampaign | null;
  toast: any;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(campaign?.name || "");
  const [objective, setObjective] = useState(
    campaign?.objective || "OUTCOME_TRAFFIC",
  );
  const [status, setStatus] = useState(campaign?.status || "PAUSED");
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">(
    campaign?.daily_budget ? "daily" : "lifetime",
  );
  const [budget, setBudget] = useState(
    campaign?.daily_budget
      ? String(+campaign.daily_budget / 100)
      : campaign?.lifetime_budget
        ? String(+campaign.lifetime_budget / 100)
        : "",
  );
  const [startDate, setStartDate] = useState(
    campaign?.start_time
      ? format(new Date(campaign.start_time), "yyyy-MM-dd")
      : "",
  );
  const [stopDate, setStopDate] = useState(
    campaign?.stop_time
      ? format(new Date(campaign.stop_time), "yyyy-MM-dd")
      : "",
  );

  const handleSave = async () => {
    if (!name.trim() || !budget) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        objective,
        status,
        ...(startDate && { start_time: new Date(startDate).toISOString() }),
        ...(stopDate && { stop_time: new Date(stopDate).toISOString() }),
        ...(budgetType === "daily"
          ? { daily_budget: String(+budget * 100) }
          : { lifetime_budget: String(+budget * 100) }),
      };
      if (campaign) {
        await facebookAPI.updateCampaign(campaign.id, data);
        toast({ title: "Campaign updated" });
      } else {
        await facebookAPI.createCampaign(data);
        toast({ title: "Campaign created" });
      }
      onClose();
      onSaved();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-6 h-6 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
              <Facebook className="w-3.5 h-3.5 text-white" />
            </div>
            {campaign ? "Edit Campaign" : "New Campaign"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Campaign Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale 2024"
              className="mt-1 nb-input"
            />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Objective *
            </Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger className="mt-1 nb-input">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 nb-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Budget Type
              </Label>
              <Select
                value={budgetType}
                onValueChange={(v) => setBudgetType(v as "daily" | "lifetime")}
              >
                <SelectTrigger className="mt-1 nb-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Budget</SelectItem>
                  <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Budget (₹) *
            </Label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 1000"
              min="1"
              className="mt-1 nb-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 nb-input"
              />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                End Date
              </Label>
              <Input
                type="date"
                value={stopDate}
                onChange={(e) => setStopDate(e.target.value)}
                className="mt-1 nb-input"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="nb-btn">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !budget}
            className="nb-btn bg-[#024BAB] text-white hover:bg-[#024BAB]/90"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {campaign ? "Update" : "Create"} Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdSetFormDialog({
  open,
  onClose,
  adSet,
  campaignId,
  toast,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  adSet: MetaAdSet | null;
  campaignId: string;
  toast: any;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(adSet?.name || "");
  const [status, setStatus] = useState(adSet?.status || "PAUSED");
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">(
    adSet?.daily_budget ? "daily" : "lifetime",
  );
  const [budget, setBudget] = useState(
    adSet?.daily_budget
      ? String(+adSet.daily_budget / 100)
      : adSet?.lifetime_budget
        ? String(+adSet.lifetime_budget / 100)
        : "",
  );
  const [ageMin, setAgeMin] = useState(String(adSet?.targeting?.age_min || 18));
  const [ageMax, setAgeMax] = useState(String(adSet?.targeting?.age_max || 65));
  const [optimizationGoal, setOptimizationGoal] = useState(
    adSet?.optimization_goal || "LINK_CLICKS",
  );
  const [billingEvent, setBillingEvent] = useState(
    adSet?.billing_event || "IMPRESSIONS",
  );
  const [startDate, setStartDate] = useState(
    adSet?.start_time ? format(new Date(adSet.start_time), "yyyy-MM-dd") : "",
  );
  const [endDate, setEndDate] = useState(
    adSet?.end_time ? format(new Date(adSet.end_time), "yyyy-MM-dd") : "",
  );

  const handleSave = async () => {
    if (!name.trim() || !budget) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        campaign_id: campaignId,
        status,
        targeting: { age_min: +ageMin, age_max: +ageMax },
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        ...(startDate && { start_time: new Date(startDate).toISOString() }),
        ...(endDate && { end_time: new Date(endDate).toISOString() }),
        ...(budgetType === "daily"
          ? { daily_budget: String(+budget * 100) }
          : { lifetime_budget: String(+budget * 100) }),
      };
      if (adSet) {
        await facebookAPI.updateAdSet(adSet.id, data);
        toast({ title: "Ad Set updated" });
      } else {
        await facebookAPI.createAdSet(data);
        toast({ title: "Ad Set created" });
      }
      onClose();
      onSaved();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-6 h-6 bg-[#FA731C] border-2 border-black flex items-center justify-center shrink-0">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
            {adSet ? "Edit Ad Set" : "New Ad Set"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Ad Set Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Young Adults 18-35"
              className="mt-1 nb-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 nb-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Budget Type
              </Label>
              <Select
                value={budgetType}
                onValueChange={(v) => setBudgetType(v as "daily" | "lifetime")}
              >
                <SelectTrigger className="mt-1 nb-input">
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
            <Label className="font-bold text-xs uppercase tracking-wide">
              Budget (₹) *
            </Label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="500"
              className="mt-1 nb-input"
            />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Age Range
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                min="13"
                max="65"
                className="nb-input text-center"
              />
              <span className="font-bold text-muted-foreground shrink-0">
                to
              </span>
              <Input
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                min="13"
                max="65"
                className="nb-input text-center"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Optimization Goal
              </Label>
              <Select
                value={optimizationGoal}
                onValueChange={setOptimizationGoal}
              >
                <SelectTrigger className="mt-1 nb-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "LINK_CLICKS",
                    "IMPRESSIONS",
                    "REACH",
                    "LANDING_PAGE_VIEWS",
                    "LEAD_GENERATION",
                    "OFFSITE_CONVERSIONS",
                  ].map((g) => (
                    <SelectItem key={g} value={g}>
                      {g.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                Billing Event
              </Label>
              <Select value={billingEvent} onValueChange={setBillingEvent}>
                <SelectTrigger className="mt-1 nb-input">
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
              <Label className="font-bold text-xs uppercase tracking-wide">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 nb-input"
              />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-wide">
                End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 nb-input"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="nb-btn">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !budget}
            className="nb-btn bg-[#FA731C] text-white hover:bg-[#FA731C]/90"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {adSet ? "Update" : "Create"} Ad Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdFormDialog({
  open,
  onClose,
  ad,
  adSetId,
  campaignId,
  toast,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  ad: MetaAd | null;
  adSetId: string;
  campaignId: string;
  toast: any;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(ad?.name || "");
  const [status, setStatus] = useState(ad?.status || "PAUSED");
  const [title, setTitle] = useState(ad?.creative?.title || "");
  const [body, setBody] = useState(ad?.creative?.body || "");
  const [imageUrl, setImageUrl] = useState(ad?.creative?.image_url || "");
  const [linkUrl, setLinkUrl] = useState(ad?.creative?.link_url || "");
  const [cta, setCta] = useState(
    ad?.creative?.call_to_action_type || "LEARN_MORE",
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        adset_id: adSetId,
        campaign_id: campaignId,
        status,
        creative: {
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
          link_url: linkUrl.trim() || undefined,
          call_to_action_type: cta,
        },
      };
      if (ad) {
        await facebookAPI.updateAd(ad.id, data);
        toast({ title: "Ad updated" });
      } else {
        await facebookAPI.createAd(data);
        toast({ title: "Ad created" });
      }
      onClose();
      onSaved();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-6 h-6 bg-[#00C48C] border-2 border-black flex items-center justify-center shrink-0">
              <ImageIcon className="w-3.5 h-3.5 text-black" />
            </div>
            {ad ? "Edit Ad" : "New Ad"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Ad Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale — Main Banner"
              className="mt-1 nb-input"
            />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-wide">
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 nb-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {}
          <div className="border-t-2 border-black pt-4">
            <p className="text-xs font-bold uppercase tracking-wide mb-3">
              Creative
            </p>
            <div className="space-y-3">
              <div>
                <Label className="font-bold text-xs uppercase tracking-wide">
                  Headline
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Shop the Summer Sale!"
                  className="mt-1 nb-input"
                />
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-wide">
                  Ad Body
                </Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Discover amazing deals..."
                  rows={3}
                  className="mt-1 nb-input resize-none"
                />
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-wide">
                  Image URL
                </Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 nb-input"
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="mt-2 border-2 border-black max-h-32 object-cover w-full"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).style.display = "none")
                    }
                  />
                )}
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-wide">
                  Destination URL
                </Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://yoursite.com/sale"
                  className="mt-1 nb-input"
                />
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-wide">
                  Call to Action
                </Label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger className="mt-1 nb-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "LEARN_MORE",
                      "SHOP_NOW",
                      "SIGN_UP",
                      "GET_QUOTE",
                      "CONTACT_US",
                      "BOOK_NOW",
                      "DOWNLOAD",
                    ].map((c) => (
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
          <Button variant="outline" onClick={onClose} className="nb-btn">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="nb-btn bg-[#00C48C] text-black hover:bg-[#00C48C]/90"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {ad ? "Update" : "Create"} Ad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border-2 border-dashed border-black bg-[#fafafa]">
      <div className="w-12 h-12 border-2 border-black bg-muted flex items-center justify-center nb-shadow">
        <Icon className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
      {action && (
        <Button
          size="sm"
          className="nb-btn mt-1"
          variant="outline"
          onClick={action.onClick}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> {action.label}
        </Button>
      )}
    </div>
  );
}
