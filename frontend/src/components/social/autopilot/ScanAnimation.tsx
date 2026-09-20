import { useEffect, useState } from "react";
import { Check, Facebook, Instagram, Loader2 } from "lucide-react";

export const SCAN_STEPS = [
  { key: "profile", label: "Reading your profile" },
  { key: "posts", label: "Studying your recent posts" },
  { key: "style", label: "Learning your visual style" },
  { key: "profile_built", label: "Building your brand profile" },
] as const;

const INTRO_STEP = { key: "intro", label: "Reading your brand notes" } as const;
export const scanSteps = (hasIntro?: boolean) => (hasIntro ? [INTRO_STEP, ...SCAN_STEPS] : [...SCAN_STEPS]);

const STEP_MS = 1300; // each step stays visible at least this long, even if the server is faster

// Which step the server is on; a finished scan means every step is done.
export const scanTarget = (status: string, stage: string, hasIntro?: boolean) => {
  const steps = scanSteps(hasIntro);
  return status === "done" ? steps.length : Math.max(0, steps.findIndex((s) => s.key === stage));
};

interface Props {
  status: "idle" | "running" | "done" | "failed";
  stage: string;
  accountName?: string;
  platform?: string;
  avatar?: string;
  hasIntro?: boolean;
  onComplete?: () => void;
}

export function ScanAnimation({ status, stage, accountName, platform, avatar, hasIntro, onComplete }: Props) {
  const steps = scanSteps(hasIntro);
  const target = scanTarget(status, stage, hasIntro);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= target) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [shown, target]);

  const finished = shown >= steps.length;
  useEffect(() => {
    if (finished) onComplete?.();
  }, [finished, onComplete]);

  const Icon = platform === "facebook" ? Facebook : Instagram;

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center" aria-live="polite">
      {/* Radar + post grid */}
      <div className="relative mx-auto w-full max-w-[260px] aspect-square">
        {!finished &&
          [0, 0.8, 1.6].map((d) => (
            <span
              key={d}
              className="absolute inset-[22%] rounded-full border-2 border-primary/60 animate-ring-pulse motion-reduce:animate-none"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        <div className="absolute inset-[22%] rounded-full border-2 border-black bg-background nb-shadow overflow-hidden flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-10 h-10 text-primary" />
          )}
          {!finished && (
            <span className="absolute left-0 right-0 top-0 h-1.5 bg-primary/70 shadow-[0_0_12px_hsl(var(--primary))] animate-scan-sweep motion-reduce:hidden" />
          )}
        </div>
        {finished && (
          <span className="absolute right-[14%] bottom-[14%] w-9 h-9 rounded-full bg-green-500 border-2 border-black flex items-center justify-center animate-pop-in">
            <Check className="w-5 h-5 text-white" />
          </span>
        )}
        {/* Floating "post" tiles that light up as the scan advances */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const pos = [
            "left-0 top-[6%]",
            "right-0 top-[6%]",
            "left-[-4%] top-[42%]",
            "right-[-4%] top-[42%]",
            "left-0 bottom-[6%]",
            "right-0 bottom-[6%]",
          ][i];
          const lit = shown >= 2 || (shown === 1 && i < 3);
          return (
            <span
              key={i}
              className={`absolute ${pos} w-10 h-12 rounded border-2 border-black transition-all duration-500 ${
                lit
                  ? "bg-primary/20"
                  : "bg-muted bg-[linear-gradient(90deg,transparent,hsl(var(--background)),transparent)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none"
              }`}
            />
          );
        })}
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        {accountName && (
          <p className="text-sm text-muted-foreground">
            Scanning <span className="font-semibold text-foreground">{accountName}</span>
          </p>
        )}
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const done = shown > i;
            const active = shown === i && !finished && status !== "failed";
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  done || active ? "opacity-100" : "opacity-40"
                }`}
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full border-2 border-black flex items-center justify-center ${
                    done ? "bg-green-500" : active ? "bg-primary/10" : "bg-background"
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-white animate-pop-in" />
                  ) : active ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  ) : null}
                </span>
                <span className={active ? "font-semibold" : ""}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
