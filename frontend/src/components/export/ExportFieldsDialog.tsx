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
import { downloadCSV } from "@/lib/csvExport";

export interface ExportField {
  key: string;
  label: string;
  default?: boolean;
  get: (item: any) => string | number;
}

interface ExportFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  fields: ExportField[];
  data: any[];
  filenamePrefix: string;
}

export function ExportFieldsDialog({
  open,
  onOpenChange,
  title = "Export CSV",
  fields,
  data,
  filenamePrefix,
}: ExportFieldsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(fields.filter((f) => f.default !== false).map((f) => f.key)),
  );

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const allSelected = selected.size === fields.length;

  const handleExport = () => {
    const chosen = fields.filter((f) => selected.has(f.key));
    if (chosen.length === 0) return;
    downloadCSV(
      `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`,
      chosen.map((f) => f.label),
      data.map((item) => chosen.map((f) => f.get(item))),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selected.size === 0 || data.length === 0}
          >
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
