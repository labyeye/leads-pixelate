import { Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";

import fbLogo from "@/assets/images/logos/facebook.png";
import imLogo from "@/assets/images/logos/indiamart.png";
import jdLogo from "@/assets/images/logos/justdial.webp";
import tiLogo from "@/assets/images/logos/tradeindia.webp";
import igLogo from "@/assets/images/logos/instagram.webp";
import metaLogo from "@/assets/images/logos/meta.png";
const LogoImg = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} className="w-3.5 h-3.5 shrink-0 object-contain" />
);

type SourceCfg = {
  icon: React.ReactNode;
  bg: string;
  text: string;
  border: string;
};

const SOURCE_CONFIG: Record<string, SourceCfg> = {
  Facebook: {
    icon: <LogoImg src={fbLogo} alt="Facebook" />,
    bg: "bg-[#1877F2]",
    text: "text-white",
    border: "border-[#0d65d9]",
  },
  Instagram: {
    icon: <LogoImg src={igLogo} alt="Instagram" />,
    bg: "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737]",
    text: "text-white",
    border: "border-[#E1306C]",
  },
  Meta: {
    icon: <LogoImg src={metaLogo} alt="Meta" />,
    bg: "bg-[#0668E1]",
    text: "text-white",
    border: "border-[#0557c2]",
  },
  IndiaMART: {
    icon: <LogoImg src={imLogo} alt="IndiaMART" />,
    bg: "bg-[#FB923C]",
    text: "text-white",
    border: "border-[#ea7d22]",
  },
  TradeIndia: {
    icon: <LogoImg src={tiLogo} alt="TradeIndia" />,
    bg: "bg-[#22C55E]",
    text: "text-white",
    border: "border-[#16a34a]",
  },
  Justdial: {
    icon: <LogoImg src={jdLogo} alt="Justdial" />,
    bg: "bg-[#EF4444]",
    text: "text-white",
    border: "border-[#dc2626]",
  },
  Website: {
    icon: <Globe className="w-3 h-3 shrink-0" />,
    bg: "bg-[#A855F7]",
    text: "text-white",
    border: "border-[#9333ea]",
  },
  Manual: {
    icon: <User className="w-3 h-3 shrink-0" />,
    bg: "bg-[#6B7280]",
    text: "text-white",
    border: "border-[#4b5563]",
  },
};

const FALLBACK_CFG: SourceCfg = {
  icon: <User className="w-3 h-3 shrink-0" />,
  bg: "bg-[#6B7280]",
  text: "text-white",
  border: "border-[#4b5563]",
};

interface SourceBadgeProps {
  source?: string;
  size?: "sm" | "md";
}

export function SourceBadge({ source, size = "md" }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source || ""] || FALLBACK_CFG;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold border uppercase tracking-wide leading-none",
        cfg.bg,
        cfg.text,
        cfg.border,
        size === "sm"
          ? "text-[9px] px-1.5 py-0.5"
          : "text-[10px] px-2 py-1",
      )}
    >
      {cfg.icon}
      {source || "Manual"}
    </span>
  );
}
