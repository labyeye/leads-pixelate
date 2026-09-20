import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { autopilotAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AutopilotStatus } from "./useAutopilot";

const MAX_PDF = 10 * 1024 * 1024;

// The owner's own words about the brand: type an intro and/or attach a PDF (brand book,
// company profile, brochure). Claude reads both before it looks at the social profiles.
export function IntroStep({
  status,
  toast,
  reload,
  onNext,
}: {
  status: AutopilotStatus;
  toast: any;
  reload: () => Promise<unknown>;
  onNext: () => void;
}) {
  const [text, setText] = useState(status.intro?.text ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const savedPdf = status.intro?.pdfName;

  const pick = (f?: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Please choose a PDF", variant: "destructive" });
    } else if (f.size > MAX_PDF) {
      toast({ title: "That PDF is over 10 MB", variant: "destructive" });
    } else {
      setFile(f);
    }
  };

  const removeSaved = async () => {
    try {
      await autopilotAPI.deleteIntroPdf();
      await reload();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const next = async () => {
    const changed = text.trim() !== (status.intro?.text ?? "").trim() || !!file;
    if (changed) {
      setBusy(true);
      try {
        await autopilotAPI.saveIntro(text, file);
        await reload();
      } catch (err: any) {
        toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onNext();
  };

  const has = !!(text.trim() || file || savedPdf);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="intro-text">Tell us about your brand</Label>
        <p className="text-xs text-muted-foreground">
          What you do, who your customers are, what makes you different, how you like to sound. A few lines is enough.
        </p>
        <Textarea
          id="intro-text"
          rows={6}
          maxLength={4000}
          value={text}
          placeholder="e.g. We are a family-run bakery in Ahmedabad making slow-fermented sourdough. Our customers are health-conscious families. We sound warm and simple, never salesy."
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-right text-[11px] text-muted-foreground">{text.length}/4000</p>
      </div>

      <div className="space-y-2">
        <Label>Or import a document (PDF)</Label>
        <p className="text-xs text-muted-foreground">
          Brand guidelines, company profile or brochure. Up to 10 MB. We read the text and images.
        </p>
        {file || savedPdf ? (
          <div className="flex items-center gap-3 rounded-lg border-2 border-black p-3 bg-background">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm">{file ? file.name : savedPdf}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove document"
              onClick={() => (file ? setFile(null) : removeSaved())}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 text-sm transition-colors ${
              over ? "border-primary bg-primary/5" : "border-black/40 hover:border-black"
            }`}
          >
            <Upload className="w-6 h-6" />
            <span className="font-medium">Drop a PDF here or click to choose</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Button onClick={next} disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        {has ? "Continue" : "Skip for now"}
      </Button>
    </div>
  );
}
