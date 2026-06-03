import { AppLayout } from "@/components/layout/AppLayout";
import { campaignAPI, whatsappAPI, leadsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  MessageSquare,
  Check,
  Info,
  AlertCircle,
  Search,
  RefreshCw,
  PlayCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface Template {
  _id: string;
  name: string;
  displayName: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  variables?: string[];
  language?: string;
}

interface PhoneNumber {
  phoneNumberId: string;
  label?: string;
  businessName?: string;
  phoneNumber?: string;
}

const LEAD_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "1-3", label: "1-3 (Follow-up)" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "WON", label: "Won" },
  { value: "DROP", label: "Drop" },
];

const LEAD_SOURCES = [
  { value: "IndiaMART", label: "IndiaMART" },
  { value: "TradeIndia", label: "TradeIndia" },
  { value: "Justdial", label: "Justdial" },
  { value: "Website", label: "Website" },
  { value: "Facebook", label: "Facebook" },
  { value: "Manual", label: "Manual" },
];

const VARIABLE_FIELDS = [
  { value: "name", label: "Contact Name" },
  { value: "company", label: "Company" },
  { value: "phone", label: "Phone" },
  { value: "location", label: "Location" },
  { value: "requirement", label: "Requirement" },
  { value: "budget", label: "Budget" },
  { value: "custom", label: "Custom Text" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampaignBuilderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);

  // Step 1 — Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 — Audience
  const [targetType, setTargetType] = useState<"ALL_LEADS" | "SEGMENT">("ALL_LEADS");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<{ count: number; preview: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 3 — Template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [variableMapping, setVariableMapping] = useState<Array<{ position: number; fieldKey: string; customValue: string }>>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");

  // Step 4 — Review
  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  // Load templates + phone config
  useEffect(() => {
    const load = async () => {
      setTemplatesLoading(true);
      try {
        const [tplRes, cfgRes] = await Promise.all([
          whatsappAPI.getTemplates(),
          whatsappAPI.getConfig(),
        ]);
        setTemplates(tplRes.data || []);
        const numbers = cfgRes.data?.phoneNumbers || [];
        setPhoneNumbers(numbers);
        if (numbers.length === 1) setSelectedPhoneNumberId(numbers[0].phoneNumberId);
      } catch {
        // WhatsApp may not be configured — silent
      } finally {
        setTemplatesLoading(false);
      }
    };
    load();
  }, []);

  // Auto-initialize variable mapping when template changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const varCount = (selectedTemplate.bodyText?.match(/\{\{(\d+)\}\}/g) || []).length;
    setVariableMapping(
      Array.from({ length: varCount }, (_, i) => ({
        position: i + 1,
        fieldKey: i === 0 ? "name" : "company",
        customValue: "",
      })),
    );
  }, [selectedTemplateId]);

  // Load existing campaign if editing
  useEffect(() => {
    if (!isEdit) return;
    campaignAPI.getById(id!).then((res) => {
      const c = res.data;
      setName(c.name || "");
      setDescription(c.description || "");
      setTargetType(c.audience?.targetType || "ALL_LEADS");
      setSelectedStatuses(c.audience?.filters?.leadStatus || []);
      setSelectedSources(c.audience?.filters?.leadSource || []);
      setSelectedTemplateId(c.whatsapp?.templateId || "");
      setVariableMapping(c.whatsapp?.variableMapping || []);
      setSelectedPhoneNumberId(c.whatsapp?.phoneNumberId || "");
    }).catch(() => {
      toast({ title: "Failed to load campaign", variant: "destructive" });
    }).finally(() => setLoadingInitial(false));
  }, [id, isEdit]);

  const handlePreviewAudience = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await campaignAPI.resolveAudience({
        targetType,
        filters: {
          leadStatus: selectedStatuses,
          leadSource: selectedSources,
        },
      });
      setAudiencePreview(res.data);
    } catch {
      // silent
    } finally {
      setPreviewLoading(false);
    }
  }, [targetType, selectedStatuses, selectedSources]);

  useEffect(() => {
    if (step === 2) handlePreviewAudience();
  }, [step]);

  const toggleStatus = (v: string) =>
    setSelectedStatuses((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const toggleSource = (v: string) =>
    setSelectedSources((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const handleSave = async (launch = false) => {
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        type: "WHATSAPP",
        audience: {
          targetType,
          filters: {
            leadStatus: selectedStatuses,
            leadSource: selectedSources,
          },
        },
        whatsapp: {
          templateId: selectedTemplateId || undefined,
          variableMapping,
          phoneNumberId: selectedPhoneNumberId || undefined,
        },
      };

      let campaignId: string;

      if (isEdit) {
        const res = await campaignAPI.update(id!, payload);
        campaignId = res.data._id;
        toast({ title: "Campaign updated" });
      } else {
        const res = await campaignAPI.create(payload);
        campaignId = res.data._id;
        toast({ title: "Campaign saved as Draft" });
      }

      if (launch && isAdmin) {
        await campaignAPI.launch(campaignId);
        toast({ title: "Campaign launched!", description: "Messages are being sent." });
      }

      navigate("/campaigns");
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <AppLayout title="Campaign Builder">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const canNext =
    (step === 1 && name.trim()) ||
    (step === 2) ||
    (step === 3 && selectedTemplateId) ||
    step === 4;

  return (
    <AppLayout title={isEdit ? "Edit Campaign" : "New Campaign"}>
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{isEdit ? "Edit Campaign" : "New Campaign"}</h1>
            <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-3">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-orange-500" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Step labels */}
        <div className="grid grid-cols-4 px-6 pt-1 pb-3 text-center">
          {["Basics", "Audience", "Template", "Review"].map((label, i) => (
            <span
              key={label}
              className={`text-[10px] font-medium ${i + 1 === step ? "text-orange-600" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* ─── Step 1: Basics ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <Label>Campaign Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. May Followup Blast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder="What's this campaign about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg flex gap-3">
                <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  You'll choose your audience and WhatsApp template in the next steps.
                  The campaign will be saved as a <strong>Draft</strong> until you launch it.
                </p>
              </div>
            </>
          )}

          {/* ─── Step 2: Audience ─────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <Label className="mb-2 block">Target Type</Label>
                <div className="flex gap-3">
                  {[
                    { id: "ALL_LEADS", label: "All Leads", desc: "Send to every lead in the system" },
                    { id: "SEGMENT", label: "Filtered Segment", desc: "Apply status / source filters" },
                  ].map(({ id, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setTargetType(id as any)}
                      className={`flex-1 text-left p-3 rounded-xl border-2 transition-all ${targetType === id ? "border-orange-400 bg-orange-50" : "border-border hover:border-muted-foreground/30"}`}
                    >
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {targetType === "SEGMENT" && (
                <>
                  <div>
                    <Label className="mb-2 block">Lead Status</Label>
                    <div className="flex flex-wrap gap-2">
                      {LEAD_STATUSES.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => toggleStatus(value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedStatuses.includes(value) ? "border-orange-400 bg-orange-50 text-orange-700" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
                        >
                          {selectedStatuses.includes(value) && <Check className="w-3 h-3 inline mr-1" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Lead Source</Label>
                    <div className="flex flex-wrap gap-2">
                      {LEAD_SOURCES.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => toggleSource(value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedSources.includes(value) ? "border-blue-400 bg-blue-50 text-blue-700" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
                        >
                          {selectedSources.includes(value) && <Check className="w-3 h-3 inline mr-1" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Audience preview */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Audience Preview</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePreviewAudience} disabled={previewLoading}>
                    {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </Button>
                </div>
                {previewLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : audiencePreview ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                      <Users className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-bold text-orange-700">{audiencePreview.count}</span>
                      <span className="text-sm text-orange-600">contacts will receive this campaign</span>
                    </div>
                    {audiencePreview.preview.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Sample contacts</p>
                        {audiencePreview.preview.map((contact, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                              {contact.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium">{contact.name}</span>
                            {contact.company && <span className="text-muted-foreground">· {contact.company}</span>}
                            <span className="ml-auto font-mono text-muted-foreground">{contact.phone}</span>
                          </div>
                        ))}
                        {audiencePreview.count > 5 && (
                          <p className="text-[11px] text-muted-foreground text-center pt-1">
                            +{audiencePreview.count - 5} more contacts
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Click refresh to preview audience</p>
                )}
              </div>
            </>
          )}

          {/* ─── Step 3: Template ─────────────────────────────────────── */}
          {step === 3 && (
            <>
              {templatesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
                  <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-700">
                    <p className="font-semibold mb-1">No WhatsApp templates found</p>
                    <p>Go to <strong>WhatsApp → Setup</strong> to sync your approved Meta templates first.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="mb-2 block">Select Template <span className="text-red-500">*</span></Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {templates.map((t) => (
                        <button
                          key={t._id}
                          onClick={() => setSelectedTemplateId(t._id)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedTemplateId === t._id ? "border-orange-400 bg-orange-50" : "border-border hover:border-muted-foreground/30"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold">{t.displayName || t.name}</p>
                            {selectedTemplateId === t._id && (
                              <Check className="w-4 h-4 text-orange-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{t.bodyText}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Variable mapping */}
                  {variableMapping.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Variable Mapping</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Map each template variable to a contact field.
                      </p>
                      <div className="space-y-2">
                        {variableMapping.map((vm, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16 shrink-0">
                              {"{{"}
                              {vm.position}
                              {"}}"}
                            </span>
                            <Select
                              value={vm.fieldKey}
                              onValueChange={(v) =>
                                setVariableMapping((prev) =>
                                  prev.map((x, j) => j === i ? { ...x, fieldKey: v } : x),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VARIABLE_FIELDS.map((f) => (
                                  <SelectItem key={f.value} value={f.value} className="text-xs">
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {vm.fieldKey === "custom" && (
                              <Input
                                placeholder="Custom text..."
                                value={vm.customValue}
                                onChange={(e) =>
                                  setVariableMapping((prev) =>
                                    prev.map((x, j) => j === i ? { ...x, customValue: e.target.value } : x),
                                  )
                                }
                                className="h-8 text-xs flex-1"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phone number selection */}
                  {phoneNumbers.length > 1 && (
                    <div>
                      <Label className="mb-2 block">Send From <span className="text-red-500">*</span></Label>
                      <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select a phone number..." />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneNumbers.map((pn) => (
                            <SelectItem key={pn.phoneNumberId} value={pn.phoneNumberId}>
                              {pn.label || pn.businessName || pn.phoneNumber || pn.phoneNumberId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ─── Step 4: Review ───────────────────────────────────────── */}
          {step === 4 && (
            <>
              <p className="text-sm font-semibold">Campaign Summary</p>

              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <ReviewRow label="Name" value={name} />
                {description && <ReviewRow label="Description" value={description} />}
                <ReviewRow
                  label="Audience"
                  value={
                    targetType === "ALL_LEADS"
                      ? "All Leads"
                      : `Filtered: ${[
                          selectedStatuses.length ? `${selectedStatuses.length} statuses` : "",
                          selectedSources.length ? `${selectedSources.length} sources` : "",
                        ].filter(Boolean).join(", ") || "No filters"}`
                  }
                />
                {audiencePreview && (
                  <ReviewRow label="Est. Contacts" value={String(audiencePreview.count)} />
                )}
                <ReviewRow
                  label="Template"
                  value={selectedTemplate ? (selectedTemplate.displayName || selectedTemplate.name) : "Not selected"}
                />
                {variableMapping.length > 0 && (
                  <ReviewRow
                    label="Variables"
                    value={variableMapping.map((v) => `{{${v.position}}} → ${v.fieldKey}`).join(", ")}
                  />
                )}
              </div>

              {/* Template preview */}
              {selectedTemplate && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Message Preview</p>
                  <div className="bg-[#ECE5DD] rounded-xl p-4">
                    <div className="bg-white rounded-xl p-3 max-w-xs shadow-sm text-xs text-gray-800 whitespace-pre-wrap">
                      {selectedTemplate.headerText && (
                        <p className="font-bold mb-1">{selectedTemplate.headerText}</p>
                      )}
                      <p>{selectedTemplate.bodyText}</p>
                      {selectedTemplate.footerText && (
                        <p className="text-gray-400 mt-1 text-[10px]">{selectedTemplate.footerText}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Save as <strong>Draft</strong> to review later, or{" "}
                  <strong>Save & Launch</strong> to start sending immediately.
                  Once launched, messages cannot be recalled.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : navigate("/campaigns")}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          <div className="flex gap-2">
            {step === 4 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Save Draft
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                    onClick={() => handleSave(true)}
                    disabled={saving || !selectedTemplateId}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <PlayCircle className="w-4 h-4 mr-1" />
                    )}
                    Save & Launch
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={!canNext}
                onClick={() => setStep((s) => (s + 1) as Step)}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
