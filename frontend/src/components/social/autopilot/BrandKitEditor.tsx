import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { autopilotAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BrandKit, LogoPosition } from "./useAutopilot";

const MAX_LOGOS = 5;
const MAX_COLORS = 4;
const POSITIONS: { id: LogoPosition; label: string; cls: string }[] = [
  { id: "top-left", label: "Top left", cls: "top-2 left-2" },
  { id: "top-right", label: "Top right", cls: "top-2 right-2" },
  { id: "bottom-left", label: "Bottom left", cls: "bottom-2 left-2" },
  { id: "bottom-right", label: "Bottom right", cls: "bottom-2 right-2" },
];

interface Props {
  kit: BrandKit;
  toast: any;
  onChanged: () => void | Promise<unknown>;
}

export function BrandKitEditor({ kit, toast, onChanged }: Props) {
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  // The colour picker fires continuously while dragging: keep the value local and save on blur.
  const [picked, setPicked] = useState<Record<number, string>>({});
  const input = useRef<HTMLInputElement>(null);

  const fail = (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" });
  const save = async (patch: Record<string, unknown>) => {
    try {
      await autopilotAPI.saveBrand(patch);
      await onChanged();
    } catch (err) {
      fail(err);
    }
  };

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_LOGOS - kit.logos.length);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const f of list) await autopilotAPI.uploadLogo(f);
      await onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await autopilotAPI.deleteLogo(id);
      await onChanged();
    } catch (err) {
      fail(err);
    }
  };

  const rename = (id: string) => {
    const name = (names[id] ?? "").trim();
    const current = kit.logos.find((l) => l.id === id);
    if (name && current && name !== current.name) {
      save({ logos: kit.logos.map((l) => ({ id: l.id, name: l.id === id ? name : l.name })) });
    }
  };

  const active = kit.logos.find((l) => l.id === kit.logoId) || kit.logos[0];
  const pos = POSITIONS.find((p) => p.id === kit.logoPosition) || POSITIONS[3];

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="space-y-2">
        <Label>Your logos</Label>
        <p className="text-xs text-muted-foreground">
          PNG with a transparent background works best. Up to {MAX_LOGOS}. Give each a name so you can tell them apart
          (e.g. “Main logo”, “White version”).
        </p>
        {kit.logos.length < MAX_LOGOS && (
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
            className={`w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 text-sm transition-colors ${
              over ? "border-primary bg-primary/5" : "border-black/40 hover:border-black"
            }`}
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
            <span className="font-medium">{uploading ? "Uploading…" : "Drop logos here or click to upload"}</span>
            <span className="text-xs text-muted-foreground">PNG, JPG or WebP · up to 5 MB each</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {kit.logos.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-3">
          {kit.logos.map((l) => (
            <li
              key={l.id}
              className={`flex items-center gap-3 rounded-lg border-2 p-2.5 bg-background ${
                active?.id === l.id ? "border-black nb-shadow-sm" : "border-black/20"
              }`}
            >
              <button
                type="button"
                title="Use this logo"
                onClick={() => save({ logoId: l.id })}
                className="w-14 h-14 shrink-0 rounded border bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] bg-[length:12px_12px] flex items-center justify-center"
              >
                <img src={l.url} alt={l.name} className="max-w-full max-h-full object-contain" />
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  aria-label="Logo name"
                  maxLength={60}
                  value={names[l.id] ?? l.name}
                  onChange={(e) => setNames({ ...names, [l.id]: e.target.value })}
                  onBlur={() => rename(l.id)}
                  className="h-8"
                />
                <p className="text-[11px] text-muted-foreground">{active?.id === l.id ? "Used on posts" : "Click image to use"}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Delete ${l.name}`} onClick={() => remove(l.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Placement */}
      <div className="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-5 items-start">
        <div
          className="relative w-[180px] aspect-[4/5] rounded-lg border-2 border-black bg-gradient-to-br from-primary/20 via-muted to-primary/10 overflow-hidden"
          aria-label="Logo placement preview"
        >
          <span className="absolute inset-x-6 top-1/3 h-2 rounded bg-black/10" />
          <span className="absolute inset-x-10 top-[42%] h-2 rounded bg-black/10" />
          {kit.logoEnabled && active && (
            <img
              src={active.url}
              alt=""
              className={`absolute ${pos.cls} w-[16%] min-w-[24px] object-contain transition-all duration-300`}
            />
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Put my logo on every image</p>
              <p className="text-xs text-muted-foreground">Added after the image is created, so it always looks sharp.</p>
            </div>
            <Switch
              checked={kit.logoEnabled}
              disabled={!kit.logos.length}
              onCheckedChange={(v) => save({ logoEnabled: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={kit.logoPosition === p.id ? "default" : "outline"}
                  disabled={!kit.logos.length || !kit.logoEnabled}
                  onClick={() => save({ logoPosition: p.id })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Colours */}
      <div className="space-y-2">
        <Label>Brand colours</Label>
        <p className="text-xs text-muted-foreground">Autopilot uses these in the images it creates. Up to {MAX_COLORS}.</p>
        <div className="flex flex-wrap items-center gap-2">
          {kit.colors.map((c, i) => (
            <span key={`${c}-${i}`} className="relative">
              <input
                type="color"
                aria-label={`Brand colour ${i + 1}`}
                value={picked[i] ?? c}
                onChange={(e) => setPicked({ ...picked, [i]: e.target.value })}
                onBlur={() => {
                  const v = picked[i];
                  if (v && v !== c) save({ colors: kit.colors.map((x, j) => (j === i ? v : x)) });
                  setPicked({});
                }}
                className="w-10 h-10 rounded border-2 border-black bg-transparent cursor-pointer p-0.5"
              />
              <button
                type="button"
                aria-label={`Remove colour ${c}`}
                onClick={() => save({ colors: kit.colors.filter((_, j) => j !== i) })}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {kit.colors.length < MAX_COLORS && (
            <Button type="button" size="sm" variant="outline" onClick={() => save({ colors: [...kit.colors, "#024BAB"] })}>
              <Plus className="w-4 h-4 mr-1" /> Add colour
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
