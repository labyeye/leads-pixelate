import { cn } from "@/lib/utils";
import whatsappLogo from "@/assets/images/logos/whatsapp.png";

interface WhatsAppIconProps {
  className?: string;
  colored?: boolean;
}

export function WhatsAppIcon({ className }: WhatsAppIconProps) {
  return (
    <img
      src={whatsappLogo}
      alt="WhatsApp"
      className={cn("object-contain", className)}
    />
  );
}

export const WhatsAppNavIcon = WhatsAppIcon;
