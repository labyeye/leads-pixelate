import { AppLayout } from "@/components/layout/AppLayout";
import { socialAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Calendar,
  Plus,
  Loader2,
  RefreshCw,
  Instagram,
  Facebook,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Eye,
  Pencil,
  Trash2,
  Link2,
  Link2Off,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Hash,
  Globe,
  AlertCircle,
  Check,
  ThumbsUp,
  ThumbsDown,
  Zap,
  BarChart3,
  ExternalLink,
  Copy,
  Info,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useSearchParams } from "react-router-dom";

interface SocialPost {
  _id: string;
  caption: string;
  imageUrl?: string;
  hashtags: string[];
  platforms: string[];
  scheduledAt: string;
  status: string;
  approvalNote?: string;
  rejectionReason?: string;
  facebookPostId?: string;
  instagramPostId?: string;
  postedAt?: string;
  failureReason?: string;
  createdBy?: { name: string };
  approvedBy?: { name: string };
  rejectedBy?: { name: string };
  createdAt: string;
}

interface SocialAccount {
  _id: string;
  platform: string;
  accountName: string;
  accountId: string;
  profilePicture?: string;
  isActive: boolean;
  connectedBy?: { name: string };
  createdAt: string;
}

type WizardStep = 1 | 2 | 3;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Pencil,
  },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  SCHEDULED: {
    label: "Scheduled",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Calendar,
  },
  POSTING: {
    label: "Posting...",
    color: "bg-blue-100 text-blue-600 border-blue-200",
    icon: Loader2,
  },
  POSTED: {
    label: "Posted",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertCircle,
  },
};

const FILTER_TABS = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Draft" },
  { id: "PENDING_APPROVAL", label: "Pending" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "POSTED", label: "Posted" },
  { id: "FAILED", label: "Failed" },
];

export default function SocialMediaPlannerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"posts" | "accounts">(
    searchParams.get("tab") === "accounts" ? "accounts" : "posts",
  );

  const [stats, setStats] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await socialAPI.getStats();
      setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast({ title: `Connected! ${connected} account(s) saved.` });
      setActiveTab("accounts");
    }
    if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      setActiveTab("accounts");
    }
  }, [searchParams, toast]);

  return (
    <AppLayout title="Social Media Planner">
      <div className="flex flex-col h-full">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-background">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-900 border-2 border-black nb-shadow flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Social Media Planner</h1>
              <p className="text-xs text-muted-foreground">
                Plan, approve & auto-post to Facebook and Instagram
              </p>
            </div>
          </div>
        </div>

        {}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 border-b border-border bg-muted/20">
            {[
              {
                label: "Total Posts",
                value: stats.total,
                color: "text-gray-700",
              },
              {
                label: "Pending",
                value: stats.pending,
                color: "text-orange-600",
              },
              {
                label: "Scheduled",
                value: stats.scheduled,
                color: "text-primary-900",
              },
              { label: "Posted", value: stats.posted, color: "text-green-600" },
              {
                label: "Connected",
                value: stats.connectedAccounts,
                color: "text-blue-600",
              },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {}
        <div className="flex border-b-2 border-black px-6 bg-background">
          {[
            { id: "posts", label: "Posts" },
            { id: "accounts", label: "Connected Accounts" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3 px-1 mr-6 text-sm font-bold border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-primary-900 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "posts" && (
            <PostsTab
              isAdmin={isAdmin}
              toast={toast}
              onStatsChange={fetchStats}
            />
          )}
          {activeTab === "accounts" && (
            <AccountsTab isAdmin={isAdmin} toast={toast} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function PostsTab({
  isAdmin,
  toast,
  onStatsChange,
}: {
  isAdmin: boolean;
  toast: any;
  onStatsChange: () => void;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approvalDialogPost, setApprovalDialogPost] =
    useState<SocialPost | null>(null);
  const [rejectionDialogPost, setRejectionDialogPost] =
    useState<SocialPost | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "ALL" ? { status: filter } : {};
      const res = await socialAPI.getPosts(params);
      setPosts(res.data);
    } catch {
      toast({ title: "Failed to load posts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmitForApproval = async (post: SocialPost) => {
    setActionLoading(true);
    try {
      await socialAPI.submitPost(post._id);
      toast({ title: "Submitted for approval" });
      await fetchPosts();
      onStatsChange();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalDialogPost) return;
    setActionLoading(true);
    try {
      await socialAPI.approvePost(approvalDialogPost._id);
      toast({
        title: "Post approved!",
        description: "It will be published at the scheduled time.",
      });
      setApprovalDialogPost(null);
      await fetchPosts();
      onStatsChange();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionDialogPost || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      await socialAPI.rejectPost(rejectionDialogPost._id, rejectionReason);
      toast({ title: "Post rejected" });
      setRejectionDialogPost(null);
      setRejectionReason("");
      await fetchPosts();
      onStatsChange();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await socialAPI.deletePost(deleteId);
      toast({ title: "Post deleted" });
      setDeleteId(null);
      await fetchPosts();
      onStatsChange();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePublishNow = async (post: SocialPost) => {
    setActionLoading(true);
    try {
      await socialAPI.publishPost(post._id);
      toast({ title: "Publishing started!" });
      setTimeout(fetchPosts, 3000);
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {FILTER_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all border-2 ${
                filter === t.id
                  ? "border-black bg-primary-900 text-white nb-shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-black hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPosts}
            className="nb-btn"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="nb-btn bg-primary-900 text-white hover:bg-purple-700"
            onClick={() => {
              setEditingPost(null);
              setWizardOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> New Post
          </Button>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No posts yet. Click <strong>New Post</strong> to schedule your
              first one.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-3xl">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                isAdmin={isAdmin}
                actionLoading={actionLoading}
                onEdit={() => {
                  setEditingPost(post);
                  setWizardOpen(true);
                }}
                onDelete={() => setDeleteId(post._id)}
                onSubmit={() => handleSubmitForApproval(post)}
                onApprove={() => setApprovalDialogPost(post)}
                onReject={() => {
                  setRejectionDialogPost(post);
                  setRejectionReason("");
                }}
                onPublishNow={() => handlePublishNow(post)}
              />
            ))}
          </div>
        )}
      </div>

      {}
      {wizardOpen && (
        <PostWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          editingPost={editingPost}
          toast={toast}
          onSaved={async () => {
            await fetchPosts();
            onStatsChange();
          }}
        />
      )}

      {}
      <AlertDialog
        open={!!approvalDialogPost}
        onOpenChange={() => setApprovalDialogPost(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-green-600" /> Approve Post?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This post will be scheduled for publishing at{" "}
              <strong>
                {approvalDialogPost
                  ? format(
                      new Date(approvalDialogPost.scheduledAt),
                      "dd MMM yyyy, h:mm a",
                    )
                  : ""}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading && (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              )}{" "}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <Dialog
        open={!!rejectionDialogPost}
        onOpenChange={() => setRejectionDialogPost(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="w-5 h-5 text-red-500" /> Reject Post
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>
              Reason for rejection <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Tell the creator why this post is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectionDialogPost(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionLoading && (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              )}{" "}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{" "}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostCard({
  post,
  isAdmin,
  actionLoading,
  onEdit,
  onDelete,
  onSubmit,
  onApprove,
  onReject,
  onPublishNow,
}: {
  post: SocialPost;
  isAdmin: boolean;
  actionLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPublishNow: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = cfg.icon;
  const isScheduledPast =
    post.status === "SCHEDULED" && isPast(new Date(post.scheduledAt));

  return (
    <div className="nb-card nb-card-hover overflow-hidden border-l-4 border-l-primary-900">
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          {}
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt=""
              className="w-16 h-16 object-cover shrink-0 border-2 border-black"
            />
          ) : (
            <div className="w-16 h-16 shrink-0 bg-purple-100 border-2 border-black flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-purple-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}
              >
                <StatusIcon
                  className={`w-3 h-3 ${post.status === "POSTING" ? "animate-spin" : ""}`}
                />
                {cfg.label}
              </span>
              {post.platforms.includes("facebook") && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-300 font-semibold">
                  <Facebook className="w-3 h-3" /> Facebook
                </span>
              )}
              {post.platforms.includes("instagram") && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-300 font-semibold">
                  <Instagram className="w-3 h-3" /> Instagram
                </span>
              )}
            </div>

            {}
            <p className="text-sm text-foreground line-clamp-2">
              {post.caption}
            </p>

            {}
            {post.hashtags.length > 0 && (
              <p className="text-xs text-primary-900 mt-1 truncate">
                {post.hashtags
                  .map((h) => (h.startsWith("#") ? h : `#${h}`))
                  .join(" ")}
              </p>
            )}

            {}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(post.scheduledAt), "dd MMM yyyy, h:mm a")}
              </span>
              {post.createdBy && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {post.createdBy.name}
                </span>
              )}
            </div>

            {}
            {post.status === "REJECTED" && post.rejectionReason && (
              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                <strong>Rejected:</strong> {post.rejectionReason}
              </div>
            )}

            {}
            {post.status === "FAILED" && post.failureReason && (
              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                <strong>Failed:</strong> {post.failureReason}
              </div>
            )}

            {}
            {post.status === "POSTED" && (
              <div className="mt-2 flex items-center gap-3 text-xs text-green-600">
                <Check className="w-3 h-3" />
                Posted{" "}
                {post.postedAt
                  ? formatDistanceToNow(new Date(post.postedAt), {
                      addSuffix: true,
                    })
                  : ""}
                {post.facebookPostId && (
                  <span className="text-blue-600">FB ✓</span>
                )}
                {post.instagramPostId && (
                  <span className="text-primary-900">IG ✓</span>
                )}
              </div>
            )}
          </div>

          {}
          <div className="flex flex-col gap-1.5 shrink-0">
            {}
            {!["POSTING", "POSTED"].includes(post.status) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs nb-btn"
                onClick={onEdit}
              >
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            )}

            {}
            {["DRAFT", "REJECTED"].includes(post.status) && (
              <Button
                size="sm"
                className="h-7 text-xs nb-btn bg-primary-900 text-white hover:bg-purple-700"
                onClick={onSubmit}
                disabled={actionLoading}
              >
                <Send className="w-3 h-3 mr-1" /> Submit
              </Button>
            )}

            {}
            {isAdmin && post.status === "PENDING_APPROVAL" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs nb-btn bg-[#00C48C] text-black hover:bg-[#00C48C]/90"
                  onClick={onApprove}
                  disabled={actionLoading}
                >
                  <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs nb-btn text-red-600 border-red-300 hover:bg-red-50"
                  onClick={onReject}
                  disabled={actionLoading}
                >
                  <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                </Button>
              </>
            )}

            {}
            {isAdmin &&
              ["SCHEDULED", "FAILED", "APPROVED"].includes(post.status) && (
                <Button
                  size="sm"
                  className="h-7 text-xs nb-btn bg-[#024BAB] text-white hover:bg-[#024BAB]/90"
                  onClick={onPublishNow}
                  disabled={actionLoading}
                >
                  <Zap className="w-3 h-3 mr-1" /> Post Now
                </Button>
              )}

            {}
            {!["POSTING", "POSTED"].includes(post.status) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-300"
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

function PostWizard({
  open,
  onClose,
  editingPost,
  toast,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingPost: SocialPost | null;
  toast: any;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);

  const [caption, setCaption] = useState(editingPost?.caption || "");
  const [imageUrl, setImageUrl] = useState(editingPost?.imageUrl || "");
  const [hashtagInput, setHashtagInput] = useState(
    editingPost?.hashtags.join(" ") || "",
  );
  const [platforms, setPlatforms] = useState<string[]>(
    editingPost?.platforms || ["facebook", "instagram"],
  );
  const [scheduledDate, setScheduledDate] = useState(
    editingPost ? format(new Date(editingPost.scheduledAt), "yyyy-MM-dd") : "",
  );
  const [scheduledTime, setScheduledTime] = useState(
    editingPost ? format(new Date(editingPost.scheduledAt), "HH:mm") : "09:00",
  );

  const hashtags = hashtagInput
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSave = async () => {
    if (!caption.trim() || !platforms.length || !scheduledDate) return;

    setSaving(true);
    try {
      const scheduledAt = new Date(
        `${scheduledDate}T${scheduledTime}:00`,
      ).toISOString();
      const payload = {
        caption: caption.trim(),
        imageUrl: imageUrl.trim(),
        hashtags,
        platforms,
        scheduledAt,
      };

      if (editingPost) {
        await socialAPI.updatePost(editingPost._id, payload);
        toast({ title: "Post updated" });
      } else {
        await socialAPI.createPost(payload);
        toast({ title: "Post created as Draft" });
      }
      onClose();
      await onSaved();
    } catch (err: any) {
      toast({
        title: "Failed to save post",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fullCaption = hashtags.length
    ? `${caption}\n\n${hashtags.join(" ")}`
    : caption;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-6 h-6 bg-primary-900 border-2 border-black flex items-center justify-center shrink-0">
              <Instagram className="w-3.5 h-3.5 text-white" />
            </div>
            {editingPost ? "Edit Post" : "New Post"}
            <span className="ml-auto text-xs font-bold text-muted-foreground border-2 border-black px-2 py-0.5">
              Step {step} / 3
            </span>
          </DialogTitle>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 border border-black ${s <= step ? "bg-primary-900" : "bg-muted"}`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 space-y-4">
          {}
          {step === 1 && (
            <>
              <div>
                <Label>
                  Caption <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Write your post caption here..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={5}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-right">
                  {caption.length} chars
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Hashtags
                  <span className="text-muted-foreground text-xs font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  placeholder="#branding #marketing #growth"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  className="mt-1"
                />
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Image URL
                  <span className="text-muted-foreground text-xs font-normal">
                    (optional — required for Instagram)
                  </span>
                </Label>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="mt-1"
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="mt-2 rounded-lg border border-border max-h-40 object-cover w-full"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).style.display = "none")
                    }
                  />
                )}
              </div>
            </>
          )}

          {}
          {step === 2 && (
            <>
              <div>
                <Label className="mb-2 block">
                  Post to <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-3">
                  {[
                    {
                      id: "facebook",
                      label: "Facebook",
                      Icon: Facebook,
                      color: "border-blue-200 bg-blue-50 text-blue-700",
                    },
                    {
                      id: "instagram",
                      label: "Instagram",
                      Icon: Instagram,
                      color: "border-purple-200 bg-purple-50 text-purple-700",
                    },
                  ].map(({ id, label, Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => togglePlatform(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-medium text-sm ${platforms.includes(id) ? `border-2 ${color}` : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                      {platforms.includes(id) && (
                        <Check className="w-3.5 h-3.5 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
                {platforms.includes("instagram") && !imageUrl && (
                  <div className="mt-2 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700">
                      Instagram requires an image URL. Go back to Step 1 to add
                      one.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd")}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {scheduledDate && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <Clock className="w-4 h-4 text-primary-900 shrink-0" />
                  <p className="text-xs text-purple-700">
                    Will be published on{" "}
                    <strong>
                      {format(
                        new Date(`${scheduledDate}T${scheduledTime}`),
                        "EEEE, dd MMM yyyy 'at' h:mm a",
                      )}
                    </strong>
                    {isPast(new Date(`${scheduledDate}T${scheduledTime}`)) && (
                      <span className="text-orange-600 ml-1">
                        (time is in the past — will post immediately after
                        approval)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {}
          {step === 3 && (
            <>
              <p className="text-sm font-medium mb-1">Post Preview</p>
              {}
              <div className="bg-gray-50 rounded-2xl p-4 border border-border">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-xs mx-auto shadow-sm">
                  {}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                    <span className="text-xs font-semibold">Your Page</span>
                  </div>
                  {}
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full object-cover max-h-48"
                      onError={(e) =>
                        ((e.target as HTMLImageElement).style.display = "none")
                      }
                    />
                  )}
                  {}
                  <div className="px-3 py-2">
                    <p className="text-xs text-gray-800 whitespace-pre-wrap">
                      {fullCaption || (
                        <span className="text-gray-400 italic">No caption</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {scheduledDate
                        ? format(
                            new Date(`${scheduledDate}T${scheduledTime}`),
                            "dd MMM yyyy",
                          )
                        : "Date TBD"}
                    </p>
                  </div>
                </div>
              </div>

              {}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <SummaryRow
                  label="Platforms"
                  value={platforms
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(", ")}
                />
                <SummaryRow
                  label="Scheduled"
                  value={
                    scheduledDate
                      ? format(
                          new Date(`${scheduledDate}T${scheduledTime}`),
                          "dd MMM yyyy, h:mm a",
                        )
                      : "—"
                  }
                />
                <SummaryRow
                  label="Hashtags"
                  value={hashtags.length ? hashtags.join(" ") : "None"}
                />
                <SummaryRow label="Image" value={imageUrl ? "Yes" : "No"} />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Post will be saved as <strong>Draft</strong>. Submit it for
                  approval before it can be published.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              step > 1 ? setStep((s) => (s - 1) as WizardStep) : onClose()
            }
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-primary-900 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            disabled={
              saving ||
              (step === 1 && !caption.trim()) ||
              (step === 2 && (!platforms.length || !scheduledDate))
            }
            onClick={() =>
              step < 3 ? setStep((s) => (s + 1) as WizardStep) : handleSave()
            }
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {step < 3 ? (
              <>
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" />
                {editingPost ? "Update" : "Save Draft"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-48 truncate">{value}</span>
    </div>
  );
}

function AccountsTab({ isAdmin, toast }: { isAdmin: boolean; toast: any }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [manualForm, setManualForm] = useState({
    platform: "facebook",
    accountId: "",
    accountName: "",
    accessToken: "",
    instagramBusinessAccountId: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getAccounts();
      setAccounts(res.data);
    } catch {
      toast({ title: "Failed to load accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOAuthConnect = async () => {
    setOauthLoading(true);
    try {
      const res = await socialAPI.getFacebookAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast({
        title: "Failed to get auth URL",
        description: err.message,
        variant: "destructive",
      });
      setOauthLoading(false);
    }
  };

  const handleImportFromIntegration = async () => {
    setImporting(true);
    try {
      const res = await socialAPI.importFromIntegration();
      toast({
        title: `Imported! ${res.data.connected} account(s) saved.`,
      });
      await fetchAccounts();
    } catch (err: any) {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleManualConnect = async () => {
    if (
      !manualForm.accountId ||
      !manualForm.accountName ||
      !manualForm.accessToken
    )
      return;
    setConnecting(true);
    try {
      await socialAPI.connectAccount(manualForm);
      toast({ title: "Account connected!" });
      setManualDialogOpen(false);
      setManualForm({
        platform: "facebook",
        accountId: "",
        accountName: "",
        accessToken: "",
        instagramBusinessAccountId: "",
      });
      await fetchAccounts();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectId) return;
    setDisconnecting(true);
    try {
      await socialAPI.disconnectAccount(disconnectId);
      toast({ title: "Account disconnected" });
      setDisconnectId(null);
      await fetchAccounts();
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const fbAccounts = accounts.filter((a) => a.platform === "facebook");
  const igAccounts = accounts.filter((a) => a.platform === "instagram");

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-base">Connected Accounts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your Facebook Pages and Instagram Business accounts
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAccounts}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {}
        <button
          onClick={handleImportFromIntegration}
          disabled={importing}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-green-200 hover:border-green-400 hover:bg-green-50/30 transition-all"
        >
          {importing ? (
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          ) : (
            <RefreshCw className="w-8 h-8 text-green-600" />
          )}
          <div className="text-center">
            <p className="text-sm font-semibold text-green-700">
              Import from Integrations
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Already connected Facebook under Integrations? Reuse it — no
              re-login needed
            </p>
          </div>
          <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
            Recommended
          </span>
        </button>

        {}
        <button
          onClick={handleOAuthConnect}
          disabled={oauthLoading}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
        >
          {oauthLoading ? (
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          ) : (
            <Facebook className="w-8 h-8 text-blue-600" />
          )}
          <div className="text-center">
            <p className="text-sm font-semibold text-blue-700">
              Connect via Facebook
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              OAuth — connects all your Pages & Instagram accounts automatically
            </p>
          </div>
        </button>

        {}
        <button
          onClick={() => setManualDialogOpen(true)}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50/30 transition-all"
        >
          <Link2 className="w-8 h-8 text-gray-500" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              Manual Connect
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste Page ID and Access Token manually
            </p>
          </div>
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            Advanced
          </span>
        </button>
      </div>

      {}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">
          Setup Requirements
        </h3>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>
            Create a <strong>Meta App</strong> at developers.facebook.com with{" "}
            <em>Business</em> type
          </li>
          <li>
            Add <strong>FACEBOOK_APP_ID</strong> and{" "}
            <strong>FACEBOOK_APP_SECRET</strong> to backend .env
          </li>
          <li>
            Register callback:{" "}
            <code className="bg-blue-100 px-1 rounded">
              YOUR_API_URL/api/social/auth/facebook/callback
            </code>
          </li>
          <li>
            Your Instagram account must be a <strong>Business/Creator</strong>{" "}
            account linked to a Facebook Page
          </li>
        </ol>
      </div>

      {}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-center border border-dashed border-border rounded-xl">
          <Globe className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No accounts connected yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            {
              label: "Facebook Pages",
              items: fbAccounts,
              Icon: Facebook,
              color: "text-blue-600 bg-blue-100",
            },
            {
              label: "Instagram Accounts",
              items: igAccounts,
              Icon: Instagram,
              color: "text-primary-900 bg-purple-100",
            },
          ].map(({ label, items, Icon, color }) =>
            items.length === 0 ? null : (
              <div key={label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {label}
                </p>
                <div className="space-y-2">
                  {items.map((acc) => (
                    <div
                      key={acc._id}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg bg-white"
                    >
                      {acc.profilePicture ? (
                        <img
                          src={acc.profilePicture}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${color}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {acc.accountName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {acc.accountId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                            onClick={() => setDisconnectId(acc._id)}
                          >
                            <Link2Off className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Account Connect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Platform</Label>
              <div className="flex gap-2 mt-1">
                {["facebook", "instagram"].map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setManualForm((f) => ({ ...f, platform: p }))
                    }
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${manualForm.platform === p ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>
                Account / Page Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="My Business Page"
                value={manualForm.accountName}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, accountName: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>
                {manualForm.platform === "facebook"
                  ? "Facebook Page ID"
                  : "Instagram Business Account ID"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="123456789"
                value={manualForm.accountId}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, accountId: e.target.value }))
                }
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>
                Page Access Token <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="EAAxxxxx..."
                value={manualForm.accessToken}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, accessToken: e.target.value }))
                }
                className="mt-1 font-mono text-xs"
                type="password"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Get this from Meta Business Suite → Settings → Page Access
                Tokens
              </p>
            </div>
            {manualForm.platform === "facebook" && (
              <div>
                <Label>
                  Instagram Business Account ID{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  placeholder="Leave blank if not using Instagram"
                  value={manualForm.instagramBusinessAccountId}
                  onChange={(e) =>
                    setManualForm((f) => ({
                      ...f,
                      instagramBusinessAccountId: e.target.value,
                    }))
                  }
                  className="mt-1 font-mono"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualConnect}
              disabled={
                connecting ||
                !manualForm.accountId ||
                !manualForm.accountName ||
                !manualForm.accessToken
              }
              className="bg-primary-900 hover:bg-purple-700 text-white"
            >
              {connecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{" "}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <AlertDialog
        open={!!disconnectId}
        onOpenChange={() => setDisconnectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Scheduled posts targeting this account will fail. You can
              reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {disconnecting && (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              )}{" "}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
