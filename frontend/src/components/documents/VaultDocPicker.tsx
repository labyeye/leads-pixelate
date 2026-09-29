import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentsAPI, type VaultDocument } from "@/services/api";

const NONE = "__none__";

// Picks a file from the Document Vault. imagesOnly: for templates whose header is an image.
export function VaultDocPicker({
  value,
  onChange,
  imagesOnly = false,
  optional = false,
}: {
  value: string;
  onChange: (id: string) => void;
  imagesOnly?: boolean;
  optional?: boolean;
}) {
  const [docs, setDocs] = useState<VaultDocument[] | null>(null);

  useEffect(() => {
    documentsAPI
      .getAll()
      .then((r) => setDocs(r.data))
      .catch(() => setDocs([]));
  }, []);

  const list = (docs || []).filter((d) => !imagesOnly || d.mimeType.startsWith("image/"));

  if (docs && list.length === 0)
    return (
      <p className="text-xs text-muted-foreground mt-1 p-3 bg-muted/50 rounded-lg">
        No {imagesOnly ? "images" : "documents"} in the vault yet.{" "}
        <Link to="/documents" className="underline">
          Open Document Vault
        </Link>
      </p>
    );

  return (
    <Select value={value || (optional ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="mt-1 text-sm">
        <SelectValue placeholder={docs ? "Choose a document..." : "Loading..."} />
      </SelectTrigger>
      <SelectContent>
        {optional && <SelectItem value={NONE}>Template's saved file</SelectItem>}
        {list.map((d) => (
          <SelectItem key={d._id} value={d._id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
