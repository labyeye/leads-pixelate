import { useEffect, useState } from "react";
import { Check, Phone, MessageCircle, FileText, CalendarCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
}

const TONE: Record<Tone, { word: string; cls: string }> = {
  green: { word: "On target", cls: "bg-[#16a34a] text-white" },
  amber: { word: "Behind", cls: "bg-[#f59e0b] text-black" },
  red: { word: "Off pace", cls: "bg-[#dc2626] text-white" },
};

const SHORT: Record<string, { label: string; icon: LucideIcon }> = {
  calls: { label: "Calls", icon: Phone },
  conversations: { label: "Convos", icon: MessageCircle },
  quotations: { label: "Quotes", icon: FileText },
  visits: { label: "Visits", icon: CalendarCheck },
};

const per = (m: number) =>
  m === 60 ? "hour" : m === 1440 ? "day" : m === 10080 ? "week" : m % 60 === 0 ? `${m / 60} hrs` : `${m} min`;

// Staff-only: one badge per target the admin set (calls, conversations, quotations, visits),
// each coloured by how that target is going. Hover a badge for the detail.
export function PaceBadge() {
  const [pace, setPace] = useState<Pace | null>(null);

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

  if (!pace?.configured || !pace.metrics?.length) return null;

  return (
    <div className="flex items-center gap-1.5 max-w-[55vw] lg:max-w-none overflow-x-auto py-1 pr-1">
      {pace.metrics.map((m) => {
        const short = SHORT[m.key] ?? { label: m.label, icon: Phone };
        const Icon = m.tone === "green" ? Check : short.icon;
        const togo = Math.max(0, m.target - m.done);
        return (
          <div
            key={m.key}
            title={`${short.label}: ${m.done} of ${m.target} per ${per(m.perMinutes)} — ${TONE[m.tone].word}${
              togo ? ` (${togo} to go)` : ""
            }`}
            className={cn(
              "shrink-0 flex items-center gap-1.5 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
              TONE[m.tone].cls,
            )}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="text-[11px] font-semibold uppercase tracking-wide leading-none">
              {short.label}
            </span>
            <span className="text-xs font-bold tabular-nums leading-none border-l-2 border-current/40 pl-1.5">
              {m.done}/{m.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}
