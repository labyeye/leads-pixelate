import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { dashboardAPI } from "@/services/api";
import { cn } from "@/lib/utils";

type Tone = "green" | "amber" | "red";

interface Metric {
  key: string;
  label: string;
  done: number;
  target: number;
  perMinutes: number;
  pct: number;
  tone: Tone;
}

interface Pace {
  configured: boolean;
  metrics?: Metric[];
  tone?: Tone;
}

const LOOK: Record<Tone, { label: string; cls: string; hex: string }> = {
  green: { label: "On target", cls: "bg-[#16a34a] text-white", hex: "#16a34a" },
  amber: { label: "Behind", cls: "bg-[#f59e0b] text-black", hex: "#f59e0b" },
  red: { label: "Off pace", cls: "bg-[#dc2626] text-white", hex: "#dc2626" },
};

const per = (m: number) =>
  m === 60 ? "hour" : m === 1440 ? "day" : m === 10080 ? "week" : m % 60 === 0 ? `${m / 60} hrs` : `${m} min`;

// Staff-only: the signed-in person's own progress on every target the admin set (calls,
// conversations, quotations, visits). The badge shows the worst of them; click for the list.
export function PaceBadge() {
  const [pace, setPace] = useState<Pace | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      dashboardAPI
        .getMyPace()
        .then((r) => alive && setPace(r.data))
        .catch(() => {});
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!pace?.configured || !pace.tone || !pace.metrics?.length) return null;
  const look = LOOK[pace.tone];
  const hit = pace.metrics.filter((m) => m.tone === "green").length;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 border-2 border-black px-2.5 py-1.5 text-xs font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          look.cls,
        )}
        aria-label="My targets"
      >
        <span className="w-2 h-2 rounded-full bg-current opacity-80 animate-pulse" />
        <span className="uppercase tracking-wider">{look.label}</span>
        <span className="tabular-nums hidden sm:inline">
          {hit}/{pace.metrics.length}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-30">
          <p className="px-3 py-2 border-b-2 border-black bg-slate-100 text-[11px] font-medium uppercase tracking-wider text-black">
            My targets
          </p>
          <ul className="divide-y divide-slate-200">
            {pace.metrics.map((m) => (
              <li key={m.key} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-black">{m.label}</span>
                  <span className="text-xs tabular-nums font-semibold" style={{ color: LOOK[m.tone].hex }}>
                    {m.done} / {m.target} · {LOOK[m.tone].label}
                  </span>
                </div>
                <div className="mt-1 h-2 border border-black bg-slate-100">
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, m.pct)}%`, backgroundColor: LOOK[m.tone].hex }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  target {m.target} per {per(m.perMinutes)}
                  {m.target > m.done ? ` · ${m.target - m.done} to go` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
