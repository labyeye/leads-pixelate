import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, Fragment } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  MoreVertical,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  UserCheck,
  Zap,
  Loader2,
  AlertCircle,
  Filter,
  Check,
  ChevronDown,
  X,
  ChevronUp,
  MoreHorizontal,
  MapPin,
  Ban,
  IndianRupee,
  LayoutGrid,
  List,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  leadsAPI,
  indiamartAPI,
  tradeindiaSyncAPI,
  justdialSyncAPI,
  facebookAPI,
  usersAPI,
  productsAPI,
  authAPI,
} from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  categories,
  getCategoryByStatus,
  statusColors,
  sourceColors,
} from "@/components/leads/statusConstants";

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("New Lead");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [loadingFullLead, setLoadingFullLead] = useState(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const { toast } = useToast();

  const [syncing, setSyncing] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbConnected, setFbConnected] = useState(false);
  const [tiSyncing, setTiSyncing] = useState(false);
  const [jdSyncing, setJdSyncing] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [salesExecs, setSalesExecs] = useState<any[]>([]);
  const [selectedExecIds, setSelectedExecIds] = useState<string[]>([]);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [loadingExecs, setLoadingExecs] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [budgetFilters, setBudgetFilters] = useState<string[]>([]);
  const [productFilters, setProductFilters] = useState<string[]>([]);

  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [followUpDateFilter, setFollowUpDateFilter] = useState<
    Date | undefined
  >(undefined);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [remarksInput, setRemarksInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = useState<string>("12:00");

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLeadLoading, setAddLeadLoading] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    requirement: "",
    budget: "",
    source: "Manual",
    status: "ALL",
    assignedTo: "",
    interestedProducts: [] as string[],
    location: "",
  });

  useEffect(() => {
    fetchLeads();
  }, [startDate, endDate]);

  useEffect(() => {
    loadSyncStatus();
    fetchAllUsers();
    fetchProducts();
    fetchCurrentUser();
    facebookAPI
      .getConnectedPages()
      .then((res) => {
        if (res.data.length > 0) setFbConnected(true);
      })
      .catch(() => {});
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

  const fetchCurrentUser = async () => {
    try {
      const res = await authAPI.getMe();
      setCurrentUser(res.data);
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll();
      setAllProducts(res.data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await usersAPI.getAll({ status: "active" });
      const users = res.data || [];
      setAllUsers(users);
      if (currentUser && currentUser.role === "sales_executive") {
        setNewLead((prev) => ({ ...prev, assignedTo: currentUser._id }));
      } else if (users.length > 0) {
        setNewLead((prev) => ({ ...prev, assignedTo: users[0]._id }));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await leadsAPI.getAll(params);
      setLeads(res.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const res = await indiamartAPI.getStatus();
      setSyncStatus(res.data);
    } catch {}
  };

  const handleFacebookSync = async () => {
    try {
      setFbSyncing(true);
      const res = await facebookAPI.sync();
      const pageErrors = res.data?.pages?.filter((p: any) => p.error) || [];
      const pageDetails =
        res.data?.pages
          ?.map((p: any) =>
            p.error
              ? `${p.pageName}: ❌ ${p.error}`
              : `${p.pageName}: +${p.created} new`,
          )
          .join("\n") || "";
      toast({
        title: "Facebook Sync Complete",
        description:
          pageErrors.length > 0
            ? `${res.message}\n\n${pageDetails}`
            : res.message,
        variant: pageErrors.length > 0 ? "destructive" : "default",
      });
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Facebook Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFbSyncing(false);
    }
  };

  const handleIndiamartSync = async () => {
    try {
      setSyncing(true);
      const res = await indiamartAPI.sync();
      setLastSyncResult(res.data);
      toast({
        title: "🟢 IndiaMART Sync Complete",
        description: res.message,
      });
      fetchLeads();
      loadSyncStatus();
    } catch (error: any) {
      toast({
        title: "IndiaMART Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleTradeindiaSyncAttempt = async () => {
    try {
      setTiSyncing(true);
      const res = await tradeindiaSyncAPI.sync();
      toast({ title: "TradeIndia Sync Complete", description: res.message });
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "TradeIndia Sync",
        description: error.message || "TradeIndia integration not configured.",
        variant: "destructive",
      });
    } finally {
      setTiSyncing(false);
    }
  };

  const handleJustdialSyncAttempt = async () => {
    try {
      setJdSyncing(true);
      const res = await justdialSyncAPI.sync();
      toast({ title: "Justdial Sync Complete", description: res.message });
      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Justdial Sync",
        description: error.message || "Justdial integration not configured.",
        variant: "destructive",
      });
    } finally {
      setJdSyncing(false);
    }
  };

  const fetchSalesExecs = async () => {
    try {
      setLoadingExecs(true);
      const res = await usersAPI.getAll({
        role: "sales_executive",
        status: "active",
      });
      setSalesExecs(res.data || []);
      const preselected = res.data
        .filter((u: any) => u.receiveAutoAssignedLeads)
        .map((u: any) => u._id);
      setSelectedExecIds(preselected);
    } catch (error: any) {
      console.error("Error fetching executives:", error);
    } finally {
      setLoadingExecs(false);
    }
  };

  const handleUpdateAutoAssign = async () => {
    try {
      setSavingAssignees(true);
      await usersAPI.updateAutoAssign(selectedExecIds);
      toast({
        title: "Settings updated",
        description:
          selectedExecIds.length > 0
            ? `Leads will be assigned to ${selectedExecIds.length} selected executives.`
            : "Leads will be assigned randomly among all active executives.",
      });
      setIsAssignModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingAssignees(false);
    }
  };

  const toggleExecSelection = (id: string) => {
    setSelectedExecIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleUpdateAssignee = async (leadId: string, userId: string) => {
    try {
      await leadsAPI.update(leadId, { assignedTo: userId });
      setLeads((prev) =>
        prev.map((l) =>
          l._id === leadId || l.id === leadId
            ? { ...l, assignedTo: allUsers.find((u) => u._id === userId) }
            : l,
        ),
      );
      toast({
        title: "Lead reassigned",
        description: "The lead has been successfully reassigned.",
      });
    } catch (error: any) {
      toast({
        title: "Reassignment failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const matchesCategory = (l: any, cat: string) => {
    const leadCategory = getCategoryByStatus(l.status || "ALL");
    if (leadCategory === cat) return true;

    if (cat === "Quotation") {
      return l.stagePath?.some((s: string) => s.includes("QUOTATION"));
    } else if (cat === "Visit Scheduled") {
      return (
        (l.status === "VISIT SCHEDULED" || !!l.visitScheduledDate) &&
        l.status !== "VISITED" &&
        !l.visitActualDate
      );
    } else if (cat === "Visited") {
      return l.status === "VISITED" || !!l.visitActualDate;
    }
    return false;
  };

  const filtered = leads
    .filter((l) => {
      const matchesSearch =
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.company || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.phone || "").toLowerCase().includes(search.toLowerCase());

      const isInCategory = matchesCategory(l, activeCategory);

      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(l.status || "ALL");

      const matchesSource =
        sourceFilters.length === 0 ||
        sourceFilters.includes(l.source || "General");

      const parseBudget = (b: string) => {
        if (!b || b === "Not Specified") return null;
        return parseInt(b.replace(/[^0-9]/g, "")) || null;
      };

      const leadBudget = parseBudget(l.budget || "");
      const min = budgetMin ? parseInt(budgetMin) : null;
      const max = budgetMax ? parseInt(budgetMax) : null;

      const matchesBudget =
        (budgetFilters.length === 0 ||
          budgetFilters.includes(l.budget || "Not Specified")) &&
        (min === null || (leadBudget !== null && leadBudget >= min)) &&
        (max === null || (leadBudget !== null && leadBudget <= max));

      const matchesProduct =
        productFilters.length === 0 ||
        (l.interestedProducts &&
          l.interestedProducts.some((p: string) => productFilters.includes(p)));

      let matchesFollowUp = true;
      if (followUpDateFilter) {
        if (!l.followUpDate) {
          matchesFollowUp = false;
        } else {
          const fDate = new Date(l.followUpDate);
          const filterDate = new Date(followUpDateFilter);

          matchesFollowUp =
            fDate.getDate() === filterDate.getDate() &&
            fDate.getMonth() === filterDate.getMonth() &&
            fDate.getFullYear() === filterDate.getFullYear();
        }
      }

      return (
        matchesSearch &&
        isInCategory &&
        matchesStatus &&
        matchesSource &&
        matchesBudget &&
        matchesProduct &&
        matchesFollowUp
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

  const getUniqueValues = (field: string) => {
    const values = new Set<string>();
    leads.forEach((l) => {
      if (field === "interestedProducts") {
        l.interestedProducts?.forEach((p: string) => values.add(p));
      } else {
        const val =
          l[field] || (field === "budget" ? "Not Specified" : "General");
        values.add(val);
      }
    });
    return Array.from(values).sort();
  };

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

  const renderBudgetRangeFilter = () => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1 rounded-sm hover:bg-muted transition-colors",
            budgetMin || budgetMax
              ? "text-primary bg-primary/10"
              : "text-black/50 hover:text-primary",
          )}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-4 z-50 bg-popover shadow-xl border border-border"
        align="start"
      >
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-black">
            Budget Range
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="min-budget" className="text-[10px] uppercase">
                Min
              </Label>
              <input
                id="min-budget"
                type="number"
                placeholder="0"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max-budget" className="text-[10px] uppercase">
                Max
              </Label>
              <input
                id="max-budget"
                type="number"
                placeholder="Max"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[10px] h-7"
            onClick={() => {
              setBudgetMin("");
              setBudgetMax("");
            }}
          >
            Clear Range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const renderFollowUpDateFilter = () => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1 rounded-sm hover:bg-muted transition-colors",
            followUpDateFilter
              ? "text-primary bg-primary/10"
              : "text-black/50 hover:text-primary",
          )}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-50 bg-popover shadow-xl border border-border"
        align="end"
      >
        <div className="p-3 border-b border-border bg-muted/50 rounded-t-lg">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-black">
            Select Follow-up Date
          </h4>
        </div>
        <div className="p-1 bg-popover">
          <Calendar
            initialFocus
            mode="single"
            selected={followUpDateFilter}
            onSelect={setFollowUpDateFilter}
            className="p-3"
          />
        </div>
        <div className="p-3 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-7"
            onClick={() => setFollowUpDateFilter(undefined)}
          >
            Clear Date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const lead =
    fullLead &&
    (fullLead._id === selectedLeadId || fullLead.id === selectedLeadId)
      ? fullLead
      : selectedLeadId
        ? leads.find((l) => (l._id || l.id) === selectedLeadId)
        : null;

  const handleUpdateStatus = async (
    newStatus: string,
    remarks?: string,
    date?: Date,
  ) => {
    if (!lead) return;

    const dateRequiredStatuses = [
      "FOLLOWUP 1",
      "FOLLOW UP 2",
      "FOLLOW UP 3",
      "FOLLOW UP 4",
      "FOLLOW UP 5",
      "REMINDER",
      "VISITING",
      "VISITED",
    ];

    if (!isStatusModalOpen) {
      setPendingStatus(newStatus);
      setRemarksInput(lead.remarks || "");
      setBudgetInput(lead.budget || "");
      setSelectedProducts(lead.interestedProducts || []);
      setSelectedDate(
        lead.followUpDate ? new Date(lead.followUpDate) : new Date(),
      );
      setSelectedTime(
        lead.followUpDate
          ? format(new Date(lead.followUpDate), "HH:mm")
          : "12:00",
      );
      setIsStatusModalOpen(true);
      return;
    }

    try {
      setConverting(true);
      if (newStatus === "WON") {
        await handleConvertToClient(remarksInput);
        setIsStatusModalOpen(false);
        setPendingStatus(null);
        return;
      }
      const updateData: any = {
        status: newStatus,
        remarks: remarksInput !== undefined ? remarksInput : lead.remarks,
        budget: budgetInput !== undefined ? budgetInput : lead.budget,
        interestedProducts: selectedProducts,
      };

      if (!["DROP", "WON"].includes(newStatus)) {
        updateData.followUpDate = date;
      }

      await leadsAPI.update(lead._id || lead.id, updateData);
      toast({
        title: "Status Updated",
        description: `Lead status changed to ${newStatus}${date ? ` for ${format(date, "PPP")}` : ""}`,
      });
      fetchLeads();
      if (selectedLeadId) fetchFullLead(selectedLeadId);
      setIsStatusModalOpen(false);
      setPendingStatus(null);

      const newCat = getCategoryByStatus(newStatus);
      if (newCat !== activeCategory) {
        setSelectedLeadId(null);
      }
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newLead.name ||
      !newLead.company ||
      !newLead.phone ||
      !newLead.requirement
    ) {
      toast({
        title: "Missing Fields",
        description:
          "Please fill in all required fields (Name, Company, Phone, Requirement).",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddLeadLoading(true);
      const res = await leadsAPI.create(newLead);
      if (res.success) {
        toast({
          title: "Lead Created",
          description: `${newLead.name} from ${newLead.company} has been added successfully.`,
        });
        setIsAddModalOpen(false);
        setNewLead({
          name: "",
          company: "",
          phone: "",
          email: "",
          requirement: "",
          budget: "",
          source: "Manual",
          status: "ALL",
          assignedTo:
            currentUser?._id || (allUsers.length > 0 ? allUsers[0]._id : ""),
          interestedProducts: [],
          location: "",
        });
        fetchLeads();
      }
    } catch (error: any) {
      toast({
        title: "Error creating lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddLeadLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      setIsAddingProduct(true);
      const res = await productsAPI.create({
        name: newProductName,
        category: "Machines",
        price: 0,
        description: "Added from lead remarks",
      });

      if (res.success) {
        setAllProducts((prev) => [...prev, res.data]);
        setSelectedProducts((prev) => [...prev, res.data.name]);
        setNewProductName("");
        toast({
          title: "Product added",
          description: `${newProductName} has been added to the database.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error adding product",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingProduct(false);
    }
  };

  const toggleProductSelection = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((p) => p !== productName)
        : [...prev, productName],
    );
  };

  const handleConvertToClient = async (remarks?: string) => {
    if (!lead) return;
    try {
      setConverting(true);
      const res = await leadsAPI.convertToClient(lead._id || lead.id, {
        address: "Not Provided",
        businessType: "Not Specified",
        remarks: remarks || remarksInput,
      });
      if (res.success) {
        toast({
          title: "Success",
          description: "Lead converted to Client successfully!",
        });
        fetchLeads();
        setSelectedLeadId(null);
      }
    } catch (error: any) {
      toast({
        title: "Error converting lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const noPickupAction = () => {
    if (!lead) return;
    const current = lead.status || "ALL";
    if (current === "ALL") handleUpdateStatus("FOLLOWUP 1");
    else if (current === "FOLLOWUP 1" || current === "FOLLOW UP 1")
      handleUpdateStatus("FOLLOW UP 2");
    else if (current === "FOLLOW UP 2") handleUpdateStatus("FOLLOW UP 3");
    else if (current === "FOLLOW UP 3") handleUpdateStatus("FOLLOW UP 4");
    else if (current === "FOLLOW UP 4") handleUpdateStatus("FOLLOW UP 5");
    else if (current === "FOLLOW UP 5") handleUpdateStatus("DROP");
    else handleUpdateStatus("FOLLOWUP 1");
  };

  return (
    <AppLayout title="Leads">
      {}
      <div className="flex flex-col gap-5 mb-6 animate-fade-in">
        {}
        <div className="flex flex-wrap items-center gap-3 w-full">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {currentUser?.role !== "sales_executive" && (
              <Dialog
                open={isAssignModalOpen}
                onOpenChange={(open) => {
                  setIsAssignModalOpen(open);
                  if (open) fetchSalesExecs();
                }}
              >
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all whitespace-nowrap">
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign Lead
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Lead Assignment Settings</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <p className="text-sm text-black">
                      Select the sales executives who should receive leads from
                      IndiaMART. If none are selected, leads will be assigned
                      randomly among all active executives.
                    </p>

                    {loadingExecs ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {salesExecs.map((exec) => (
                          <div
                            key={exec._id}
                            className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={`exec-${exec._id}`}
                              checked={selectedExecIds.includes(exec._id)}
                              onCheckedChange={() =>
                                toggleExecSelection(exec._id)
                              }
                            />
                            <Label
                              htmlFor={`exec-${exec._id}`}
                              className="flex-1 cursor-pointer font-medium"
                            >
                              {exec.name}
                              <span className="block text-[10px] text-black font-normal">
                                {exec.email}
                              </span>
                            </Label>
                          </div>
                        ))}
                        {salesExecs.length === 0 && (
                          <p className="text-center py-4 text-xs text-black italic">
                            No active sales executives found.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex gap-2 sm:justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => setIsAssignModalOpen(false)}
                      disabled={savingAssignees}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleUpdateAutoAssign}
                      disabled={savingAssignees}
                    >
                      {savingAssignees ? "Saving..." : "Save Settings"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-green-600 font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>

            {fbConnected && (
              <button
                onClick={handleFacebookSync}
                disabled={fbSyncing}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {fbSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {fbSyncing ? "Syncing..." : "Sync Facebook"}
              </button>
            )}

            {syncStatus !== null && (
              <div className="flex items-center border-2 border-black shadow-[3px_3px_0px_#000]">
                <button
                  id="indiamart-sync-btn"
                  onClick={handleIndiamartSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-400 text-black font-black uppercase text-xs tracking-widest border-r-2 border-black hover:bg-orange-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {syncing ? "Syncing..." : "Sync IndiaMART"}
                </button>
                <button
                  onClick={() => setSyncPanelOpen(!syncPanelOpen)}
                  className="px-2 py-2 bg-orange-400 hover:bg-orange-300 text-black transition-colors"
                >
                  {syncPanelOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* TradeIndia Sync */}
            <button
              onClick={handleTradeindiaSyncAttempt}
              disabled={tiSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {tiSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {tiSyncing ? "Syncing..." : "Sync TradeIndia"}
            </button>

            {/* Justdial Sync */}
            <button
              onClick={handleJustdialSyncAttempt}
              disabled={jdSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {jdSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {jdSyncing ? "Syncing..." : "Sync Justdial"}
            </button>

            <div className="flex items-center gap-1.5 border-2 border-black px-3 h-10 w-full sm:w-40 bg-white shadow-[2px_2px_0px_#000]">
              <CalendarIcon className="w-3.5 h-3.5 text-black shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none w-full text-black"
                title="Start Date"
              />
            </div>
            <div className="flex items-center gap-1.5 border-2 border-black px-3 h-10 w-full sm:w-40 bg-white shadow-[2px_2px_0px_#000]">
              <CalendarIcon className="w-3.5 h-3.5 text-black shrink-0" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none w-full text-black"
                title="End Date"
              />
            </div>
            {(startDate ||
              endDate ||
              search ||
              statusFilters.length > 0 ||
              sourceFilters.length > 0 ||
              budgetFilters.length > 0 ||
              productFilters.length > 0 ||
              followUpDateFilter) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSearch("");
                  setStatusFilters([]);
                  setSourceFilters([]);
                  setBudgetFilters([]);
                  setProductFilters([]);
                  setBudgetMin("");
                  setBudgetMax("");
                  setFollowUpDateFilter(undefined);
                }}
                className="flex items-center gap-1 px-3 py-2 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all whitespace-nowrap"
              >
                <X className="w-3 h-3" /> Reset All
              </button>
            )}
          </div>

          <div className="relative z-50 flex items-center gap-2 bg-white border-2 border-black px-3 h-10 w-full lg:w-72 shadow-[2px_2px_0px_#000]">
            <Search className="w-4 h-4 text-black" />
            <input
              type="text"
              placeholder="Search by name, company, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-black"
            />
            {search.trim().length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-md shadow-xl max-h-80 overflow-y-auto">
                {leads
                  .filter(
                    (l) =>
                      (l.name || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                      (l.company || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                      (l.phone || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .slice(0, 20).length === 0 ? (
                  <div className="p-3 text-sm text-black">No leads found.</div>
                ) : (
                  leads
                    .filter(
                      (l) =>
                        (l.name || "")
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        (l.company || "")
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        (l.phone || "")
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .slice(0, 20)
                    .map((l) => (
                      <div
                        key={l._id || l.id}
                        className="p-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0"
                        onClick={() => {
                          setSearch("");
                          setActiveCategory(
                            getCategoryByStatus(l.status || "ALL"),
                          );
                          setSelectedLeadId(l._id || l.id);
                        }}
                      >
                        <div className="font-medium text-sm flex justify-between items-center">
                          <span>{l.name}</span>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border",
                              statusColors[l.status] ||
                                "bg-muted text-black border-transparent",
                            )}
                          >
                            {l.status || "ALL"}
                          </span>
                        </div>
                        <div className="text-xs text-black mt-1 flex gap-2">
                          <span>{l.company || "No Company"}</span>
                          <span>•</span>
                          <span>{l.phone || "No Phone"}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-full lg:w-fit overflow-x-auto border-2 border-black shadow-[3px_3px_0px_#000]">
            {Object.keys(categories).map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSelectedLeadId(null); }}
                className={cn(
                  "px-4 py-2.5 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 border-r-2 border-black last:border-r-0",
                  activeCategory === cat
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#FFDE00] hover:text-black",
                )}
              >
                {cat}
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 border border-black min-w-[20px] text-center",
                  activeCategory === cat ? "bg-[#FFDE00] text-black" : "bg-black text-white",
                )}>
                  {leads.filter((l) => matchesCategory(l, cat)).length}
                </span>
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border-2 border-black shadow-[2px_2px_0px_#000] ml-auto">
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest border-r-2 border-black transition-colors",
                viewMode === "table" ? "bg-[#024BAB] text-white" : "bg-white text-black hover:bg-[#FFDE00]",
              )}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => { setViewMode("kanban"); setSelectedLeadId(null); }}
              title="Kanban view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors",
                viewMode === "kanban" ? "bg-[#024BAB] text-white" : "bg-white text-black hover:bg-[#FFDE00]",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>
        </div>

        {}

        {}
        {syncPanelOpen && syncStatus && (
          <div className="border-2 border-black shadow-[4px_4px_0px_#000] bg-orange-50 animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-orange-400">
              <Zap className="w-4 h-4 text-black" />
              <h4 className="text-xs font-black uppercase tracking-widest text-black">
                IndiaMART Integration Status
              </h4>
              <span
                className={cn(
                  "text-[10px] font-black px-2 py-0.5 border-2 border-black ml-auto",
                  syncStatus.apiKeyConfigured
                    ? "bg-green-400 text-black"
                    : "bg-red-400 text-black",
                )}
              >
                {syncStatus.apiKeyConfigured
                  ? "API Key Active"
                  : "API Key Missing"}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_#000]">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  Total IM Leads
                </p>
                <p className="text-2xl font-black text-orange-600">
                  {syncStatus.totalIndiamartLeads || 0}
                </p>
              </div>
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_#000]">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  Last 7 Days
                </p>
                <p className="text-2xl font-black text-orange-500">
                  {syncStatus.last7DaysLeads || 0}
                </p>
              </div>
              {lastSyncResult && (
                <>
                  <div className="bg-green-400 border-2 border-black p-3 shadow-[2px_2px_0px_#000]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black">
                      Last Sync: New
                    </p>
                    <p className="text-2xl font-black text-black">
                      {lastSyncResult.created || 0}
                    </p>
                  </div>
                  <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_#000]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black">
                      Last Sync: Skipped
                    </p>
                    <p className="text-2xl font-black text-gray-500">
                      {lastSyncResult.skipped || 0}
                    </p>
                  </div>
                </>
              )}
            </div>
            {syncStatus.recentSyncs?.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Recent Syncs
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto border-2 border-black">
                  {syncStatus.recentSyncs.map((log: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white px-3 py-2 text-xs border-b-2 border-black last:border-b-0"
                    >
                      <span className="font-bold text-black">
                        {new Date(log.timestamp).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="font-black text-green-700">
                        +{log.created} new
                      </span>
                      <span className="font-bold text-black">
                        {log.skipped} skipped
                      </span>
                      <span
                        className={cn(
                          "font-black",
                          log.errors?.length > 0
                            ? "text-red-600"
                            : "text-gray-400",
                        )}
                      >
                        {log.errors?.length > 0
                          ? `${log.errors.length} err`
                          : "✓"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] font-bold text-black/50 px-4 pb-3">
              Auto-sync runs every 5 minutes. Click "Sync IndiaMART" to fetch
              immediately.
            </p>
          </div>
        )}
      </div>

      {/* ── Kanban view ── */}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {Object.entries({
              "New Lead": { bg: "bg-white", accent: "bg-primary" },
              "Discussion/Requirement": { bg: "bg-white", accent: "bg-primary" },
              "Quotation": { bg: "bg-white", accent: "bg-primary" },
              "Visit Scheduled": { bg: "bg-white", accent: "bg-primary" },
              "Visited": { bg: "bg-white", accent: "bg-primary" },
              "Client": { bg: "bg-green-50", accent: "bg-green-600" },
              "Dropped": { bg: "bg-red-50", accent: "bg-red-600" },
            } as Record<string, { bg: string; accent: string }>).map(([cat, style]) => {
              const colLeads = filtered.filter((l) => matchesCategory(l, cat));
              return (
                <div key={cat} className="w-72 shrink-0 border-2 border-black shadow-[4px_4px_0px_#000]">
                  {/* Column header */}
                  <div className={cn("flex items-center justify-between px-3 py-2.5 border-b-2 border-black", style.accent)}>
                    <span className="text-xs font-black uppercase tracking-widest text-white">{cat}</span>
                    <span className="text-[10px] font-black bg-white text-black px-1.5 py-0.5 border border-black min-w-[20px] text-center">
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className={cn("p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-340px)] overflow-y-auto", style.bg)}>
                    {loading ? (
                      <div className="flex justify-center pt-8">
                        <Loader2 className="w-5 h-5 animate-spin text-[#024BAB]" />
                      </div>
                    ) : colLeads.length === 0 ? (
                      <div className="text-center pt-10 text-[10px] font-black uppercase tracking-widest text-black/30">
                        No leads
                      </div>
                    ) : colLeads.map((l) => (
                      <div
                        key={l._id || l.id}
                        onClick={() => { setSelectedLeadId(l._id || l.id); setViewMode("table"); setActiveCategory(cat); }}
                        className={cn(
                          "bg-white border-2 border-black p-3 cursor-pointer transition-all hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5",
                          selectedLeadId === (l._id || l.id) && "ring-2 ring-[#024BAB]",
                        )}
                      >
                        {/* Score badge */}
                        {l.contactTag && (
                          <div className="flex justify-end mb-1.5">
                            <span className={cn(
                              "inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 border border-black uppercase",
                              l.contactTag === "HOT" && "bg-red-500 text-white",
                              l.contactTag === "WARM" && "bg-[#FFDE00] text-black",
                              l.contactTag === "COLD" && "bg-[#024BAB] text-white",
                            )}>
                              {l.contactTag === "HOT" && <Flame className="w-2.5 h-2.5" />}
                              {l.contactTag === "WARM" && <Thermometer className="w-2.5 h-2.5" />}
                              {l.contactTag === "COLD" && <Snowflake className="w-2.5 h-2.5" />}
                              {l.contactTag}
                            </span>
                          </div>
                        )}
                        <p className="font-black text-black text-sm leading-tight">{l.name}</p>
                        <p className="text-[10px] text-black/60 font-medium mt-0.5 truncate">{l.company}</p>
                        {l.phone && <p className="text-[10px] text-black/50 mt-1">{l.phone}</p>}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10">
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 border border-black uppercase tracking-wider",
                            sourceColors[l.source] || "bg-gray-100 text-black",
                          )}>
                            {l.source || "Manual"}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 border border-black uppercase",
                            statusColors[l.status] || "bg-gray-100 text-black border-transparent",
                          )}>
                            {l.status || "—"}
                          </span>
                        </div>
                        {l.assignedTo?.name && (
                          <p className="text-[9px] text-black/40 font-bold mt-1.5 truncate">
                            → {l.assignedTo.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === "table" && (
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        {}
        <div
          className="flex-1 bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden animate-fade-in min-h-[500px]"
          style={{ animationDelay: "100ms" }}
        >
          <div className="overflow-x-auto relative max-h-[calc(100vh-250px)]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-black bg-[#024BAB]">
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                    Score
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden md:table-cell group">
                    <div className="flex items-center gap-1">
                      Source
                      {renderHeaderFilter(
                        "source",
                        [
                          "IndiaMART",
                          "Manual",
                          "Website",
                          "Walk-in",
                          "Referral",
                        ],
                        sourceFilters,
                        setSourceFilters,
                      )}
                    </div>
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden lg:table-cell">
                    Inquiry Date
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden lg:table-cell">
                    Phone
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden xl:table-cell">
                    City
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden xl:table-cell">
                    Campaign
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden xl:table-cell">
                    <div className="flex items-center gap-1">
                      Budget
                      {renderBudgetRangeFilter()}
                    </div>
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden xl:table-cell">
                    <div className="flex items-center gap-1">
                      Interested Product
                      {renderHeaderFilter(
                        "interestedProducts",
                        getUniqueValues("interestedProducts"),
                        productFilters,
                        setProductFilters,
                      )}
                    </div>
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden xl:table-cell">
                    Remarks
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                    <div className="flex items-center gap-1">
                      Status
                      {renderHeaderFilter(
                        "status",
                        Object.keys(statusColors),
                        statusFilters,
                        setStatusFilters,
                      )}
                    </div>
                  </th>
                  {currentUser?.role !== "sales_executive" && (
                    <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden lg:table-cell">
                      Assigned
                    </th>
                  )}
                  <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest hidden lg:table-cell">
                    <div className="flex items-center gap-1">
                      Follow-up
                      {renderFollowUpDateFilter()}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
                      <p className="text-sm text-black mt-2">
                        Loading leads...
                      </p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10">
                      <p className="text-sm text-black">
                        No {activeCategory.toLowerCase()} leads found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    let lastGroupDate = "";
                    return filtered.map((l, i) => {
                      const groupDate = l.indiamartQueryTime
                        ? format(new Date(l.indiamartQueryTime), "d MMMM yyyy")
                        : format(new Date(l.createdAt), "d MMMM yyyy");
                      const showHeader = groupDate !== lastGroupDate;
                      lastGroupDate = groupDate;

                      return (
                        <Fragment key={l._id || l.id}>
                          {showHeader && (
                            <tr className="bg-muted/40 border-y border-border/50 shadow-sm animate-fade-in group">
                              <td
                                colSpan={10}
                                className="px-5 py-2.5 text-xs font-bold text-black uppercase tracking-widest"
                              >
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="w-3.5 h-3.5 text-primary/70" />
                                  {groupDate}
                                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full border border-border/50 text-black/60 invisible group-hover:visible ml-2 transition-all">
                                    {
                                      filtered.filter((le) => {
                                        const d = le.indiamartQueryTime
                                          ? format(
                                              new Date(le.indiamartQueryTime),
                                              "d MMMM yyyy",
                                            )
                                          : format(
                                              new Date(le.createdAt),
                                              "d MMMM yyyy",
                                            );
                                        return d === groupDate;
                                      }).length
                                    }{" "}
                                    leads
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                            key={l._id || l.id}
                            className={cn(
                              "border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer animate-fade-in",
                              selectedLeadId === (l._id || l.id)
                                ? "bg-muted/50"
                                : "",
                            )}
                            style={{ animationDelay: `${i * 30}ms` }}
                            onClick={() => setSelectedLeadId(l._id || l.id)}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-foreground">
                                {l.name}
                              </p>
                              <p className="text-xs text-black">{l.company}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              {l.contactTag ? (
                                <span className={cn(
                                  "inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 border-2 uppercase tracking-wider whitespace-nowrap",
                                  l.contactTag === "HOT" && "bg-red-500 text-white border-black",
                                  l.contactTag === "WARM" && "bg-[#FFDE00] text-black border-black",
                                  l.contactTag === "COLD" && "bg-[#024BAB] text-white border-black",
                                )}>
                                  {l.contactTag === "HOT" && <Flame className="w-3 h-3" />}
                                  {l.contactTag === "WARM" && <Thermometer className="w-3 h-3" />}
                                  {l.contactTag === "COLD" && <Snowflake className="w-3 h-3" />}
                                  {l.contactTag}
                                </span>
                              ) : (
                                <span className="text-black/20 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 hidden md:table-cell">
                              <span
                                className={cn(
                                  "text-xs font-medium px-2 py-1 rounded-md text-nowrap",
                                  sourceColors[l.source] ||
                                    "bg-muted text-black",
                                )}
                              >
                                {l.source || "General"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 hidden lg:table-cell text-black text-nowrap">
                              {l.indiamartQueryTime
                                ? format(
                                    new Date(l.indiamartQueryTime),
                                    "dd MMM, hh:mm a",
                                  )
                                : format(
                                    new Date(l.createdAt),
                                    "dd MMM, hh:mm a",
                                  )}
                            </td>
                            <td className="px-5 py-3.5 hidden lg:table-cell text-black text-nowrap">
                              {l.phone || "-"}
                            </td>
                            <td className="px-5 py-3.5 hidden xl:table-cell text-black text-nowrap">
                              {l.location || "-"}
                            </td>
                            <td
                              className="px-5 py-3.5 hidden xl:table-cell text-black text-nowrap truncate max-w-[150px]"
                              title={l.facebookAdName || "-"}
                            >
                              {l.facebookAdName ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#1877F2] shrink-0 inline-block" />
                                  {l.facebookAdName}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-5 py-3.5 hidden xl:table-cell text-black text-nowrap">
                              {l.budget || "-"}
                            </td>
                            <td
                              className="px-5 py-3.5 hidden xl:table-cell text-black truncate max-w-[150px]"
                              title={l.interestedProducts?.join(", ") || "-"}
                            >
                              {l.interestedProducts &&
                              l.interestedProducts.length > 0
                                ? l.interestedProducts.join(", ")
                                : "-"}
                            </td>
                            <td
                              className="px-5 py-3.5 hidden xl:table-cell text-black text-nowrap truncate max-w-[150px]"
                              title={l.remarks || "-"}
                            >
                              {l.remarks || "-"}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={cn(
                                    "text-xs font-medium px-2.5 py-1 rounded-full border text-nowrap",
                                    statusColors[l.status] ||
                                      "bg-muted text-black border-transparent",
                                  )}
                                >
                                  {l.status || "ALL"}
                                </span>
                                {activeCategory === "Quotation" &&
                                  !l.status?.includes("QUOTATION") &&
                                  l.stagePath?.some((s: string) =>
                                    s.includes("QUOTATION"),
                                  ) && (
                                    <span className="text-[9px] text-purple-600 font-bold whitespace-nowrap bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-0.5">
                                      <Check className="w-2 h-2" /> Quotation
                                      Sent
                                    </span>
                                  )}
                              </div>
                            </td>
                            {currentUser?.role !== "sales_executive" && (
                              <td
                                className="px-5 py-3.5 hidden lg:table-cell"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Select
                                  value={
                                    typeof l.assignedTo === "object"
                                      ? l.assignedTo?._id
                                      : l.assignedTo || "unassigned"
                                  }
                                  onValueChange={(value) =>
                                    handleUpdateAssignee(l._id || l.id, value)
                                  }
                                >
                                  <SelectTrigger className="h-8 w-[140px] text-xs border-none bg-transparent hover:bg-muted focus:ring-0 px-2">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned" disabled>
                                      Unassigned
                                    </SelectItem>
                                    {allUsers.map((u) => (
                                      <SelectItem key={u._id} value={u._id}>
                                        {u.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            )}
                            <td className="px-5 py-3.5 hidden lg:table-cell text-black">
                              {l.followUpDate
                                ? new Date(l.followUpDate).toLocaleDateString(
                                    "en-IN",
                                    { day: "numeric", month: "short" },
                                  )
                                : "-"}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>

        {lead && (
          <div className="w-full xl:w-96 sticky top-24 xl:top-[100px] mt-0 h-fit max-h-[calc(100vh-140px)] animate-slide-in-left">
            <LeadDetailPanel
              lead={lead}
              onClose={() => setSelectedLeadId(null)}
              onRefresh={() => {
                fetchLeads();
                if (selectedLeadId) fetchFullLead(selectedLeadId);
              }}
              className="card-shadow"
            />
          </div>
        )}
      </div>
      )}

      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-black font-normal">Updating to:</span>
              <span
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full border",
                  statusColors[pendingStatus || "ALL"],
                )}
              >
                {pendingStatus}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {}
            <div className="space-y-2">
              <Label
                htmlFor="budget"
                className="text-xs text-black uppercase tracking-wider"
              >
                Budget
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  id="budget"
                  type="text"
                  placeholder="Enter budget (e.g. 50,000)"
                  className="w-full rounded-lg border border-border bg-background pl-10 p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                />
              </div>
            </div>

            {}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label
                htmlFor="remarks"
                className="text-xs text-black uppercase tracking-wider"
              >
                Remarks <span className="text-destructive font-bold">*</span>
              </Label>
              <textarea
                id="remarks"
                placeholder="Add a remark for this status change..."
                className="w-full min-h-[120px] rounded-lg border border-border bg-background p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
              />
            </div>

            {}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-black uppercase tracking-wider">
                Interested Products
              </Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-md border border-dashed border-border/50">
                {allProducts.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => toggleProductSelection(p.name)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border transition-all",
                      selectedProducts.includes(p.name)
                        ? "bg-primary border-primary text-primary-foreground font-medium"
                        : "bg-background border-border text-black hover:border-primary/50",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="New product..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddProduct();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px]"
                  onClick={handleAddProduct}
                  disabled={isAddingProduct || !newProductName.trim()}
                >
                  {isAddingProduct ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Add & Pick
                </Button>
              </div>
            </div>

            {}
            {pendingStatus && !["DROP", "WON"].includes(pendingStatus) && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs text-black uppercase tracking-wider block">
                  Select Schedule Date & Time
                </Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal h-10",
                          !selectedDate && "text-black",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-50 bg-popover shadow-xl border border-border"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <input
                    type="time"
                    className="h-10 w-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white gap-1.5"
              onClick={() => {
                if (!pendingStatus) return;
                let finalDate = selectedDate;
                if (selectedDate && selectedTime) {
                  const [hours, minutes] = selectedTime.split(":").map(Number);
                  finalDate = new Date(selectedDate);
                  finalDate.setHours(hours, minutes, 0, 0);
                }
                handleUpdateStatus(pendingStatus, remarksInput, finalDate);
              }}
              disabled={
                converting ||
                !remarksInput.trim() ||
                (pendingStatus &&
                  !["DROP", "WON"].includes(pendingStatus) &&
                  !selectedDate)
              }
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add New Lead Manually
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Contact Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={newLead.name}
                    onChange={(e) =>
                      setNewLead({ ...newLead, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="company"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Company Name *
                  </Label>
                  <Input
                    id="company"
                    placeholder="Enter company name"
                    value={newLead.company}
                    onChange={(e) =>
                      setNewLead({ ...newLead, company: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    value={newLead.phone}
                    onChange={(e) =>
                      setNewLead({ ...newLead, phone: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newLead.email}
                    onChange={(e) =>
                      setNewLead({ ...newLead, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Location
                  </Label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="Enter location"
                    value={newLead.location}
                    onChange={(e) =>
                      setNewLead({ ...newLead, location: e.target.value })
                    }
                  />
                </div>
              </div>

              {}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="source"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Source
                  </Label>
                  <Select
                    value={newLead.source}
                    onValueChange={(val) =>
                      setNewLead({ ...newLead, source: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Manual",
                        "IndiaMART",
                        "TradeIndia",
                        "Justdial",
                        "Website",
                        "Walk-in",
                        "Referral",
                      ].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="budget"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Budget
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                    <Input
                      id="budget"
                      className="pl-9"
                      placeholder="e.g. 50,000"
                      value={newLead.budget}
                      onChange={(e) =>
                        setNewLead({ ...newLead, budget: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="assignedTo"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Assign To *
                  </Label>
                  <Select
                    value={newLead.assignedTo}
                    onValueChange={(val) =>
                      setNewLead({ ...newLead, assignedTo: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select User" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-black">
                    Interested Products
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        {newLead.interestedProducts.length > 0
                          ? `${newLead.interestedProducts.length} selected`
                          : "Select Products"}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search products..." />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {allProducts.map((p) => (
                              <CommandItem
                                key={p._id}
                                onSelect={() => {
                                  const products =
                                    newLead.interestedProducts.includes(p.name)
                                      ? newLead.interestedProducts.filter(
                                          (item) => item !== p.name,
                                        )
                                      : [...newLead.interestedProducts, p.name];
                                  setNewLead({
                                    ...newLead,
                                    interestedProducts: products,
                                  });
                                }}
                              >
                                <div
                                  className={cn(
                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                    newLead.interestedProducts.includes(p.name)
                                      ? "bg-primary text-primary-foreground"
                                      : "opacity-50",
                                  )}
                                >
                                  {newLead.interestedProducts.includes(
                                    p.name,
                                  ) && <Check className="h-3 w-3" />}
                                </div>
                                {p.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {}
            <div className="space-y-2">
              <Label
                htmlFor="requirement"
                className="text-xs font-semibold uppercase text-black"
              >
                Requirement *
              </Label>
              <Textarea
                id="requirement"
                placeholder="Describe what the customer looking for..."
                className="min-h-[100px] resize-none"
                value={newLead.requirement}
                onChange={(e) =>
                  setNewLead({ ...newLead, requirement: e.target.value })
                }
                required
              />
            </div>

            <DialogFooter className="pt-4 border-t gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                disabled={addLeadLoading}
              >
                {addLeadLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create Lead"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
