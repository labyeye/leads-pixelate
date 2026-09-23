import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { productsAPI } from "@/services/api";
import { downloadXLSX } from "@/lib/tableExport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Export writes these same columns, so an exported file can be re-imported. Image URL is always exported, optional on import.
export const PRODUCT_HEADERS = [
  "Name",
  "Category",
  "Price",
  "Unit",
  "Stock",
  "Tax Rate",
  "HSN/SAC",
  "SKU",
  "Status",
  "Description",
  "Image URL",
];
const TEMPLATE_ROW = ["Offset Printing Machine", "Machines", 250000, "pcs", 5, 18, "8443", "OPM-01", "Active", "", ""];

const ALIASES: Record<string, string> = {
  name: "name",
  productname: "name",
  category: "category",
  price: "price",
  rate: "price",
  unit: "unit",
  stock: "stockQuantity",
  stockqty: "stockQuantity",
  stockquantity: "stockQuantity",
  taxrate: "taxRate",
  tax: "taxRate",
  hsn: "hsnCode",
  hsnsac: "hsnCode",
  hsncode: "hsnCode",
  sku: "sku",
  status: "status",
  description: "description",
  imageurl: "image",
  image: "image",
  photo: "image",
  photos: "image",
};

type Row = Record<string, string>;
type Failed = { row: number; name: string; reason: string };

async function readRows(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  return raw
    .map((r) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) {
        const f = ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
        if (f) out[f] = String(v ?? "").trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v !== ""));
}

const num = (v?: string) => (v === undefined || v === "" ? undefined : Number(v));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportProductsDialog({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: Failed[] } | null>(null);

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
      const missing = ["name", "category", "price"].filter((k) => !parsed.some((r) => k in r));
      if (missing.length) return setError("Missing columns (Name, Category, Price are required). Download the template to see the format.");
      setRows(parsed);
    } catch {
      setError("Could not read this file. Use an .xlsx, .xls or .csv file.");
    }
  };

  const runImport = async () => {
    setImporting(true);
    let imported = 0;
    const failed: Failed[] = [];
    // Sequential so one bad row never blocks the rest and errors map to a sheet row.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const photos = (r.image || "").split(/[,\n]/).map((u) => u.trim()).filter(Boolean).slice(0, 5);
        await productsAPI.create({
          name: r.name,
          category: r.category,
          price: Number(r.price),
          unit: r.unit || "pcs",
          stockQuantity: num(r.stockQuantity) ?? 0,
          taxRate: num(r.taxRate) ?? 18,
          hsnCode: r.hsnCode || "",
          sku: r.sku || "",
          status: /^inactive$/i.test(r.status || "") ? "Inactive" : "Active",
          description: r.description || "",
          photos,
          photoUrl: photos[0] || "",
        });
        imported++;
      } catch (err: any) {
        failed.push({ row: i + 2, name: r.name, reason: err.message || "Failed" });
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
          <DialogTitle>Import products from Excel</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{result.imported}</strong> product{result.imported === 1 ? "" : "s"} imported
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
                  <div key={f.row} className="px-3 py-2">
                    <span className="font-semibold">
                      Row {f.row}
                      {f.name ? ` (${f.name})` : ""}:
                    </span>{" "}
                    {f.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Required: <strong>Name, Category, Price</strong>. Optional: Unit, Stock, Tax Rate, HSN/SAC, SKU, Status,
              Description and <strong>Image URL</strong> (up to 5, comma-separated). Files exported from this page can be
              imported back.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadXLSX("products-import-template.xlsx", PRODUCT_HEADERS, [TEMPLATE_ROW], "Products")}
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
                {fileName} — <strong>{rows.length}</strong> product{rows.length === 1 ? "" : "s"} found
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
                Import {rows.length > 0 ? `${rows.length} product${rows.length === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
