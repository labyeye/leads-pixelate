import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { factoryAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Package,
  Printer,
  BarChart3,
  Building2,
  Weight,
  Ruler,
  Calendar,
  User,
  Hash,
  TrendingUp,
  Filter,
  RefreshCw,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface Reel {
  _id: string;
  reelNo: string;
  company: string;
  reelWeight: number;
  reelSize: string;
  entryDate: string;
  enteredBy?: { name: string; email: string };
  createdAt: string;
}

interface FactoryProduct {
  _id: string;
  name: string;
  description?: string;
}

interface PrintingLog {
  _id: string;
  printingId: string;
  reelNoStr: string;
  company: string;
  reelWeight: number;
  reelSize: string;
  product?: { _id: string; name: string };
  printDate: string;
  printedBy?: { name: string; email: string };
}

type Tab = "inventory" | "printing" | "reports";

const COMPANIES = ["Silver Tone", "ITC", "Spectra 160", "Spectra 180"];

const companyColors: Record<string, string> = {
  "Silver Tone": "bg-slate-100 text-slate-700",
  ITC: "bg-orange-100 text-orange-700",
  "Spectra 160": "bg-blue-100 text-blue-700",
  "Spectra 180": "bg-indigo-100 text-indigo-700",
};

function formatDate(d: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4 card-shadow">
      <div
        className={cn(
          "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",
          accent,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function FactoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("inventory");

  const [reels, setReels] = useState<Reel[]>([]);
  const [reelsLoading, setReelsLoading] = useState(true);
  const [showAddReel, setShowAddReel] = useState(false);
  const [reelSaving, setReelSaving] = useState(false);
  const [reelForm, setReelForm] = useState({
    company: "",
    reelWeight: "",
    reelSize: "",
    entryDate: new Date().toISOString().slice(0, 10),
  });

  const [factoryProducts, setFactoryProducts] = useState<FactoryProduct[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "" });

  const [logs, setLogs] = useState<PrintingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedReelId, setSelectedReelId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [printDate, setPrintDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [printSaving, setPrintSaving] = useState(false);

  const selectedReel = reels.find((r) => r._id === selectedReelId);

  const [reports, setReports] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReels = useCallback(async () => {
    try {
      setReelsLoading(true);
      const res = await factoryAPI.getInventory();
      setReels(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReelsLoading(false);
    }
  }, [toast]);

  const fetchFactoryProducts = useCallback(async () => {
    try {
      const res = await factoryAPI.getFactoryProducts();
      setFactoryProducts(res.data || []);
    } catch (e: any) {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await factoryAPI.getPrintingLogs();
      setLogs(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLogsLoading(false);
    }
  }, [toast]);

  const fetchReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      const res = await factoryAPI.getReports(
        startDate || endDate
          ? { startDate: startDate || undefined, endDate: endDate || undefined }
          : undefined,
      );
      setReports(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReportsLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    fetchReels();
    fetchFactoryProducts();
    fetchLogs();
  }, [fetchReels, fetchFactoryProducts, fetchLogs]);

  useEffect(() => {
    if (activeTab === "reports") fetchReports();
  }, [activeTab, fetchReports]);

  const handleAddReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelForm.company || !reelForm.reelWeight || !reelForm.reelSize) {
      toast({
        title: "Validation",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    try {
      setReelSaving(true);
      await factoryAPI.addReel({
        company: reelForm.company,
        reelWeight: parseFloat(reelForm.reelWeight),
        reelSize: reelForm.reelSize,
        entryDate: reelForm.entryDate,
      });
      toast({
        title: "Reel added!",
        description: "Inventory updated successfully.",
      });
      setShowAddReel(false);
      setReelForm({
        company: "",
        reelWeight: "",
        reelSize: "",
        entryDate: new Date().toISOString().slice(0, 10),
      });
      fetchReels();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReelSaving(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name) {
      toast({
        title: "Validation",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }
    try {
      setProductSaving(true);
      await factoryAPI.addFactoryProduct(productForm);
      toast({ title: "Product added!" });
      setShowAddProduct(false);
      setProductForm({ name: "", description: "" });
      fetchFactoryProducts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProductSaving(false);
    }
  };

  const handleLogPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReelId || !selectedProductId) {
      toast({
        title: "Validation",
        description: "Select a reel and a product.",
        variant: "destructive",
      });
      return;
    }
    try {
      setPrintSaving(true);
      await factoryAPI.addPrintingLog({
        reelId: selectedReelId,
        productId: selectedProductId,
        printDate,
      });
      toast({
        title: "Print logged!",
        description: "Batch has been recorded.",
      });
      setSelectedReelId("");
      setSelectedProductId("");
      setPrintDate(new Date().toISOString().slice(0, 10));
      fetchLogs();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPrintSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "printing", label: "Printing", icon: Printer },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ];

  return (
    <AppLayout title="Factory Inventory & Printing">
      {}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span>Factory</span>
          <ChevronRight className="w-3 h-3" />
          <span className="capitalize">{activeTab}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Factory Inventory & Printing
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage reel inventory, log print batches, and view analytics.
        </p>
      </div>

      {}
      <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit border border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {}
      {}
      {}
      {activeTab === "inventory" && (
        <div className="animate-fade-in space-y-5">
          {}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Package}
              label="Total Reels"
              value={reels.length}
              accent="bg-primary/10 text-primary"
            />
            <StatCard
              icon={Building2}
              label="Companies"
              value={new Set(reels.map((r) => r.company)).size}
              accent="bg-secondary/10 text-secondary"
            />
            <StatCard
              icon={Weight}
              label="Avg Weight (kg)"
              value={
                reels.length
                  ? (
                      reels.reduce((a, r) => a + r.reelWeight, 0) / reels.length
                    ).toFixed(1)
                  : 0
              }
              accent="bg-warning/10 text-warning"
            />
          </div>

          {}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">
              All Reels
            </h2>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowAddProduct(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Cup Product
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowAddReel(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Reel
                  </Button>
                </>
              )}
            </div>
          </div>

          {}
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Reel No",
                      "Company",
                      "Weight (kg)",
                      "Size",
                      "Entry Date",
                      "Entered By",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reelsLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">
                          Loading inventory...
                        </p>
                      </td>
                    </tr>
                  ) : reels.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No reels found. Add the first one.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    reels.map((reel, i) => (
                      <tr
                        key={reel._id}
                        className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-semibold text-primary text-xs bg-primary/8 px-2 py-0.5 rounded">
                            {reel.reelNo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded",
                              companyColors[reel.company] ||
                                "bg-muted text-muted-foreground",
                            )}
                          >
                            {reel.company}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-foreground">
                          {reel.reelWeight} kg
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {reel.reelSize}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          {formatDate(reel.entryDate)}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          {reel.enteredBy?.name || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {}
      {}
      {}
      {activeTab === "printing" && (
        <div className="animate-fade-in space-y-6">
          {}
          <div className="bg-card rounded-xl border border-border card-shadow p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Printer className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Log New Print Batch
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select reel to auto-fill details
                </p>
              </div>
            </div>

            <form onSubmit={handleLogPrint} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {}
                <div className="grid gap-1.5">
                  <Label htmlFor="reel-select">
                    Reel No <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedReelId}
                    onValueChange={(v) => {
                      setSelectedReelId(v);
                    }}
                  >
                    <SelectTrigger id="reel-select">
                      <SelectValue placeholder="Select a reel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reels.map((r) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.reelNo} — {r.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {}
                <div className="grid gap-1.5">
                  <Label htmlFor="product-select">
                    Product <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger id="product-select">
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {factoryProducts.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No products. Admin must add them first.
                        </div>
                      ) : (
                        factoryProducts.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {}
              {selectedReel && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Building2 className="w-3 h-3" /> Company (read-only)
                    </Label>
                    <Input
                      value={selectedReel.company}
                      readOnly
                      className="bg-muted cursor-not-allowed text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Weight className="w-3 h-3" /> Weight kg (read-only)
                    </Label>
                    <Input
                      value={selectedReel.reelWeight}
                      readOnly
                      className="bg-muted cursor-not-allowed text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Ruler className="w-3 h-3" /> Size (read-only)
                    </Label>
                    <Input
                      value={selectedReel.reelSize}
                      readOnly
                      className="bg-muted cursor-not-allowed text-sm"
                    />
                  </div>
                </div>
              )}

              {}
              <div className="grid gap-1.5 max-w-xs">
                <Label
                  htmlFor="print-date"
                  className="flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" /> Print Date
                </Label>
                <Input
                  id="print-date"
                  type="date"
                  value={printDate}
                  onChange={(e) => setPrintDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button type="submit" disabled={printSaving} className="gap-2">
                  {printSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Printer className="w-4 h-4" />
                  Log Print Batch
                </Button>
              </div>
            </form>
          </div>

          {}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">
                Recent Print Logs
              </h2>
              <button
                onClick={fetchLogs}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "Print ID",
                        "Reel No",
                        "Company",
                        "Weight",
                        "Size",
                        "Product",
                        "Date",
                        "By",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mt-2">
                            Loading logs...
                          </p>
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <Printer className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No print logs yet.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, i) => (
                        <tr
                          key={log._id}
                          className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors animate-fade-in"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                              {log.printingId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-primary">
                              {log.reelNoStr}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-medium px-1.5 py-0.5 rounded",
                                companyColors[log.company] ||
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {log.company}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {log.reelWeight} kg
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {log.reelSize}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground text-xs">
                            {log.product?.name || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {formatDate(log.printDate)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {log.printedBy?.name || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {}
      {}
      {activeTab === "reports" && (
        <div className="animate-fade-in space-y-6">
          {}
          <div className="bg-card rounded-xl border border-border card-shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Date Filter
              </h2>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="start-date"
                  className="text-xs text-muted-foreground"
                >
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="end-date"
                  className="text-xs text-muted-foreground"
                >
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button
                onClick={fetchReports}
                disabled={reportsLoading}
                className="gap-2"
                size="sm"
              >
                {reportsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Generate Report
              </Button>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {}
          {reports && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={Printer}
                label="Total Print Jobs"
                value={reports.totalJobs ?? 0}
                accent="bg-primary/10 text-primary"
              />
              <StatCard
                icon={Building2}
                label="Companies Active"
                value={reports.byCompany?.length ?? 0}
                accent="bg-secondary/10 text-secondary"
              />
              <StatCard
                icon={User}
                label="Staff Members Active"
                value={reports.byStaff?.length ?? 0}
                accent="bg-success/10 text-success"
              />
            </div>
          )}

          {reportsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating report...
              </span>
            </div>
          )}

          {!reportsLoading && !reports && (
            <div className="flex flex-col items-center py-14 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Click "Generate Report" to view analytics.
              </p>
            </div>
          )}

          {reports && !reportsLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {}
              <div className="bg-card rounded-xl border border-border card-shadow p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Prints by
                  Company
                </h3>
                {reports.byCompany?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {reports.byCompany?.map((row: any) => (
                      <div
                        key={row._id}
                        className="flex items-center justify-between"
                      >
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            companyColors[row._id] ||
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {row._id}
                        </span>
                        <span className="font-bold text-foreground text-sm">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {}
              <div className="bg-card rounded-xl border border-border card-shadow p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-secondary" /> Prints by Reel
                </h3>
                {reports.byReel?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {reports.byReel?.map((row: any) => (
                      <div
                        key={row._id}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-xs font-semibold text-primary">
                            {row._id}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({row.company})
                          </span>
                        </div>
                        <span className="font-bold text-foreground text-sm">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {}
              <div className="bg-card rounded-xl border border-border card-shadow p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-success" /> Prints by Staff
                </h3>
                {reports.byStaff?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {reports.byStaff?.map((row: any) => (
                      <div
                        key={row._id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-foreground">
                          {row.name}
                        </span>
                        <span className="font-bold text-foreground text-sm">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {}
      {}
      {}

      {}
      <Dialog open={showAddReel} onOpenChange={setShowAddReel}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddReel}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Add New Reel
              </DialogTitle>
              <DialogDescription>
                Register a new reel to inventory. A unique SKY-XXX ID will be
                auto-generated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="company">
                  Company <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={reelForm.company}
                  onValueChange={(v) =>
                    setReelForm({ ...reelForm, company: v })
                  }
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="reelWeight">
                    Weight (kg) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="reelWeight"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 25.5"
                    value={reelForm.reelWeight}
                    onChange={(e) =>
                      setReelForm({ ...reelForm, reelWeight: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="reelSize">
                    Size <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="reelSize"
                    placeholder="e.g. 72mm"
                    value={reelForm.reelSize}
                    onChange={(e) =>
                      setReelForm({ ...reelForm, reelSize: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="entryDate">Entry Date</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={reelForm.entryDate}
                  onChange={(e) =>
                    setReelForm({ ...reelForm, entryDate: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddReel(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={reelSaving} className="gap-2">
                {reelSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Reel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleAddProduct}>
            <DialogHeader>
              <DialogTitle>Add Cup Product</DialogTitle>
              <DialogDescription>
                Products appear in the Printing tab dropdown (e.g. 60ml Cup,
                80ml Cup).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="prod-name">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-name"
                  placeholder="e.g. 60ml Cup"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-desc">Description (optional)</Label>
                <Input
                  id="prod-desc"
                  placeholder="Short note"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddProduct(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={productSaving} className="gap-2">
                {productSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
