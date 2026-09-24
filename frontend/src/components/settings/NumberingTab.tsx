import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

// Keep in step with backend/utils/docNumber.js.
const TYPES = [
  { id: "invoice", label: "Invoice", format: "INV-{seq:4}" },
  { id: "quotation", label: "Quotation", format: "SKF-{seq:4}" },
  { id: "sales_order", label: "Sales order", format: "SO-{seq:4}" },
  { id: "purchase_order", label: "Purchase order", format: "PO-{seq:4}" },
];

export function previewNumber(format: string, seq: number, date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return format.replace(/\{(YYYY|YY|MM|DD|seq(?::(\d{1,2}))?)\}/g, (_, t, pad) =>
    t === "YYYY" ? String(date.getFullYear())
    : t === "YY" ? p(date.getFullYear() % 100)
    : t === "MM" ? p(date.getMonth() + 1)
    : t === "DD" ? p(date.getDate())
    : String(seq).padStart(Number(pad) || 1, "0"),
  );
}

const input = "w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]";

// Owner-only (the page shows this tab only to the owner; the server checks again).
export default function NumberingTab({ saved, onSaved }: { saved: Record<string, { format: string; next: number }> | undefined; onSaved: (n: any) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(() =>
    Object.fromEntries(TYPES.map((t) => [t.id, { format: saved?.[t.id]?.format ?? "", next: saved?.[t.id]?.next ? String(saved[t.id].next) : "" }])),
  );
  const [saving, setSaving] = useState(false);
  const set = (id: string, patch: object) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      // Only send rows that have a format; `next` only when typed, so saving never resets a running counter.
      const body = Object.fromEntries(
        TYPES.filter((t) => rows[t.id].format.trim()).map((t) => [t.id, { format: rows[t.id].format.trim(), ...(rows[t.id].next ? { next: Number(rows[t.id].next) } : {}) }]),
      );
      const res = await settingsAPI.saveNumbering(body);
      onSaved(res.data);
      setRows((r) => Object.fromEntries(TYPES.map((t) => [t.id, { format: r[t.id].format, next: res.data?.[t.id]?.next ? String(res.data[t.id].next) : "" }])));
      toast({ title: "Numbering saved" });
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Choose how your document numbers look. Use <b>{"{seq:4}"}</b> for the running number (4 digits), and optionally <b>{"{YYYY}"}</b> <b>{"{YY}"}</b> <b>{"{MM}"}</b> <b>{"{DD}"}</b> for the date. Example: <b>{"INV/{YY}-{seq:4}"}</b> gives INV/26-0001. Leave a format empty to keep the current numbering. Changes apply to new documents only.
      </p>
      {TYPES.map((t) => {
        const r = rows[t.id];
        const shown = r.format.trim() ? previewNumber(r.format, Number(r.next) || 1) : previewNumber(t.format, 1) + "  (current style)";
        return (
          <div key={t.id} className="border-2 border-black bg-white p-4">
            <h3 className="font-display font-bold text-sm mb-3">{t.label} number</h3>
            <div className="grid sm:grid-cols-[1fr_140px] gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">Format</label>
                <input className={input} value={r.format} maxLength={40} placeholder={t.format} onChange={(e) => set(t.id, { format: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">Next number</label>
                <input className={input} inputMode="numeric" value={r.next} placeholder="auto" onChange={(e) => set(t.id, { next: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
              </div>
            </div>
            <p className="text-xs mt-2 text-black/70">Next one will look like: <span className="font-bold">{shown}</span></p>
          </div>
        );
      })}
      <button onClick={save} disabled={saving} className="nb-btn px-5 py-2 text-sm font-bold text-white bg-[#024BAB] border-2 border-black flex items-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save numbering
      </button>
    </div>
  );
}
