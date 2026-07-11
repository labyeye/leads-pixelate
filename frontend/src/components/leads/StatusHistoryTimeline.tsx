import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { statusColors, getStatusColorClasses, getStatusLabel } from "./statusConstants";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

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
}

interface StatusHistoryTimelineProps {
  statusHistory?: StatusHistoryEntry[];
  stagePath?: string[];
  className?: string;
}

export function StatusHistoryTimeline({
  statusHistory = [],
  stagePath = [],
  className,
}: StatusHistoryTimelineProps) {
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
                          "px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider shadow-sm",
                          getStatusColorClasses(entry.status) ||
                            "bg-muted text-muted-foreground border-transparent",
                        )}
                      >
                        {getStatusLabel(entry.status)}
                      </span>
                      {entry.contactTag && (
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider shadow-sm",
                            getStatusColorClasses(entry.contactTag) ||
                              "bg-muted text-muted-foreground border-transparent",
                          )}
                        >
                          {entry.contactTag}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[12px] font-bold text-black">
                        {safeFormat(entry.timestamp, "MMM dd, yyyy")}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-medium">
                        {safeFormat(entry.timestamp, "HH:mm a")}
                      </span>
                    </div>
                  </div>

                  {}
                  {entry.remarks && (
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
                          <span className="text-[9px] text-success/70 font-bold uppercase tracking-tighter">
                            Budget
                          </span>
                          <span className="text-[10px] text-success font-bold ml-auto">
                            {entry.budget}
                          </span>
                        </div>
                      )}
                      {entry.followUpDate && (
                        <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-blue-500/70 font-bold uppercase tracking-tighter">
                            Follow-up
                          </span>
                          <span className="text-[10px] text-blue-500 font-bold ml-auto">
                            {safeFormat(entry.followUpDate, "dd MMM")}
                          </span>
                        </div>
                      )}
                      {entry.visitScheduledDate && (
                        <div className="flex items-center gap-2 bg-purple-500/5 border border-purple-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-purple-500/70 font-bold uppercase tracking-tighter">
                            Scheduled
                          </span>
                          <span className="text-[10px] text-purple-500 font-bold ml-auto">
                            {safeFormat(entry.visitScheduledDate, "dd MMM")}
                          </span>
                        </div>
                      )}
                      {entry.visitActualDate && (
                        <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/10 rounded-md p-1.5 px-2">
                          <span className="text-[9px] text-teal-500/70 font-bold uppercase tracking-tighter">
                            Visited
                          </span>
                          <span className="text-[10px] text-teal-500 font-bold ml-auto">
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
          <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Lead Progression
          </p>
          <div className="flex flex-wrap gap-1">
            {stagePath.map((stage, idx) => (
              <div key={`stage-${idx}`} className="flex items-center gap-1">
                <span
                  className={cn(
                    "px-2 py-1 rounded-full border text-[9px] font-bold",
                    getStatusColorClasses(stage) ||
                      "bg-muted text-muted-foreground border-transparent",
                  )}
                >
                  {getStatusLabel(stage)}
                </span>
                {idx < stagePath.length - 1 && (
                  <span className="text-muted-foreground/40 font-bold">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
