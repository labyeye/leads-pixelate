import { useCallback, useEffect, useState } from "react";
import { Facebook, Instagram, Loader2, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { socialAPI } from "@/services/api";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Post {
  _id: string;
  caption: string;
  imageUrl: string;
  platforms: string[];
  scheduledAt: string;
  status: string;
  failureReason?: string;
}

const UPCOMING = ["SCHEDULED", "APPROVED", "PENDING_APPROVAL", "POSTING"];
const HISTORY = ["POSTED", "PARTIALLY_POSTED", "FAILED"];
const REMOVABLE = ["SCHEDULED", "APPROVED", "PENDING_APPROVAL", "FAILED"];

const STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", cls: "bg-blue-100 text-blue-700" },
  PENDING_APPROVAL: { label: "Needs your approval", cls: "bg-orange-100 text-orange-700" },
  POSTING: { label: "Posting…", cls: "bg-blue-100 text-blue-700" },
  POSTED: { label: "Posted", cls: "bg-green-100 text-green-700" },
  PARTIALLY_POSTED: { label: "Partly posted", cls: "bg-amber-100 text-amber-700" },
  FAILED: { label: "Failed", cls: "bg-red-100 text-red-700" },
};

const PLATFORM_ICON: Record<string, JSX.Element> = {
  facebook: <Facebook className="w-3.5 h-3.5 text-blue-600" />,
  instagram: <Instagram className="w-3.5 h-3.5 text-pink-600" />,
  linkedin: <LinkedInIcon className="w-3.5 h-3.5" />,
};

const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function AutopilotPosts({ toast }: { toast: any }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await socialAPI.getPosts({ source: "autopilot" });
      setPosts(res.data);
    } catch (err: any) {
      toast({ title: "Failed to load posts", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // new posts land while a run is generating
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast({ title: ok });
      await load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (!posts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const upcoming = posts
    .filter((p) => UPCOMING.includes(p.status))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const history = posts
    .filter((p) => HISTORY.includes(p.status))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
    .slice(0, 8);

  const row = (p: Post) => {
    const st = STATUS[p.status];
    return (
      <li key={p._id} className="flex gap-3 rounded-lg border p-3 bg-background">
        {p.imageUrl && (
          <img
            src={p.imageUrl}
            alt=""
            loading="lazy"
            className="w-16 h-20 object-cover rounded border bg-muted shrink-0"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {p.platforms.map((pl) => (
              <span key={pl}>{PLATFORM_ICON[pl]}</span>
            ))}
            <span>{when(p.scheduledAt)}</span>
            {st && <Badge className={`${st.cls} hover:${st.cls} border-0`}>{st.label}</Badge>}
          </div>
          <p className="text-sm line-clamp-3">{p.caption}</p>
          {p.status === "FAILED" && p.failureReason && (
            <p className="text-xs text-red-600 line-clamp-2" title={p.failureReason}>
              {p.failureReason}
            </p>
          )}
          {(p.status === "PENDING_APPROVAL" || REMOVABLE.includes(p.status)) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {p.status === "PENDING_APPROVAL" && (
                <>
                  <Button
                    size="sm"
                    disabled={busy === p._id}
                    onClick={() => act(p._id, () => socialAPI.approvePost(p._id), "Post approved")}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === p._id}
                    onClick={() => act(p._id, () => socialAPI.rejectPost(p._id, "Rejected from Autopilot"), "Post rejected")}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </>
              )}
              {REMOVABLE.includes(p.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === p._id}
                  onClick={() => {
                    if (confirm("Remove this post? Autopilot may plan a replacement.")) {
                      act(p._id, () => socialAPI.deletePost(p._id), "Post removed");
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Coming up ({upcoming.length})</h3>
        {upcoming.length ? (
          <ul className="space-y-2">{upcoming.map(row)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
            Nothing queued yet. Turn Autopilot on and your next post will appear here.
          </p>
        )}
      </section>
      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Recently published</h3>
          <ul className="space-y-2">{history.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
