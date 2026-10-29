import { useEffect, useState } from "react";
import { dashboardAPI } from "@/services/api";
import { cn } from "@/lib/utils";

interface Pace {
  configured: boolean;
  done?: number;
  target?: number;
  perMinutes?: number;
  pct?: number;
  tone?: "green" | "amber" | "red";
}

const LOOK = {
  green: { label: "On target", cls: "bg-[#16a34a] text-white" },
  amber: { label: "Behind", cls: "bg-[#f59e0b] text-black" },
  red: { label: "Off pace", cls: "bg-[#dc2626] text-white" },
};

// Staff-only: shows the signed-in person's own status against the calls target the admin set.
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

  if (!pace?.configured || !pace.tone) return null;
  const look = LOOK[pace.tone];
  const mins = pace.perMinutes || 60;
  const per = mins % 60 === 0 ? `${mins / 60} hr` : `${mins} min`;

  return (
    <div
      title={`${pace.done} of ${pace.target} calls in the last ${per}`}
      className={cn(
        "flex items-center gap-2 border-2 border-black px-2.5 py-1.5 text-xs font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        look.cls,
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current opacity-80 animate-pulse" />
      <span className="uppercase tracking-wider">{look.label}</span>
      <span className="tabular-nums hidden sm:inline">
        {pace.done}/{pace.target}
      </span>
    </div>
  );
}
