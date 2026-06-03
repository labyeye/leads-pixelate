import { AppLayout } from "@/components/layout/AppLayout";
import { campaignAPI, whatsappAPI, facebookAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface MyCampaign {
  _id: string;
  name: string;
  status: string;
  type: string;
  audience: { totalContacts: number };
  metrics: { total: number; sent: number; delivered: number; read: number; failed: number };
  createdAt: string;
  launchedAt?: string;
  createdBy?: { name: string };
}

type ActiveTab = "meta" | "whatsapp" | "mine";

const WA_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  SENDING:   "bg-blue-100 text-blue-700 border-blue-200",
  FAILED:    "bg-red-100 text-red-700 border-red-200",
  PARTIAL:   "bg-orange-100 text-orange-700 border-orange-200",
  DRAFT:     "bg-gray-100 text-gray-600 border-gray-200",
};

const META_STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700 border-green-200",
  PAUSED:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  DELETED:  "bg-red-100 text-red-700 border-red-200",
  ARCHIVED: "bg-gray-100 text-gray-600 border-gray-200",
};

const MY_STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-600 border-gray-200",
  RUNNING:   "bg-blue-100 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  PAUSED:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [tab, setTab] = useState<ActiveTab>("meta");
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [waCampaigns, setWaCampaigns]     = useState<WaCampaign[]>([]);
  const [myCampaigns, setMyCampaigns]     = useState<MyCampaign[]>([]);
  const [loading, setLoading]             = useState(false);
  const [metaError, setMetaError]         = useState<string | null>(null);
  const [actionId, setActionId]           = useState<string | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);

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

  const fetchWa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setWaCampaigns(res.data || []);
    } catch {
      toast({ title: "Failed to load WhatsApp campaigns", variant: "destructive" });
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
    if (tab === "meta")          fetchMeta();
    else if (tab === "whatsapp") fetchWa();
    else                         fetchMine();
  }, [tab]);

  const handleLaunch = async (id: string) => {
    setActionId(id);
    try {
      await campaignAPI.launch(id);
      toast({ title: "Campaign launched!", description: "Messages are being sent." });
      fetchMine();
    } catch (err: any) {
      toast({ title: "Launch failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await campaignAPI.delete(deleteId);
      toast({ title: "Campaign deleted" });
      setDeleteId(null);
      fetchMine();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const refresh = () => {
    if (tab === "meta")          fetchMeta();
    else if (tab === "whatsapp") fetchWa();
    else                         fetchMine();
  };

  const totalSent = waCampaigns.reduce((s, c) => s + (c.sentCount || 0), 0);

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Campaigns</h1>
              <p className="text-xs text-muted-foreground">Meta Ads · WhatsApp · CRM</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              onClick={() => navigate("/campaigns/new")}
            >
              <Plus className="w-4 h-4 mr-1" /> New Campaign
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-border bg-muted/20">
          {[
            { label: "Meta Active",  value: metaCampaigns.filter(c => c.status === "ACTIVE").length,  color: "text-blue-600",   icon: Facebook    },
            { label: "WA Campaigns", value: waCampaigns.length,                                        color: "text-green-600",  icon: MessageSquare },
            { label: "WA Sent",      value: totalSent,                                                 color: "text-orange-600", icon: Send        },
            { label: "CRM Running",  value: myCampaigns.filter(c => c.status === "RUNNING").length,   color: "text-purple-600", icon: TrendingUp  },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 bg-background">
          {([
            { id: "meta",     label: "Meta Ads",      icon: Facebook,      count: metaCampaigns.length },
            { id: "whatsapp", label: "WhatsApp",       icon: MessageSquare, count: waCampaigns.length   },
            { id: "mine",     label: "CRM Campaigns",  icon: Megaphone,     count: myCampaigns.length   },
          ] as { id: ActiveTab; label: string; icon: React.ElementType; count: number }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.id ? "border-orange-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-semibold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-w-3xl space-y-3">

              {/* ── META ADS ── */}
              {tab === "meta" && (
                <>
                  {metaError ? (
                    <div className="rounded-xl border border-border p-5 bg-background">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <Info className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">
                            {metaError.includes("permission")
                              ? "Ads Permission Required"
                              : "Facebook Not Connected"}
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">{metaError}</p>
                          {metaError.includes("permission") ? (
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <p className="font-semibold text-foreground">To fix this:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Go to <strong>Integrations → Facebook</strong></li>
                                <li>Click <strong>Disconnect</strong></li>
                                <li>Click <strong>Connect Facebook</strong> again</li>
                                <li>This time it will request Ads permissions</li>
                              </ol>
                              <p className="mt-2">
                                Also add <code className="bg-muted px-1 rounded">ads_read</code> permission in{" "}
                                <strong>Meta Developer Console → Your App → App Review → Permissions</strong>
                              </p>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => navigate("/integrations")}>
                              Go to Integrations
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : metaCampaigns.length === 0 ? (
                    <EmptyState icon={Facebook} title="No Meta Campaigns found" desc="No active ad campaigns in your connected ad accounts." />
                  ) : (
                    metaCampaigns.map((c) => (
                      <div key={c.id} className="border border-border rounded-xl p-4 bg-background hover:border-blue-200 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Facebook className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-sm">{c.name}</h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${META_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                {c.status}
                              </span>
                              {c.objective && (
                                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
                                  {c.objective.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{c.adAccountName}</p>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {(c.daily_budget || c.lifetime_budget) && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {c.daily_budget
                                    ? `₹${(+c.daily_budget / 100).toLocaleString()}/day`
                                    : `₹${(+c.lifetime_budget! / 100).toLocaleString()} total`}
                                </span>
                              )}
                              {c.budget_remaining && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <BarChart3 className="w-3 h-3" />
                                  ₹{(+c.budget_remaining / 100).toLocaleString()} remaining
                                </span>
                              )}
                              {c.start_time && (
                                <span>{format(new Date(c.start_time), "dd MMM yyyy")} → {c.stop_time ? format(new Date(c.stop_time), "dd MMM yyyy") : "ongoing"}</span>
                              )}
                            </div>
                          </div>
                          <a
                            href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                            title="Open in Ads Manager"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* ── WHATSAPP ── */}
              {tab === "whatsapp" && (
                <>
                  {waCampaigns.length === 0 ? (
                    <EmptyState icon={MessageSquare} title="No WhatsApp campaigns yet" desc="Send your first WhatsApp campaign from the messaging page." />
                  ) : (
                    waCampaigns.map((c) => {
                      const total = c.totalCount || 1;
                      const delivPct = Math.round((c.deliveredCount / total) * 100);
                      const readPct  = Math.round((c.readCount / total) * 100);
                      return (
                        <div key={c._id} className="border border-border rounded-xl p-4 bg-background hover:border-green-200 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h3 className="font-semibold text-sm">{c.name}</h3>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${WA_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                  {c.status}
                                </span>
                              </div>
                              {c.templateSnapshot?.displayName && (
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Template: {c.templateSnapshot.displayName}
                                </p>
                              )}
                              {/* Metrics */}
                              <div className="flex gap-4 text-xs mb-2">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3 text-gray-500" />{c.totalCount}</span>
                                <span className="flex items-center gap-1 text-blue-600"><Send className="w-3 h-3" />{c.sentCount}</span>
                                <span className="flex items-center gap-1 text-green-600"><CheckCheck className="w-3 h-3" />{c.deliveredCount}</span>
                                <span className="flex items-center gap-1 text-purple-600"><Eye className="w-3 h-3" />{c.readCount}</span>
                                {c.failedCount > 0 && (
                                  <span className="flex items-center gap-1 text-red-600"><AlertCircle className="w-3 h-3" />{c.failedCount}</span>
                                )}
                              </div>
                              {/* Progress */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-14">Delivery</span>
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${delivPct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-semibold text-green-600 w-8">{delivPct}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-14">Read</span>
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${readPct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-semibold text-purple-600 w-8">{readPct}%</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {c.sentAt
                                  ? `Sent ${formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}`
                                  : format(new Date(c.createdAt), "dd MMM yyyy")}
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

              {/* ── CRM CAMPAIGNS ── */}
              {tab === "mine" && (
                <>
                  {myCampaigns.length === 0 ? (
                    <EmptyState
                      icon={Megaphone}
                      title="No CRM campaigns yet"
                      desc="Create your first campaign to reach your leads directly from the CRM."
                      action={{ label: "New Campaign", onClick: () => navigate("/campaigns/new") }}
                    />
                  ) : (
                    myCampaigns.map((c) => {
                      const total = c.metrics.total || c.audience.totalContacts || 0;
                      const pct   = total > 0 ? Math.round((c.metrics.delivered / total) * 100) : 0;
                      return (
                        <div key={c._id} className="border border-border rounded-xl p-4 bg-background hover:border-orange-200 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                              <Megaphone className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-sm">{c.name}</h3>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${MY_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                  {c.status}
                                </span>
                                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{c.type}</span>
                              </div>
                              <div className="flex gap-4 text-xs mb-2">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3 text-gray-500" />{total} contacts</span>
                                <span className="flex items-center gap-1 text-blue-600"><Send className="w-3 h-3" />{c.metrics.sent} sent</span>
                                <span className="flex items-center gap-1 text-green-600"><CheckCheck className="w-3 h-3" />{c.metrics.delivered} delivered</span>
                                {c.metrics.failed > 0 && (
                                  <span className="flex items-center gap-1 text-red-600"><AlertCircle className="w-3 h-3" />{c.metrics.failed} failed</span>
                                )}
                              </div>
                              {total > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-semibold text-orange-600 w-8">{pct}%</span>
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
                                      className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                                      onClick={() => handleLaunch(c._id)}
                                      disabled={actionId === c._id}
                                    >
                                      {actionId === c._id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <PlayCircle className="w-3 h-3 mr-1" />}
                                      Launch
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" onClick={() => setDeleteId(c._id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                              {["COMPLETED", "CANCELLED"].includes(c.status) && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" onClick={() => setDeleteId(c._id)}>
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
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
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed border-border rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {action.label}
        </Button>
      )}
    </div>
  );
}
