import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  statusColors,
  getStatusColorClasses,
  getStatusLabel,
  categories,
} from "./statusConstants";
import { CheckCircle2, Clock, AlertCircle, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { leadsAPI } from "@/services/api";
import { LOST_REASONS } from "./StatusUpdateModal";

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  changedBy?: any;
  remarks?: string;
  budget?: string;
  followUpDate?: string;
  visitScheduledDate?: string;
  visitActualDate?: string;
  contactTag?: string;
  editedAt?: string;
}

interface StatusHistoryTimelineProps {
  statusHistory?: StatusHistoryEntry[];
  stagePath?: string[];
  className?: string;
  // Pass both to let the latest change be corrected (stage and remark).
  leadId?: string;
  onChanged?: () => void;
}

export function StatusHistoryTimeline({
  statusHistory = [],
  stagePath = [],
  className,
  leadId,
  onChanged,
}: StatusHistoryTimelineProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ status: "", remarks: "", lostReason: "" });
  const [saving, setSaving] = useState(false);

  const latest = statusHistory?.[statusHistory.length - 1];
  const changedById =
    latest?.changedBy && typeof latest.changedBy === "object"
      ? latest.changedBy._id
      : latest?.changedBy;
  const canEdit =
    !!leadId &&
    !!latest &&
    (user?.role === "admin" ||
      user?.role === "super_admin" ||
      (!!changedById && changedById === user?.id));

  const startEdit = () => {
    if (!latest) return;
    setDraft({ status: latest.status, remarks: latest.remarks || "", lostReason: "" });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!leadId || !latest) return;
    if (draft.status === "DROP" && latest.status !== "DROP" && !draft.lostReason) {
      toast({ title: "Pick a lost reason", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      await leadsAPI.editLatestStatus(leadId, {
        ...(draft.status !== latest.status ? { status: draft.status } : {}),
        remarks: draft.remarks,
        ...(draft.status === "DROP" && draft.lostReason
          ? { lostReason: draft.lostReason }
          : {}),
      });
      toast({ title: "Status updated" });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast({
        title: "Couldn't update",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!statusHistory || statusHistory.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground italic">
          No status history available for this lead.
        </p>
      </div>
    );
  }

  const safeFormat = (dateStr: string | undefined, formatStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return format(date, formatStr);
    } catch (e) {
      return "";
    }
  };

  const displayHistory = [...statusHistory];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        {}
        <div className="absolute left-[19px] top-6 bottom-0 w-[1px] bg-gradient-to-b from-primary/30 via-border to-transparent" />

        <div className="space-y-8">
          {displayHistory.map((entry, idx) => {
            const isLatest = idx === displayHistory.length - 1;
            return (
              <div
                key={`${entry.status}-${idx}`}
                className="relative pl-12 group"
              >
                {}
                <div
                  className={cn(
                    "absolute left-0 top-1 w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm",
                    isLatest
                      ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/10"
                      : "bg-background text-muted-foreground border-border group-hover:border-primary/30",
                  )}
                >
                  {isLatest ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : entry.status === "DROP" ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-[10px] font-medium uppercase tracking-wider shadow-sm",
                          getStatusColorClasses(entry.status) ||
                            "bg-muted text-muted-foreground border-transparent",
                        )}
                      >
                        {getStatusLabel(entry.status)}
                      </span>
                      {entry.contactTag && (
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md border text-[10px] font-medium uppercase tracking-wider shadow-sm",
                            getStatusColorClasses(entry.contactTag) ||
                              "bg-muted text-muted-foreground border-transparent",
                          )}
                        >
                          {entry.contactTag}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end">
                      {isLatest && canEdit && !editing && (
                        <button
                          type="button"
                          onClick={startEdit}
                          className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#024BAB] hover:underline"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <span className="text-[12px] font-medium text-black">
                        {safeFormat(entry.timestamp, "MMM dd, yyyy")}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-medium">
                        {safeFormat(entry.timestamp, "HH:mm a")}
                      </span>
                    </div>
                  </div>

                  {isLatest && editing && (
                    <div className="border-2 border-black bg-white p-3 space-y-2">
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, status: e.target.value }))
                          }
                          className="mt-1 w-full h-9 border-2 border-black bg-white px-2 text-sm normal-case tracking-normal text-black"
                        >
                          {Object.entries(categories).map(([group, list]) => (
                            <optgroup key={group} label={group}>
                              {list.map((s) => (
                                <option key={s} value={s}>
                                  {getStatusLabel(s)}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      {draft.status === "DROP" && latest?.status !== "DROP" && (
                        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Lost reason
                          <select
                            value={draft.lostReason}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, lostReason: e.target.value }))
                            }
                            className="mt-1 w-full h-9 border-2 border-black bg-white px-2 text-sm normal-case tracking-normal text-black"
                          >
                            <option value="">Choose…</option>
                            {LOST_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Remark
                        <textarea
                          value={draft.remarks}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, remarks: e.target.value }))
                          }
                          rows={3}
                          className="mt-1 w-full border-2 border-black p-2 text-sm normal-case tracking-normal text-black"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setEditing(false)}
                          className="h-8 px-3 text-xs font-medium border-2 border-black bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={saveEdit}
                          className="h-8 px-3 text-xs font-medium border-2 border-black bg-[#024BAB] text-white disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  )}

                  {}
                  {entry.remarks && !(isLatest && editing) && (
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
                      <div className="bg-muted/30 rounded-lg p-3 pl-4 border border-border/40 hover:border-primary/10 transition-all shadow-sm group-hover:bg-muted/40">
                        <p className="text-[14px] text-black font-medium italic leading-relaxed">
                          "{entry.remarks}"
                        </p>
                      </div>
                    </div>
                  )}

                  {}
                  {(entry.budget ||
                    entry.followUpDate ||
                    entry.visitScheduledDate ||
                    entry.visitActualDate) && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {entry.budget && (
                        <div className="flex items-center gap-2 bg-success/5 border border-success/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-success/70 font-medium uppercase tracking-tighter">
                            Budget
                          </span>
                          <span className="text-[10px] text-success font-medium ml-auto">
                            {entry.budget}
                          </span>
                        </div>
                      )}
                      {entry.followUpDate && (
                        <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-blue-500/70 font-medium uppercase tracking-tighter">
                            Follow-up
                          </span>
                          <span className="text-[10px] text-blue-500 font-medium ml-auto">
                            {safeFormat(entry.followUpDate, "dd MMM")}
                          </span>
                        </div>
                      )}
                      {entry.visitScheduledDate && (
                        <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-purple-500/70 font-medium uppercase tracking-tighter">
                            Scheduled
                          </span>
                          <span className="text-[10px] text-purple-500 font-medium ml-auto">
                            {safeFormat(entry.visitScheduledDate, "dd MMM")}
                          </span>
                        </div>
                      )}
                      {entry.visitActualDate && (
                        <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-teal-500/70 font-medium uppercase tracking-tighter">
                            Visited
                          </span>
                          <span className="text-[10px] text-teal-500 font-medium ml-auto">
                            {safeFormat(entry.visitActualDate, "dd MMM")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {}
                  {entry.changedBy && (
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground/60 font-medium">
                      <span className="w-4 h-[1px] bg-border" />
                      <span>
                        Updated by{" "}
                        {typeof entry.changedBy === "object"
                          ? entry.changedBy.name
                          : "System"}
                        {entry.editedAt ? " · edited" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {}
      {stagePath && stagePath.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/30">
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Lead Progression
          </p>
          <div className="flex flex-wrap gap-1">
            {stagePath.map((stage, idx) => (
              <div key={`stage-${idx}`} className="flex items-center gap-1">
                <span
                  className={cn(
                    "px-2 py-1 rounded-full border text-[9px] font-medium",
                    getStatusColorClasses(stage) ||
                      "bg-muted text-muted-foreground border-transparent",
                  )}
                >
                  {getStatusLabel(stage)}
                </span>
                {idx < stagePath.length - 1 && (
                  <span className="text-muted-foreground/40 font-medium">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
