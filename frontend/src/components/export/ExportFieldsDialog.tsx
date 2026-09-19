import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csvExport";
import { downloadPDF, downloadXLSX } from "@/lib/tableExport";

export interface ExportField {
  key: string;
  label: string;
  default?: boolean;
  get: (item: any) => string | number;
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

const FORMAT_LABEL: Record<ExportFormat, string> = {
  xlsx: "Excel",
  pdf: "PDF",
  csv: "CSV",
};

interface ExportFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  fields: ExportField[];
  data: any[];
  filenamePrefix: string;
  // Formats to offer. Defaults to CSV only, which keeps existing callers unchanged.
  formats?: ExportFormat[];
  // Heading/sheet name inside Excel and PDF files.
  documentTitle?: string;
}

export function ExportFieldsDialog({
  open,
  onOpenChange,
  title,
  fields,
  data,
  filenamePrefix,
  formats = ["csv"],
  documentTitle,
}: ExportFieldsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(fields.filter((f) => f.default !== false).map((f) => f.key)),
  );
  const [format, setFormat] = useState<ExportFormat>(formats[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const allSelected = selected.size === fields.length;
  const heading = title ?? (formats.length > 1 ? "Export" : "Export CSV");

  const handleExport = async () => {
    const chosen = fields.filter((f) => selected.has(f.key));
    if (chosen.length === 0) return;
    const headers = chosen.map((f) => f.label);
    const rows = data.map((item) => chosen.map((f) => f.get(item)));
    const name = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}`;
    const docTitle = documentTitle ?? filenamePrefix;

    setBusy(true);
    setError("");
    try {
      if (format === "xlsx") await downloadXLSX(`${name}.xlsx`, headers, rows, docTitle);
      else if (format === "pdf") await downloadPDF(`${name}.pdf`, docTitle, headers, rows);
      else downloadCSV(`${name}.csv`, headers, rows);
      onOpenChange(false);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>

        {formats.length > 1 && (
          <div className="flex gap-2" role="radiogroup" aria-label="File format">
            {formats.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  "flex-1 rounded border px-3 py-1.5 text-sm font-semibold transition-colors",
                  format === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-b pb-2 mb-1">
          <span className="text-xs text-muted-foreground">
            {data.length} row{data.length !== 1 ? "s" : ""} will be exported
          </span>
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(fields.map((f) => f.key)),
              )
            }
            className="text-xs font-semibold text-primary hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <Checkbox
                id={`export-field-${f.key}`}
                checked={selected.has(f.key)}
                onCheckedChange={() => toggle(f.key)}
              />
              <Label
                htmlFor={`export-field-${f.key}`}
                className="text-sm font-medium cursor-pointer"
              >
                {f.label}
              </Label>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selected.size === 0 || data.length === 0 || busy}
          >
            {busy ? "Exporting…" : `Export ${FORMAT_LABEL[format]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
