import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { clientsAPI } from "@/services/api";
import { downloadXLSX } from "@/lib/tableExport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TEMPLATE_HEADERS = [
  "Name",
  "Company",
  "Email",
  "Phone",
  "Address",
  "Business Type",
  "GST",
  "Services",
  "Project Status",
  "Payment Status",
];
const TEMPLATE_EXAMPLE = [
  "Ravi Kumar",
  "Acme Pvt Ltd",
  "ravi@acme.com",
  "9876543210",
  "12 MG Road, Pune",
  "Manufacturing",
  "",
  "SEO, Web Design",
  "Active",
  "Pending",
];
const REQUIRED: [string, string][] = [
  ["name", "Name"],
  ["company", "Company"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["businessType", "Business Type"],
];

// Header text -> API field, ignoring case, spaces and punctuation ("E-mail ID" -> email).
const ALIASES: Record<string, string> = {
  name: "name",
  clientname: "name",
  client: "name",
  company: "company",
  companyname: "company",
  email: "email",
  emailid: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  address: "address",
  businesstype: "businessType",
  type: "businessType",
  gst: "gst",
  gstin: "gst",
  gstnumber: "gst",
  services: "services",
  projectstatus: "projectStatus",
  paymentstatus: "paymentStatus",
};

const CHUNK = 500; // server accepts up to 1000 rows per request

type Row = Record<string, string>;
type Skipped = { row: number; name: string; reason: string };

async function readRows(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
    wb.Sheets[wb.SheetNames[0]],
    { defval: "" },
  );
  return raw
    .map((r) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(r)) {
        const field = ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
        if (field) out[field] = String(v ?? "").trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v !== "")); // trailing blank rows
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportClientsDialog({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: Skipped[] } | null>(null);

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
      if (parsed.length === 0) {
        setError("No rows found in the first sheet of this file.");
        return;
      }
      const missing = REQUIRED.filter(([key]) => !parsed.some((r) => key in r)).map(([, label]) => label);
      if (missing.length) {
        setError(`Missing column(s): ${missing.join(", ")}. Download the template to see the expected columns.`);
        return;
      }
      setRows(parsed);
    } catch {
      setError("Could not read this file. Use an .xlsx, .xls or .csv file.");
    }
  };

  const runImport = async () => {
    setImporting(true);
    setError("");
    try {
      let imported = 0;
      const skipped: Skipped[] = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await clientsAPI.importBulk(rows.slice(i, i + CHUNK));
        imported += res.imported;
        // the server numbers rows within its chunk; shift back to the sheet's row number
        skipped.push(...res.skipped.map((s) => ({ ...s, row: s.row + i })));
      }
      setResult({ imported, skipped });
      if (imported > 0) onImported();
    } catch (err: any) {
      setError(err.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import clients from Excel</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{result.imported}</strong> client{result.imported === 1 ? "" : "s"} imported
              {result.skipped.length > 0 && (
                <>
                  , <strong>{result.skipped.length}</strong> skipped
                </>
              )}
              .
            </p>
            {result.skipped.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded border text-xs divide-y">
                {result.skipped.map((s) => (
                  <div key={s.row} className="px-3 py-2">
                    <span className="font-semibold">
                      Row {s.row}
                      {s.name ? ` (${s.name})` : ""}:
                    </span>{" "}
                    {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an .xlsx, .xls or .csv file. Required columns: <strong>Name, Company, Email, Phone, Address,
              Business Type</strong>. Optional: GST, Services (comma-separated), Project Status, Payment Status. Rows
              that fail validation are skipped and listed afterwards.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadXLSX("clients-import-template.xlsx", TEMPLATE_HEADERS, [TEMPLATE_EXAMPLE], "Clients")}
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
              <div className="rounded border p-3 space-y-2">
                <p className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  {fileName} — <strong>{rows.length}</strong> row{rows.length === 1 ? "" : "s"} found
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {rows.slice(0, 3).map((r, i) => (
                    <p key={i} className="truncate">
                      {r.name} · {r.company} · {r.email}
                    </p>
                  ))}
                  {rows.length > 3 && <p>…and {rows.length - 3} more</p>}
                </div>
              </div>
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
                Import {rows.length > 0 ? `${rows.length} client${rows.length === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
