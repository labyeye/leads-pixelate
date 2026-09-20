import { useState } from "react";
import { Check, Loader2, MessageSquareWarning, ThumbsDown } from "lucide-react";
import { autopilotAPI, socialAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ReviewablePost {
  _id: string;
  autopilotMeta?: { revising?: boolean; revisions?: number; revisionError?: string };
}

const MAX_REVISIONS = 3;

// Approve, ask for a change ("the bread looks burnt", "never mention X") or reject a post
// that is waiting for the owner. A change request is fixed and regenerated on the server.
export function ReviewActions({
  post,
  toast,
  onChanged,
  onApprove,
  onReject,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: {
  post: ReviewablePost;
  toast: any;
  onChanged: () => void | Promise<unknown>;
  onApprove?: () => Promise<unknown>;
  onReject?: () => Promise<unknown>;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const revising = !!post.autopilotMeta?.revising;
  const used = post.autopilotMeta?.revisions ?? 0;

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast({ title: ok });
      await onChanged();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (revising) {
    return (
      <p className="flex items-center gap-2 text-sm text-blue-700" aria-live="polite">
        <Loader2 className="w-4 h-4 animate-spin" /> Fixing this post from your feedback…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {post.autopilotMeta?.revisionError && (
        <p className="text-xs text-red-600">
          Couldn't apply your change: {post.autopilotMeta.revisionError}. Try again.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            act(onApprove ?? (() => socialAPI.approvePost(post._id)), onApprove ? undefined : "Post approved")
          }
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          {approveLabel}
        </Button>
        <Button size="sm" variant="outline" disabled={busy || used >= MAX_REVISIONS} onClick={() => setOpen(!open)}>
          <MessageSquareWarning className="w-3.5 h-3.5 mr-1" /> Request changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            act(
              onReject ?? (() => socialAPI.rejectPost(post._id, "Rejected from Autopilot")),
              onReject ? undefined : "Post rejected",
            )
          }
        >
          <ThumbsDown className="w-3.5 h-3.5 mr-1" /> {rejectLabel}
        </Button>
      </div>
      {used >= MAX_REVISIONS && (
        <p className="text-xs text-muted-foreground">You've used all {MAX_REVISIONS} changes for this post.</p>
      )}
      {open && (
        <div className="space-y-2 rounded-lg border-2 border-black/20 p-3 animate-fade-in">
          <Textarea
            rows={3}
            maxLength={500}
            autoFocus
            aria-label="What should change?"
            placeholder="What's wrong? e.g. “the image looks too dark”, “caption is too long”, “never mention offers”"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy || !feedback.trim()}
              onClick={() =>
                act(async () => {
                  await autopilotAPI.revisePost(post._id, feedback.trim());
                  setFeedback("");
                  setOpen(false);
                }, "Fixing your post…")
              }
            >
              Fix &amp; regenerate
            </Button>
            <span className="text-xs text-muted-foreground">
              {MAX_REVISIONS - used} change{MAX_REVISIONS - used === 1 ? "" : "s"} left · Autopilot remembers rules
              like “never…”
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
