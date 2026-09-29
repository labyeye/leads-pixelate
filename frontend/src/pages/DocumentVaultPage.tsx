import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, FolderOpen, ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { documentsAPI, documentFileUrl, type VaultDocument } from "@/services/api";

const DOC_CATEGORIES: Record<string, string> = {
  brochure: "Brochure",
  catalogue: "Catalogue",
  price_list: "Price List",
  presentation: "Presentation",
  other: "Other",
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

const formatSize = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function DocumentVaultPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "admin";
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [newCategory, setNewCategory] = useState("brochure");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    documentsAPI
      .getAll()
      .then((r) => setDocs(r.data))
      .catch((e) => toast({ title: "Failed to load documents", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(
      (d) =>
        (category === "all" || d.category === category) &&
        (!q || d.name.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)),
    );
  }, [docs, search, category]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await documentsAPI.upload(file, name, newCategory);
      setDocs((prev) => [r.data, ...prev]);
      toast({ title: "Document added to vault" });
      setUploadOpen(false);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (d: VaultDocument) => {
    if (!window.confirm(`Delete "${d.name}" from the vault?`)) return;
    try {
      await documentsAPI.remove(d._id);
      setDocs((prev) => prev.filter((x) => x._id !== d._id));
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const openUpload = () => {
    setFile(null);
    setName("");
    setNewCategory("brochure");
    setUploadOpen(true);
  };

  return (
    <AppLayout title="Document Vault">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Document Vault</h1>
            <p className="text-xs text-muted-foreground">
              Brochures, catalogues and price lists, ready to send to leads on WhatsApp.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openUpload}>
              <Upload className="w-4 h-4 mr-1" /> Upload
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center text-sm text-muted-foreground">
            <FolderOpen className="w-10 h-10 opacity-30" />
            {docs.length === 0
              ? canManage
                ? "No documents yet. Upload your brochure or catalogue to get started."
                : "No documents yet. Ask an admin to upload brochures and catalogues."
              : "No documents match your search."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((d) => {
              const Icon = d.mimeType.startsWith("image/") ? ImageIcon : FileText;
              return (
                <div key={d._id} className="border border-border rounded-lg p-4 flex gap-3 bg-card">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate" title={d.name}>
                      {d.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={d.fileName}>
                      {DOC_CATEGORIES[d.category] || d.category} · {formatSize(d.size)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(d.createdAt), "dd MMM yyyy")}
                      {d.uploadedBy?.name ? ` · ${d.uploadedBy.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Open / download">
                      <a href={documentFileUrl(d)} target="_blank" rel="noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Delete"
                        onClick={() => handleDelete(d)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          To send a document: open a lead → WhatsApp → Document, or attach it to a WhatsApp campaign that uses a
          Document-header template.
        </p>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">File (PDF, image, Word, Excel, PowerPoint · max 25 MB)</Label>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" maxLength={160} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
