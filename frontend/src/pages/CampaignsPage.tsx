import { AppLayout } from "@/components/layout/AppLayout";
import { campaignAPI, whatsappAPI, facebookAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Loader2,
  RefreshCw,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Trash2,
  Megaphone,
  MessageSquare,
  Facebook,
  TrendingUp,
  DollarSign,
  MousePointer,
  Users,
  BarChart3,
  ExternalLink,
  Zap,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WaCampaign {
  _id: string;
  name: string;
  status: string;
  templateSnapshot?: { displayName?: string; bodyText?: string };
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

// ─── Status config ─────────────────────────────────────────────────────────────
const WA_STATUS: Record<string, { label: string; bg: string }> = {
  COMPLETED: { label: "COMPLETED", bg: "bg-green-400" },
  SENDING: { label: "SENDING", bg: "bg-blue-400" },
  FAILED: { label: "FAILED", bg: "bg-red-400" },
  PARTIAL: { label: "PARTIAL", bg: "bg-orange-400" },
  DRAFT: { label: "DRAFT", bg: "bg-gray-300" },
};

const META_STATUS: Record<string, { label: string; bg: string }> = {
  ACTIVE: { label: "ACTIVE", bg: "bg-green-400" },
  PAUSED: { label: "PAUSED", bg: "bg-yellow-400" },
  DELETED: { label: "DELETED", bg: "bg-red-400" },
  ARCHIVED: { label: "ARCHIVED", bg: "bg-gray-300" },
};

const MY_STATUS: Record<string, { label: string; bg: string }> = {
  DRAFT: { label: "DRAFT", bg: "bg-gray-300" },
  RUNNING: { label: "RUNNING", bg: "bg-blue-400" },
  COMPLETED: { label: "COMPLETED", bg: "bg-green-400" },
  PAUSED: { label: "PAUSED", bg: "bg-yellow-400" },
  CANCELLED: { label: "CANCELLED", bg: "bg-red-400" },
};

// ─── Main page ────────────────────────────────────────────────────────────────
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
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facebookAPI.getMetaCampaigns();
      setMetaCampaigns(res.data || []);
    } catch (err: any) {
      if (err.message?.includes("not connected")) {
        toast({
          title: "Facebook not connected",
          description: "Connect Facebook in Integrations first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to fetch Meta campaigns",
          description: err.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchWa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setWaCampaigns(res.data || []);
    } catch {
      toast({
        title: "Failed to fetch WhatsApp campaigns",
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
      toast({ title: "Failed to fetch campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === "meta") fetchMeta();
    else if (tab === "whatsapp") fetchWa();
    else fetchMine();
  }, [tab]);

  const handleLaunch = async (id: string) => {
    setActionId(id);
    try {
      await campaignAPI.launch(id);
      toast({ title: "Campaign launched!" });
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

  const handleDelete = async (id: string) => {
    setActionId(id);
    try {
      await campaignAPI.delete(id);
      toast({ title: "Deleted" });
      fetchMine();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const refresh = () => {
    if (tab === "meta") fetchMeta();
    else if (tab === "whatsapp") fetchWa();
    else fetchMine();
  };

  // ─── Stats ───────────────────────────────────────────────────────────────
  const metaActive = metaCampaigns.filter((c) => c.status === "ACTIVE").length;
  const waCompleted = waCampaigns.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const waTotalSent = waCampaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
  const myRunning = myCampaigns.filter((c) => c.status === "RUNNING").length;

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-col h-full bg-[#FFFBF0]">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="border-b-2 border-black px-6 py-4 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-400 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
              <Megaphone className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">
                Campaigns
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                Meta Ads · WhatsApp · CRM
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              className="p-2 border-2 border-black shadow-[3px_3px_0px_0px_#000] bg-white hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => navigate("/campaigns/new")}
              className="flex items-center gap-2 px-4 py-2 bg-orange-400 border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 border-b-2 border-black">
          {[
            {
              label: "Meta Active",
              value: metaActive,
              bg: "bg-blue-300",
              icon: Facebook,
            },
            {
              label: "WA Sent",
              value: waTotalSent,
              bg: "bg-green-300",
              icon: Send,
            },
            {
              label: "WA Completed",
              value: waCompleted,
              bg: "bg-yellow-300",
              icon: CheckCheck,
            },
            {
              label: "CRM Running",
              value: myRunning,
              bg: "bg-orange-300",
              icon: Zap,
            },
          ].map((s, i) => (
            <div
              key={i}
              className={`${s.bg} border-r-2 border-black last:border-r-0 p-4 flex items-center gap-3`}
            >
              <s.icon className="w-5 h-5 text-black shrink-0" />
              <div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex border-b-2 border-black bg-white">
          {(
            [
              { id: "meta", label: "📘 Meta Ads", count: metaCampaigns.length },
              {
                id: "whatsapp",
                label: "💬 WhatsApp",
                count: waCampaigns.length,
              },
              {
                id: "mine",
                label: "⚡ CRM Campaigns",
                count: myCampaigns.length,
              },
            ] as { id: ActiveTab; label: string; count: number }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 font-black text-sm uppercase tracking-wide border-r-2 border-black transition-all ${
                tab === t.id
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 border border-current font-black ${tab === t.id ? "border-white" : "border-black"}`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-orange-400 border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] animate-bounce">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <p className="font-black uppercase text-sm">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              {/* META ADS TAB */}
              {tab === "meta" && (
                <div className="space-y-3">
                  {metaCampaigns.length === 0 ? (
                    <EmptyState
                      icon={Facebook}
                      title="No Meta Campaigns"
                      desc="Connect Facebook in Integrations to see your ad campaigns here."
                      bg="bg-blue-300"
                    />
                  ) : (
                    metaCampaigns.map((c) => (
                      <MetaCampaignCard key={c.id} campaign={c} />
                    ))
                  )}
                </div>
              )}

              {/* WHATSAPP TAB */}
              {tab === "whatsapp" && (
                <div className="space-y-3">
                  {waCampaigns.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No WhatsApp Campaigns"
                      desc="Send your first WhatsApp campaign from the messaging page."
                      bg="bg-green-300"
                    />
                  ) : (
                    waCampaigns.map((c) => (
                      <WaCampaignCard key={c._id} campaign={c} />
                    ))
                  )}
                </div>
              )}

              {/* MY CAMPAIGNS TAB */}
              {tab === "mine" && (
                <div className="space-y-3">
                  {myCampaigns.length === 0 ? (
                    <EmptyState
                      icon={Megaphone}
                      title="No CRM Campaigns"
                      desc="Create your first campaign to start reaching leads."
                      bg="bg-orange-300"
                      action={{
                        label: "+ New Campaign",
                        onClick: () => navigate("/campaigns/new"),
                      }}
                    />
                  ) : (
                    myCampaigns.map((c) => (
                      <MyCampaignCard
                        key={c._id}
                        campaign={c}
                        isAdmin={isAdmin}
                        loading={actionId === c._id}
                        onEdit={() => navigate(`/campaigns/${c._id}/edit`)}
                        onLaunch={() => handleLaunch(c._id)}
                        onDelete={() => handleDelete(c._id)}
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Meta Campaign Card ───────────────────────────────────────────────────────
function MetaCampaignCard({ campaign: c }: { campaign: MetaCampaign }) {
  const st = META_STATUS[c.status] || { label: c.status, bg: "bg-gray-300" };
  const budget = c.daily_budget
    ? `₹${(+c.daily_budget / 100).toLocaleString()}/day`
    : c.lifetime_budget
      ? `₹${(+c.lifetime_budget / 100).toLocaleString()} total`
      : "—";
  const remaining = c.budget_remaining
    ? `₹${(+c.budget_remaining / 100).toLocaleString()} left`
    : null;

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] transition-all">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-300 border-2 border-black flex items-center justify-center shrink-0">
          <Facebook className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-black text-sm">{c.name}</h3>
            <span
              className={`${st.bg} border border-black text-[10px] font-black px-2 py-0.5 uppercase`}
            >
              {st.label}
            </span>
            {c.objective && (
              <span className="bg-gray-100 border border-black text-[10px] font-bold px-2 py-0.5 uppercase">
                {c.objective.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mb-2">
            {c.adAccountName}
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-700" />
              <span className="font-bold">{budget}</span>
            </div>
            {remaining && (
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-blue-700" />
                <span className="font-bold text-blue-700">{remaining}</span>
              </div>
            )}
            {c.start_time && (
              <span className="text-gray-500">
                {format(new Date(c.start_time), "dd MMM yyyy")}
                {c.stop_time
                  ? ` → ${format(new Date(c.stop_time), "dd MMM yyyy")}`
                  : " → ongoing"}
              </span>
            )}
          </div>
        </div>
        <a
          href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all shrink-0"
          title="Open in Ads Manager"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ─── WhatsApp Campaign Card ───────────────────────────────────────────────────
function WaCampaignCard({ campaign: c }: { campaign: WaCampaign }) {
  const st = WA_STATUS[c.status] || { label: c.status, bg: "bg-gray-300" };
  const total = c.totalCount || 1;
  const deliveryPct = Math.round((c.deliveredCount / total) * 100);
  const readPct = Math.round((c.readCount / total) * 100);

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] transition-all">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-green-300 border-2 border-black flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-black text-sm">{c.name}</h3>
            <span
              className={`${st.bg} border border-black text-[10px] font-black px-2 py-0.5 uppercase`}
            >
              {st.label}
            </span>
          </div>
          {c.templateSnapshot?.displayName && (
            <p className="text-[11px] text-gray-500 font-medium mb-2">
              Template: {c.templateSnapshot.displayName}
            </p>
          )}
          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              {
                label: "Total",
                value: c.totalCount,
                icon: Users,
                color: "bg-gray-100",
              },
              {
                label: "Sent",
                value: c.sentCount,
                icon: Send,
                color: "bg-blue-100",
              },
              {
                label: "Delivered",
                value: c.deliveredCount,
                icon: CheckCheck,
                color: "bg-green-100",
              },
              {
                label: "Read",
                value: c.readCount,
                icon: Eye,
                color: "bg-purple-100",
              },
            ].map((m) => (
              <div
                key={m.label}
                className={`${m.color} border border-black p-2 text-center`}
              >
                <m.icon className="w-3 h-3 mx-auto mb-0.5 text-black" />
                <p className="text-sm font-black">{m.value}</p>
                <p className="text-[9px] font-bold uppercase">{m.label}</p>
              </div>
            ))}
          </div>
          {/* Progress bars */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-16 uppercase">
                Delivery
              </span>
              <div className="flex-1 h-2 bg-gray-200 border border-black">
                <div
                  className="h-full bg-green-400 transition-all"
                  style={{ width: `${deliveryPct}%` }}
                />
              </div>
              <span className="text-[10px] font-black w-8">{deliveryPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-16 uppercase">Read</span>
              <div className="flex-1 h-2 bg-gray-200 border border-black">
                <div
                  className="h-full bg-purple-400 transition-all"
                  style={{ width: `${readPct}%` }}
                />
              </div>
              <span className="text-[10px] font-black w-8">{readPct}%</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-2">
            {c.sentAt
              ? `Sent ${format(new Date(c.sentAt), "dd MMM yyyy, h:mm a")}`
              : format(new Date(c.createdAt), "dd MMM yyyy")}
            {c.createdBy ? ` · ${c.createdBy.name}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── My Campaign Card ─────────────────────────────────────────────────────────
function MyCampaignCard({
  campaign: c,
  isAdmin,
  loading,
  onEdit,
  onLaunch,
  onDelete,
}: {
  campaign: MyCampaign;
  isAdmin: boolean;
  loading: boolean;
  onEdit: () => void;
  onLaunch: () => void;
  onDelete: () => void;
}) {
  const st = MY_STATUS[c.status] || { label: c.status, bg: "bg-gray-300" };
  const total = c.metrics.total || c.audience.totalContacts || 0;
  const pct = total > 0 ? Math.round((c.metrics.delivered / total) * 100) : 0;

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] transition-all">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-orange-300 border-2 border-black flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-black text-sm">{c.name}</h3>
            <span
              className={`${st.bg} border border-black text-[10px] font-black px-2 py-0.5 uppercase`}
            >
              {st.label}
            </span>
            <span className="bg-gray-100 border border-black text-[10px] font-bold px-2 py-0.5 uppercase">
              {c.type}
            </span>
          </div>
          <div className="flex gap-4 text-xs mb-2">
            <span className="font-bold">
              <Users className="w-3 h-3 inline mr-1" />
              {total} contacts
            </span>
            <span className="font-bold text-blue-700">
              <Send className="w-3 h-3 inline mr-1" />
              {c.metrics.sent} sent
            </span>
            <span className="font-bold text-green-700">
              <CheckCheck className="w-3 h-3 inline mr-1" />
              {c.metrics.delivered} delivered
            </span>
            {c.metrics.failed > 0 && (
              <span className="font-bold text-red-600">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                {c.metrics.failed} failed
              </span>
            )}
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-gray-200 border border-black">
                <div
                  className="h-full bg-orange-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-black">{pct}%</span>
            </div>
          )}
          <p className="text-[10px] text-gray-400 font-medium">
            {format(new Date(c.createdAt), "dd MMM yyyy")}
            {c.createdBy ? ` · ${c.createdBy.name}` : ""}
          </p>
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {c.status === "DRAFT" && (
            <>
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all bg-white"
              >
                Edit
              </button>
              {isAdmin && (
                <button
                  onClick={onLaunch}
                  disabled={loading}
                  className="px-3 py-1.5 text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all bg-green-400 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Launch"
                  )}
                </button>
              )}
              <button
                onClick={onDelete}
                disabled={loading}
                className="px-3 py-1.5 text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all bg-red-300 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
          {["COMPLETED", "CANCELLED"].includes(c.status) && (
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] transition-all bg-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  desc,
  bg,
  action,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  bg: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="border-2 border-black border-dashed p-12 flex flex-col items-center gap-4 text-center bg-white">
      <div
        className={`w-14 h-14 ${bg} border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000]`}
      >
        <Icon className="w-7 h-7 text-black" />
      </div>
      <p className="font-black text-base uppercase">{title}</p>
      <p className="text-sm text-gray-600 max-w-xs">{desc}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2 bg-orange-400 border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
