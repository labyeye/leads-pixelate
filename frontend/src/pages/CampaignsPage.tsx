import { AppLayout } from "@/components/layout/AppLayout";
import { campaignAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
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
  Megaphone,
  Plus,
  Loader2,
  RefreshCw,
  Users,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  BarChart3,
  Pencil,
  Trash2,
  PlayCircle,
  PauseCircle,
  StopCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  _id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  audience: {
    targetType: string;
    totalContacts: number;
  };
  metrics: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
  };
  createdBy?: { name: string };
  launchedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  draft: number;
  running: number;
  completed: number;
  cancelled: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Pencil },
  RUNNING: { label: "Running", color: "bg-blue-100 text-blue-700 border-blue-200", icon: PlayCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  PAUSED: { label: "Paused", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: PauseCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const FILTER_TABS = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Draft" },
  { id: "RUNNING", label: "Running" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "ALL" ? { status: filter } : {};
      const [campaignsRes, statsRes] = await Promise.all([
        campaignAPI.getAll(params),
        campaignAPI.getStats(),
      ]);
      setCampaigns(campaignsRes.data);
      setStats(statsRes.data);
    } catch {
      toast({ title: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLaunch = async (id: string) => {
    setActionLoading(id);
    try {
      await campaignAPI.launch(id);
      toast({ title: "Campaign launched!", description: "Messages are being sent." });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Launch failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await campaignAPI.pause(id);
      toast({ title: "Campaign paused" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await campaignAPI.delete(deleteId);
      toast({ title: "Campaign deleted" });
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await campaignAPI.cancel(cancelId);
      toast({ title: "Campaign cancelled" });
      setCancelId(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

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
              <p className="text-xs text-muted-foreground">
                Create and manage WhatsApp outreach campaigns
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            onClick={() => navigate("/campaigns/new")}
          >
            <Plus className="w-4 h-4 mr-1" /> New Campaign
          </Button>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 px-6 py-3 border-b border-border bg-muted/20">
            {[
              { label: "Total", value: stats.total, color: "text-gray-700" },
              { label: "Draft", value: stats.draft, color: "text-gray-500" },
              { label: "Running", value: stats.running, color: "text-blue-600" },
              { label: "Completed", value: stats.completed, color: "text-green-600" },
              { label: "Total Sent", value: stats.totalSent, color: "text-orange-600" },
              { label: "Delivered", value: stats.totalDelivered, color: "text-purple-600" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs + refresh */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === t.id ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-accent"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="shrink-0 ml-3">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Campaign list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-orange-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first campaign to start reaching your leads.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
                onClick={() => navigate("/campaigns/new")}
              >
                <Plus className="w-4 h-4 mr-1" /> New Campaign
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 max-w-4xl">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign._id}
                  campaign={campaign}
                  isAdmin={isAdmin}
                  actionLoading={actionLoading === campaign._id}
                  onEdit={() => navigate(`/campaigns/${campaign._id}/edit`)}
                  onLaunch={() => handleLaunch(campaign._id)}
                  onPause={() => handlePause(campaign._id)}
                  onCancel={() => setCancelId(campaign._id)}
                  onDelete={() => setDeleteId(campaign._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel confirm */}
        <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop the campaign. It cannot be restarted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={cancelling}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelling && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Cancel Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({
  campaign,
  isAdmin,
  actionLoading,
  onEdit,
  onLaunch,
  onPause,
  onCancel,
  onDelete,
}: {
  campaign: Campaign;
  isAdmin: boolean;
  actionLoading: boolean;
  onEdit: () => void;
  onLaunch: () => void;
  onPause: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = cfg.icon;
  const total = campaign.metrics.total || campaign.audience.totalContacts || 0;
  const deliveryRate = total > 0 ? Math.round((campaign.metrics.delivered / total) * 100) : 0;
  const readRate = total > 0 ? Math.round((campaign.metrics.read / total) * 100) : 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden hover:border-orange-200 transition-colors">
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-orange-600" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + status */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}
              >
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
              <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {campaign.type}
              </span>
            </div>

            {campaign.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                {campaign.description}
              </p>
            )}

            {/* Metrics row */}
            <div className="flex items-center gap-4 flex-wrap">
              <MetricBadge icon={Users} value={total} label="Contacts" color="text-gray-600" />
              <MetricBadge icon={Send} value={campaign.metrics.sent} label="Sent" color="text-blue-600" />
              <MetricBadge icon={CheckCheck} value={campaign.metrics.delivered} label="Delivered" color="text-green-600" />
              <MetricBadge icon={Eye} value={campaign.metrics.read} label="Read" color="text-purple-600" />
              {campaign.metrics.failed > 0 && (
                <MetricBadge icon={AlertCircle} value={campaign.metrics.failed} label="Failed" color="text-red-600" />
              )}
            </div>

            {/* Progress bar (only for completed/running) */}
            {["RUNNING", "COMPLETED"].includes(campaign.status) && total > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Delivery rate</span>
                  <span className="font-medium text-green-600">{deliveryRate}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all"
                    style={{ width: `${deliveryRate}%` }}
                  />
                </div>
                {readRate > 0 && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Read rate</span>
                      <span className="font-medium text-purple-600">{readRate}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all"
                        style={{ width: `${readRate}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Footer info */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              {campaign.createdBy && (
                <span>By {campaign.createdBy.name}</span>
              )}
              {campaign.launchedAt ? (
                <span className="flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" />
                  Launched {formatDistanceToNow(new Date(campaign.launchedAt), { addSuffix: true })}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Created {format(new Date(campaign.createdAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {campaign.status === "DRAFT" && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={onLaunch}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
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
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}

            {campaign.status === "RUNNING" && isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onPause}
                  disabled={actionLoading}
                >
                  <PauseCircle className="w-3 h-3 mr-1" /> Pause
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-600 hover:bg-red-50"
                  onClick={onCancel}
                >
                  <StopCircle className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </>
            )}

            {["COMPLETED", "CANCELLED"].includes(campaign.status) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
