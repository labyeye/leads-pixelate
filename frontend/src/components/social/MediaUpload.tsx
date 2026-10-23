import { useRef, useState } from "react";
import { Loader2, Upload, X, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { checkMedia, MediaCheck, MediaRule } from "@/lib/mediaCheck";

// Read pixel size from the picked file before it is uploaded.
function measure(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (v: { w: number; h: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => done(null);
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
    }
  });
}

const isVideoUrl = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u);

interface Props {
  /** Uploaded file URLs (saved to the database by the caller). */
  value: string[];
  onChange: (urls: string[]) => void;
  kind: "image" | "video";
  multiple?: boolean;
  label?: string;
  /** Instagram size rule to check each file against. */
  rule?: MediaRule;
  /** Reject files that break the rule (e.g. Instagram is a selected platform). */
  strict?: boolean;
}

/** File picker that uploads to the server and hands back the stored URL(s). */
export function MediaUpload({ value, onChange, kind, multiple, label, rule, strict }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [checks, setChecks] = useState<Record<string, MediaCheck>>({});
  const urls = value.filter(Boolean);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        let check: MediaCheck | null = null;
        if (rule) {
          const dim = await measure(file);
          if (dim) check = checkMedia(dim.w, dim.h, rule);
        }
        if (check?.status === "error") {
          const head = `${check.width}×${check.height} (${check.ratio})`;
          if (strict) {
            toast({
              title: `${file.name} not allowed`,
              description: `${head} — ${check.message}`,
              variant: "destructive",
            });
            continue;
          }
          if (!window.confirm(`${head}\n${check.message}\n\nUpload anyway?`)) continue;
        }
        const res = await uploadAPI.upload(file);
        if (!res.success || !res.url) throw new Error("Upload failed");
        if (check) setChecks((c) => ({ ...c, [res.url]: check! }));
        uploaded.push(res.url);
      }
      if (!uploaded.length) return;
      onChange(multiple ? [...urls, ...uploaded] : uploaded.slice(0, 1));
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className={multiple ? "grid grid-cols-3 gap-2" : ""}>
          {urls.map((u, i) => (
            <div
              key={u + i}
              className="relative rounded-lg border border-border overflow-hidden bg-muted"
            >
              {kind === "video" || isVideoUrl(u) ? (
                <video src={u} controls className="w-full max-h-48" />
              ) : (
                <img
                  src={u}
                  alt="preview"
                  className={
                    multiple
                      ? "w-full h-24 object-cover"
                      : "w-full max-h-48 object-cover"
                  }
                />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-1"
                aria-label="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.map((u) => {
        const c = checks[u];
        return c ? (
          <p
            key={"c" + u}
            className={`text-xs font-semibold px-2 py-1 rounded border ${
              c.status === "ok"
                ? "bg-green-50 border-green-300 text-green-800"
                : c.status === "warn"
                  ? "bg-yellow-50 border-yellow-300 text-yellow-800"
                  : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            {c.width}×{c.height} · {c.ratio}
            {c.message ? ` — ${c.message}` : ""}
          </p>
        ) : null;
      })}
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={kind === "video" ? "video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v" : "image/jpeg,image/png,image/webp,image/gif"}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {(multiple || urls.length === 0) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : kind === "video" ? (
            <VideoIcon className="w-3.5 h-3.5 mr-1" />
          ) : (
            <Upload className="w-3.5 h-3.5 mr-1" />
          )}
          {uploading
            ? "Uploading..."
            : label ||
              (kind === "video"
                ? "Upload video"
                : multiple
                  ? "Upload images"
                  : "Upload image")}
        </Button>
      )}
    </div>
  );
}
