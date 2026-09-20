import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AutopilotStatus } from "./useAutopilot";

const DAYS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];
const MAX_TIMES = 2;

const TYPES: Record<string, { label: string; hint: string }> = {
  product: { label: "Products & services", hint: "Show what you sell" },
  behind_the_scenes: { label: "Behind the scenes", hint: "Your team, workspace, process" },
  tips: { label: "Tips & advice", hint: "Useful ideas for your audience" },
  social_proof: { label: "Customer stories", hint: "Only real ones from your data" },
  occasion: { label: "Festivals & occasions", hint: "Seasonal and festive posts" },
  announcement: { label: "News & announcements", hint: "Launches and updates" },
};

export type PlanPatch = {
  schedule: { days: number[]; times: string[] };
  contentTypes: string[];
  language: string;
  tone: string;
  notes: string;
  reviewFirst: boolean;
};

// When to post (days + times, India time) and what to post about.
export function PostingPlan({
  status,
  saving,
  saveLabel = "Save",
  onSave,
}: {
  status: AutopilotStatus;
  saving?: boolean;
  saveLabel?: string;
  onSave: (patch: PlanPatch) => void;
}) {
  const s = status.settings;
  const maxDays = status.limits?.daysPerWeek ?? 7; // the plan decides how many posting days a week
  const [days, setDays] = useState<number[]>(
    s.schedule?.days?.length ? s.schedule.days.slice(0, maxDays) : DAYS.slice(0, maxDays).map((x) => x.d),
  );
  const [times, setTimes] = useState<string[]>(s.schedule?.times?.length ? s.schedule.times : ["10:00"]);
  const [types, setTypes] = useState<string[]>(s.contentTypes?.length ? s.contentTypes : Object.keys(TYPES));
  const [language, setLanguage] = useState(s.language);
  const [tone, setTone] = useState(s.tone || status.brandProfile?.tone || "");
  const [notes, setNotes] = useState(s.notes);
  const [reviewFirst, setReviewFirst] = useState(s.reviewFirst);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const valid = days.length > 0 && days.length <= maxDays && times.length > 0 && times.every(Boolean) && types.length > 0;
  const trial = status.entitlement.state === "trial" || status.entitlement.state === "none";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Days to post</Label>
        <p className="text-xs text-muted-foreground">
          Your plan allows up to {maxDays} posting day{maxDays === 1 ? "" : "s"} a week
          {days.length >= maxDays && maxDays < 7 ? ". Untick a day to pick another." : "."}
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ d, label }) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days.includes(d) ? "default" : "outline"}
              aria-pressed={days.includes(d)}
              disabled={!days.includes(d) && days.length >= maxDays}
              onClick={() => setDays(toggle(days, d))}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Time of day (India time)</Label>
        <p className="text-xs text-muted-foreground">
          One post is published at each time, up to {MAX_TIMES} a day. Autopilot prepares each post about a day ahead.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {times.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <Input
                type="time"
                aria-label={`Post time ${i + 1}`}
                value={t}
                onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-32"
              />
              {times.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove time"
                  onClick={() => setTimes(times.filter((_, j) => j !== i))}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </span>
          ))}
          {times.length < MAX_TIMES && (
            <Button type="button" size="sm" variant="outline" onClick={() => setTimes([...times, "18:00"])}>
              <Plus className="w-4 h-4 mr-1" /> Add a time
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>What to post</Label>
        <p className="text-xs text-muted-foreground">Autopilot rotates through the kinds you tick.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {Object.entries(TYPES).map(([key, t]) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-lg border-2 border-black/20 has-[:checked]:border-black has-[:checked]:nb-shadow-sm p-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1 accent-[hsl(var(--primary))]"
                checked={types.includes(key)}
                onChange={() => setTypes(toggle(types, key))}
              />
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Hinglish">Hinglish</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-tone">Brand tone (optional)</Label>
          <Input
            id="plan-tone"
            maxLength={200}
            placeholder="e.g. friendly, professional"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-notes">Topics to focus on or avoid (optional)</Label>
        <Textarea
          id="plan-notes"
          rows={3}
          maxLength={500}
          placeholder="e.g. push the summer collection, never mention competitors"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-black/20 p-3">
        <div>
          <p className="text-sm font-medium">Always ask me before posting</p>
          <p className="text-xs text-muted-foreground">
            {trial
              ? "During your free trial every post waits for your approval anyway. After that, turn this on to keep reviewing."
              : "Off = posts go out on their own. On = every post waits for your approval."}
          </p>
        </div>
        <Switch checked={reviewFirst} onCheckedChange={setReviewFirst} />
      </div>

      <Button
        disabled={saving || !valid}
        onClick={() =>
          onSave({
            schedule: { days, times: [...times].sort() },
            contentTypes: types,
            language,
            tone,
            notes,
            reviewFirst,
          })
        }
      >
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        {saveLabel}
      </Button>
      {!valid && <p className="text-xs text-amber-700">Pick at least one day, one time and one kind of post.</p>}
    </div>
  );
}
