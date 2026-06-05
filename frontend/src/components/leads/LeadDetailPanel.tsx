import { useState, useEffect } from "react";
import indiamartLogo from "@/assets/images/logos/indiamart.png";
import facebookLogo from "@/assets/images/logos/facebook.png";
import tradeindiLogo from "@/assets/images/logos/tradeindia.webp";
import justdialLogo from "@/assets/images/logos/justdial.webp";

const SOURCE_LOGOS: Record<string, string> = {
  indiamart: indiamartLogo,
  facebook: facebookLogo,
  tradeindia: tradeindiLogo,
  justdial: justdialLogo,
};
import {
  Phone,
  PhoneOff,
  Calendar as CalendarIcon,
  FileText,
  MapPin,
  Check,
  Ban,
  Loader2,
  Flame,
  Wind,
  Snowflake,
  IndianRupee,
  MessageCircle,
  Send,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { whatsappAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { statusColors, getCategoryByStatus } from "./statusConstants";
import { StatusUpdateModal } from "./StatusUpdateModal";
import { StatusHistoryTimeline } from "./StatusHistoryTimeline";
import { WhatsAppIcon } from "../icons/WhatsAppIcon";

interface LeadDetailPanelProps {
  lead: any;
  onClose: () => void;
  onRefresh: () => void;
  className?: string;
}

export function LeadDetailPanel({
  lead,
  onClose,
  onRefresh,
  className,
}: LeadDetailPanelProps) {
  const { toast } = useToast();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [selectedContactTag, setSelectedContactTag] = useState<
    "HOT" | "WARM" | "COLD" | undefined
  >(undefined);
  const [waDialogOpen, setWaDialogOpen] = useState(false);

  if (!lead) return null;

  const activeCategory = getCategoryByStatus(lead.status || "PENDING CONTACT");

  const handleUpdateStatusTrigger = (status: string) => {
    if (status === "DISCUSSION") {
      setIsTagModalOpen(true);
      setPendingStatus(status);
    } else {
      setPendingStatus(status);
      setIsStatusModalOpen(true);
    }
  };

  const handleTagSelect = (tag: "HOT" | "WARM" | "COLD") => {
    setSelectedContactTag(tag);
    setIsTagModalOpen(false);
    setIsStatusModalOpen(true);
  };

  return (
    <div
      className={cn(
        "bg-card border-2 border-border p-5 flex flex-col h-full overflow-y-auto",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Lead Details</h3>
        <button
          onClick={onClose}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.company}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 p-2.5 rounded-lg border-2 border-black">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Status
            </p>
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-full border inline-block",
                statusColors[lead.status] || "bg-muted",
              )}
            >
              {lead.status || "PENDING CONTACT"}
            </span>
          </div>
          {lead.contactTag && (
            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Tag
              </p>
              <span
                className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                  statusColors[lead.contactTag] || "bg-muted",
                )}
              >
                {lead.contactTag === "HOT" && <Flame className="w-3 h-3" />}
                {lead.contactTag === "WARM" && <Wind className="w-3 h-3" />}
                {lead.contactTag === "COLD" && (
                  <Snowflake className="w-3 h-3" />
                )}
                {lead.contactTag}
              </span>
            </div>
          )}
          <div className="bg-muted/30 p-2.5 rounded-lg border-2 border-black">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Source
            </p>
            <div className="flex items-center gap-1.5">
              {SOURCE_LOGOS[lead.source?.toLowerCase()] && (
                <img
                  src={SOURCE_LOGOS[lead.source.toLowerCase()]}
                  alt={lead.source}
                  className="w-4 h-4 object-contain rounded-sm shrink-0"
                />
              )}
              <p className="text-xs font-medium text-foreground">
                {lead.source}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0" />
              <span className="text-foreground">{lead.phone}</span>
            </div>
            {lead.location && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 text-black/70 shrink-0" />
                <span className="text-foreground font-medium text-xs leading-tight">
                  City: {lead.location}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 flex items-center justify-center font-bold text-xs">
              <Mail className="w-4 h-4 text-black" />
            </div>
            <span className="text-primary">{lead.email || "No email"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {lead.facebookAdName && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <div className="w-4 h-4 mt-0.5 bg-[#1877F2] rounded-sm flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-[9px]">f</span>
                </div>
                <span className="text-foreground font-medium text-xs leading-tight">
                  Campaign: {lead.facebookAdName}
                </span>
              </div>
            )}
            <div className="flex items-start gap-2 text-muted-foreground">
              <IndianRupee className="w-4 h-4 mt-0.5 text-success/70" />
              <span className="text-success font-bold text-xs leading-tight">
                Budget: {lead.budget || "Not Specified"}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-muted-foreground pt-2">
            <CalendarIcon className="w-4 h-4 mt-0.5 text-blue-500/70" />
            <span className="text-secondary font-bold text-xs leading-tight">
              Inquiry Date:{" "}
              {lead.indiamartQueryTime
                ? format(new Date(lead.indiamartQueryTime), "PPP p")
                : format(new Date(lead.createdAt), "PPP p")}
            </span>
          </div>
          {lead.visitScheduledDate && (
            <div className="flex items-start gap-2 text-muted-foreground pt-2">
              <CalendarIcon className="w-4 h-4 mt-0.5 text-indigo-500/70" />
              <span className="text-indigo-600 font-bold text-xs leading-tight">
                Scheduled Visit:{" "}
                {format(new Date(lead.visitScheduledDate), "PPP p")}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2 text-muted-foreground pt-2">
            <FileText className="w-4 h-4 mt-0.5" />
            <span className="text-primary font-bold text-xs leading-tight">
              Requirement: {lead.requirement || "No requirement specified."}
            </span>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground pt-2">
            <FileText className="w-4 h-4 mt-0.5 text-primary/70" />
            <span className="text-black font-semibold text-md leading-tight">
              Remarks: {lead.remarks || "No remarks added."}
            </span>
          </div>
        </div>

        {lead.interestedProducts && lead.interestedProducts.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Interested Products
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.interestedProducts.map((p: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-primary/5 text-primary border border-primary/10 rounded-md text-[10px] font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-5 space-y-4">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </h4>

        {/* WhatsApp quick action */}
        {lead.phone && (
          <Button
            variant="outline"
            className="w-full border-2 justify-start gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-black"
            onClick={() => setWaDialogOpen(true)}
          >
            <WhatsAppIcon className="w-4 h-4" />
            Send WhatsApp Message
          </Button>
        )}

        {/* WhatsApp send dialog */}
        <WhatsAppSendDialog
          open={waDialogOpen}
          onClose={() => setWaDialogOpen(false)}
          lead={lead}
          toast={toast}
        />
        {}
        {activeCategory === "New Lead" && (
          <div className="grid grid-cols-1 gap-2">
            {}
            {}
            <Button
              className="w-full border-2 justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleUpdateStatusTrigger("DISCUSSION")}
            >
              <Check className="w-4 h-4" /> Contacted
            </Button>

            {}
            {lead.status === "PENDING CONTACT" && (
              <Button
                variant="outline"
                className="w-full border-2 justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("1")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 1)
              </Button>
            )}

            {lead.status === "1" && (
              <Button
                variant="outline"
                className="w-full border-2 justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("2")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 2)
              </Button>
            )}

            {lead.status === "2" && (
              <Button
                variant="outline"
                className="w-full border-2 justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("3")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 3)
              </Button>
            )}

            {lead.status === "3" && (
              <Button
                variant="outline"
                className="w-full border-2 justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => handleUpdateStatusTrigger("COMPLETED")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 4 → Mark
                Completed)
              </Button>
            )}

            {lead.status === "COMPLETED" && (
              <Button
                variant="outline"
                className="w-full border-2 justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => handleUpdateStatusTrigger("COMPLETED")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Additional Attempt)
              </Button>
            )}

            {}
            <Button
              variant="ghost"
              className="w-full border-2 justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleUpdateStatusTrigger("DROP")}
            >
              <Ban className="w-4 h-4" /> Drop Lead
            </Button>
          </div>
        )}

        {getCategoryByStatus(lead.status) === "Discussion/Requirement" && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleUpdateStatusTrigger(lead.status)}
            >
              <Check className="w-4 h-4" /> Contacted (Update Remarks)
            </Button>

            {lead.status === "DISCUSSION" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("DISCUSSION 1")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 1)
              </Button>
            )}

            {lead.status === "DISCUSSION 1" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("DISCUSSION 2")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 2)
              </Button>
            )}

            {lead.status === "DISCUSSION 2" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("DISCUSSION 3")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 3)
              </Button>
            )}

            {(lead.status === "DISCUSSION 3" ||
              lead.status === "DISCUSSION COMPLETED") && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() =>
                  handleUpdateStatusTrigger("DISCUSSION COMPLETED")
                }
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 4+ →
                Discussion Completed)
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-purple-600 hover:text-purple-700 border-purple-200"
              onClick={() => handleUpdateStatusTrigger("QUOTATION")}
            >
              <FileText className="w-4 h-4" /> Send Quotation
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 border-indigo-200"
              onClick={() => handleUpdateStatusTrigger("VISIT SCHEDULED")}
            >
              <MapPin className="w-4 h-4" /> Schedule Visit
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleUpdateStatusTrigger("DROP")}
            >
              <Ban className="w-4 h-4" /> Drop Lead
            </Button>
          </div>
        )}

        {getCategoryByStatus(lead.status) === "Quotation" && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleUpdateStatusTrigger(lead.status)}
            >
              <Check className="w-4 h-4" /> Contacted (Update Remarks)
            </Button>

            {lead.status === "QUOTATION" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("QUOTATION 1")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 1)
              </Button>
            )}

            {lead.status === "QUOTATION 1" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("QUOTATION 2")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 2)
              </Button>
            )}

            {lead.status === "QUOTATION 2" && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-black"
                onClick={() => handleUpdateStatusTrigger("QUOTATION 3")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 3)
              </Button>
            )}

            {(lead.status === "QUOTATION 3" ||
              lead.status === "QUOTATION COMPLETED") && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => handleUpdateStatusTrigger("QUOTATION COMPLETED")}
              >
                <PhoneOff className="w-4 h-4" /> Not Picked (Attempt 4+ →
                Quotation Completed)
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 border-indigo-200"
              onClick={() => handleUpdateStatusTrigger("VISIT SCHEDULED")}
            >
              <MapPin className="w-4 h-4" /> Schedule Visit
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleUpdateStatusTrigger("DROP")}
            >
              <Ban className="w-4 h-4" /> Drop Lead
            </Button>
          </div>
        )}

        {lead.status === "VISIT SCHEDULED" && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              className="w-full justify-start gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => handleUpdateStatusTrigger("VISITED")}
            >
              <MapPin className="w-4 h-4" /> Mark Visit Completed
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 border-indigo-200"
              onClick={() => handleUpdateStatusTrigger("VISIT SCHEDULED")}
            >
              <CalendarIcon className="w-4 h-4" /> Reschedule Visit
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleUpdateStatusTrigger("DROP")}
            >
              <Ban className="w-4 h-4" /> Drop Lead
            </Button>
          </div>
        )}

        {}
        {lead.status === "VISITED" && (
          <div className="grid grid-cols-1 gap-2">
            <Button
              className="w-full justify-start gap-2 bg-success hover:bg-success/90 text-white"
              onClick={() => handleUpdateStatusTrigger("WON")}
            >
              <Check className="w-4 h-4" /> Convert to Client (Won)
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleUpdateStatusTrigger("DROP")}
            >
              <Ban className="w-4 h-4" /> Drop Lead
            </Button>
          </div>
        )}

        {}
        {lead.status === "WON" && (
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-success/10 text-success border border-success/20 p-3 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">
                ✅ Successfully converted to Client
              </span>
            </div>
          </div>
        )}

        {}
        {lead.status === "DROP" && (
          <div className="grid grid-cols-1 gap-2">
            <p className="text-xs text-muted-foreground italic mb-2">
              This lead has been dropped.
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => handleUpdateStatusTrigger("PENDING CONTACT")}
            >
              Restore to New Lead
            </Button>
          </div>
        )}
      </div>

      {}
      {isTagModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Select Contact Tag</h3>
            <p className="text-sm text-muted-foreground mb-6">
              How interested is this lead?
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Button
                className="w-full justify-start gap-3 bg-red-600 hover:bg-red-700 text-white h-10"
                onClick={() => handleTagSelect("HOT")}
              >
                <Flame className="w-4 h-4" /> HOT (Needed within 1 week)
              </Button>
              <Button
                className="w-full justify-start gap-3 bg-orange-600 hover:bg-orange-700 text-white h-10"
                onClick={() => handleTagSelect("WARM")}
              >
                <Wind className="w-4 h-4" /> WARM (Within 30 days)
              </Button>
              <Button
                className="w-full justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white h-10"
                onClick={() => handleTagSelect("COLD")}
              >
                <Snowflake className="w-4 h-4" /> COLD (Just looking)
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-5 pb-8">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Status History
        </h4>
        <StatusHistoryTimeline
          statusHistory={lead.statusHistory}
          stagePath={lead.stagePath}
        />
      </div>

      <StatusUpdateModal
        open={isStatusModalOpen}
        onOpenChange={(open) => {
          setIsStatusModalOpen(open);
          if (!open) {
            setSelectedContactTag(undefined);
            setPendingStatus(null);
          }
        }}
        lead={lead}
        pendingStatus={pendingStatus}
        onSuccess={onRefresh}
        selectedTag={selectedContactTag}
      />
    </div>
  );
}

// ─── WhatsApp Send Dialog ──────────────────────────────────────────────────────
function WhatsAppSendDialog({
  open,
  onClose,
  lead,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  lead: any;
  toast: any;
}) {
  const [mode, setMode] = useState<"text" | "template">("text");
  const [messageText, setMessageText] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loadingInit, setLoadingInit] = useState(false);
  const [sending, setSending] = useState(false);

  // Phone number selection — only shown when >1 number connected
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingInit(true);

    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([tRes, sRes]) => {
        setTemplates(
          (tRes.data || []).filter((t: any) => t.status === "APPROVED"),
        );
        const nums = sRes.data?.phoneNumbers || [];
        setPhoneNumbers(nums);
        // Auto-select if only one
        if (nums.length === 1) setSelectedPhoneNumberId(nums[0].phoneNumberId);
        else setSelectedPhoneNumberId("");
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, [open]);

  const needsPhonePick = phoneNumbers.length > 1;
  const canSend = needsPhonePick ? !!selectedPhoneNumberId : true;

  const handleSend = async () => {
    if (mode === "text" && !messageText.trim()) return;
    if (mode === "template" && !templateId) return;
    if (!canSend) return;

    setSending(true);
    try {
      await whatsappAPI.sendMessage({
        leadId: lead._id,
        ...(mode === "template"
          ? { templateId }
          : { messageType: "text", messageText }),
        ...(selectedPhoneNumberId
          ? { phoneNumberId: selectedPhoneNumberId }
          : {}),
      });
      toast({ title: "Message sent successfully" });
      setMessageText("");
      setTemplateId("");
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to send",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            WhatsApp — {lead.name}
          </DialogTitle>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground">
              Sending to:{" "}
              <span className="font-mono font-medium text-foreground">
                {lead.phone}
              </span>
            </p>

            {/* Phone number selector — only if multiple numbers connected */}
            {needsPhonePick && (
              <div>
                <Label className="text-xs">
                  Send from which number?{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedPhoneNumberId}
                  onValueChange={setSelectedPhoneNumberId}
                >
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue placeholder="Select a number..." />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((p: any) => (
                      <SelectItem key={p.phoneNumberId} value={p.phoneNumberId}>
                        <div className="flex flex-col">
                          <span>
                            {p.label || p.businessName || p.phoneNumber}
                          </span>
                          {p.phoneNumber && p.label && (
                            <span className="text-xs text-muted-foreground">
                              {p.phoneNumber}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Mode toggle */}
            <div className="flex bg-muted rounded-lg p-1 gap-1">
              <button
                onClick={() => setMode("text")}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${mode === "text" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                Free Text
              </button>
              <button
                onClick={() => setMode("template")}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${mode === "template" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                Template
              </button>
            </div>

            {mode === "text" ? (
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  className="mt-1 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Free text only works within 24h of customer's last message.
                  Use templates for new outreach.
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Select Template</Label>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
                    No approved templates. Go to Settings → WhatsApp → Templates
                    to sync.
                  </p>
                ) : (
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {templateId && templates.find((t) => t._id === templateId) && (
                  <div className="mt-3 bg-[#e5ddd5] rounded-xl p-3">
                    <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
                      {templates.find((t) => t._id === templateId)?.bodyText}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={
              sending ||
              loadingInit ||
              !canSend ||
              (mode === "text" ? !messageText.trim() : !templateId)
            }
            className="bg-green-600 hover:bg-green-700 text-white gap-1"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
