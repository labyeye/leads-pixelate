import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Calendar as CalendarIcon,
  Filter,
  Users,
  Check,
  Loader2,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { leadsAPI } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { statusColors } from "@/components/leads/statusConstants";
import { useToast } from "@/components/ui/use-toast";

const categories = {
  Traffic: [
    "ALL",
    "FOLLOWUP 1",
    "FOLLOW UP 1",
    "FOLLOW UP 2",
    "FOLLOW UP 3",
    "FOLLOW UP 4",
    "FOLLOW UP 5",
  ],
  Lead: ["CONTACTED", "QUALIFIED", "NEED QUOTATION", "REMINDER", "VISITING"],
  "Potential Lead": ["VISITED", "QUOTATION SENT"],
  Dropped: ["DROP"],
  Client: ["WON"],
};

const getCategoryByStatus = (status: string) => {
  for (const [cat, items] of Object.entries(categories)) {
    if (items.includes(status)) return cat;
  }
  return "Traffic";
};

export default function CalendarPage() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayLeads, setSelectedDayLeads] = useState<any[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [loadingFullLead, setLoadingFullLead] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      setFullLead(null);
      fetchFullLead(selectedLeadId);
    } else {
      setFullLead(null);
    }
  }, [selectedLeadId]);

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

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getAll();
      setLeads(res.data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  }, [startDate, endDate]);

  const leadsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};

    leads.forEach((lead) => {
      const status = lead.status || "";
      const isFollowUp =
        status.includes("FOLLOW UP") || status.includes("FOLLOWUP");
      const isReminder = status === "REMINDER";

      if (!isFollowUp && !isReminder) return;

      let targetDateStr: string | null = null;
      let eventData: any = null;

      const isScheduledStatus = isFollowUp || isReminder;

      if (lead.followUpDate && isScheduledStatus) {
        try {
          const dateObj = new Date(lead.followUpDate);
          targetDateStr = format(dateObj, "yyyy-MM-dd");
          eventData = {
            ...lead,
            displayStatus: lead.status,
            historyTime: dateObj.getTime(),
          };
        } catch (e) {
          console.error("Invalid followUpDate", e);
        }
      }

      if (
        !targetDateStr &&
        lead.statusHistory &&
        lead.statusHistory.length > 0
      ) {
        try {
          const latestHistory = [...lead.statusHistory].sort(
            (a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0];

          if (
            latestHistory &&
            latestHistory.status !== "ALL" &&
            latestHistory.status !== "DROP"
          ) {
            const histDate = new Date(latestHistory.timestamp);
            targetDateStr = format(histDate, "yyyy-MM-dd");
            eventData = {
              ...lead,
              displayStatus: latestHistory.status,
              historyRemarks: latestHistory.remarks,
              historyTime: histDate.getTime(),
            };
          }
        } catch (e) {
          console.error("Invalid history date", e);
        }
      }

      if (!targetDateStr) {
        const fallbackDate = new Date(lead.updatedAt || lead.createdAt);
        targetDateStr = format(fallbackDate, "yyyy-MM-dd");
        eventData = {
          ...lead,
          displayStatus: lead.status,
          historyTime: fallbackDate.getTime(),
        };
      }

      if (targetDateStr && eventData) {
        if (!map[targetDateStr]) map[targetDateStr] = [];
        map[targetDateStr].push(eventData);
      }
    });

    return map;
  }, [leads]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayLeads = leadsByDate[dateStr] || [];
    setSelectedDayLeads(dayLeads);
    setSelectedDate(day);
    setSelectedLeadId(null);
    setSearch("");
    setStatusFilters([]);
    setSourceFilters([]);
  };

  const filteredDayLeads = useMemo(() => {
    if (!selectedDayLeads) return [];
    return selectedDayLeads.filter((l) => {
      const matchesSearch =
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.company || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.phone || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(l.status || "ALL");

      const matchesSource =
        sourceFilters.length === 0 ||
        sourceFilters.includes(l.source || "General");

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [selectedDayLeads, search, statusFilters, sourceFilters]);

  const renderHeaderFilter = (
    field: string,
    options: string[],
    currentFilters: string[],
    setFilters: React.Dispatch<React.SetStateAction<string[]>>,
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1 rounded-sm hover:bg-muted transition-colors",
            currentFilters.length > 0
              ? "text-primary bg-primary/10"
              : "text-black/50 hover:text-primary",
          )}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput
            placeholder={`Search ${field}...`}
            className="h-8 text-xs"
          />
          <CommandList className="max-h-48 overflow-y-auto">
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => setFilters([])}
                className="text-xs italic text-black"
              >
                Clear All
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  onSelect={() => {
                    setFilters((prev) =>
                      prev.includes(opt)
                        ? prev.filter((s) => s !== opt)
                        : [...prev, opt],
                    );
                  }}
                  className="text-xs"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary",
                      currentFilters.includes(opt)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </div>
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const selectedLead = useMemo(() => {
    if (
      fullLead &&
      (fullLead._id === selectedLeadId || fullLead.id === selectedLeadId)
    ) {
      return fullLead;
    }
    if (!selectedLeadId || !selectedDayLeads) return null;
    return selectedDayLeads.find((l) => (l._id || l.id) === selectedLeadId);
  }, [selectedLeadId, selectedDayLeads, fullLead]);

  return (
    <AppLayout title="Calendar">
      <div className="flex flex-col h-full animate-fade-in">
        {}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-card border border-border rounded-lg p-1 overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-black hover:text-black"
                onClick={prevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-black hover:text-black"
                onClick={nextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold px-4 border-border hover:bg-muted"
              onClick={goToToday}
            >
              TODAY
            </Button>
            <h2 className="text-xl font-bold text-black min-w-[150px]">
              {format(currentDate, "MMMM yyyy")}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 p-1 rounded-lg">
              {["MONTH", "WEEK", "DAY", "SCHEDULE"].map((view) => (
                <button
                  key={view}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-md transition-all",
                    view === "MONTH"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-black hover:text-black",
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {}
          <div className="grid grid-cols-7 border-b border-border bg-muted/20">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-xs font-bold text-black tracking-widest border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {}
          <div className="grid grid-cols-7 flex-1">
            {calendarDays.map((day, idx) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayLeads = leadsByDate[dateStr] || [];
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[120px] border-r border-b border-border p-2 cursor-pointer transition-colors hover:bg-muted/30 group relative",
                    !isCurrentMonth && "bg-muted/10 opacity-50",
                    isToday(day) && "bg-primary/5",
                    idx % 7 === 6 && "border-r-0",
                  )}
                >
                  <div className="flex justify-end items-start mb-1">
                    <span
                      className={cn(
                        "text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                        isToday(day)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-black group-hover:text-black",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {}
                  <div className="space-y-1 overflow-hidden">
                    {dayLeads.slice(0, 4).map((lead, lIdx) => (
                      <div
                        key={lIdx}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold truncate border shadow-sm",
                          statusColors[lead.displayStatus] ||
                            "bg-muted text-black border-transparent",
                        )}
                        title={`${lead.displayStatus}: ${lead.name}${lead.historyRemarks ? ` - ${lead.historyRemarks}` : ""}`}
                      >
                        {lead.displayStatus.includes("FOLLOW")
                          ? "F/Up"
                          : lead.displayStatus}
                        : {lead.name}
                      </div>
                    ))}
                    {dayLeads.length > 4 && (
                      <div className="text-[9px] text-primary font-bold pl-1 mt-1">
                        + {dayLeads.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {}
      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-hidden flex flex-col p-0 transition-all duration-300",
            selectedLeadId ? "max-w-7xl" : "max-w-5xl",
          )}
        >
          <div className="p-6 pb-2 border-b border-border bg-muted/10">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p>Lead Schedule</p>
                    <p className="text-xs text-black font-normal">
                      {selectedDate &&
                        format(selectedDate, "EEEE, do MMMM yyyy")}
                    </p>
                  </div>
                </DialogTitle>

                <div className="relative flex items-center gap-2 bg-card rounded-lg border border-border px-3 h-9 w-64 mr-8">
                  <Search className="w-3.5 h-3.5 text-black" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent text-xs outline-none w-full text-black placeholder:text-black"
                  />
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {}
            <div
              className={cn(
                "flex-1 overflow-auto p-6 pt-4 transition-all duration-300",
                selectedLeadId ? "border-r border-border" : "",
              )}
            >
              {filteredDayLeads.length > 0 ? (
                <>
                  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="text-left px-5 py-4 text-xs font-bold text-black uppercase tracking-widest">
                            Lead / Company
                          </th>
                          <th className="text-left px-5 py-4 text-xs font-bold text-black uppercase tracking-widest">
                            Contact
                          </th>
                          <th className="text-left px-5 py-4 text-xs font-bold text-black uppercase tracking-widest">
                            <div className="flex items-center gap-1">
                              Status
                              {renderHeaderFilter(
                                "status",
                                Object.keys(statusColors).filter(
                                  (s) =>
                                    s.includes("FOLLOW UP") ||
                                    s.includes("FOLLOWUP") ||
                                    s === "REMINDER",
                                ),
                                statusFilters,
                                setStatusFilters,
                              )}
                            </div>
                          </th>
                          <th className="text-left px-5 py-4 text-xs font-bold text-black uppercase tracking-widest">
                            Requirements
                          </th>
                          <th className="text-left px-5 py-4 text-xs font-bold text-black uppercase tracking-widest">
                            Date & Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredDayLeads.map((lead) => (
                          <tr
                            key={lead._id || lead.id}
                            className={cn(
                              "hover:bg-muted/20 transition-colors cursor-pointer text-black",
                              selectedLeadId === (lead._id || lead.id)
                                ? "bg-primary/5"
                                : "",
                            )}
                            onClick={() =>
                              setSelectedLeadId(lead._id || lead.id)
                            }
                          >
                            <td className="px-5 py-4">
                              <p className="font-bold text-black">
                                {lead.name}
                              </p>
                              <p className="text-[11px] text-black mt-0.5">
                                {lead.company}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-black">
                                  {lead.phone}
                                </span>
                                <span className="text-[10px] text-primary hover:underline cursor-pointer">
                                  {lead.email || "No email"}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] uppercase font-bold px-2 py-0.5 border-none",
                                    statusColors[lead.status] ||
                                      "bg-muted text-black",
                                  )}
                                >
                                  {lead.status}
                                </Badge>
                                {lead.displayStatus !== lead.status && (
                                  <span className="text-[10px] text-black font-medium italic">
                                    ({lead.displayStatus})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-[11px] text-black italic line-clamp-2 max-w-[200px]">
                                {lead.requirement
                                  ? `"${lead.requirement}"`
                                  : "No details provided"}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs font-medium text-black text-nowrap">
                                {lead.historyTime
                                  ? format(
                                      new Date(lead.historyTime),
                                      "dd MMM, hh:mm a",
                                    )
                                  : lead.followUpDate
                                    ? format(
                                        new Date(lead.followUpDate),
                                        "dd MMM, hh:mm a",
                                      )
                                    : "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-xl border border-dashed border-border">
                  <CalendarIcon className="w-12 h-12 text-black/30 mb-3" />
                  <p className="text-black font-medium">
                    {search ||
                    statusFilters.length > 0 ||
                    sourceFilters.length > 0
                      ? "No leads match your filters"
                      : "No leads scheduled for this date"}
                  </p>
                  {(search ||
                    statusFilters.length > 0 ||
                    sourceFilters.length > 0) && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearch("");
                        setStatusFilters([]);
                        setSourceFilters([]);
                      }}
                      className="mt-2 text-primary"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              )}
            </div>

            {}
            {selectedLeadId && selectedLead && (
              <div className="w-[400px] bg-card flex flex-col border-l border-border animate-slide-in-right">
                <LeadDetailPanel
                  lead={selectedLead}
                  onClose={() => setSelectedLeadId(null)}
                  onRefresh={() => {
                    fetchLeads();
                  }}
                  className="rounded-none border-none"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
