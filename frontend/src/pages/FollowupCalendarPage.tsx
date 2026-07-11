import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { leadsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { statusColors, getStatusColorClasses } from "@/components/leads/statusConstants";
import { DateLeadModal } from "@/components/leads/DateLeadModal";

// Parse a DB date string to a local-midnight Date to avoid UTC-offset day shifts
const toLocalDate = (dateStr: string): Date => {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

type StatusFilter =
  "ALL" | "1" | "2" | "3" | "COMPLETED" | "DISCUSSION" | "QUOTATION";

const FOLLOW_UP_STATUSES = [
  "1",
  "2",
  "3",
  "COMPLETED",
  "DISCUSSION",
  "QUOTATION",
];

export default function FollowupCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeads, setSelectedDayLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [loadingFullLead, setLoadingFullLead] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const { toast } = useToast();

  useEffect(() => {
    fetchFollowups();
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      setFullLead(null);
      fetchFullLead(selectedLeadId);
    } else {
      setFullLead(null);
    }
  }, [selectedLeadId]);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getAll({
        hasFollowup: "true",
      });
      const freshLeads = res.data || [];
      setLeads(freshLeads);
      if (selectedDate) {
        const updated = freshLeads
          .filter((lead: any) => {
            if (!lead.followUpDate) return false;
            return (
              toLocalDate(lead.followUpDate).toDateString() ===
              selectedDate.toDateString()
            );
          })
          .sort(
            (a: any, b: any) =>
              new Date(a.followUpDate).getTime() -
              new Date(b.followUpDate).getTime(),
          );
        setSelectedDayLeads(updated);
      }
    } catch (error) {
      console.error("Error fetching followups:", error);
      toast({
        title: "Error",
        description: "Failed to load follow-ups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFullLead = async (id: string) => {
    try {
      setLoadingFullLead(true);
      const res = await leadsAPI.getById(id);
      setFullLead(res.data);
    } catch (error) {
      console.error("Error fetching full lead:", error);
    } finally {
      setLoadingFullLead(false);
    }
  };

  const getLeadsForDate = (date: Date) => {
    return leads
      .filter((lead) => {
        if (!lead.followUpDate) return false;
        const followUpDate = toLocalDate(lead.followUpDate);
        const matches =
          followUpDate.toDateString() === date.toDateString() &&
          (statusFilter === "ALL" || lead.status === statusFilter);
        return matches;
      })
      .sort((a, b) => {
        const timeA = new Date(a.followUpDate).getTime();
        const timeB = new Date(b.followUpDate).getTime();
        return timeA - timeB;
      });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedDayLeads(getLeadsForDate(date));
    setSelectedLeadId(null);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  });
  const leadingEmptyDays = monthStart.getDay(); // 0=Sun … 6=Sat

  const totalFollowups = leads.length;
  const filteredFollowups = leads.filter(
    (l) => statusFilter === "ALL" || l.status === statusFilter,
  ).length;
  const overdueFollowups = leads.filter(
    (l) =>
      isBefore(new Date(l.followUpDate), startOfDay(new Date())) &&
      (statusFilter === "ALL" || l.status === statusFilter),
  ).length;

  return (
    <AppLayout title="Follow-up Calendar">
      <div className="h-full flex flex-col gap-5">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Follow-up Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage all pending follow-ups
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <Clock className="w-3 h-3 mr-1" /> {filteredFollowups} Follow-ups
            </Badge>
            {overdueFollowups > 0 && (
              <Badge variant="destructive" className="bg-red-50">
                <AlertCircle className="w-3 h-3 mr-1" /> {overdueFollowups}{" "}
                Overdue
              </Badge>
            )}
          </div>
        </div>

        {}
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border p-3 overflow-x-auto">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-muted-foreground mr-2 flex-shrink-0">
            Filter:
          </span>
          <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-1">
            {(["ALL", ...FOLLOW_UP_STATUSES] as const).map((status) => {
              const count = leads.filter((l) => l.status === status).length;
              return (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status as StatusFilter)}
                  className="text-xs whitespace-nowrap flex-shrink-0"
                >
                  {status}
                  {status !== "ALL" && (
                    <span className="ml-1 text-[10px]">({count})</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {}
        <div className="flex flex-col lg:flex-row gap-5 flex-1 overflow-hidden">
          {}
          <div className="flex-1 flex flex-col bg-card rounded-xl border border-border p-6 overflow-hidden">
            {}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                      ),
                    )
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                      ),
                    )
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center font-bold text-sm text-muted-foreground py-2"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>

                {}
                <div className="grid grid-cols-7 gap-1 flex-1">
                  {Array.from({ length: leadingEmptyDays }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-24" />
                  ))}
                  {daysInMonth.map((date, idx) => {
                    const dayLeads = getLeadsForDate(date);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    const isCurrentDay = isToday(date);
                    const isOverdue =
                      isBefore(date, startOfDay(new Date())) && isCurrentMonth;

                    return (
                      <div
                        key={`day-${idx}`}
                        className={cn(
                          "rounded-lg border p-2 min-h-24 flex flex-col transition-colors cursor-pointer",
                          isCurrentMonth
                            ? "bg-background border-border hover:border-primary/30"
                            : "bg-muted/30 border-border/50 opacity-40",
                          isCurrentDay && "border-primary bg-primary/5",
                          isOverdue &&
                            dayLeads.length > 0 &&
                            "border-destructive/50",
                        )}
                        onClick={() => handleDateClick(date)}
                      >
                        <span
                          className={cn(
                            "text-xs font-bold mb-1",
                            isCurrentDay
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {format(date, "d")}
                        </span>
                        <div className="space-y-0.5 flex-1 overflow-y-auto">
                          {dayLeads.slice(0, 2).map((lead) => (
                            <div
                              key={lead._id}
                              className={cn(
                                "rounded px-1.5 py-1 text-[10px] font-bold truncate hover:opacity-90 shadow-sm",
                                getStatusColorClasses(lead.status) ||
                                  "bg-gray-300 text-slate-900 font-semibold",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(date);
                                setSelectedDayLeads(dayLeads);
                                setSelectedLeadId(lead._id);
                              }}
                              title={lead.name}
                            >
                              {lead.name}
                            </div>
                          ))}
                          {dayLeads.length > 2 && (
                            <div className="text-[9px] text-muted-foreground font-semibold italic px-1">
                              +{dayLeads.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DateLeadModal
          open={!!selectedDate}
          date={selectedDate}
          leads={selectedDayLeads}
          selectedLeadId={selectedLeadId}
          selectedLead={
            fullLead &&
            (fullLead._id === selectedLeadId || fullLead.id === selectedLeadId)
              ? fullLead
              : null
          }
          loadingLead={loadingFullLead}
          title="Follow-up Schedule"
          leadCountLabel={`${selectedDayLeads.length} lead${selectedDayLeads.length === 1 ? "" : "s"}`}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDate(null);
              setSelectedDayLeads([]);
              setSelectedLeadId(null);
              setFullLead(null);
            }
          }}
          onLeadSelect={(leadId) => setSelectedLeadId(leadId)}
          onLeadClose={() => setSelectedLeadId(null)}
          onRefresh={async () => {
            await fetchFollowups();
            if (selectedLeadId) fetchFullLead(selectedLeadId);
          }}
        />
      </div>
    </AppLayout>
  );
}
