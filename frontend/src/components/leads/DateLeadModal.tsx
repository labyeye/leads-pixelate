import { format } from "date-fns";
import { Loader2, Users, Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { statusColors } from "./statusConstants";
import { LeadDetailPanel } from "./LeadDetailPanel";

interface DateLeadModalProps {
  open: boolean;
  date: Date | null;
  leads: any[];
  selectedLeadId: string | null;
  selectedLead: any | null;
  loadingLead: boolean;
  title: string;
  leadCountLabel: string;
  onOpenChange: (open: boolean) => void;
  onLeadSelect: (leadId: string) => void;
  onLeadClose: () => void;
  onRefresh: () => void;
}

export function DateLeadModal({
  open,
  date,
  leads,
  selectedLeadId,
  selectedLead,
  loadingLead,
  title,
  leadCountLabel,
  onOpenChange,
  onLeadSelect,
  onLeadClose,
  onRefresh,
}: DateLeadModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onLeadClose();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col p-0 sm:max-w-6xl">
        <div className="p-6 pb-4 border-b border-border bg-muted/10">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p>{title}</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    {date
                      ? format(date, "EEEE, do MMMM yyyy")
                      : "No date selected"}
                  </p>
                </div>
              </DialogTitle>

              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                <CalendarIcon className="w-3 h-3 mr-1" /> {leadCountLabel}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div
          className={cn(
            "flex-1 overflow-hidden grid",
            selectedLeadId
              ? "lg:grid-cols-[minmax(0,1fr)_420px]"
              : "grid-cols-1",
          )}
        >
          <div
            className={cn(
              "overflow-auto p-6",
              selectedLeadId ? "border-r border-border" : "",
            )}
          >
            {leads.length > 0 ? (
              <div className="space-y-3">
                {leads.map((lead) => {
                  const label =
                    lead.displayStatus || lead.status || "PENDING CONTACT";
                  const subtitle = lead.company || lead.source || "";
                  const leadId = lead._id || lead.id;

                  return (
                    <Button
                      key={leadId}
                      type="button"
                      variant="outline"
                      onClick={() => onLeadSelect(leadId)}
                      className={cn(
                        "w-full h-auto justify-between gap-4 p-4 text-left border transition-all",
                        selectedLeadId === leadId
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/30",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">
                            {lead.name}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                              statusColors[label] ||
                                "bg-muted text-foreground border-border",
                            )}
                          >
                            {label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {subtitle}
                        </p>
                        {lead.statusHistory &&
                          lead.statusHistory.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-border/40 pt-2">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                Recent Activity
                              </p>
                              <div className="space-y-1.5">
                                {lead.statusHistory
                                  .slice(-2)
                                  .reverse()
                                  .map((h: any, i: number) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-2 group/remark"
                                    >
                                      <div className="flex flex-col items-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1" />
                                        {i === 0 &&
                                          lead.statusHistory.length > 1 && (
                                            <div className="w-[1px] h-3 bg-border/50" />
                                          )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[9px] font-bold text-primary/80 bg-primary/5 px-1 rounded truncate uppercase">
                                            {h.status}
                                          </span>
                                          <span className="text-[8px] text-muted-foreground font-medium">
                                            {h.timestamp
                                              ? format(
                                                  new Date(h.timestamp),
                                                  "dd MMM",
                                                )
                                              : ""}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug italic line-clamp-1 group-hover/remark:line-clamp-none transition-all">
                                          "{h.remarks}"
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                        View details
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="h-full min-h-[280px] flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <div className="text-center max-w-sm px-6">
                  <p className="font-semibold text-foreground mb-1">
                    No leads for this date
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pick another day to see its lead list.
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedLeadId ? (
            <div className="h-full bg-card overflow-hidden">
              {loadingLead ? (
                <div className="h-full flex items-center justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : selectedLead ? (
                <LeadDetailPanel
                  lead={selectedLead}
                  onClose={onLeadClose}
                  onRefresh={onRefresh}
                  className="rounded-none border-0 min-h-full"
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8 text-sm text-muted-foreground">
                  Lead details unavailable.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
