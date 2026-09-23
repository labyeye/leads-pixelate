import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { purchaseOrdersAPI } from "@/services/api";
import { downloadXLSX } from "@/lib/tableExport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// One row per item. Export writes these same columns, so an exported file can be re-imported.
export const PO_HEADERS = [
  "PO Number",
  "Date",
  "Expected Delivery",
  "Supplier",
  "Reference",
  "Status",
  "Discount",
  "GST %",
  "Item",
  "HSN/SAC",
  "Qty",
  "Rate",
  "Notes",
];
const TEMPLATE_ROWS = [
  ["PO-1", "2025-04-12", "2025-04-20", "Acme Supplies", "", "Draft", 0, 18, "Steel sheet", "7208", 10, 1200, ""],
  ["PO-1", "2025-04-12", "2025-04-20", "Acme Supplies", "", "Draft", 0, 18, "Bolts", "7318", 100, 5, ""],
];

const ALIASES: Record<string, string> = {
  ponumber: "no",
  number: "no",
  no: "no",
  date: "date",
  expecteddelivery: "dueDate",
  duedate: "dueDate",
  delivery: "dueDate",
  supplier: "partyName",
  client: "partyName",
  party: "partyName",
  partyname: "partyName",
  vendor: "partyName",
  reference: "reference",
  status: "status",
  discount: "discount",
  gst: "taxPercent",
  gstpercent: "taxPercent",
  tax: "taxPercent",
  taxpercent: "taxPercent",
  item: "name",
  itemname: "name",
  description: "name",
  hsn: "hsnCode",
  hsnsac: "hsnCode",
  hsncode: "hsnCode",
  qty: "quantity",
  quantity: "quantity",
  rate: "rate",
  price: "rate",
  notes: "notes",
};

const STATUSES = ["Draft", "Issued", "Received", "Cancelled"];
const pad = (n: number) => String(n).padStart(2, "0");

type Row = Record<string, string>;
type Failed = { key: string; reason: string };

async function readRows(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true });
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  return raw
    .map((r) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) {
        const f = ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
        if (!f) continue;
        out[f] = v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v ?? "").trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v !== ""));
}

const groupRows = (rows: Row[]) => {
  const groups = new Map<string, Row[]>();
  rows.forEach((r) => {
    const key = r.no || `${r.partyName}|${r.reference}|${r.date}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  });
  return groups;
};

export function exportPurchaseOrders(docs: any[]) {
  const rows = docs.flatMap((d) =>
    (d.items || []).map((i: any) => [
      d.number,
      (d.date || "").slice(0, 10),
      (d.dueDate || "").slice(0, 10),
      d.partyName,
      d.reference || "",
      d.status,
      d.discount ?? 0,
      d.taxPercent ?? 18,
      i.name,
      i.hsnCode || "",
      i.quantity,
      i.rate,
      d.notes || "",
    ]),
  );
  return downloadXLSX("purchase-orders.xlsx", PO_HEADERS, rows, "Purchase Orders");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  products: any[];
}

export function ImportPurchaseOrdersDialog({ open, onOpenChange, onImported, products }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: Failed[] } | null>(null);

  const groups = groupRows(rows);

  const reset = () => {
    setFileName("");
    setRows([]);
    setError("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onFile = async (file?: File) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) return setError("File is too large. Max file size is 5MB.");
    try {
      const parsed = await readRows(file);
      if (parsed.length === 0) return setError("No rows found in the first sheet of this file.");
      const missing = ["partyName", "name", "quantity", "rate"].filter((k) => !parsed.some((r) => k in r));
      if (missing.length) return setError("Missing columns (Supplier, Item, Qty, Rate are required). Download the template to see the format.");
      setRows(parsed);
    } catch {
      setError("Could not read this file. Use an .xlsx, .xls or .csv file.");
    }
  };

  const runImport = async () => {
    setImporting(true);
    let imported = 0;
    const failed: Failed[] = [];
    // Sequential: the server numbers documents from a running count, so parallel creates would collide.
    for (const [key, items] of groups) {
      const h = items[0];
      try {
        if (!h.partyName) throw new Error("Supplier missing");
        const status = STATUSES.find((s) => s.toLowerCase() === (h.status || "").toLowerCase()) || "Draft";
        await purchaseOrdersAPI.create({
          partyName: h.partyName,
          reference: h.reference || "",
          date: h.date || undefined,
          dueDate: h.dueDate || null,
          status,
          discount: Number(h.discount) || 0,
          taxPercent: h.taxPercent === "" || h.taxPercent === undefined ? 18 : Number(h.taxPercent),
          notes: h.notes || (h.no ? `Imported (previous no. ${h.no})` : ""),
          items: items.map((r) => {
            const p = products.find((x) => (x.name || "").toLowerCase() === r.name.toLowerCase());
            return {
              productId: p?._id || null, // matched by name so a Received order updates that product's stock
              name: r.name,
              hsnCode: r.hsnCode || p?.hsnCode || "",
              quantity: Number(r.quantity),
              rate: Number(r.rate),
            };
          }),
        });
        imported++;
      } catch (err: any) {
        failed.push({ key: h.no || `${h.partyName} / ${h.date || ""}`, reason: err.message || "Failed" });
      }
    }
    setResult({ imported, failed });
    setImporting(false);
    if (imported > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import purchase orders from Excel</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{result.imported}</strong> purchase order{result.imported === 1 ? "" : "s"} imported
              {result.failed.length > 0 && (
                <>
                  , <strong>{result.failed.length}</strong> failed
                </>
              )}
              .
            </p>
            {result.failed.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded border text-xs divide-y">
                {result.failed.map((f) => (
                  <div key={f.key} className="px-3 py-2">
                    <span className="font-semibold">{f.key}:</span> {f.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              One row per item; rows with the same <strong>PO Number</strong> become one order. Required:{" "}
              <strong>Supplier, Item, Qty, Rate</strong>. Status defaults to Draft. New orders get a fresh PO number.{" "}
              <strong>Orders imported as Received add their quantities to product stock</strong> (items are matched to
              products by name).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadXLSX("purchase-orders-import-template.xlsx", PO_HEADERS, TEMPLATE_ROWS, "Purchase Orders")}
              >
                <Download className="w-4 h-4 mr-1" /> Download template
              </Button>
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Choose file
              </Button>
              <span className="text-xs text-muted-foreground self-center">.xlsx, .xls or .csv · max 5MB</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Excel file"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
            {fileName && !error && rows.length > 0 && (
              <p className="text-sm flex items-center gap-2 rounded border p-3">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                {fileName} — <strong>{groups.size}</strong> order{groups.size === 1 ? "" : "s"} ({rows.length} item rows)
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          {result ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={runImport} disabled={rows.length === 0 || importing}>
                {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Import {groups.size > 0 ? `${groups.size} order${groups.size === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
