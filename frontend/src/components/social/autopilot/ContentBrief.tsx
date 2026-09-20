import { useState } from "react";
import { GalleryHorizontal, Image as ImageIcon, Loader2, Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AutopilotStatus } from "./useAutopilot";

export const CTA_TYPES: Record<string, string> = {
  none: "No call to action",
  learn_more: "Learn more",
  book: "Book a call / demo",
  call: "Call us",
  whatsapp: "WhatsApp us",
  visit: "Visit our website",
  shop: "Shop / order now",
  custom: "My own wording",
};

const DURATIONS = [
  { v: 7, label: "1 week" },
  { v: 14, label: "2 weeks" },
  { v: 30, label: "1 month" },
  { v: 60, label: "2 months" },
  { v: 90, label: "3 months" },
  { v: 0, label: "Until I pause it" },
];

export type BriefPatch = {
  brief: AutopilotStatus["settings"]["brief"];
  timeline: { days: number };
};

// What each post should be: format, goal, what to include, the call to action, free-form
// instructions and how long the campaign runs.
export function ContentBrief({
  status,
  saving,
  saveLabel = "Save",
  onSave,
}: {
  status: AutopilotStatus;
  saving?: boolean;
  saveLabel?: string;
  onSave: (patch: BriefPatch) => void;
}) {
  const b = status.settings.brief;
  const [format, setFormat] = useState<"image" | "carousel">(b.format);
  const [slides, setSlides] = useState(b.slides);
  const [goal, setGoal] = useState(b.goal);
  const [include, setInclude] = useState<string[]>(b.include);
  const [draft, setDraft] = useState("");
  const [ctaType, setCtaType] = useState(b.cta.type);
  const [ctaText, setCtaText] = useState(b.cta.text);
  const [ctaLink, setCtaLink] = useState(b.cta.link);
  const [ctaPhone, setCtaPhone] = useState(b.cta.phone);
  const [instructions, setInstructions] = useState(b.instructions);
  const [days, setDays] = useState(status.settings.timeline.days);

  const addInclude = () => {
    const v = draft.trim();
    if (v && !include.includes(v) && include.length < 10) setInclude([...include, v]);
    setDraft("");
  };
  const needsLink = ["learn_more", "book", "visit", "shop"].includes(ctaType);
  const needsPhone = ["call", "whatsapp"].includes(ctaType);

  const linkBad = !!ctaLink && !/^https?:\/\//i.test(ctaLink);

  const formats = [
    { id: "image", label: "Single image", icon: ImageIcon, hint: "One picture per post" },
    { id: "carousel", label: "Carousel", icon: GalleryHorizontal, hint: "Swipeable slides telling a story" },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Label>What should each post be?</Label>
        <div className="grid sm:grid-cols-3 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`text-left rounded-lg border-2 p-3 transition-colors ${
                format === f.id ? "border-black bg-primary/10 nb-shadow-sm" : "border-black/20 hover:border-black/50"
              }`}
            >
              <f.icon className="w-5 h-5 mb-1" />
              <p className="text-sm font-semibold">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </button>
          ))}
          <div className="rounded-lg border-2 border-dashed border-black/20 p-3 opacity-60" aria-disabled="true">
            <Video className="w-5 h-5 mb-1" />
            <p className="text-sm font-semibold">Video / Reel</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
        {format === "carousel" && (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor="slides" className="text-sm font-normal">
              Slides per post
            </Label>
            <Select value={String(slides)} onValueChange={(v) => setSlides(Number(v))}>
              <SelectTrigger id="slides" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Each slide is an AI image, so more slides use more AI credits.</span>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <Label htmlFor="goal">What is the goal of these posts?</Label>
        <Input
          id="goal"
          value={goal}
          maxLength={200}
          placeholder="e.g. Get demo bookings for our HR software"
          onChange={(e) => setGoal(e.target.value)}
        />
      </section>

      <section className="space-y-2">
        <Label htmlFor="include">What should the posts include?</Label>
        <div className="flex gap-2">
          <Input
            id="include"
            value={draft}
            maxLength={100}
            placeholder="e.g. free setup, 24x7 support, our new payroll module"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInclude();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addInclude} aria-label="Add">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {!!include.length && (
          <ul className="flex flex-wrap gap-2">
            {include.map((x) => (
              <li key={x} className="inline-flex items-center gap-1 rounded-full border-2 border-black px-2.5 py-0.5 text-xs">
                {x}
                <button type="button" aria-label={`Remove ${x}`} onClick={() => setInclude(include.filter((y) => y !== x))}>
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <Label>Call to action</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          <Select value={ctaType} onValueChange={setCtaType}>
            <SelectTrigger aria-label="Call to action type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CTA_TYPES).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ctaType !== "none" && (
            <Input
              aria-label="Call to action wording"
              value={ctaText}
              maxLength={80}
              placeholder={ctaType === "custom" ? "Exact wording, e.g. Start your free trial" : "Wording (optional), e.g. Book your free demo"}
              onChange={(e) => setCtaText(e.target.value)}
            />
          )}
          {needsLink && (
            <Input
              aria-label="Call to action link"
              type="url"
              value={ctaLink}
              placeholder="https://yourwebsite.com/demo"
              onChange={(e) => setCtaLink(e.target.value)}
              aria-invalid={linkBad}
            />
          )}
          {needsPhone && (
            <Input
              aria-label="Call to action phone"
              type="tel"
              value={ctaPhone}
              placeholder="+91 98765 43210"
              onChange={(e) => setCtaPhone(e.target.value)}
            />
          )}
        </div>
        {linkBad && <p className="text-xs text-red-600">The link must start with http:// or https://</p>}
        {needsLink && (
          <p className="text-xs text-muted-foreground">Instagram captions can't hold a clickable link, so add it to your bio for Instagram.</p>
        )}
      </section>

      <section className="space-y-2">
        <Label htmlFor="instructions">Instructions for the AI</Label>
        <Textarea
          id="instructions"
          rows={4}
          maxLength={1500}
          value={instructions}
          placeholder="Anything else: how the posts should look and read, what to always or never show, offers to mention, festivals to cover..."
          onChange={(e) => setInstructions(e.target.value)}
        />
      </section>

      <section className="space-y-2">
        <Label htmlFor="duration">How long should this campaign run?</Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger id="duration" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d.v} value={String(d.v)}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">The countdown starts when you start the campaign; it stops by itself at the end.</p>
      </section>

      <Button
        disabled={saving || linkBad}
        onClick={() =>
          onSave({
            brief: {
              format,
              slides,
              goal: goal.trim(),
              cta: { type: ctaType, text: ctaText.trim(), link: ctaLink.trim(), phone: ctaPhone.trim() },
              include,
              instructions: instructions.trim(),
            },
            timeline: { days },
          })
        }
      >
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        {saveLabel}
      </Button>
    </div>
  );
}
