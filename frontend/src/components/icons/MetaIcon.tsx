import metaLogo from "@/assets/images/logos/meta.png";
import { cn } from "@/lib/utils";

export function MetaIcon({ className }: { className?: string }) {
  return (
    <img
      src={metaLogo}
      alt="Meta"
      className={cn("object-contain", className)}
    />
  );
}
