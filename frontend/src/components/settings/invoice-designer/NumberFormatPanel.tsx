import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { previewNumber } from "@/components/settings/NumberingTab";

const DEFAULTS: Record<string, { label: string; format: string }> = {
  quotation: { label: "Quotation", format: "QT-{seq:4}" },
  invoice: { label: "Invoice", format: "INV-{seq:4}" },
};

// The document's number format, edited right beside its design (same saved setting as
// Settings > Numbering). Only the account owner can change it; the server checks again.
export default function NumberFormatPanel({
  docType,
  saved,
  isOwner,
  onSaved,
  onPreview,
}: {
  docType: "quotation" | "invoice";
  saved?: { format: string; next: number };
  isOwner: boolean;
  onSaved: (numbering: any) => void;
  onPreview: (no: string | null) => void;
}) {
  const { toast } = useToast();
  const d = DEFAULTS[docType];
  const [format, setFormat] = useState(saved?.format ?? "");
  const [next, setNext] = useState(saved?.next ? String(saved.next) : "");
  const [saving, setSaving] = useState(false);

  // Show the typed format on the sample document while editing.
  useEffect(() => {
    onPreview(
      format.trim() ? previewNumber(format.trim(), Number(next) || 1) : null,
    );
    return () => onPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, next]);

  const save = async () => {
    if (!format.trim()) return;
    setSaving(true);
    try {
      const res = await settingsAPI.saveNumbering({
        [docType]: {
          format: format.trim(),
          ...(next ? { next: Number(next) } : {}),
        },
      });
      onSaved(res.data);
      setNext(res.data?.[docType]?.next ? String(res.data[docType].next) : "");
      toast({ title: `${d.label} number format saved` });
    } catch (err: any) {
      toast({
        title: "Could not save",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const box =
    "w-full border-2 border-black px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#024BAB] disabled:bg-slate-100";

  return (
    <div className="border-2 border-black p-3 mb-4 space-y-2 bg-[#024BAB]/5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-black">
        {d.label} number
      </p>
      <input
        className={box}
        value={format}
        maxLength={40}
        disabled={!isOwner}
        placeholder={d.format}
        onChange={(e) => setFormat(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-black shrink-0">Next number</span>
        <input
          className={box}
          inputMode="numeric"
          value={next}
          disabled={!isOwner}
          placeholder="auto"
          onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
      </div>
      <p className="text-[10px] text-black/60 leading-snug">
        Use <b>{"{seq:4}"}</b> for the running number, plus optional{" "}
        <b>{"{YYYY} {YY} {MM} {DD}"}</b>. Example <b>{"QT/{YY}-{seq:4}"}</b> gives
        QT/26-0001. Applies to new {d.label.toLowerCase()}s only.
      </p>
      {isOwner ? (
        <button
          type="button"
          onClick={save}
          disabled={saving || !format.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#024BAB] border-2 border-black disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save number format
        </button>
      ) : (
        <p className="text-[10px] text-red-600">
          Only the account owner can change the number format.
        </p>
      )}
    </div>
  );
}
