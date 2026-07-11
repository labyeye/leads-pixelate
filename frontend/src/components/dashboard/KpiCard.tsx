import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  bg: string;
  trend?: "up" | "down";
  trendLabel?: string;
  to?: string;
  urgent?: boolean;
}

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
  const inner = (
    <div
      className={cn(
        "border-2 border-black p-4 flex flex-col gap-3 nb-card-hover bg-white",
        urgent && "bg-[#FFF0F0]",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
            bg,
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 border-2 border-black",
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
      <div>
        <p className="font-display font-bold text-3xl text-black">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
          {title}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
