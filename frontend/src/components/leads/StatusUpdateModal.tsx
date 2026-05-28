import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Loader2,
  Calendar as CalendarIcon,
  Plus,
  Flame,
  Wind,
  Snowflake,
  IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusColors } from "./statusConstants";
import { leadsAPI, productsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

interface StatusUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  pendingStatus: string | null;
  onSuccess: () => void;
  selectedTag?: string;
}

export function StatusUpdateModal({
  open,
  onOpenChange,
  lead,
  pendingStatus,
  onSuccess,
  selectedTag,
}: StatusUpdateModalProps) {
  const { toast } = useToast();
  const [remarksInput, setRemarksInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = useState<string>("12:00");
  const [visitScheduledDate, setVisitScheduledDate] = useState<
    Date | undefined
  >(new Date());
  const [visitScheduledTime, setVisitScheduledTime] = useState<string>("10:00");
  const [visitActualDate, setVisitActualDate] = useState<Date | undefined>(
    new Date(),
  );
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [localTag, setLocalTag] = useState<string | undefined>(selectedTag);

  const isSameStatus = lead?.status === pendingStatus;
  const showTagPicker =
    [
      "1",
      "DISCUSSION",
      "DISCUSSION 1",
      "DISCUSSION 2",
      "DISCUSSION 3",
      "DISCUSSION COMPLETED",
    ].includes(pendingStatus || "") && !isSameStatus;

  const showFollowupPicker =
    pendingStatus !== "WON" &&
    pendingStatus !== "DROP" &&
    pendingStatus !== "VISIT SCHEDULED";

  useEffect(() => {
    if (open && lead) {
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
      setVisitScheduledDate(
        lead.visitScheduledDate
          ? new Date(lead.visitScheduledDate)
          : new Date(),
      );
      setVisitScheduledTime(
        lead.visitScheduledDate
          ? format(new Date(lead.visitScheduledDate), "HH:mm")
          : "10:00",
      );
      setVisitActualDate(
        lead.visitActualDate ? new Date(lead.visitActualDate) : new Date(),
      );
      setLocalTag(selectedTag);
      fetchProducts();
    }
  }, [open, lead, selectedTag]);

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll();
      setAllProducts(res.data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
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

  const handleUpdate = async () => {
    if (!lead || !pendingStatus) return;

    if (!remarksInput.trim()) {
      toast({
        title: "Remarks Required",
        description: "Please add remarks for this status change",
        variant: "destructive",
      });
      return;
    }

    const isSameStatus = lead.status === pendingStatus;
    if (showFollowupPicker && !selectedDate) {
      toast({
        title: "Date Required",
        description:
          "Please select a follow-up date and time for this status change",
        variant: "destructive",
      });
      return;
    }

    if (pendingStatus === "VISIT SCHEDULED" && !visitScheduledDate) {
      toast({
        title: "Visit Date Required",
        description: "Please select the scheduled visit date",
        variant: "destructive",
      });
      return;
    }

    if (pendingStatus === "VISITED" && !visitActualDate) {
      toast({
        title: "Visit Date Required",
        description: "Please select the actual visit date",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (pendingStatus === "WON") {
        const res = await leadsAPI.convertToClient(lead._id || lead.id, {
          address: "Not Provided",
          businessType: "Not Specified",
          remarks: remarksInput,
        });
        if (res.success) {
          toast({
            title: "Success",
            description: "Lead converted to Client successfully!",
          });
          onSuccess();
          onOpenChange(false);
        }
        return;
      }

      const updateData: any = {
        status: pendingStatus,
        remarks: remarksInput,
        interestedProducts: selectedProducts,
      };

      if (budgetInput.trim()) {
        updateData.budget = budgetInput;
      }

      if (
        [
          "1",
          "DISCUSSION",
          "DISCUSSION 1",
          "DISCUSSION 2",
          "DISCUSSION 3",
          "DISCUSSION COMPLETED",
        ].includes(pendingStatus) &&
        localTag
      ) {
        updateData.contactTag = localTag;
      }

      if (showFollowupPicker && selectedDate && selectedTime) {
        const [hours, minutes] = selectedTime.split(":").map(Number);
        const finalDate = new Date(selectedDate);
        finalDate.setHours(hours, minutes, 0, 0);
        updateData.followUpDate = finalDate;
      }

      if (
        pendingStatus === "VISIT SCHEDULED" &&
        visitScheduledDate &&
        visitScheduledTime
      ) {
        const [hours, minutes] = visitScheduledTime.split(":").map(Number);
        const finalDate = new Date(visitScheduledDate);
        finalDate.setHours(hours, minutes, 0, 0);
        updateData.visitScheduledDate = finalDate;
        updateData.followUpDate = finalDate;
      }

      if (pendingStatus === "VISITED" && visitActualDate) {
        updateData.visitActualDate = visitActualDate;
      }

      await leadsAPI.update(lead._id || lead.id, updateData);
      toast({
        title: "Status Updated",
        description: `Lead status changed to ${pendingStatus}`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-muted-foreground font-normal">
              Updating to:
            </span>
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
          {showTagPicker && (
            <div className="space-y-4 p-4 rounded-xl border border-border bg-card/50">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                Assign Contact Tag{" "}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="flex gap-2">
                {(["HOT", "WARM", "COLD"] as const).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setLocalTag(tag)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                      localTag === tag
                        ? tag === "HOT"
                          ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-200"
                          : tag === "WARM"
                            ? "bg-orange-400 border-orange-400 text-white shadow-lg shadow-orange-100"
                            : "bg-blue-300 border-blue-300 text-slate-800 shadow-lg shadow-blue-100"
                        : "bg-background border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {tag === "HOT" && <Flame className="w-4 h-4" />}
                    {tag === "WARM" && <Wind className="w-4 h-4" />}
                    {tag === "COLD" && <Snowflake className="w-4 h-4" />}
                    <span className="text-xs font-bold">{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="budget"
              className="text-xs text-muted-foreground uppercase tracking-wider"
            >
              Budget
            </Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="budget"
                type="text"
                placeholder="Enter budget (e.g. 50,000)"
                className="w-full rounded-lg border border-border bg-background pl-10 p-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label
              htmlFor="remarks"
              className="text-xs text-muted-foreground uppercase tracking-wider"
            >
              Remarks <span className="text-destructive font-bold">*</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="Add a remark for this status change (required)..."
              className="min-h-[120px] resize-none"
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider text-foreground">
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
                      : "bg-background border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <Input
                placeholder="New product..."
                className="h-8 text-xs"
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
                Add
              </Button>
            </div>
          </div>

          {showFollowupPicker && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider block">
                Follow-up Date & Time{" "}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal h-10",
                        !selectedDate && "text-muted-foreground",
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
                  <PopoverContent className="w-auto p-0" align="start">
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
                  className="h-10 w-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {pendingStatus === "VISIT SCHEDULED" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider block">
                Scheduled Visit Date & Time{" "}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal h-10",
                        !visitScheduledDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {visitScheduledDate ? (
                        format(visitScheduledDate, "PPP")
                      ) : (
                        <span>Pick visit date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={visitScheduledDate}
                      onSelect={setVisitScheduledDate}
                      initialFocus
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                    />
                  </PopoverContent>
                </Popover>
                <input
                  type="time"
                  className="h-10 w-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground"
                  value={visitScheduledTime}
                  onChange={(e) => setVisitScheduledTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {pendingStatus === "VISITED" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider block">
                Actual Visit Date{" "}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !visitActualDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {visitActualDate ? (
                      format(visitActualDate, "PPP")
                    ) : (
                      <span>Pick visit date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={visitActualDate}
                    onSelect={setVisitActualDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={handleUpdate}
            disabled={
              loading ||
              !remarksInput.trim() ||
              (showFollowupPicker && !selectedDate) ||
              (pendingStatus === "VISIT SCHEDULED" && !visitScheduledDate) ||
              (pendingStatus === "VISITED" && !visitActualDate)
            }
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
