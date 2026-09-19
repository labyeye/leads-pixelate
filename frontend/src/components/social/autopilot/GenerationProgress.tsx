import { Check, Loader2, Sparkles } from "lucide-react";

export const GEN_STEPS = [
  { key: "planning", label: "Planning your post", hint: "Choosing a topic that fits your brand" },
  { key: "creating", label: "Writing the caption & creating the image", hint: "Gemini is drafting and designing" },
  { key: "review", label: "Quality check", hint: "Claude reviews the caption and image" },
] as const;

// -1 = not started; GEN_STEPS.length = finished
export const genIndex = (stage: string | undefined) =>
  stage === "done" ? GEN_STEPS.length : Math.max(-1, GEN_STEPS.findIndex((s) => s.key === stage));

export function GenerationProgress({ stage }: { stage?: string }) {
  const idx = genIndex(stage);
  const pct = Math.round((Math.max(0, idx) / GEN_STEPS.length) * 100);
  return (
    <div className="rounded-lg border-2 border-black bg-background nb-shadow p-5 space-y-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full border-2 border-black bg-primary flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white animate-pulse motion-reduce:animate-none" />
        </span>
        <div>
          <p className="font-semibold text-sm">Creating your first post</p>
          <p className="text-xs text-muted-foreground">This takes about a minute.</p>
        </div>
      </div>

      <div className="h-2 rounded-full border border-black bg-muted overflow-hidden">
        <div
          className="h-full bg-primary bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none transition-[width] duration-700"
          style={{ width: `${Math.max(8, pct)}%` }}
        />
      </div>

      <ol className="space-y-3">
        {GEN_STEPS.map((s, i) => {
          const done = idx > i;
          const active = idx === i || (idx === -1 && i === 0);
          return (
            <li key={s.key} className={`flex items-start gap-3 ${done || active ? "" : "opacity-40"}`}>
              <span
                className={`mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 border-black flex items-center justify-center ${
                  done ? "bg-green-500" : "bg-background"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-white animate-pop-in" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : null}
              </span>
              <span>
                <span className={`block text-sm ${active ? "font-semibold" : ""}`}>{s.label}</span>
                {active && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
