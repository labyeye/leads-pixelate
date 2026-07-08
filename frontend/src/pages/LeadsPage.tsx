import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Plus,
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  UserCheck,
  Zap,
  Loader2,
  Filter,
  Check,
  ChevronDown,
  X,
  ChevronUp,
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
import { useNotify } from "@/components/ui/Notification";
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
} from "@/components/leads/statusConstants";
import { SourceBadge } from "@/components/leads/SourceBadge";
import fbLogo from "@/assets/images/logos/facebook.png";
import imLogo from "@/assets/images/logos/indiamart.png";
import tiLogo from "@/assets/images/logos/tradeindia.webp";
import jdLogo from "@/assets/images/logos/justdial.webp";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as XLSX from "xlsx";

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("New Lead");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [fullLead, setFullLead] = useState<any>(null);
  const [, setLoadingFullLead] = useState(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const notify = useNotify();

  const [syncing, setSyncing] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncDateOption, setSyncDateOption] = useState<
    "today" | "yesterday" | "custom"
  >("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbConnected, setFbConnected] = useState(false);
  const [fbSyncModalOpen, setFbSyncModalOpen] = useState(false);
  const [fbSyncDateOption, setFbSyncDateOption] = useState<
    "today" | "3days" | "7days" | "30days" | "custom"
  >("today");
  const [fbCustomFrom, setFbCustomFrom] = useState("");
  const [fbCustomTo, setFbCustomTo] = useState("");
  const [tiSyncing, setTiSyncing] = useState(false);
  const [jdSyncing, setJdSyncing] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [salesExecs, setSalesExecs] = useState<any[]>([]);
  const [selectedExecIds, setSelectedExecIds] = useState<string[]>([]);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [loadingExecs, setLoadingExecs] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    website: "",
    requirement: "",
    budget: "",
    source: "Manual",
    status: "ALL",
    assignedTo: "",
    interestedProducts: [] as string[],
    location: "",
    state: "",
  });
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const handleLocationChange = async (val: string) => {
    setNewLead((prev) => ({ ...prev, location: val }));
    if (/^\d{6}$/.test(val.trim())) {
      setPincodeLoading(true);
      try {
        const res = await fetch(
          `https://api.postalpincode.in/pincode/${val.trim()}`,
        );
        const data = await res.json();
        const po = data?.[0]?.PostOffice?.[0];
        if (po) {
          setNewLead((prev) => ({
            ...prev,
            location: po.District || po.Name,
            state: po.State,
          }));
        }
      } catch {
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  useEffect(() => {
    setLeads([]);
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
      notify.error("Error fetching leads", error.message);
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

  const handleFacebookSync = async (since?: string, until?: string) => {
    try {
      setFbSyncing(true);
      const res = await facebookAPI.sync(undefined, since, until);
      const pageErrors = res.data?.pages?.filter((p: any) => p.error) || [];
      if (pageErrors.length > 0) {
        notify.warning("Facebook Sync Complete", res.message);
      } else {
        notify.success("Facebook Sync Complete", res.message);
      }
      fetchLeads();
    } catch (error: any) {
      notify.error("Facebook Sync Failed", error.message);
    } finally {
      setFbSyncing(false);
    }
  };

  const handleIndiamartSync = async () => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let start_time: string | undefined;
    let end_time: string | undefined;

    if (syncDateOption === "today") {
      start_time = fmt(today);
      end_time = fmt(today);
    } else if (syncDateOption === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      start_time = fmt(y);
      end_time = fmt(today);
    } else {
      if (!customFrom || !customTo) {
        notify.error(
          "Select Date Range",
          "Please pick both start and end dates.",
        );
        return;
      }
      start_time = customFrom;
      end_time = customTo;
    }

    setSyncModalOpen(false);
    try {
      setSyncing(true);
      const res = await indiamartAPI.sync({ start_time, end_time });
      setLastSyncResult(res.data);
      notify.success("IndiaMART Sync Complete", res.message);
      fetchLeads();
      loadSyncStatus();
    } catch (error: any) {
      notify.error("IndiaMART Sync Failed", error.message);
    } finally {
      setSyncing(false);
    }
  };

  const REQUIRED_HEADERS = ["name"];
  const EXCEL_HEADERS = [
    { key: "name", label: "Name", required: true },
    { key: "phone", label: "Phone", required: false },
    { key: "company", label: "Company", required: false },
    { key: "requirement", label: "Requirement", required: false },
    { key: "website", label: "Website", required: false },
    { key: "email", label: "Email", required: false },
    { key: "location", label: "Location", required: false },
    { key: "state", label: "State", required: false },
    { key: "budget", label: "Budget", required: false },
    { key: "remarks", label: "Remarks", required: false },
  ];

  const handleExcelFile = (file: File) => {
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        // Normalise keys to lowercase trimmed
        const normalised = rows
          .map((row) => {
            const n: any = {};
            Object.entries(row).forEach(([k, v]) => {
              n[k.toLowerCase().trim()] = v;
            });
            return n;
          })
          // Drop fully blank rows (e.g. trailing/hidden rows from Excel exports)
          .filter((row) =>
            Object.values(row).some((v) => String(v ?? "").trim() !== ""),
          );
        setImportPreview(normalised);
      } catch {
        notify.error("Invalid File", "Could not parse the Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const sanitizeCell = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    return String(val)
      .replace(/<[^>]*>/g, "")
      .replace(/[<>"'`\\]/g, "")
      .trim()
      .slice(0, 500);
  };

  const sanitizePhone = (val: unknown): string =>
    String(val ?? "")
      .replace(/\D/g, "")
      .slice(0, 15);

  const STRING_FIELDS = [
    "name",
    "company",
    "requirement",
    "website",
    "email",
    "location",
    "state",
    "remarks",
  ];

  const handleImport = async () => {
    if (importPreview.length === 0) return;
    const missing = REQUIRED_HEADERS.filter(
      (h) => !Object.keys(importPreview[0] || {}).includes(h),
    );
    if (missing.length > 0) {
      notify.error(
        "Missing Columns",
        `Required columns not found: ${missing.join(", ")}`,
      );
      return;
    }

    const sanitized = importPreview.map((row) => {
      const clean: any = {};
      Object.entries(row).forEach(([k, v]) => {
        if (k === "phone") clean[k] = sanitizePhone(v);
        else if (STRING_FIELDS.includes(k)) clean[k] = sanitizeCell(v);
        else clean[k] = v;
      });
      return clean;
    });

    const invalidPhones = sanitized.filter(
      (r) => r.phone && (r.phone.length < 7 || r.phone.length > 15),
    );
    if (invalidPhones.length > 0) {
      notify.error(
        "Invalid Phone Numbers",
        `${invalidPhones.length} row(s) have invalid phone numbers. Please fix and re-upload.`,
      );
      return;
    }

    try {
      setImporting(true);
      const res = await leadsAPI.importBulk(sanitized);
      notify.success("Import Complete", res.message);
      setImportModalOpen(false);
      setImportFile(null);
      setImportPreview([]);
      fetchLeads();
    } catch (error: any) {
      notify.error("Import Failed", error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleTradeindiaSyncAttempt = async () => {
    try {
      setTiSyncing(true);
      const res = await tradeindiaSyncAPI.sync();
      notify.success("TradeIndia Sync Complete", res.message);
      fetchLeads();
    } catch (error: any) {
      notify.error(
        "TradeIndia Sync Failed",
        error.message || "TradeIndia integration not configured.",
      );
    } finally {
      setTiSyncing(false);
    }
  };

  const handleJustdialSyncAttempt = async () => {
    try {
      setJdSyncing(true);
      const res = await justdialSyncAPI.sync();
      notify.success("Justdial Sync Complete", res.message);
      fetchLeads();
    } catch (error: any) {
      notify.error(
        "Justdial Sync Failed",
        error.message || "Justdial integration not configured.",
      );
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
      notify.success(
        "Settings Updated",
        selectedExecIds.length > 0
          ? `Leads will be assigned to ${selectedExecIds.length} selected executives.`
          : "Leads will be assigned randomly among all active executives.",
      );
      setIsAssignModalOpen(false);
    } catch (error: any) {
      notify.error("Update Failed", error.message);
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
      notify.success(
        "Lead Reassigned",
        "The lead has been successfully reassigned.",
      );
    } catch (error: any) {
      notify.error("Reassignment Failed", error.message);
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

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualList = useMemo(() => {
    type VItem =
      | { type: "header"; date: string; count: number }
      | { type: "row"; lead: any };
    const items: VItem[] = [];
    const dateCounts: Record<string, number> = {};
    for (const l of filtered) {
      const d = l.indiamartQueryTime
        ? format(new Date(l.indiamartQueryTime), "d MMMM yyyy")
        : format(new Date(l.createdAt), "d MMMM yyyy");
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
    let lastDate = "";
    for (const l of filtered) {
      const d = l.indiamartQueryTime
        ? format(new Date(l.indiamartQueryTime), "d MMMM yyyy")
        : format(new Date(l.createdAt), "d MMMM yyyy");
      if (d !== lastDate) {
        items.push({ type: "header", date: d, count: dateCounts[d] });
        lastDate = d;
      }
      items.push({ type: "row", lead: l });
    }
    return items;
  }, [filtered]);

  const rowVirtualizer = useVirtualizer({
    count: virtualList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (virtualList[i].type === "header" ? 38 : 57),
    overscan: 15,
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
              ? "text-white bg-white"
              : "text-white hover:text-secondary",
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

  const STATIC_COLUMNS: { id: string; label: string; alwaysOn?: boolean }[] =
    [
      { id: "name", label: "Name", alwaysOn: true },
      { id: "score", label: "Score" },
      { id: "source", label: "Source" },
      { id: "adPlatform", label: "Ad Platform (FB/IG)" },
      { id: "inquiryDate", label: "Inquiry Date" },
      { id: "createdAt", label: "Created At" },
      { id: "phone", label: "Phone" },
      { id: "email", label: "Email" },
      { id: "website", label: "Website" },
      { id: "city", label: "City" },
      { id: "state", label: "State" },
      { id: "pageName", label: "Facebook Page" },
      { id: "campaign", label: "Ad Name" },
      { id: "campaignName", label: "Campaign Name" },
      { id: "adsetName", label: "Ad Set Name" },
      { id: "formName", label: "Lead Form Name" },
      { id: "budget", label: "Budget" },
      { id: "product", label: "Interested Product" },
      { id: "remarks", label: "Remarks" },
      { id: "status", label: "Status", alwaysOn: true },
      { id: "assigned", label: "Assigned" },
      { id: "followup", label: "Follow-up" },
      { id: "visitScheduled", label: "Visit Scheduled" },
      { id: "visitActual", label: "Visit Completed" },
    ];

  const titleCase = (s: string) =>
    s
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const customColumns = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((l) => {
      const cf = l.customFields;
      if (cf && typeof cf === "object") {
        Object.keys(cf).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys).map((k) => ({
      id: `custom:${k}`,
      label: titleCase(k),
      alwaysOn: false as boolean | undefined,
    }));
  }, [leads]);

  const ALL_COLUMNS = useMemo(
    () => [...STATIC_COLUMNS, ...customColumns],
    [customColumns],
  );

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    () => {
      try {
        const stored = localStorage.getItem("leadsTableColumns");
        if (stored) return JSON.parse(stored);
      } catch {}
      return {};
    },
  );

  useEffect(() => {
    leadsAPI
      .getColumnPreferences()
      .then((res) => {
        if (res.data && Object.keys(res.data).length > 0) {
          setVisibleCols(res.data);
          try {
            localStorage.setItem(
              "leadsTableColumns",
              JSON.stringify(res.data),
            );
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const isColVisible = (id: string) => visibleCols[id] !== false;
  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [id]: !isColVisible(id) };
      try {
        localStorage.setItem("leadsTableColumns", JSON.stringify(next));
      } catch {}
      leadsAPI.updateColumnPreferences(next).catch(() => {});
      return next;
    });
  };

  const showAssignedCol =
    isColVisible("assigned") && currentUser?.role !== "sales_executive";
  const visibleColumnCount =
    ALL_COLUMNS.filter(
      (c) => isColVisible(c.id) && (c.id !== "assigned" || showAssignedCol),
    ).length || 1;

  const renderColumnConfigurator = () => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Configure columns"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-black bg-white text-black hover:bg-[#FFDE00] transition-colors"
        >
          <Filter className="w-3.5 h-3.5" /> Columns
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-[10px] font-black uppercase tracking-widest text-black px-2 pb-1">
          Show Columns
        </p>
        <p className="text-[10px] text-black/50 px-2 pb-2">
          Saved for your whole team.
        </p>
        <div className="max-h-80 overflow-y-auto space-y-0.5">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs",
                col.alwaysOn
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-muted",
              )}
            >
              <Checkbox
                checked={isColVisible(col.id)}
                disabled={col.alwaysOn}
                onCheckedChange={() => toggleCol(col.id)}
              />
              <span>{col.label}</span>
            </label>
          ))}
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
      notify.success(
        "Status Updated",
        `Lead status changed to ${newStatus}${date ? ` for ${format(date, "PPP")}` : ""}`,
      );
      fetchLeads();
      if (selectedLeadId) fetchFullLead(selectedLeadId);
      setIsStatusModalOpen(false);
      setPendingStatus(null);

      const newCat = getCategoryByStatus(newStatus);
      if (newCat !== activeCategory) {
        setSelectedLeadId(null);
      }
    } catch (error: any) {
      notify.error("Error Updating Status", error.message);
    } finally {
      setConverting(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name.trim()) {
      notify.error("Name is required");
      return;
    }
    if (!newLead.company.trim()) {
      notify.error("Company is required");
      return;
    }
    if (!newLead.phone.trim()) {
      notify.error("Phone is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(newLead.phone)) {
      notify.error(
        "Invalid Phone",
        "Enter a valid 10-digit Indian mobile number.",
      );
      return;
    }
    if (newLead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLead.email)) {
      notify.error("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!newLead.requirement.trim()) {
      notify.error("Requirement is required");
      return;
    }

    try {
      setAddLeadLoading(true);
      const res = await leadsAPI.create(newLead);
      if (res.success) {
        notify.success(
          "Lead Created",
          `${newLead.name} from ${newLead.company} has been added successfully.`,
        );
        setIsAddModalOpen(false);
        setNewLead({
          name: "",
          company: "",
          phone: "",
          email: "",
          website: "",
          requirement: "",
          budget: "",
          source: "Manual",
          status: "ALL",
          assignedTo:
            currentUser?._id || (allUsers.length > 0 ? allUsers[0]._id : ""),
          interestedProducts: [],
          location: "",
          state: "",
        });
        fetchLeads();
      }
    } catch (error: any) {
      notify.error("Error Creating Lead", error.message);
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
        notify.success(
          "Product Added",
          `${newProductName} has been added to the database.`,
        );
      }
    } catch (error: any) {
      notify.error("Error Adding Product", error.message);
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
        notify.success(
          "Lead Converted",
          "Lead has been converted to a Client successfully!",
        );
        fetchLeads();
        setSelectedLeadId(null);
      }
    } catch (error: any) {
      notify.error("Conversion Failed", error.message);
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
        <div className="flex flex-col gap-2 w-full">
          {}
          <div className="flex flex-wrap items-center gap-2">
            {currentUser?.role !== "sales_executive" && (
              <Dialog
                open={isAssignModalOpen}
                onOpenChange={(open) => {
                  setIsAssignModalOpen(open);
                  if (open) fetchSalesExecs();
                }}
              >
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all whitespace-nowrap">
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
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Import Excel
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-green-600 font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>

            {fbConnected && (
              <button
                onClick={() => setFbSyncModalOpen(true)}
                disabled={fbSyncing}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#1877F2] font-black uppercase text-xs tracking-widest border-2 border-[#1877F2] shadow-[2px_2px_0px_#1877F2] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {fbSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <img
                    src={fbLogo}
                    alt="Facebook"
                    className="w-4 h-4 object-contain"
                  />
                )}
                {fbSyncing ? "Syncing..." : "Sync Facebook"}
              </button>
            )}

            {syncStatus !== null && (
              <div className="flex items-center border-2 border-black">
                <button
                  id="indiamart-sync-btn"
                  onClick={() => setSyncModalOpen(true)}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#E07B39] font-black uppercase text-xs tracking-widest border-r-2 border-[#E07B39] hover:bg-orange-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E07B39]" />
                  ) : (
                    <img
                      src={imLogo}
                      alt="IndiaMART"
                      className="w-4 h-4 object-contain"
                    />
                  )}
                  {syncing ? "Syncing..." : "Sync IndiaMART"}
                </button>
                <button
                  onClick={() => setSyncPanelOpen(!syncPanelOpen)}
                  className="px-2 py-2 bg-white hover:bg-orange-50 text-[#E07B39] border-l border-[#E07B39]/30 transition-colors"
                >
                  {syncPanelOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {}
            <button
              onClick={handleTradeindiaSyncAttempt}
              disabled={tiSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#22C55E] font-black uppercase text-xs tracking-widest border-2 border-[#22C55E] shadow-[2px_2px_0px_#22C55E] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {tiSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <img
                  src={tiLogo}
                  alt="TradeIndia"
                  className="w-4 h-4 object-contain"
                />
              )}
              {tiSyncing ? "Syncing..." : "Sync TradeIndia"}
            </button>

            {}
            <button
              onClick={handleJustdialSyncAttempt}
              disabled={jdSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#EF4444] font-black uppercase text-xs tracking-widest border-2 border-[#EF4444] shadow-[2px_2px_0px_#EF4444] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {jdSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <img
                  src={jdLogo}
                  alt="Justdial"
                  className="w-4 h-4 object-contain"
                />
              )}
              {jdSyncing ? "Syncing..." : "Sync Justdial"}
            </button>
          </div>

          {}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border-2 border-black px-3 h-10 w-full sm:w-40 bg-white">
              <CalendarIcon className="w-3.5 h-3.5 text-black shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none w-full text-black"
                title="Start Date"
              />
            </div>
            <div className="flex items-center gap-1.5 border-2 border-black px-3 h-10 w-full sm:w-40 bg-white">
              <CalendarIcon className="w-3.5 h-3.5 text-black shrink-0" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none w-full text-black"
                title="End Date"
              />
            </div>

            <div className="relative z-50 flex items-center gap-2 bg-white border-2 border-black px-3 h-10 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-black shrink-0" />
              <input
                type="text"
                placeholder="Search by name, company, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-black"
              />
              {search.trim().length > 0 && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-md shadow-xl max-h-80 overflow-y-auto z-50">
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
                    <div className="p-3 text-sm text-black">
                      No leads found.
                    </div>
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
                className="flex items-center gap-1 px-3 py-2 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all whitespace-nowrap"
              >
                <X className="w-3 h-3" /> Reset All
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-full lg:w-fit overflow-x-auto border-2 border-black">
            {Object.keys(categories).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSelectedLeadId(null);
                }}
                className={cn(
                  "px-4 py-2.5 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 border-r-2 border-black last:border-r-0",
                  activeCategory === cat
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#FFDE00] hover:text-black",
                )}
              >
                {cat}
                <span
                  className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 border border-black min-w-[20px] text-center",
                    activeCategory === cat
                      ? "bg-[#FFDE00] text-black"
                      : "bg-black text-white",
                  )}
                >
                  {leads.filter((l) => matchesCategory(l, cat)).length}
                </span>
              </button>
            ))}
          </div>

          {}
          {viewMode === "table" && (
            <div className="ml-auto">{renderColumnConfigurator()}</div>
          )}
          <div
            className={cn(
              "flex items-center border-2 border-black",
              viewMode !== "table" && "ml-auto",
            )}
          >
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest border-r-2 border-black transition-colors",
                viewMode === "table"
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-[#FFDE00]",
              )}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => {
                setViewMode("kanban");
                setSelectedLeadId(null);
              }}
              title="Kanban view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors",
                viewMode === "kanban"
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-[#FFDE00]",
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
              <div className="bg-white border-2 border-black p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  Total IM Leads
                </p>
                <p className="text-2xl font-black text-orange-600">
                  {syncStatus.totalIndiamartLeads || 0}
                </p>
              </div>
              <div className="bg-white border-2 border-black p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  Last 7 Days
                </p>
                <p className="text-2xl font-black text-orange-500">
                  {syncStatus.last7DaysLeads || 0}
                </p>
              </div>
              {lastSyncResult && (
                <>
                  <div className="bg-green-400 border-2 border-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black">
                      Last Sync: New
                    </p>
                    <p className="text-2xl font-black text-black">
                      {lastSyncResult.created || 0}
                    </p>
                  </div>
                  <div className="bg-white border-2 border-black p-3">
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

      {}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {Object.entries({
              "New Lead": { bg: "bg-white", accent: "bg-primary" },
              "Discussion/Requirement": {
                bg: "bg-white",
                accent: "bg-primary",
              },
              Quotation: { bg: "bg-white", accent: "bg-primary" },
              "Visit Scheduled": { bg: "bg-white", accent: "bg-primary" },
              Visited: { bg: "bg-white", accent: "bg-primary" },
              Client: { bg: "bg-green-50", accent: "bg-green-600" },
              Dropped: { bg: "bg-red-50", accent: "bg-red-600" },
            } as Record<string, { bg: string; accent: string }>).map(
              ([cat, style]) => {
                const colLeads = filtered.filter((l) =>
                  matchesCategory(l, cat),
                );
                return (
                  <div
                    key={cat}
                    className="w-72 shrink-0 border-2 border-black shadow-[4px_4px_0px_#000]"
                  >
                    {}
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 border-b-2 border-black",
                        style.accent,
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-widest text-white">
                        {cat}
                      </span>
                      <span className="text-[10px] font-black bg-white text-black px-1.5 py-0.5 border border-black min-w-[20px] text-center">
                        {colLeads.length}
                      </span>
                    </div>

                    {}
                    <div
                      className={cn(
                        "p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-340px)] overflow-y-auto",
                        style.bg,
                      )}
                    >
                      {loading ? (
                        <div className="flex justify-center pt-8">
                          <Loader2 className="w-5 h-5 animate-spin text-[#024BAB]" />
                        </div>
                      ) : colLeads.length === 0 ? (
                        <div className="text-center pt-10 text-[10px] font-black uppercase tracking-widest text-black/30">
                          No leads
                        </div>
                      ) : (
                        colLeads.map((l) => (
                          <div
                            key={l._id || l.id}
                            onClick={() => {
                              setSelectedLeadId(l._id || l.id);
                              setViewMode("table");
                              setActiveCategory(cat);
                            }}
                            className={cn(
                              "bg-white border-2 border-black p-3 cursor-pointer transition-all hover hover:-translate-x-0.5 hover:-translate-y-0.5",
                              selectedLeadId === (l._id || l.id) &&
                                "ring-2 ring-[#024BAB]",
                            )}
                          >
                            {}
                            {l.contactTag && (
                              <div className="flex justify-end mb-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 border border-black uppercase",
                                    l.contactTag === "HOT" &&
                                      "bg-red-500 text-white",
                                    l.contactTag === "WARM" &&
                                      "bg-[#FFDE00] text-black",
                                    l.contactTag === "COLD" &&
                                      "bg-[#024BAB] text-white",
                                  )}
                                >
                                  {l.contactTag === "HOT" && (
                                    <Flame className="w-2.5 h-2.5" />
                                  )}
                                  {l.contactTag === "WARM" && (
                                    <Thermometer className="w-2.5 h-2.5" />
                                  )}
                                  {l.contactTag === "COLD" && (
                                    <Snowflake className="w-2.5 h-2.5" />
                                  )}
                                  {l.contactTag}
                                </span>
                              </div>
                            )}
                            <p className="font-black text-black text-sm leading-tight">
                              {l.name}
                            </p>
                            <p className="text-[10px] text-black/60 font-medium mt-0.5 truncate">
                              {l.company}
                            </p>
                            {l.phone && (
                              <p className="text-[10px] text-black/50 mt-1">
                                {l.phone}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/10">
                              <SourceBadge source={l.source} size="sm" />
                              <span
                                className={cn(
                                  "text-[9px] font-black px-1.5 py-0.5 border border-black uppercase",
                                  statusColors[l.status] ||
                                    "bg-gray-100 text-black border-transparent",
                                )}
                              >
                                {l.status || "—"}
                              </span>
                            </div>
                            {l.assignedTo?.name && (
                              <p className="text-[9px] text-black/40 font-bold mt-1.5 truncate">
                                → {l.assignedTo.name}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {}
      {viewMode === "table" && (
        <div className="flex flex-col xl:flex-row gap-5 items-start">
          {}
          <div
            className="flex-1 bg-white border-2 border-black overflow-hidden animate-fade-in min-h-[500px]"
            style={{ animationDelay: "100ms" }}
          >
            <div
              ref={parentRef}
              className="overflow-x-auto overflow-y-auto relative"
              style={{ maxHeight: "calc(100vh - 250px)" }}
            >
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b-2 border-black bg-[#024BAB]">
                    <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                      Name
                    </th>
                    {isColVisible("score") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Score
                      </th>
                    )}
                    {isColVisible("source") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest group">
                        <div className="flex items-center gap-1">
                          Source
                          {renderHeaderFilter(
                            "source",
                            [
                              "IndiaMART",
                              "TradeIndia",
                              "Justdial",
                              "Facebook",
                              "Instagram",
                              "Meta",
                              "Website",
                              "Manual",
                            ],
                            sourceFilters,
                            setSourceFilters,
                          )}
                        </div>
                      </th>
                    )}
                    {isColVisible("adPlatform") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Ad Platform
                      </th>
                    )}
                    {isColVisible("inquiryDate") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Inquiry Date
                      </th>
                    )}
                    {isColVisible("createdAt") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Created At
                      </th>
                    )}
                    {isColVisible("phone") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Phone
                      </th>
                    )}
                    {isColVisible("email") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Email
                      </th>
                    )}
                    {isColVisible("website") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Website
                      </th>
                    )}
                    {isColVisible("city") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        City
                      </th>
                    )}
                    {isColVisible("state") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        State
                      </th>
                    )}
                    {isColVisible("pageName") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Facebook Page
                      </th>
                    )}
                    {isColVisible("campaign") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Ad Name
                      </th>
                    )}
                    {isColVisible("campaignName") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Campaign Name
                      </th>
                    )}
                    {isColVisible("adsetName") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Ad Set Name
                      </th>
                    )}
                    {isColVisible("formName") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Lead Form Name
                      </th>
                    )}
                    {isColVisible("budget") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          Budget
                          {renderBudgetRangeFilter()}
                        </div>
                      </th>
                    )}
                    {isColVisible("product") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
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
                    )}
                    {isColVisible("remarks") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Remarks
                      </th>
                    )}
                    {customColumns
                      .filter((c) => isColVisible(c.id))
                      .map((c) => (
                        <th
                          key={c.id}
                          className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest"
                        >
                          {c.label}
                        </th>
                      ))}
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
                    {showAssignedCol && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Assigned
                      </th>
                    )}
                    {isColVisible("followup") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          Follow-up
                          {renderFollowUpDateFilter()}
                        </div>
                      </th>
                    )}
                    {isColVisible("visitScheduled") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Visit Scheduled
                      </th>
                    )}
                    {isColVisible("visitActual") && (
                      <th className="text-left px-5 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                        Visit Completed
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        className="text-center py-10"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
                        <p className="text-sm text-black mt-2">
                          Loading leads...
                        </p>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        className="text-center py-10"
                      >
                        <p className="text-sm text-black">
                          No {activeCategory.toLowerCase()} leads found.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {(rowVirtualizer.getVirtualItems()[0]?.start ?? 0) >
                        0 && (
                        <tr>
                          <td
                            colSpan={visibleColumnCount}
                            style={{
                              height: rowVirtualizer.getVirtualItems()[0].start,
                              padding: 0,
                            }}
                          />
                        </tr>
                      )}
                      {rowVirtualizer.getVirtualItems().map((vRow) => {
                        const item = virtualList[vRow.index];
                        if (item.type === "header") {
                          return (
                            <tr
                              key={`hdr-${vRow.index}`}
                              className="bg-muted/40 border-y border-border/50 shadow-sm group"
                            >
                              <td
                                colSpan={visibleColumnCount}
                                className="px-5 py-2.5 text-xs font-bold text-black uppercase tracking-widest"
                              >
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="w-3.5 h-3.5 text-primary/70" />
                                  {item.date}
                                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full border border-border/50 text-black/60 invisible group-hover:visible ml-2 transition-all">
                                    {item.count} leads
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const l = item.lead;
                        return (
                          <tr
                            key={l._id || l.id}
                            className={cn(
                              "border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                              selectedLeadId === (l._id || l.id)
                                ? "bg-muted/50"
                                : "",
                            )}
                            onClick={() => setSelectedLeadId(l._id || l.id)}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-foreground">
                                {l.name}
                              </p>
                              <p className="text-xs text-black">{l.company}</p>
                            </td>
                            {isColVisible("score") && (
                              <td className="px-5 py-3.5">
                                {l.contactTag ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 border-2 uppercase tracking-wider whitespace-nowrap",
                                      l.contactTag === "HOT" &&
                                        "bg-red-500 text-white border-black",
                                      l.contactTag === "WARM" &&
                                        "bg-[#FFDE00] text-black border-black",
                                      l.contactTag === "COLD" &&
                                        "bg-[#024BAB] text-white border-black",
                                    )}
                                  >
                                    {l.contactTag === "HOT" && (
                                      <Flame className="w-3 h-3" />
                                    )}
                                    {l.contactTag === "WARM" && (
                                      <Thermometer className="w-3 h-3" />
                                    )}
                                    {l.contactTag === "COLD" && (
                                      <Snowflake className="w-3 h-3" />
                                    )}
                                    {l.contactTag}
                                  </span>
                                ) : (
                                  <span className="text-black/20 text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                            )}
                            {isColVisible("source") && (
                              <td className="px-5 py-3.5">
                                <SourceBadge source={l.source} />
                              </td>
                            )}
                            {isColVisible("adPlatform") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.adPlatforms && l.adPlatforms.length > 0
                                  ? l.adPlatforms
                                      .map((p: string) =>
                                        p === "ig" ? "Instagram" : "Facebook",
                                      )
                                      .join(", ")
                                  : "-"}
                              </td>
                            )}
                            {isColVisible("inquiryDate") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
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
                            )}
                            {isColVisible("createdAt") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.createdAt
                                  ? format(
                                      new Date(l.createdAt),
                                      "dd MMM, hh:mm a",
                                    )
                                  : "-"}
                              </td>
                            )}
                            {isColVisible("phone") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.phone || "-"}
                              </td>
                            )}
                            {isColVisible("email") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.email || "-"}
                              </td>
                            )}
                            {isColVisible("website") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.website ? (
                                  <a
                                    href={
                                      /^https?:\/\//i.test(l.website)
                                        ? l.website
                                        : `https://${l.website}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 border border-green-300 hover:underline"
                                  >
                                    Yes
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-300">
                                    No
                                  </span>
                                )}
                              </td>
                            )}
                            {isColVisible("city") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.location || "-"}
                              </td>
                            )}
                            {isColVisible("state") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.state || "-"}
                              </td>
                            )}
                            {isColVisible("pageName") && (
                              <td className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]">
                                {l.facebookPageName || "-"}
                              </td>
                            )}
                            {isColVisible("campaign") && (
                              <td
                                className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
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
                            )}
                            {isColVisible("campaignName") && (
                              <td
                                className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
                                title={l.facebookCampaignName || "-"}
                              >
                                {l.facebookCampaignName || "-"}
                              </td>
                            )}
                            {isColVisible("adsetName") && (
                              <td
                                className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
                                title={l.facebookAdsetName || "-"}
                              >
                                {l.facebookAdsetName || "-"}
                              </td>
                            )}
                            {isColVisible("formName") && (
                              <td
                                className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
                                title={l.facebookFormName || "-"}
                              >
                                {l.facebookFormName || "-"}
                              </td>
                            )}
                            {isColVisible("budget") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.budget || "-"}
                              </td>
                            )}
                            {isColVisible("product") && (
                              <td
                                className="px-5 py-3.5 text-black truncate max-w-[150px]"
                                title={l.interestedProducts?.join(", ") || "-"}
                              >
                                {l.interestedProducts &&
                                l.interestedProducts.length > 0
                                  ? l.interestedProducts.join(", ")
                                  : "-"}
                              </td>
                            )}
                            {isColVisible("remarks") && (
                              <td
                                className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
                                title={l.remarks || "-"}
                              >
                                {l.remarks || "-"}
                              </td>
                            )}
                            {customColumns
                              .filter((c) => isColVisible(c.id))
                              .map((c) => {
                                const key = c.id.slice("custom:".length);
                                const val = l.customFields?.[key];
                                return (
                                  <td
                                    key={c.id}
                                    className="px-5 py-3.5 text-black text-nowrap truncate max-w-[150px]"
                                    title={val || "-"}
                                  >
                                    {val || "-"}
                                  </td>
                                );
                              })}
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
                            {showAssignedCol && (
                              <td
                                className="px-5 py-3.5"
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
                            {isColVisible("followup") && (
                              <td className="px-5 py-3.5 text-black">
                                {l.followUpDate
                                  ? new Date(l.followUpDate).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "numeric",
                                        month: "short",
                                      },
                                    )
                                  : "-"}
                              </td>
                            )}
                            {isColVisible("visitScheduled") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.visitScheduledDate
                                  ? new Date(
                                      l.visitScheduledDate,
                                    ).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : "-"}
                              </td>
                            )}
                            {isColVisible("visitActual") && (
                              <td className="px-5 py-3.5 text-black text-nowrap">
                                {l.visitActualDate
                                  ? new Date(
                                      l.visitActualDate,
                                    ).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : "-"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {(() => {
                        const vItems = rowVirtualizer.getVirtualItems();
                        if (vItems.length === 0) return null;
                        const bottomPad =
                          rowVirtualizer.getTotalSize() -
                          vItems[vItems.length - 1].end;
                        return bottomPad > 0 ? (
                          <tr>
                            <td
                              colSpan={visibleColumnCount}
                              style={{ height: bottomPad, padding: 0 }}
                            />
                          </tr>
                        ) : null;
                      })()}
                    </>
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
                  type="number"
                  min="0"
                  placeholder="0"
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
                    placeholder="10-digit mobile number"
                    value={newLead.phone}
                    onChange={(e) =>
                      setNewLead({
                        ...newLead,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    maxLength={10}
                    inputMode="numeric"
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
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="website"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Website
                  </Label>
                  <Input
                    id="website"
                    placeholder="Enter website URL"
                    value={newLead.website}
                    onChange={(e) =>
                      setNewLead({ ...newLead, website: e.target.value })
                    }
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    Location
                  </Label>
                  <div className="relative">
                    <Input
                      id="location"
                      type="text"
                      placeholder="City or 6-digit pincode"
                      value={newLead.location}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      maxLength={50}
                    />
                    {pincodeLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 animate-pulse">
                        Looking up…
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="state"
                    className="text-xs font-semibold uppercase text-black"
                  >
                    State
                  </Label>
                  <Input
                    id="state"
                    type="text"
                    placeholder="State (auto-filled from pincode)"
                    value={newLead.state}
                    onChange={(e) =>
                      setNewLead({ ...newLead, state: e.target.value })
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
                        "Facebook",
                        "Instagram",
                        "Meta",
                        "Website",
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
      {/* Excel Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black px-5 py-4">
              <h2 className="text-base font-black uppercase tracking-widest">
                Import Leads via Excel
              </h2>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Expected headers */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  Required Excel Columns
                </p>
                <div className="border-2 border-black overflow-x-auto">
                  <table className="w-full min-w-[340px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black">
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider border-r border-black">
                          Column Header
                        </th>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider">
                          Required?
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {EXCEL_HEADERS.map((h, i) => (
                        <tr
                          key={h.key}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="px-3 py-1.5 font-bold border-r border-black font-mono">
                            {h.label}
                          </td>
                          <td
                            className={`px-3 py-1.5 font-black text-xs ${h.required ? "text-red-600" : "text-gray-400"}`}
                          >
                            {h.required ? "Required" : "Optional"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Source will be set to{" "}
                  <span className="font-bold text-black">Manual</span> for all
                  imported leads. Column names are case-insensitive.
                </p>
              </div>

              {/* File upload */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  Upload File (.xlsx / .xls)
                </p>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-black bg-gray-50 hover:bg-gray-100 cursor-pointer py-6 transition-colors">
                  <FileText className="w-6 h-6 mb-2 text-emerald-700" />
                  <span className="text-xs font-bold">
                    {importFile
                      ? importFile.name
                      : "Click to select Excel file"}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleExcelFile(f);
                    }}
                  />
                </label>
              </div>

              {/* Preview count */}
              {importPreview.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-2 border-emerald-600">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-xs font-black text-emerald-700">
                    {importPreview.length} rows ready to import
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    setImportPreview([]);
                  }}
                  className="flex-1 px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || importPreview.length === 0}
                  className="flex-1 px-4 py-2 bg-emerald-600 border-2 border-black text-white font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-colors shadow-[3px_3px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    `Import ${importPreview.length > 0 ? importPreview.length + " Leads" : ""}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Facebook Sync Modal */}
      {fbSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3 mb-4">
              <img
                src={fbLogo}
                alt="Facebook"
                className="w-6 h-6 object-contain"
              />
              <h2 className="text-lg font-black uppercase tracking-widest">
                Sync Facebook
              </h2>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Leads Fetch Range
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {(
                [
                  { value: "today", label: "Today Only" },
                  { value: "3days", label: "Last 3 Days" },
                  { value: "7days", label: "Last 7 Days" },
                  { value: "30days", label: "Last 30 Days" },
                  { value: "custom", label: "Custom Date Range" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFbSyncDateOption(opt.value)}
                  className={`w-full text-left px-4 py-2.5 border-2 border-black font-bold text-sm transition-colors ${
                    fbSyncDateOption === opt.value
                      ? "bg-[#1877F2] text-white"
                      : "bg-white hover:bg-blue-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fbSyncDateOption === "custom" && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={fbCustomFrom}
                    onChange={(e) => setFbCustomFrom(e.target.value)}
                    className="w-full border-2 border-black px-2 py-1.5 text-sm font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={fbCustomTo}
                    onChange={(e) => setFbCustomTo(e.target.value)}
                    className="w-full border-2 border-black px-2 py-1.5 text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setFbSyncModalOpen(false)}
                className="flex-1 px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (
                    fbSyncDateOption === "custom" &&
                    (!fbCustomFrom || !fbCustomTo)
                  ) {
                    notify.error(
                      "Select Date Range",
                      "Please pick both from and to dates.",
                    );
                    return;
                  }
                  const today = new Date();
                  let since: string;
                  let until: string | undefined;
                  if (fbSyncDateOption === "today") {
                    const d = new Date(today);
                    d.setHours(0, 0, 0, 0);
                    since = d.toISOString();
                  } else if (fbSyncDateOption === "3days") {
                    const d = new Date(today);
                    d.setDate(d.getDate() - 3);
                    since = d.toISOString();
                  } else if (fbSyncDateOption === "7days") {
                    const d = new Date(today);
                    d.setDate(d.getDate() - 7);
                    since = d.toISOString();
                  } else if (fbSyncDateOption === "30days") {
                    const d = new Date(today);
                    d.setDate(d.getDate() - 30);
                    since = d.toISOString();
                  } else {
                    since = new Date(fbCustomFrom).toISOString();
                    until = new Date(fbCustomTo + "T23:59:59").toISOString();
                  }
                  setFbSyncModalOpen(false);
                  handleFacebookSync(since, until);
                }}
                disabled={fbSyncing}
                className="flex-1 px-4 py-2 bg-[#1877F2] border-2 border-black text-white font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors shadow-[3px_3px_0px_#000] disabled:opacity-50"
              >
                {fbSyncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IndiaMART Sync Date Range Modal */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-black uppercase tracking-widest mb-4 border-b-2 border-black pb-2">
              Sync IndiaMART
            </h2>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Select Date Range
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {(
                [
                  { value: "today", label: "Today Only" },
                  { value: "yesterday", label: "Today + Yesterday" },
                  { value: "custom", label: "Custom Date Range" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSyncDateOption(opt.value)}
                  className={`w-full text-left px-4 py-2.5 border-2 border-black font-bold text-sm transition-colors ${
                    syncDateOption === opt.value
                      ? "bg-[#E07B39] text-white"
                      : "bg-white hover:bg-orange-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {syncDateOption === "custom" && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full border-2 border-black px-2 py-1.5 text-sm font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full border-2 border-black px-2 py-1.5 text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setSyncModalOpen(false)}
                className="flex-1 px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIndiamartSync}
                className="flex-1 px-4 py-2 bg-[#E07B39] border-2 border-black text-white font-black uppercase text-xs tracking-widest hover:bg-orange-600 transition-colors shadow-[3px_3px_0px_#000]"
              >
                Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
