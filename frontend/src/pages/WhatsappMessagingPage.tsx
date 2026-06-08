import { AppLayout } from "@/components/layout/AppLayout";
import { whatsappAPI, leadsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
  MessageSquare,
  Plus,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  Loader2,
  Users,
  FileText,
  BarChart3,
  MessageCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface Campaign {
  _id: string;
  name: string;
  status: string;
  template?: { displayName: string; name: string };
  templateSnapshot?: { displayName: string };
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  createdAt: string;
  sentAt?: string;
  createdBy?: { name: string };
}

interface Template {
  _id: string;
  name: string;
  displayName: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  category: string;
  language: string;
  variableCount: number;
  status: string;
  metaTemplateName?: string;
}

interface Lead {
  _id: string;
  name: string;
  company: string;
  phone: string;
  status: string;
  source: string;
  contactTag?: string;
}

type WizardStep = 1 | 2 | 3 | 4;

const VARIABLE_FIELDS = [
  { key: "name", label: "Lead Name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "requirement", label: "Requirement" },
  { key: "budget", label: "Budget" },
  { key: "custom", label: "Custom Value" },
];

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  SENDING: "bg-blue-100 text-blue-800 border-blue-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  PARTIAL: "bg-orange-100 text-orange-800 border-orange-200",
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
};

function previewBody(
  bodyText: string,
  mapping: { position: number; fieldKey: string; customValue?: string }[],
) {
  const SAMPLE: Record<string, string> = {
    name: "Rajesh Kumar",
    company: "ABC Industries",
    phone: "9876543210",
    location: "Mumbai",
    requirement: "Flex Banners",
    budget: "₹50,000",
    custom: "Custom Text",
  };
  let preview = bodyText;
  mapping.forEach((v) => {
    const val =
      v.fieldKey === "custom"
        ? v.customValue || "Custom Text"
        : SAMPLE[v.fieldKey] || "";
    preview = preview.replace(
      new RegExp(`\\{\\{${v.position}\\}\\}`, "g"),
      `*${val}*`,
    );
  });
  return preview;
}

export default function WhatsappMessagingPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [campaignName, setCampaignName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    new Set(),
  );
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("ALL");
  const [variableMapping, setVariableMapping] = useState<
    { position: number; fieldKey: string; customValue: string }[]
  >([]);
  const [sending, setSending] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setCampaigns(res.data);
    } catch {
      toast({ title: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setLoadingCampaigns(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const openWizard = async () => {
    setStep(1);
    setCampaignName("");
    setSelectedTemplate(null);
    setSelectedLeadIds(new Set());
    setLeadSearch("");
    setLeadStatusFilter("ALL");
    setVariableMapping([]);
    setWizardOpen(true);

    setLoadingTemplates(true);
    setLoadingLeads(true);
    try {
      const [tRes, lRes] = await Promise.all([
        whatsappAPI.getTemplates(),
        leadsAPI.getAll(),
      ]);
      setTemplates(
        tRes.data.filter(
          (t: Template) => t.status === "APPROVED" || t.status === "DRAFT",
        ),
      );
      setLeads(lRes.data);
      setFilteredLeads(lRes.data);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoadingTemplates(false);
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    let filtered = leads;
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.phone.includes(q),
      );
    }
    if (leadStatusFilter !== "ALL") {
      filtered = filtered.filter((l) => l.status === leadStatusFilter);
    }
    setFilteredLeads(filtered);
  }, [leads, leadSearch, leadStatusFilter]);

  const selectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    const vars: { position: number; fieldKey: string; customValue: string }[] =
      [];
    for (let i = 1; i <= t.variableCount; i++) {
      const defaultField = i === 1 ? "name" : i === 2 ? "company" : "custom";
      vars.push({ position: i, fieldKey: defaultField, customValue: "" });
    }
    setVariableMapping(vars);
  };

  const toggleAllLeads = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l._id)));
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendCampaign = async () => {
    if (!selectedTemplate || selectedLeadIds.size === 0 || !campaignName.trim())
      return;
    setSending(true);
    try {
      await whatsappAPI.createCampaign({
        name: campaignName.trim(),
        templateId: selectedTemplate._id,
        leadIds: Array.from(selectedLeadIds),
        variableMapping,
      });
      toast({
        title: "Campaign launched!",
        description: `Sending to ${selectedLeadIds.size} leads...`,
      });
      setWizardOpen(false);
      await fetchCampaigns();
    } catch (err: any) {
      toast({
        title: "Failed to send campaign",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const viewCampaign = async (id: string) => {
    setLoadingDetail(true);
    setSelectedCampaign(null);
    try {
      const res = await whatsappAPI.getCampaign(id);
      setSelectedCampaign(res.data);
    } catch {
      toast({ title: "Failed to load campaign", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <AppLayout title="WhatsApp Messaging">
      <div className="flex flex-col h-full">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">WhatsApp Messaging</h1>
              <p className="text-xs text-muted-foreground">
                Manage & send WhatsApp campaigns to leads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCampaigns}
              disabled={loadingCampaigns}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${loadingCampaigns ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={openWizard}
            >
              <Plus className="w-4 h-4 mr-1" />
              New Campaign
            </Button>
          </div>
        </div>

        {}
        <div className="flex flex-1 overflow-hidden">
          {}
          <div className="w-full md:w-1/2 xl:w-2/5 border-r border-border overflow-y-auto">
            {loadingCampaigns ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No campaigns yet.
                  <br />
                  Click <strong>New Campaign</strong> to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {campaigns.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => viewCampaign(c._id)}
                    className={`w-full text-left px-4 py-4 hover:bg-accent/50 transition-colors ${selectedCampaign?._id === c._id ? "bg-accent" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {c.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"}`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.template?.displayName ||
                            c.templateSnapshot?.displayName ||
                            "—"}{" "}
                          ·{" "}
                          {format(new Date(c.createdAt), "dd MMM yyyy, h:mm a")}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {c.totalCount}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600">
                            <Send className="w-3 h-3" />
                            {c.sentCount}
                          </span>
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCheck className="w-3 h-3" />
                            {c.deliveredCount}
                          </span>
                          <span className="flex items-center gap-1 text-purple-600">
                            <Eye className="w-3 h-3" />
                            {c.readCount}
                          </span>
                          {c.failedCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-3 h-3" />
                              {c.failedCount}
                            </span>
                          )}
                          {c.repliedCount > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <MessageCircle className="w-3 h-3" />
                              {c.repliedCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="hidden md:flex flex-1 flex-col overflow-y-auto">
            {loadingDetail ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedCampaign ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Select a campaign to view details
                </p>
              </div>
            ) : (
              <CampaignDetail campaign={selectedCampaign} />
            )}
          </div>
        </div>
      </div>

      {}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              New Campaign
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Step {step} of 4
              </span>
            </DialogTitle>
            {}
            <div className="flex gap-1 mt-3">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-green-500" : "bg-muted"}`}
                />
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Campaign Name</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Give this campaign a recognisable name.
                  </p>
                  <Input
                    placeholder="e.g. Diwali Offer – October 2025"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Select Template</p>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading
                    templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No templates found. Create one in{" "}
                    <strong>WhatsApp Settings</strong>.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {templates.map((t) => (
                      <button
                        key={t._id}
                        onClick={() => selectTemplate(t)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedTemplate?._id === t._id ? "border-green-500 bg-green-50/50" : "border-border hover:border-muted-foreground/40"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {t.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {t.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {t.category}
                            </Badge>
                            <Badge
                              variant={
                                t.status === "APPROVED"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {t.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs mt-2 text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                          {t.bodyText}
                        </p>
                        {t.variableCount > 0 && (
                          <p className="text-[10px] mt-1 text-blue-600">
                            {t.variableCount} variable
                            {t.variableCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {}
            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Select Leads</p>
                  <span className="text-xs text-muted-foreground">
                    {selectedLeadIds.size} selected
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search name, company, phone..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <Select
                    value={leadStatusFilter}
                    onValueChange={setLeadStatusFilter}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PENDING CONTACT">
                        Pending Contact
                      </SelectItem>
                      <SelectItem value="DISCUSSION">Discussion</SelectItem>
                      <SelectItem value="QUOTATION">Quotation</SelectItem>
                      <SelectItem value="WON">Won</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {loadingLeads ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading
                    leads...
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    {}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
                      <Checkbox
                        checked={
                          selectedLeadIds.size > 0 &&
                          selectedLeadIds.size === filteredLeads.length
                        }
                        onCheckedChange={toggleAllLeads}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        Select All ({filteredLeads.length})
                      </span>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-border">
                      {filteredLeads.map((l) => (
                        <div
                          key={l._id}
                          className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 cursor-pointer ${selectedLeadIds.has(l._id) ? "bg-green-50/40" : ""}`}
                          onClick={() => toggleLead(l._id)}
                        >
                          <Checkbox
                            checked={selectedLeadIds.has(l._id)}
                            onCheckedChange={() => toggleLead(l._id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {l.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {l.company} · {l.phone}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0"
                          >
                            {l.status}
                          </Badge>
                        </div>
                      ))}
                      {filteredLeads.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No leads match your search.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {}
            {step === 4 && selectedTemplate && (
              <div className="space-y-4">
                {variableMapping.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3">
                      Map Variables to Lead Fields
                    </p>
                    <div className="space-y-3">
                      {variableMapping.map((v, idx) => (
                        <div
                          key={v.position}
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground w-12 text-center shrink-0">{`{{${v.position}}}`}</span>
                          <Select
                            value={v.fieldKey}
                            onValueChange={(val) => {
                              const next = [...variableMapping];
                              next[idx].fieldKey = val;
                              setVariableMapping(next);
                            }}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VARIABLE_FIELDS.map((f) => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {v.fieldKey === "custom" && (
                            <Input
                              placeholder="Custom text"
                              value={v.customValue}
                              onChange={(e) => {
                                const next = [...variableMapping];
                                next[idx].customValue = e.target.value;
                                setVariableMapping(next);
                              }}
                              className="flex-1 h-8 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {}
                <div>
                  <p className="text-sm font-medium mb-2">Message Preview</p>
                  <div className="bg-[#e5ddd5] rounded-xl p-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-xs ml-auto">
                      {selectedTemplate.headerText && (
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          {selectedTemplate.headerText}
                        </p>
                      )}
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {previewBody(
                          selectedTemplate.bodyText,
                          variableMapping,
                        )}
                      </p>
                      {selectedTemplate.footerText && (
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedTemplate.footerText}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1 text-right">
                        Preview
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Variables shown with sample data. Actual messages will use
                    lead field values.
                  </p>
                </div>

                {}
                <div className="bg-muted/40 rounded-lg p-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Campaign</span>
                    <span className="font-medium">{campaignName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">
                      {selectedTemplate.displayName}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-medium">
                      {selectedLeadIds.size} leads
                    </span>
                  </div>
                </div>

                {selectedTemplate.status === "DRAFT" && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-orange-700">
                      This template is in <strong>DRAFT</strong> status. It may
                      not be approved by Meta yet. Messages may fail if the
                      template isn't registered in your Meta Business Manager.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                step > 1
                  ? setStep((s) => (s - 1) as WizardStep)
                  : setWizardOpen(false)
              }
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={
                sending ||
                (step === 1 && !campaignName.trim()) ||
                (step === 2 && !selectedTemplate) ||
                (step === 3 && selectedLeadIds.size === 0)
              }
              onClick={() => {
                if (step < 4) setStep((s) => (s + 1) as WizardStep);
                else sendCampaign();
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              {step < 4 ? (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Send Campaign
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ─── Campaign Detail Panel ─────────────────────────────────────────────────────
function CampaignDetail({ campaign }: { campaign: any }) {
  const [activeTab, setActiveTab] = useState<"messages" | "replies">(
    "messages",
  );

  const stats = [
    {
      label: "Total",
      value: campaign.totalCount,
      icon: Users,
      color: "text-gray-600",
    },
    {
      label: "Sent",
      value: campaign.sentCount,
      icon: Send,
      color: "text-blue-600",
    },
    {
      label: "Delivered",
      value: campaign.deliveredCount,
      icon: CheckCheck,
      color: "text-green-600",
    },
    {
      label: "Read",
      value: campaign.readCount,
      icon: Eye,
      color: "text-purple-600",
    },
    {
      label: "Failed",
      value: campaign.failedCount,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      label: "Replied",
      value: campaign.repliedCount,
      icon: MessageCircle,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Campaign header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-base">{campaign.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {campaign.template?.displayName ||
                campaign.templateSnapshot?.displayName}{" "}
              ·{" "}
              {campaign.sentAt
                ? format(new Date(campaign.sentAt), "dd MMM yyyy, h:mm a")
                : "Not sent"}
            </p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[campaign.status] || "bg-gray-100 text-gray-700"}`}
          >
            {campaign.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-1 mt-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {campaign.totalCount > 0 && (
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 h-full"
              style={{
                width: `${(campaign.sentCount / campaign.totalCount) * 100}%`,
              }}
            />
            <div
              className="bg-green-500 h-full"
              style={{
                width: `${(campaign.deliveredCount / campaign.totalCount) * 100}%`,
              }}
            />
            <div
              className="bg-purple-500 h-full"
              style={{
                width: `${(campaign.readCount / campaign.totalCount) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        {[
          { id: "messages", label: "Messages" },
          { id: "replies", label: `Replies (${campaign.repliedCount || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-green-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "messages" && (
          <div className="divide-y divide-border">
            {(campaign.messages || []).map((msg: any) => (
              <div key={msg._id} className="flex items-center gap-3 px-5 py-3">
                <MessageStatusIcon status={msg.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{msg.leadName}</p>
                  <p className="text-xs text-muted-foreground">
                    {msg.leadCompany} · {msg.phone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <MessageStatusBadge status={msg.status} />
                  {msg.sentAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(msg.sentAt), "h:mm a")}
                    </p>
                  )}
                  {msg.failedReason && (
                    <p className="text-[10px] text-red-500 mt-0.5 max-w-28 truncate">
                      {msg.failedReason}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {(!campaign.messages || campaign.messages.length === 0) && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No messages
              </div>
            )}
          </div>
        )}

        {activeTab === "replies" && (
          <div className="divide-y divide-border">
            {(campaign.replies || []).map((r: any) => (
              <div key={r._id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{r.leadName || r.phone}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(r.receivedAt), "dd MMM, h:mm a")}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-gray-800">
                  {r.messageText}
                </div>
              </div>
            ))}
            {(!campaign.replies || campaign.replies.length === 0) && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No replies yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: string }) {
  const map: Record<string, React.ReactNode> = {
    PENDING: <Clock className="w-4 h-4 text-muted-foreground" />,
    SENT: <Send className="w-4 h-4 text-blue-500" />,
    DELIVERED: <CheckCheck className="w-4 h-4 text-green-500" />,
    READ: <Eye className="w-4 h-4 text-purple-500" />,
    FAILED: <XCircle className="w-4 h-4 text-red-500" />,
  };
  return (
    <>{map[status] || <Clock className="w-4 h-4 text-muted-foreground" />}</>
  );
}

function MessageStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700",
    READ: "bg-purple-100 text-purple-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}
