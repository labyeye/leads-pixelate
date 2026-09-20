import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BrandProfile } from "./useAutopilot";

function ChipList({
  label,
  hint,
  items,
  onChange,
  max = 6,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && items.length < max && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-background px-2.5 py-0.5 text-xs"
          >
            {it}
            <button
              type="button"
              aria-label={`Remove ${it}`}
              onClick={() => onChange(items.filter((x) => x !== it))}
              className="hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      {items.length < max && (
        <Input
          value={draft}
          maxLength={120}
          placeholder="Type and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}

const emptyCompetitive = (p: BrandProfile) => ({
  positioning: p.competitive?.positioning ?? "",
  whatTheyDoWell: p.competitive?.whatTheyDoWell ?? [],
  gapsToExploit: p.competitive?.gapsToExploit ?? [],
});

export function BrandProfileEditor({
  profile,
  saving,
  saveLabel = "Save",
  onSave,
}: {
  profile: BrandProfile;
  saving?: boolean;
  saveLabel?: string;
  onSave: (p: BrandProfile) => void;
}) {
  const [p, setP] = useState<BrandProfile>(profile);
  const set = <K extends keyof BrandProfile>(k: K, v: BrandProfile[K]) => setP({ ...p, [k]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bp-summary">About the business</Label>
        <Textarea
          id="bp-summary"
          rows={3}
          maxLength={600}
          value={p.summary}
          placeholder="What you do and who you serve"
          onChange={(e) => set("summary", e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bp-industry">Industry</Label>
          <Input id="bp-industry" maxLength={100} value={p.industry} onChange={(e) => set("industry", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bp-audience">Audience</Label>
          <Input id="bp-audience" maxLength={300} value={p.audience} onChange={(e) => set("audience", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bp-tone">Tone of voice</Label>
          <Input id="bp-tone" maxLength={200} value={p.tone} onChange={(e) => set("tone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bp-hash">Hashtag style</Label>
          <Input id="bp-hash" maxLength={200} value={p.hashtagStyle} onChange={(e) => set("hashtagStyle", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bp-visual">Visual style</Label>
        <Textarea
          id="bp-visual"
          rows={2}
          maxLength={300}
          value={p.visualStyle}
          placeholder="Colours, lighting, subjects of your images"
          onChange={(e) => set("visualStyle", e.target.value)}
        />
      </div>

      {p.palette.length > 0 && (
        <div className="space-y-1.5">
          <Label>Colours we noticed</Label>
          <div className="flex flex-wrap gap-2">
            {p.palette.map((c) => (
              <button
                key={c}
                type="button"
                title={`${c} — click to remove`}
                aria-label={`Remove colour ${c}`}
                onClick={() => set("palette", p.palette.filter((x) => x !== c))}
                className="w-8 h-8 rounded border-2 border-black"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border-2 border-black/20 p-3">
        <div>
          <p className="text-sm font-semibold">Against your competitors</p>
          <p className="text-xs text-muted-foreground">
            Filled in by the scan when you add competitors. Autopilot uses it to stand apart, never to copy them.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bp-positioning">How you stand apart</Label>
          <Textarea
            id="bp-positioning"
            rows={2}
            maxLength={400}
            value={p.competitive?.positioning ?? ""}
            onChange={(e) => set("competitive", { ...emptyCompetitive(p), positioning: e.target.value })}
          />
        </div>
        <ChipList
          label="What they do well"
          items={p.competitive?.whatTheyDoWell ?? []}
          onChange={(v) => set("competitive", { ...emptyCompetitive(p), whatTheyDoWell: v })}
          max={5}
        />
        <ChipList
          label="Gaps you can use"
          items={p.competitive?.gapsToExploit ?? []}
          onChange={(v) => set("competitive", { ...emptyCompetitive(p), gapsToExploit: v })}
          max={5}
        />
      </div>

      <ChipList label="Content pillars" hint="The themes your posts keep coming back to." items={p.contentPillars} onChange={(v) => set("contentPillars", v)} />
      <ChipList label="Do" items={p.doList} onChange={(v) => set("doList", v)} />
      <ChipList label="Avoid" items={p.avoidList} onChange={(v) => set("avoidList", v)} />

      <Button onClick={() => onSave(p)} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        {saveLabel}
      </Button>
    </div>
  );
}
