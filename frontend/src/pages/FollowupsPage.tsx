import { useState, useEffect } from "react";
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  isBefore,
  startOfDay,
} from "date-fns";
import {
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Clock,
  CalendarIcon,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { leadsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { statusColors } from "@/components/leads/statusConstants";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Parse a DB date string to a local-midnight Date to avoid UTC-offset day shifts
const toLocalDate = (dateStr: string): Date => {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

type TabType = "overdue" | "today" | "tomorrow" | "week" | "custom";

export default function FollowupsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [loadingFullLead, setLoadingFullLead] = useState(false);

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

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getAll({
        hasFollowup: "true",
      });
      const leadsWithFollowup = (res.data || []).filter(
        (l: any) => l.followUpDate && !["WON", "DROP"].includes(l.status),
      );
      setLeads(leadsWithFollowup);
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

  const getFollowupsByTab = (tab: TabType, customDateValue?: Date) => {
    const now = new Date();
    const today = startOfDay(now);

    return leads.filter((lead) => {
      if (!lead.followUpDate) return false;
      const followupDate = toLocalDate(lead.followUpDate);

      switch (tab) {
        case "overdue":
          return isBefore(followupDate, today);
        case "today":
          return isToday(followupDate);
        case "tomorrow":
          return isTomorrow(followupDate);
        case "week":
          return (
            isThisWeek(followupDate) &&
            !isToday(followupDate) &&
            !isTomorrow(followupDate)
          );
        case "custom":
          if (!customDateValue) return false;
          return (
            followupDate.toDateString() ===
            toLocalDate(customDateValue.toISOString()).toDateString()
          );
        default:
          return false;
      }
    });
  };

  const getFilteredFollowups = () => {
    if (activeTab === "custom") {
      return getFollowupsByTab(activeTab, customDate);
    }
    return getFollowupsByTab(activeTab);
  };

  const handleRefresh = async () => {
    fetchFollowups();
    if (selectedLeadId) fetchFullLead(selectedLeadId);
  };

  const todayCount = getFollowupsByTab("today").length;
  const overdueCount = getFollowupsByTab("overdue").length;
  const tomorrowCount = getFollowupsByTab("tomorrow").length;
  const weekCount = getFollowupsByTab("week").length;

  const filteredLeads = getFilteredFollowups();

  return (
    <AppLayout title="Follow-ups">
      {}
      {todayCount > 0 && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-4 flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900">
              You have {todayCount} follow-up{todayCount !== 1 ? "s" : ""} today
            </p>
            <p className="text-sm text-blue-700">
              {overdueCount > 0 && `${overdueCount} overdue • `}Keep track and
              follow up!
            </p>
          </div>
        </div>
      )}

      {}
      <div className="mb-6 flex flex-wrap gap-2 bg-card rounded-lg border border-border p-2">
        <button
          onClick={() => {
            setActiveTab("overdue");
            setCustomDate(undefined);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "overdue"
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <AlertCircle className="w-4 h-4" />
          Overdue
          {overdueCount > 0 && (
            <span className="ml-1 bg-destructive/20 text-destructive text-xs font-bold px-2 py-0.5 rounded-full">
              {overdueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("today");
            setCustomDate(undefined);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "today"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Clock className="w-4 h-4" />
          Today
          {todayCount > 0 && (
            <span className="ml-1 bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {todayCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("tomorrow");
            setCustomDate(undefined);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "tomorrow"
              ? "bg-blue-500/10 text-blue-600"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          Tomorrow
          {tomorrowCount > 0 && (
            <span className="ml-1 bg-blue-500/20 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {tomorrowCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("week");
            setCustomDate(undefined);
          }}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
            activeTab === "week"
              ? "bg-purple-500/10 text-purple-600"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          This Week
          {weekCount > 0 && (
            <span className="ml-1 bg-purple-500/20 text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {weekCount}
            </span>
          )}
        </button>

        {}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                activeTab === "custom"
                  ? "bg-secondary/10 text-secondary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={(date) => {
                setCustomDate(date);
                setActiveTab("custom");
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {}
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="flex-1 bg-card rounded-xl border border-border card-shadow overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">
              {loading && (
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              )}
              {activeTab === "today" &&
                `Today's Follow-ups (${filteredLeads.length})`}
              {activeTab === "overdue" &&
                `Overdue Follow-ups (${filteredLeads.length})`}
              {activeTab === "tomorrow" &&
                `Tomorrow's Follow-ups (${filteredLeads.length})`}
              {activeTab === "week" &&
                `This Week's Follow-ups (${filteredLeads.length})`}
              {activeTab === "custom" && `Follow-ups (${filteredLeads.length})`}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Check className="w-12 h-12 text-green-500/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                No follow-ups
              </h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "today"
                  ? "Great! No follow-ups scheduled for today"
                  : "No follow-ups for this period"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-350px)]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-background/95 shadow-sm">
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider hidden md:table-cell">
                      Phone
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider">
                      Follow-up Date
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider hidden lg:table-cell">
                      Remarks
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-black uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead._id || lead.id}
                      onClick={() => setSelectedLeadId(lead._id || lead.id)}
                      className={cn(
                        "border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
                        (lead._id || lead.id) === selectedLeadId
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "",
                        activeTab === "overdue" ? "bg-destructive/5" : "",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {lead.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lead.company}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-sm text-black">
                        {lead.phone}
                      </td>
                      <td className="px-5 py-3 text-sm text-black">
                        {format(toLocalDate(lead.followUpDate), "MMM dd, yyyy")}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-sm text-black max-w-xs">
                        <span className="line-clamp-1">
                          {lead.remarks || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-1 rounded-full border inline-block",
                            statusColors[lead.status] || "bg-muted",
                          )}
                        >
                          {lead.status || "ALL"}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              const phoneNumber = lead.phone.replace(/\D/g, "");
                              window.open(`tel:${phoneNumber}`, "_blank");
                            }}
                            title="Call"
                          >
                            <Phone className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              const phoneNumber = lead.phone.replace(/\D/g, "");
                              window.open(
                                `https://wa.me/${phoneNumber}?text=Hi%20${encodeURIComponent(lead.name)}`,
                                "_blank",
                              );
                            }}
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">WA</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {}
        {fullLead && (
          <LeadDetailPanel
            lead={fullLead}
            onClose={() => setSelectedLeadId(null)}
            onRefresh={handleRefresh}
            className="w-full xl:w-96 sticky top-24 xl:top-[100px] mt-0 h-[calc(100vh-140px)]"
          />
        )}
      </div>
    </AppLayout>
  );
}
