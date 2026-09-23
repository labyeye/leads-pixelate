import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { quotationsAPI } from "@/services/api";
import { downloadXLSX } from "@/lib/tableExport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// One row per line item; rows sharing a Quotation No (or, if blank, Client + Project) become one quotation.
const TEMPLATE_HEADERS = [
  "Quotation No",
  "Date",
  "Client Name",
  "Company",
  "Mobile",
  "GST",
  "Address",
  "Project Title",
  "Status",
  "Discount",
  "Item",
  "HSN",
  "Price",
  "Qty",
];
const TEMPLATE_ROWS = [
  ["Q-101", "2025-04-12", "Ravi Kumar", "Acme Pvt Ltd", "9876543210", "", "12 MG Road, Pune", "Supply of Machinery", "Approved", 0, "Lathe machine", "8458", 150000, 1],
  ["Q-101", "2025-04-12", "Ravi Kumar", "Acme Pvt Ltd", "9876543210", "", "12 MG Road, Pune", "Supply of Machinery", "Approved", 0, "Installation", "998315", 5000, 2],
];

const ALIASES: Record<string, string> = {
  quotationno: "no",
  quotationnumber: "no",
  number: "no",
  no: "no",
  date: "date",
  clientname: "clientName",
  client: "clientName",
  name: "clientName",
  company: "companyName",
  companyname: "companyName",
  mobile: "mobile",
  phone: "mobile",
  gst: "gst",
  gstin: "gst",
  address: "address",
  projecttitle: "projectTitle",
  project: "projectTitle",
  title: "projectTitle",
  status: "status",
  discount: "discount",
  item: "name",
  itemdescription: "name",
  description: "name",
  hsn: "hsnCode",
  hsncode: "hsnCode",
  hsnsac: "hsnCode",
  price: "price",
  rate: "price",
  qty: "quantity",
  quantity: "quantity",
};

const STATUSES = ["Draft", "Sent", "Approved", "Rejected"];
const pad = (n: number) => String(n).padStart(2, "0");

type Row = Record<string, string>;
type Failed = { key: string; reason: string };

async function readRows(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  return raw
    .map((r) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) {
        const field = ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
        if (!field) continue;
        out[field] =
          v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v ?? "").trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v !== ""));
}

const groupRows = (rows: Row[]) => {
  const groups = new Map<string, Row[]>();
  rows.forEach((r) => {
    const key = r.no || `${r.clientName}|${r.projectTitle}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  });
  return groups;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportQuotationsDialog({ open, onOpenChange, onImported }: Props) {
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
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Max file size is 5MB.");
      return;
    }
    try {
      const parsed = await readRows(file);
      const missing = ["clientName", "name", "price", "quantity"].filter((k) => !parsed.some((r) => k in r));
      if (parsed.length === 0) setError("No rows found in the first sheet of this file.");
      else if (missing.length)
        setError("Missing columns (Client Name, Item, Price, Qty are required). Download the template to see the format.");
      else setRows(parsed);
    } catch {
      setError("Could not read this file. Use an .xlsx, .xls or .csv file.");
    }
  };

  const runImport = async () => {
    setImporting(true);
    setError("");
    let imported = 0;
    const failed: Failed[] = [];
    // Sequential: the server numbers quotations from a running count, so parallel creates would collide.
    for (const [key, items] of groups) {
      const h = items[0];
      const services = items.map((r) => ({
        name: r.name,
        hsnCode: r.hsnCode || "",
        price: Number(r.price),
        quantity: Number(r.quantity) || 1,
      }));
      const status = STATUSES.find((s) => s.toLowerCase() === (h.status || "").toLowerCase()) || "Approved";
      const discount = Number(h.discount) || 0;
      const subtotal = services.reduce((a, s) => a + s.price * s.quantity, 0);
      const tax = (subtotal - discount) * 0.18;
      try {
        if (!h.clientName) throw new Error("Client Name missing");
        if (services.some((s) => !s.name || !(s.price > 0))) throw new Error("Every item needs a name and price above 0");
        await quotationsAPI.create({
          clientName: h.clientName,
          companyName: h.companyName || "",
          address: h.address || "",
          gst: (h.gst || "").toUpperCase(),
          mobile: (h.mobile || "").replace(/\D/g, "").slice(-10),
          projectTitle: h.projectTitle || "Imported quotation",
          date: h.date || undefined,
          status,
          services,
          discount,
          subtotal,
          tax,
          total: subtotal - discount + tax,
          notes: h.no ? `Imported (previous no. ${h.no})` : "Imported",
        });
        imported++;
      } catch (err: any) {
        failed.push({ key: h.no || `${h.clientName} / ${h.projectTitle}`, reason: err.message || "Failed" });
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
          <DialogTitle>Import quotations from Excel</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{result.imported}</strong> quotation{result.imported === 1 ? "" : "s"} imported
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
              Keep a client&apos;s earlier quotations here. One row per item; rows with the same{" "}
              <strong>Quotation No</strong> become one quotation. Required: <strong>Client Name, Item, Price, Qty</strong>.
              Status defaults to <strong>Approved</strong>. Imports never change stock.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadXLSX("quotations-import-template.xlsx", TEMPLATE_HEADERS, TEMPLATE_ROWS, "Quotations")}
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
                {fileName} — <strong>{groups.size}</strong> quotation{groups.size === 1 ? "" : "s"} ({rows.length} item rows)
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
                Import {groups.size > 0 ? `${groups.size} quotation${groups.size === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
