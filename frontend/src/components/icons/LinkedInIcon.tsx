import linkedinLogo from "@/assets/images/logos/linkedIn.webp";
import { cn } from "@/lib/utils";

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <img
      src={linkedinLogo}
      alt="LinkedIn"
      className={cn("object-contain", className)}
    />
  );
}
