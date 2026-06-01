import { AppLayout } from "@/components/layout/AppLayout";
import { whatsappAPI } from "@/services/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
  CheckCheck,
  Eye,
  Send,
  XCircle,
  MessageCircle,
  Users,
  RefreshCw,
  Copy,
  Check,
  Info,
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  ImageIcon,
  UploadCloud,
  X,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Template {
  _id: string;
  name: string;
  displayName: string;
  bodyText: string;
  headerType?: string;
  headerText?: string;
  headerMediaId?: string;
  headerMediaName?: string;
  footerText?: string;
  category: string;
  language: string;
  variableCount: number;
  status: string;
  metaTemplateName?: string;
  notes?: string;
  createdAt: string;
  createdBy?: { name: string };
  buttons?: {
    type: string;
    text: string;
    url?: string;
    phoneNumber?: string;
  }[];
}

interface Campaign {
  _id: string;
  name: string;
  status: string;
  templateSnapshot?: { displayName: string };
  template?: { displayName: string };
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  createdAt: string;
  sentAt?: string;
}

interface Reply {
  _id: string;
  campaignId: string;
  campaignName: string;
  leadName?: string;
  phone: string;
  messageText: string;
  receivedAt: string;
}

const EMPTY_TEMPLATE = {
  displayName: "",
  name: "",
  category: "MARKETING",
  language: "en",
  headerType: "NONE",
  headerText: "",
  headerMediaId: "",
  headerMediaName: "",
  bodyText: "",
  footerText: "",
  metaTemplateName: "",
  status: "DRAFT",
  notes: "",
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  PENDING: "bg-orange-100 text-orange-700 border-orange-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  SENDING: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  DRAFT: "bg-gray-100 text-gray-600",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function WhatsappSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "connection" | "templates" | "analytics" | "replies"
  >("connection");

  return (
    <AppLayout title="WhatsApp Setup">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-black bg-white">
          <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 border-2 border-[#25D366]/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faWhatsapp} className="text-[#25D366] text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold">WhatsApp Setup</h1>
            <p className="text-xs text-muted-foreground">
              Connection, templates & campaign analytics
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border px-6 bg-background">
          {[
            { id: "connection", label: "Connection" },
            { id: "templates", label: "Templates" },
            { id: "analytics", label: "Campaign Analytics" },
            { id: "replies", label: "Replies" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-green-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "connection" && <ConnectionTab toast={toast} />}
          {activeTab === "templates" && <TemplatesTab toast={toast} />}
          {activeTab === "analytics" && <AnalyticsTab toast={toast} />}
          {activeTab === "replies" && <RepliesTab toast={toast} />}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab({ toast }: { toast: any }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<any>(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getTemplates();
      setTemplates(res.data);
    } catch {
      toast({ title: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
    setFormOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      displayName: t.displayName,
      name: t.name,
      category: t.category,
      language: t.language,
      headerType: t.headerType || "NONE",
      headerText: t.headerText || "",
      headerMediaId: t.headerMediaId || "",
      headerMediaName: t.headerMediaName || "",
      bodyText: t.bodyText,
      footerText: t.footerText || "",
      metaTemplateName: t.metaTemplateName || "",
      status: t.status,
      notes: t.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (
      !form.displayName.trim() ||
      !form.bodyText.trim() ||
      !form.name.trim()
    ) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await whatsappAPI.updateTemplate(editing._id, form);
        toast({ title: "Template updated" });
      } else {
        await whatsappAPI.createTemplate(form);
        toast({ title: "Template created" });
      }
      setFormOpen(false);
      await fetchTemplates();
    } catch (err: any) {
      toast({
        title: "Failed to save template",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await whatsappAPI.deleteTemplate(deleteId);
      toast({ title: "Template deleted" });
      setDeleteId(null);
      await fetchTemplates();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Auto-generate name from displayName
  const handleDisplayNameChange = (val: string) => {
    const autoName = val
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    setForm((f: any) => ({
      ...f,
      displayName: val,
      name: editing ? f.name : autoName,
      metaTemplateName: editing ? f.metaTemplateName : autoName,
    }));
  };

  const handleMediaUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await whatsappAPI.uploadMedia(file);
      setForm((f: any) => ({
        ...f,
        headerMediaId: res.data.mediaId,
        headerMediaName: res.data.filename,
      }));
      toast({ title: "File uploaded", description: res.data.filename });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-base">WhatsApp Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage message templates. Templates must be approved in
            Meta Business Manager before use.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTemplates}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-1" /> New Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No templates yet. Create your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t._id}
              template={t}
              onEdit={() => openEdit(t)}
              onDelete={() => setDeleteId(t._id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Display Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Diwali Offer"
                  value={form.displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>
                  Template ID (Meta Name){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. diwali_offer"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f: any) => ({
                      ...f,
                      name: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, ""),
                    }))
                  }
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Lowercase, numbers, underscores only. Must match your Meta
                  template name exactly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f: any) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">
                      Authentication
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) =>
                    setForm((f: any) => ({ ...f, language: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="en_IN">English (India)</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="gu">Gujarati</SelectItem>
                    <SelectItem value="mr">Marathi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f: any) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Header section */}
            <div className="space-y-3">
              <div>
                <Label>
                  Header Type{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Select
                  value={form.headerType}
                  onValueChange={(v) =>
                    setForm((f: any) => ({
                      ...f,
                      headerType: v,
                      headerText: "",
                      headerMediaId: "",
                      headerMediaName: "",
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="DOCUMENT">Document (PDF)</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.headerType === "TEXT" && (
                <Input
                  placeholder="Header text..."
                  value={form.headerText}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, headerText: e.target.value }))
                  }
                />
              )}

              {(form.headerType === "DOCUMENT" ||
                form.headerType === "IMAGE") && (
                <div>
                  {form.headerMediaId ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      {form.headerType === "DOCUMENT" ? (
                        <FileText className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-green-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 truncate">
                          {form.headerMediaName}
                        </p>
                        <p className="text-xs text-green-600 font-mono truncate">
                          ID: {form.headerMediaId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() =>
                          setForm((f: any) => ({
                            ...f,
                            headerMediaId: "",
                            headerMediaName: "",
                          }))
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${uploading ? "opacity-60 pointer-events-none" : "hover:border-green-400 hover:bg-green-50/30"}`}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          form.headerType === "DOCUMENT"
                            ? ".pdf,application/pdf"
                            : "image/jpeg,image/png,image/webp"
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file);
                          e.target.value = "";
                        }}
                      />
                      {uploading ? (
                        <Loader2 className="w-7 h-7 text-green-500 animate-spin mb-2" />
                      ) : (
                        <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
                      )}
                      <p className="text-sm font-medium text-muted-foreground">
                        {uploading
                          ? "Uploading to WhatsApp..."
                          : `Click to upload ${form.headerType === "DOCUMENT" ? "PDF" : "image"}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.headerType === "DOCUMENT"
                          ? "PDF only, max 16MB"
                          : "JPEG, PNG, WEBP, max 16MB"}
                      </p>
                    </label>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    File is uploaded directly to your WhatsApp media library.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>
                Body Text <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={
                  "Hello {{1}},\n\nWe have an exciting offer for {{2}}!\n\nContact us to know more."
                }
                value={form.bodyText}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, bodyText: e.target.value }))
                }
                rows={5}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">{"{{1}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded">{"{{2}}"}</code>, etc.
                for dynamic variables (e.g. lead name, company).
              </p>
            </div>

            <div>
              <Label>
                Footer Text{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                placeholder="e.g. Reply STOP to unsubscribe"
                value={form.footerText}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, footerText: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>
                Internal Notes{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                placeholder="Notes for your team about this template..."
                value={form.notes}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                className="mt-1 text-sm"
              />
            </div>

            {/* Live preview */}
            <div>
              <Label className="mb-2 block">Preview</Label>
              <div className="bg-[#e5ddd5] rounded-xl p-4">
                <div className="bg-white rounded-lg p-3 shadow-sm max-w-xs ml-auto">
                  {form.headerType === "TEXT" && form.headerText && (
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                      {form.headerText}
                    </p>
                  )}
                  {form.headerType === "DOCUMENT" && (
                    <div
                      className={`flex items-center gap-2 p-2 rounded mb-2 ${form.headerMediaId ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-dashed border-gray-300"}`}
                    >
                      <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">
                        {form.headerMediaName || "PDF document"}
                      </span>
                    </div>
                  )}
                  {form.headerType === "IMAGE" && (
                    <div
                      className={`flex items-center justify-center h-20 rounded mb-2 ${form.headerMediaId ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-dashed border-gray-300"}`}
                    >
                      <ImageIcon
                        className={`w-8 h-8 ${form.headerMediaId ? "text-green-400" : "text-gray-300"}`}
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {form.bodyText || (
                      <span className="text-gray-400 italic">
                        Body text here...
                      </span>
                    )}
                  </p>
                  {form.footerText && (
                    <p className="text-xs text-gray-500 mt-1">
                      {form.footerText}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 text-right">
                    Preview
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Campaigns that used this template
              will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{template.displayName}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {template.name}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {template.category}
            </Badge>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[template.status] || "bg-gray-100 text-gray-600"}`}
            >
              {template.status}
            </span>
            {template.variableCount > 0 && (
              <span className="text-[10px] text-blue-600">
                {template.variableCount} var
                {template.variableCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {template.bodyText}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8 p-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 p-0"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Full Body
              </p>
              <p className="text-sm whitespace-pre-wrap font-mono bg-white p-3 rounded border border-border">
                {template.bodyText}
              </p>
              {template.notes && (
                <div className="mt-2 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {template.notes}
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                WhatsApp Preview
              </p>
              <div className="bg-[#e5ddd5] rounded-xl p-3">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  {template.headerType === "TEXT" && template.headerText && (
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                      {template.headerText}
                    </p>
                  )}
                  {template.headerType === "DOCUMENT" && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded mb-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">
                        {template.headerMediaName || "PDF document"}
                      </span>
                    </div>
                  )}
                  {template.headerType === "IMAGE" && (
                    <div className="flex items-center justify-center h-16 bg-green-50 border border-green-200 rounded mb-2">
                      <ImageIcon className="w-6 h-6 text-green-400" />
                    </div>
                  )}
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {template.bodyText}
                  </p>
                  {template.footerText && (
                    <p className="text-xs text-gray-500 mt-1">
                      {template.footerText}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Created {format(new Date(template.createdAt), "dd MMM yyyy")}
                {template.createdBy && ` by ${template.createdBy.name}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ toast }: { toast: any }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setCampaigns(res.data);
    } catch {
      toast({ title: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const viewDetail = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const res = await whatsappAPI.getCampaign(id);
      setDetail(res.data);
    } catch {
      toast({
        title: "Failed to load campaign detail",
        variant: "destructive",
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-base">Campaign Analytics</h2>
        <Button variant="outline" size="sm" onClick={fetchCampaigns}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Send one from <strong>WhatsApp Messaging</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const isOpen = selectedId === c._id;
            const deliveryRate =
              c.totalCount > 0
                ? Math.round((c.deliveredCount / c.totalCount) * 100)
                : 0;
            const readRate =
              c.totalCount > 0
                ? Math.round((c.readCount / c.totalCount) * 100)
                : 0;

            return (
              <div
                key={c._id}
                className="border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => viewDetail(c._id)}
                  className="w-full text-left px-5 py-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.name}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAMPAIGN_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.template?.displayName ||
                          c.templateSnapshot?.displayName}{" "}
                        ·{" "}
                        {c.sentAt
                          ? format(new Date(c.sentAt), "dd MMM yyyy, h:mm a")
                          : format(new Date(c.createdAt), "dd MMM yyyy")}
                      </p>

                      {/* Mini stats row */}
                      <div className="flex items-center gap-4 mt-2">
                        <StatPill
                          icon={Users}
                          value={c.totalCount}
                          label="Total"
                          color="text-gray-600"
                        />
                        <StatPill
                          icon={Send}
                          value={c.sentCount}
                          label="Sent"
                          color="text-blue-600"
                        />
                        <StatPill
                          icon={CheckCheck}
                          value={c.deliveredCount}
                          label="Delivered"
                          color="text-green-600"
                        />
                        <StatPill
                          icon={Eye}
                          value={c.readCount}
                          label="Read"
                          color="text-purple-600"
                        />
                        <StatPill
                          icon={XCircle}
                          value={c.failedCount}
                          label="Failed"
                          color="text-red-500"
                        />
                        <StatPill
                          icon={MessageCircle}
                          value={c.repliedCount}
                          label="Replies"
                          color="text-orange-500"
                        />
                      </div>

                      {/* Progress bar */}
                      {c.totalCount > 0 && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{
                              width: `${(c.sentCount / c.totalCount) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{
                              width: `${(c.deliveredCount / c.totalCount) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-purple-500 h-full transition-all"
                            style={{
                              width: `${(c.readCount / c.totalCount) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-red-400 h-full transition-all"
                            style={{
                              width: `${(c.failedCount / c.totalCount) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">
                        {deliveryRate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        delivered
                      </p>
                      <p className="text-sm font-semibold text-purple-600 mt-1">
                        {readRate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">read</p>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-5 py-4">
                    {loadingDetail ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : detail ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b border-border">
                              <th className="text-left pb-2 pr-4">Lead</th>
                              <th className="text-left pb-2 pr-4">Phone</th>
                              <th className="text-left pb-2 pr-4">Status</th>
                              <th className="text-left pb-2">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(detail.messages || []).map((msg: any) => (
                              <tr key={msg._id} className="text-sm">
                                <td className="py-2 pr-4">
                                  <p className="font-medium">{msg.leadName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {msg.leadCompany}
                                  </p>
                                </td>
                                <td className="py-2 pr-4 text-xs text-muted-foreground font-mono">
                                  {msg.phone}
                                </td>
                                <td className="py-2 pr-4">
                                  <MsgStatusBadge status={msg.status} />
                                  {msg.failedReason && (
                                    <p className="text-[10px] text-red-500 mt-0.5">
                                      {msg.failedReason}
                                    </p>
                                  )}
                                </td>
                                <td className="py-2 text-xs text-muted-foreground">
                                  {msg.readAt
                                    ? format(new Date(msg.readAt), "h:mm a")
                                    : msg.deliveredAt
                                      ? format(
                                          new Date(msg.deliveredAt),
                                          "h:mm a",
                                        )
                                      : msg.sentAt
                                        ? format(new Date(msg.sentAt), "h:mm a")
                                        : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: any;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function MsgStatusBadge({ status }: { status: string }) {
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

// ─── Replies Tab ──────────────────────────────────────────────────────────────
function RepliesTab({ toast }: { toast: any }) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getReplies();
      setReplies(res.data);
    } catch {
      toast({ title: "Failed to load replies", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-base">Incoming Replies</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Replies received from leads via WhatsApp webhook.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReplies}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No replies yet. Replies will appear here when leads respond to your
            campaigns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map((r) => (
            <div
              key={r._id}
              className="border border-border rounded-xl px-5 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {r.leadName || r.phone}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {r.phone}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Campaign:{" "}
                    <span className="font-medium">{r.campaignName}</span>
                  </p>
                  <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-800">{r.messageText}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(r.receivedAt), "dd MMM, h:mm a")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connection Tab ────────────────────────────────────────────────────────────
function ConnectionTab({ toast }: { toast: any }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Step 1: setup access token
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupForm, setSetupForm] = useState({ accessToken: "", wabaId: "" });

  // Step 2: add phone number
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [addForm, setAddForm] = useState({ phoneNumberId: "", label: "", businessName: "", phoneNumber: "" });

  const [removingId, setRemovingId] = useState<string | null>(null);

  const webhookUrl = `https://leads-backend.pixelatenest.com/api/whatsapp/webhook`;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getStatus();
      setStatus(res.data);
    } catch {
      toast({ title: "Failed to load WhatsApp status", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSetup = async () => {
    if (!setupForm.accessToken.trim()) {
      toast({ title: "Access Token is required", variant: "destructive" });
      return;
    }
    setSetupSaving(true);
    try {
      await whatsappAPI.setup({ accessToken: setupForm.accessToken, wabaId: setupForm.wabaId });
      toast({ title: "Access token saved. Now add your phone number(s)." });
      setSetupOpen(false);
      setSetupForm({ accessToken: "", wabaId: "" });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setSetupSaving(false);
    }
  };

  const handleAddPhone = async () => {
    if (!addForm.phoneNumberId.trim()) {
      toast({ title: "Phone Number ID is required", variant: "destructive" });
      return;
    }
    setAddingSaving(true);
    try {
      await whatsappAPI.addPhoneNumber(addForm);
      toast({ title: "Phone number added" });
      setAddPhoneOpen(false);
      setAddForm({ phoneNumberId: "", label: "", businessName: "", phoneNumber: "" });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: "Failed to add number", description: err.message, variant: "destructive" });
    } finally {
      setAddingSaving(false);
    }
  };

  const handleRemovePhone = async (phoneNumberId: string) => {
    setRemovingId(phoneNumberId);
    try {
      await whatsappAPI.removePhoneNumber(phoneNumberId);
      toast({ title: "Phone number removed" });
      await fetchStatus();
    } catch {
      toast({ title: "Failed to remove number", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await whatsappAPI.disconnect();
      toast({ title: "WhatsApp disconnected" });
      await fetchStatus();
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const res = await whatsappAPI.syncTemplates();
      toast({ title: res.message });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const phoneNumbers: any[] = status?.phoneNumbers || [];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="font-semibold text-base">WhatsApp Business Connection</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          One access token, multiple phone numbers — each from the same WABA.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Step 1 — Access Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${status?.isConnected ? "bg-green-500 text-white" : "bg-muted text-muted-foreground border"}`}>
                  {status?.isConnected ? <Check className="w-3 h-3" /> : "1"}
                </div>
                <span className="text-sm font-medium">Access Token & WABA</span>
              </div>
              <div className="flex gap-2">
                {status?.isConnected ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleSyncTemplates} disabled={syncing} className="text-xs h-7">
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync Templates
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSetupOpen(true)} className="text-xs h-7">
                      Update Token
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      Disconnect All
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-7" onClick={() => setSetupOpen(true)}>
                    Set Up Access Token
                  </Button>
                )}
              </div>
            </div>

            {status?.isConnected && status?.wabaId && (
              <div className="ml-7 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700">
                  <span className="font-medium">WABA ID:</span>{" "}
                  <span className="font-mono">{status.wabaId}</span>
                </p>
              </div>
            )}
          </div>

          {/* Step 2 — Phone Numbers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${phoneNumbers.length > 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground border"}`}>
                  {phoneNumbers.length > 0 ? <Check className="w-3 h-3" /> : "2"}
                </div>
                <span className="text-sm font-medium">
                  Phone Numbers
                  {phoneNumbers.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">({phoneNumbers.length} connected)</span>
                  )}
                </span>
              </div>
              {status?.isConnected && (
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAddPhoneOpen(true)}>
                  <Plus className="w-3 h-3" /> Add Number
                </Button>
              )}
            </div>

            {phoneNumbers.length === 0 ? (
              <div className="ml-7 border border-dashed border-border rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {status?.isConnected ? "No phone numbers added yet. Click \"Add Number\" to add your first." : "Set up access token first."}
                </p>
              </div>
            ) : (
              <div className="ml-7 space-y-2">
                {phoneNumbers.map((p: any) => (
                  <div key={p.phoneNumberId} className="flex items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.label || p.businessName || "WhatsApp Number"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.phoneNumber || p.phoneNumberId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      <button
                        onClick={() => handleRemovePhone(p.phoneNumberId)}
                        disabled={removingId === p.phoneNumberId}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      >
                        {removingId === p.phoneNumberId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Webhook Configuration</h3>
            <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Callback URL for Meta → WhatsApp → Configuration:</p>
                <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  <code className="text-xs font-mono flex-1 truncate">{webhookUrl}</code>
                  <button onClick={() => copy(webhookUrl, "webhook")} className="text-muted-foreground hover:text-foreground shrink-0">
                    {copied === "webhook" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {status?.webhookVerifyToken && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Verify Token:</p>
                  <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                    <code className="text-xs font-mono flex-1 truncate">{status.webhookVerifyToken}</code>
                    <button onClick={() => copy(status.webhookVerifyToken, "vtoken")} className="text-muted-foreground hover:text-foreground shrink-0">
                      {copied === "vtoken" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                Subscribe to <strong className="mx-0.5">messages</strong> and <strong className="mx-0.5">message_status_updates</strong> fields.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Setup access token dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{status?.isConnected ? "Update Access Token" : "Set Up WhatsApp Business"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Step 1 of 2:</strong> Enter your Meta System User access token. This is shared across all your phone numbers under the same WABA.
              </p>
            </div>
            <div>
              <Label>Access Token <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                placeholder="EAAxxxxx... (permanent system user token)"
                value={setupForm.accessToken}
                onChange={(e) => setSetupForm((f) => ({ ...f, accessToken: e.target.value.trim() }))}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Meta Business Manager → System Users → Generate Token → select <code className="bg-muted px-1 rounded">whatsapp_business_messaging</code>
              </p>
            </div>
            <div>
              <Label>WABA ID <span className="text-muted-foreground text-xs">(required for template sync)</span></Label>
              <Input
                placeholder="WhatsApp Business Account ID"
                value={setupForm.wabaId}
                onChange={(e) => setSetupForm((f) => ({ ...f, wabaId: e.target.value.trim() }))}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Meta Business Manager → WhatsApp Accounts → copy the Account ID</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button onClick={handleSetup} disabled={setupSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {setupSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add phone number dialog */}
      <Dialog open={addPhoneOpen} onOpenChange={setAddPhoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Step 2:</strong> Add a phone number from your WABA. You can add multiple numbers — same access token works for all.
              </p>
            </div>
            <div>
              <Label>Phone Number ID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 123456789012345"
                value={addForm.phoneNumberId}
                onChange={(e) => setAddForm((f) => ({ ...f, phoneNumberId: e.target.value.trim() }))}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Meta Developer Console → WhatsApp → API Setup → Phone Number ID</p>
            </div>
            <div>
              <Label>Label <span className="text-muted-foreground text-xs">(helps identify which number)</span></Label>
              <Input
                placeholder='e.g. "Company A", "Sales", "Support"'
                value={addForm.label}
                onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Display Number</Label>
                <Input placeholder="+91 98001 00001" value={addForm.phoneNumber} onChange={(e) => setAddForm((f) => ({ ...f, phoneNumber: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div>
                <Label>Business Name</Label>
                <Input placeholder="Company A" value={addForm.businessName} onChange={(e) => setAddForm((f) => ({ ...f, businessName: e.target.value }))} className="mt-1 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPhoneOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPhone} disabled={addingSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {addingSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Add Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
