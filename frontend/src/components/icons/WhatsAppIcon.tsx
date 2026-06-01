import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { cn } from "@/lib/utils";

interface WhatsAppIconProps {
  className?: string;
  colored?: boolean; // true = green brand color, false = inherit current color
}

export function WhatsAppIcon({ className, colored = false }: WhatsAppIconProps) {
  return (
    <FontAwesomeIcon
      icon={faWhatsapp}
      className={cn(colored && "text-[#25D366]", className)}
    />
  );
}

// Wrapper that matches the LucideIcon interface (className only)
// Used in navigation config
export function WhatsAppNavIcon({ className }: { className?: string }) {
  return (
    <FontAwesomeIcon
      icon={faWhatsapp}
      className={className}
    />
  );
}
