import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { whatsappAPI } from "@/services/api";
import { quotationPdfBlob } from "@/lib/quotationPdf";

type Mapping = { position: number; fieldKey: string; customValue: string };

const FIELDS = [
  { key: "name", label: "Client Name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Address" },
  { key: "requirement", label: "Project Title" },
  { key: "quotationNumber", label: "Quotation No." },
  { key: "total", label: "Total (incl. tax)" },
  { key: "custom", label: "Custom Value" },
];

const RULES: [RegExp, string][] = [
  [/(quotation|quote|proforma|ref|no\.?|number|#)\W*$/, "quotationNumber"],
  [/(total|amount|worth|value|rs\.?|inr|₹)\W*$/, "total"],
  [/(project|regarding|requirement|for|about)\W*$/, "requirement"],
  [/(company|firm|organi[sz]ation)\W*$/, "company"],
  [/(dear|hi|hello|hey|mr\.?|ms\.?|mrs\.?)\W*$/, "name"],
];

// Guess each {{n}} from the template's own wording ("Quotation {{3}}", "total {{4}}"), then its MAP hint.
// Anything we can't place stays "custom" and is asked for.
function autoMapping(t: any): Mapping[] {
  const body: string = t?.bodyText || "";
  const hint = /MAP:\s*([A-Za-z,\s]+)/
    .exec(t?.notes || "")?.[1]
    .split(",")
    .map((x) => x.trim());
  return Array.from({ length: t?.variableCount || 0 }, (_, i) => {
    const before = body.slice(0, body.indexOf(`{{${i + 1}}}`)).slice(-30).toLowerCase();
    const h = hint?.[i];
    const fieldKey =
      (h && h !== "custom" && FIELDS.some((f) => f.key === h) && h) ||
      RULES.find(([re]) => re.test(before))?.[1] ||
      (i === 0 ? "name" : "custom");
    return { position: i + 1, fieldKey, customValue: "" };
  });
}

/**
 * Quotation → WhatsApp: pick a template, the quotation PDF goes in as its Document header.
 * Only APPROVED templates with a Document header can carry the PDF; if there are none we say so.
 */
export function SendQuotationDialog({
  quotation,
  settings,
  onOpenChange,
  onSent,
}: {
  quotation: any | null;
  settings: any;
  onOpenChange: (o: boolean) => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [senderId, setSenderId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!quotation) return;
    setTemplateId("");
    setMapping([]);
    setPhone(quotation.mobile || "");
    setLoading(true);
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([t, s]) => {
        setTemplates(
          (t.data || []).filter(
            (x: any) => x.status === "APPROVED" && x.headerType === "DOCUMENT",
          ),
        );
        const nums = s.data?.phoneNumbers || [];
        setSenders(nums);
        setSenderId(nums[0]?.phoneNumberId || "");
      })
      .catch((e) =>
        toast({
          title: "Couldn't load WhatsApp templates",
          description: e.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?._id]);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x._id === id);
    setMapping(autoMapping(t));
  };

  const send = async () => {
    setSending(true);
    try {
      const pdf = await quotationPdfBlob(quotation, settings || {});
      const fd = new FormData();
      fd.append("file", pdf, `${quotation.number || "quotation"}.pdf`);
      fd.append("quotationId", quotation._id);
      fd.append("templateId", templateId);
      fd.append("phone", phone);
      fd.append("phoneNumberId", senderId);
      fd.append("variableMapping", JSON.stringify(mapping));
      await whatsappAPI.sendQuotation(fd);
      toast({ title: "Quotation sent on WhatsApp", description: phone });
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast({
        title: "Failed to send",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const template = templates.find((x) => x._id === templateId);
  const values: Record<string, string> = {
    name: quotation?.clientName,
    company: quotation?.companyName,
    phone: quotation?.mobile,
    location: quotation?.address,
    requirement: quotation?.projectTitle,
    quotationNumber: quotation?.number,
    total: String(Math.round(quotation?.total ?? 0)),
  };
  const valueOf = (m: Mapping) =>
    (m.fieldKey === "custom" ? m.customValue : values[m.fieldKey]) || "";
  const preview = mapping.reduce(
    (text, m) =>
      text.replace(`{{${m.position}}}`, `*${valueOf(m) || `{{${m.position}}}`}*`),
    template?.bodyText || "",
  );
  const missing = mapping.some((m) => !valueOf(m).trim());
  const validPhone = phone.replace(/\D/g, "").length >= 10;

  return (
    <Dialog open={!!quotation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send quotation on WhatsApp</DialogTitle>
          <DialogDescription>
            {quotation?.number} · {quotation?.clientName} — the PDF is attached
            to the template you choose.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : senders.length === 0 ? (
          <p className="text-sm p-4 border-2 border-black">
            WhatsApp isn't connected yet.{" "}
            <Link to="/whatsapp/setup" className="underline font-medium">
              Connect WhatsApp
            </Link>
          </p>
        ) : templates.length === 0 ? (
          <p className="text-sm p-4 border-2 border-black">
            No approved template with a <b>Document header</b> found — the PDF
            can't be attached. Update or create a template with a Document
            header in{" "}
            <Link to="/whatsapp/campaigns" className="underline font-medium">
              WhatsApp → Campaigns
            </Link>
            , then click <b>Sync</b>.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider">
                Send to (WhatsApp number)
              </label>
              <Input
                className="mt-1"
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider">
                Template
              </label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.displayName || t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {senders.length > 1 && (
              <div>
                <label className="text-xs font-medium uppercase tracking-wider">
                  Send from
                </label>
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {senders.map((n) => (
                      <SelectItem key={n.phoneNumberId} value={n.phoneNumberId}>
                        {n.displayPhoneNumber ||
                          n.verifiedName ||
                          n.phoneNumberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {template && (
              <div className="p-3 bg-[#DCF8C6] border-2 border-black text-sm whitespace-pre-wrap">
                {preview}
                <p className="mt-2 text-xs font-medium">📎 {quotation?.number}.pdf</p>
              </div>
            )}

            {mapping.some((m) => m.fieldKey === "custom") && (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider">
                  Fill the rest
                </label>
                {mapping
                  .filter((m) => m.fieldKey === "custom")
                  .map((m) => (
                    <div key={m.position} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-10">{`{{${m.position}}}`}</span>
                      <Input
                        placeholder="Type value"
                        value={m.customValue}
                        onChange={(e) =>
                          setMapping((p) =>
                            p.map((x) =>
                              x.position === m.position
                                ? { ...x, customValue: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
              </div>
            )}

            <Button
              onClick={send}
              disabled={!templateId || !validPhone || !senderId || missing || sending}
              className="w-full"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send quotation PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
