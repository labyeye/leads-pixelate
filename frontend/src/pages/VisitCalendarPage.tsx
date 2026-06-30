import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
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
import { statusColors } from "@/components/leads/statusConstants";
import { DateLeadModal } from "@/components/leads/DateLeadModal";

type TagFilter = "ALL" | "HOT" | "WARM" | "COLD";

// Parse a DB date string to a local-midnight Date to avoid UTC-offset day shifts
const toLocalDate = (dateStr: string): Date => {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export default function VisitCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeads, setSelectedDayLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [loadingFullLead, setLoadingFullLead] = useState(false);
  const [tagFilter, setTagFilter] = useState<TagFilter>("ALL");
  const { toast } = useToast();

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      setFullLead(null);
      fetchFullLead(selectedLeadId);
    } else {
      setFullLead(null);
    }
  }, [selectedLeadId]);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getAll({
        status: "VISIT SCHEDULED",
      });
      const freshLeads = res.data || [];
      setLeads(freshLeads);

      if (selectedDate) {
        const updated = freshLeads
          .filter((lead: any) => {
            const dateToUse = lead.visitScheduledDate || lead.followUpDate;
            if (!dateToUse) return false;
            return (
              toLocalDate(dateToUse).toDateString() === selectedDate.toDateString()
            );
          })
          .sort((a: any, b: any) => {
            const dateA = a.visitScheduledDate || a.followUpDate;
            const dateB = b.visitScheduledDate || b.followUpDate;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          });
        setSelectedDayLeads(updated);
      }
    } catch (error) {
      console.error("Error fetching visits:", error);
      toast({
        title: "Error",
        description: "Failed to load scheduled visits",
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
        const dateToUse = lead.visitScheduledDate || lead.followUpDate;
        if (!dateToUse) return false;
        const visitDate = toLocalDate(dateToUse);
        return (
          visitDate.toDateString() === date.toDateString() &&
          (tagFilter === "ALL" || lead.contactTag === tagFilter)
        );
      })
      .sort((a, b) => {
        const timeA = new Date(
          a.visitScheduledDate || a.followUpDate,
        ).getTime();
        const timeB = new Date(
          b.visitScheduledDate || b.followUpDate,
        ).getTime();
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

  const totalVisits = leads.length;
  const filteredVisits = leads.filter(
    (l) => tagFilter === "ALL" || l.contactTag === tagFilter,
  ).length;
  const overdueDays = leads.filter((l) => {
    const dateToUse = l.visitScheduledDate || l.followUpDate;
    return (
      dateToUse &&
      isBefore(new Date(dateToUse), startOfDay(new Date())) &&
      (tagFilter === "ALL" || l.contactTag === tagFilter)
    );
  }).length;

  return (
    <AppLayout title="Visit Calendar">
      <div className="h-full flex flex-col gap-5">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Visit Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and track all scheduled client visits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <MapPin className="w-3 h-3 mr-1" /> {totalVisits} Total Visits
            </Badge>
            {overdueDays > 0 && (
              <Badge variant="destructive" className="bg-red-50">
                <AlertCircle className="w-3 h-3 mr-1" /> {overdueDays} Overdue
              </Badge>
            )}
          </div>
        </div>

        {}
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border p-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Filter by Tag:
          </span>
          {(["ALL", "HOT", "WARM", "COLD"] as const).map((tag) => (
            <Button
              key={tag}
              variant={tagFilter === tag ? "default" : "outline"}
              size="sm"
              onClick={() => setTagFilter(tag)}
              className="text-xs"
            >
              {tag}
              {tag !== "ALL" && (
                <span className="ml-1 text-[10px]">
                  ({leads.filter((l) => l.contactTag === tag).length})
                </span>
              )}
            </Button>
          ))}
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
                              className="bg-blue-400 rounded px-1.5 py-1 text-[10px] font-bold text-white truncate hover:bg-blue-500 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(date);
                                setSelectedDayLeads(dayLeads);
                                setSelectedLeadId(lead._id);
                              }}
                            >
                              {lead.name}
                            </div>
                          ))}
                          {dayLeads.length > 2 && (
                            <div className="text-[8px] text-muted-foreground italic px-1">
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
          title="Visit Schedule"
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
            await fetchVisits();
            if (selectedLeadId) fetchFullLead(selectedLeadId);
          }}
        />
      </div>
    </AppLayout>
  );
}
