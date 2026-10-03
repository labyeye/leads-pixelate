import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  /** Tailwind bg class carrying the accent hex, e.g. "bg-[#024BAB]". */
  bg: string;
  trend?: "up" | "down";
  trendLabel?: string;
  to?: string;
  urgent?: boolean;
}

/**
 * Summary card — same look as the Students / StatCard design:
 * solid icon chip, big number, uppercase label.
 */
export function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  bg,
  trend,
  trendLabel,
  to,
  urgent,
}: KpiCardProps) {
  const hex = bg.match(/#[0-9A-Fa-f]{6}/)?.[0]?.toUpperCase() ?? "#6B7280";
  const color = hex;
  const inner = (
    <div
      className={cn(
        "border-2 border-black p-4 flex items-center gap-3 nb-card-hover",
        urgent ? "bg-[#FFF0F0]" : "bg-white",
      )}
    >
      <div
        className="w-10 h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center shrink-0"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-black leading-tight">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground truncate">{sub}</p>
        )}
      </div>
      {trend && (
        <span
          className={cn(
            "self-start flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 border-2 border-black",
            trend === "up"
              ? "bg-[#A3E635] text-black"
              : "bg-[#EF4444] text-white",
          )}
        >
          {trend === "up" ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trendLabel}
        </span>
      )}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
