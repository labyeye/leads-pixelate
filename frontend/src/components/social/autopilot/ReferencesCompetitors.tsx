import { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Instagram, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCampaignApi } from "./CampaignContext";
import type { AutopilotStatus } from "./useAutopilot";

const MAX_REFERENCES = 8;
const MAX_COMPETITORS = 5;

// What Autopilot should look like (reference images) and who it competes with (Instagram
// usernames it can read, plus the owner's notes). Both are read by the next brand scan.
export function ReferencesCompetitors({
  status,
  toast,
  onChanged,
}: {
  status: AutopilotStatus;
  toast: any;
  onChanged: () => void | Promise<unknown>;
}) {
  const api = useCampaignApi();
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [username, setUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refs = status.references ?? [];
  const rivals = status.competitors ?? [];

  const fail = (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" });

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_REFERENCES - refs.length);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const f of list) await api.uploadReference(f);
      await onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
    }
  };

  const removeRef = async (id: string) => {
    try {
      await api.deleteReference(id);
      await onChanged();
    } catch (err) {
      fail(err);
    }
  };

  const addRival = async () => {
    if (!username.trim() && !notes.trim()) return;
    setAdding(true);
    try {
      await api.addCompetitor({ username: username.trim(), notes: notes.trim() });
      setUsername("");
      setNotes("");
      await onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setAdding(false);
    }
  };

  const removeRival = async (id: string) => {
    try {
      await api.deleteCompetitor(id);
      await onChanged();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* reference images */}
      <div className="space-y-2">
        <Label>Reference images</Label>
        <p className="text-xs text-muted-foreground">
          Posts or photos with the look you want (a moodboard). Up to {MAX_REFERENCES}. Autopilot studies them and matches the
          style in your images.
        </p>
        {refs.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {refs.map((r) => (
              <li key={r.id} className="relative border-2 border-black bg-muted aspect-square">
                <img src={r.url} alt={r.note || "Reference"} className="w-full h-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove reference image"
                  onClick={() => removeRef(r.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black text-white flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {refs.length < MAX_REFERENCES && (
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
              upload(e.dataTransfer.files);
            }}
            className={`w-full rounded-lg border-2 border-dashed p-5 flex flex-col items-center gap-2 text-sm transition-colors ${
              over ? "border-primary bg-primary/5" : "border-black/40 hover:border-black"
            }`}
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
            <span className="font-medium">{uploading ? "Uploading…" : "Drop images here or click to upload"}</span>
            <span className="text-xs text-muted-foreground">PNG, JPG or WebP · up to 5 MB each</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          aria-label="Upload reference images"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* competitors */}
      <div className="space-y-2">
        <Label>Competitors</Label>
        <p className="text-xs text-muted-foreground">
          Add up to {MAX_COMPETITORS}. With an Instagram username Autopilot reads their public posts (public Business or Creator
          accounts only) to see what works and where you can stand apart. Notes are your own words about them.
        </p>
        {rivals.length > 0 && (
          <ul className="space-y-2">
            {rivals.map((c) => (
              <li key={c.id} className="rounded-lg border-2 border-black/20 p-3 space-y-1 bg-background">
                <div className="flex items-center gap-2">
                  {c.username ? <Instagram className="w-4 h-4 text-pink-600 shrink-0" /> : <Users className="w-4 h-4 shrink-0" />}
                  <span className="font-medium text-sm truncate">{c.username ? `@${c.username}` : "Notes only"}</span>
                  {c.followers != null && (
                    <span className="text-xs text-muted-foreground">{c.followers.toLocaleString("en-IN")} followers</span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={`Remove ${c.username || "competitor"}`}
                    onClick={() => removeRival(c.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                {c.summary && <p className="text-xs">{c.summary}</p>}
                {c.error && (
                  <p className="flex items-start gap-1 text-xs text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {c.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {rivals.length < MAX_COMPETITORS && (
          <div className="grid sm:grid-cols-[200px_minmax(0,1fr)_auto] gap-2 items-start">
            <Input
              aria-label="Competitor Instagram username"
              placeholder="@instagram_username"
              value={username}
              maxLength={31}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              aria-label="Notes about the competitor"
              placeholder="What they do, what you like or dislike (optional)"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRival()}
            />
            <Button type="button" variant="outline" onClick={addRival} disabled={adding || (!username.trim() && !notes.trim())}>
              {adding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
