import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VaultDocPicker } from "@/components/documents/VaultDocPicker";
import { useToast } from "@/hooks/use-toast";
import { whatsappAPI } from "@/services/api";
import { mappingFromNotes } from "@/config/whatsappTemplateLibrary";

interface Template {
  _id: string;
  name: string;
  displayName: string;
  bodyText: string;
  headerType?: string;
  variableCount: number;
  status: string;
  notes?: string;
}

type Mapping = { position: number; fieldKey: string; customValue: string };

const FIELDS = [
  { key: "name", label: "Lead Name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "requirement", label: "Requirement" },
  { key: "budget", label: "Budget" },
  { key: "custom", label: "Custom Value" },
];

const hasFileHeader = (t?: Template | null) =>
  !!t && ["DOCUMENT", "IMAGE"].includes(t.headerType || "");

/**
 * Select leads → Send WhatsApp → pick an approved template → (if the template's
 * header is a document/image) pick the file from the Document Vault → send.
 * Uses the same campaign endpoint as the full wizard, so delivery tracking shows
 * up under WhatsApp → Campaigns / Logs.
 */
export function SendWhatsAppDialog({
  open,
  onOpenChange,
  leads,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leads: any[];
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [senderId, setSenderId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [sending, setSending] = useState(false);

  const template = templates.find((t) => t._id === templateId) || null;
  const sendable = useMemo(
    () => leads.filter((l) => String(l.phone || "").replace(/\D/g, "").length >= 10),
    [leads],
  );

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setMapping([]);
    setDocumentId("");
    setLoading(true);
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([t, s]) => {
        setTemplates((t.data || []).filter((x: Template) => x.status === "APPROVED"));
        const nums = s.data?.phoneNumbers || [];
        setSenders(nums);
        setSenderId(nums[0]?.phoneNumberId || "");
      })
      .catch((e) =>
        toast({ title: "Couldn't load WhatsApp templates", description: e.message, variant: "destructive" }),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    setDocumentId("");
    const t = templates.find((x) => x._id === id);
    setMapping(mappingFromNotes(t?.notes, t?.variableCount || 0));
  };

  // Preview using the first lead's real values.
  const preview = useMemo(() => {
    if (!template) return "";
    const sample = sendable[0] || leads[0] || {};
    let text = template.bodyText;
    mapping.forEach((m) => {
      const val = m.fieldKey === "custom" ? m.customValue || "…" : String(sample[m.fieldKey] ?? "…");
      text = text.replace(new RegExp(`\\{\\{${m.position}\\}\\}`, "g"), `*${val}*`);
    });
    return text;
  }, [template, mapping, sendable, leads]);

  const needsDoc = hasFileHeader(template);
  const canSend =
    !!template && sendable.length > 0 && (!needsDoc || !!documentId) && !!senderId && !sending;

  const send = async () => {
    if (!template) return;
    setSending(true);
    try {
      await whatsappAPI.createCampaign({
        name: `${template.displayName || template.name} · ${new Date().toLocaleDateString("en-IN")}`,
        templateId: template._id,
        leadIds: sendable.map((l) => l._id || l.id),
        variableMapping: mapping,
        phoneNumberId: senderId || undefined,
        documentId: documentId || undefined,
      });
      toast({
        title: "WhatsApp message queued",
        description: `Sending to ${sendable.length} lead${sendable.length > 1 ? "s" : ""}. Track it under WhatsApp → Campaigns.`,
      });
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const skipped = leads.length - sendable.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send WhatsApp message</DialogTitle>
          <DialogDescription>
            {sendable.length} lead{sendable.length === 1 ? "" : "s"} selected
            {skipped > 0 ? ` · ${skipped} skipped (no valid phone number)` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : senders.length === 0 ? (
          <p className="text-sm p-4 border-2 border-black">
            WhatsApp isn't connected yet.{" "}
            <Link to="/whatsapp/setup" className="underline font-bold">
              Connect WhatsApp
            </Link>
          </p>
        ) : templates.length === 0 ? (
          <p className="text-sm p-4 border-2 border-black">
            No approved templates yet. Create one and get it approved in{" "}
            <Link to="/whatsapp/campaigns" className="underline font-bold">
              WhatsApp → Campaigns
            </Link>
            , then click <b>Sync</b>.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider">Template</label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose an approved template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.displayName || t.name}
                      {hasFileHeader(t) ? " · 📎 file" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {senders.length > 1 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider">Send from</label>
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {senders.map((n) => (
                      <SelectItem key={n.phoneNumberId} value={n.phoneNumberId}>
                        {n.displayPhoneNumber || n.verifiedName || n.phoneNumberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {template && mapping.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider">Fill template variables</label>
                {mapping.map((m, i) => (
                  <div key={m.position} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-10">{`{{${m.position}}}`}</span>
                    <Select
                      value={m.fieldKey}
                      onValueChange={(v) =>
                        setMapping((p) => p.map((x, j) => (j === i ? { ...x, fieldKey: v } : x)))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {m.fieldKey === "custom" && (
                      <Input
                        className="flex-1"
                        placeholder="Type value"
                        value={m.customValue}
                        onChange={(e) =>
                          setMapping((p) => p.map((x, j) => (j === i ? { ...x, customValue: e.target.value } : x)))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {needsDoc && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider">
                  Attach {template?.headerType === "IMAGE" ? "image" : "document"} from Document Vault
                </label>
                <VaultDocPicker
                  value={documentId}
                  onChange={setDocumentId}
                  imagesOnly={template?.headerType === "IMAGE"}
                />
              </div>
            )}

            {template && (
              <div className="p-3 bg-[#DCF8C6] border-2 border-black text-sm whitespace-pre-wrap">
                {preview}
              </div>
            )}

            <Button onClick={send} disabled={!canSend} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to {sendable.length} lead{sendable.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
