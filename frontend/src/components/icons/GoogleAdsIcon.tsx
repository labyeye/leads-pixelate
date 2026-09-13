import { cn } from "@/lib/utils";

export function GoogleAdsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("object-contain", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.5 4.5 3 15.8a3.5 3.5 0 1 0 6.06 3.5L15.5 8a3.5 3.5 0 1 0-6-3.5Z"
        fill="#FBBC04"
      />
      <path
        d="M9.5 4.5 3 15.8a3.5 3.5 0 1 0 6.06 3.5l6.5-11.3-6.06-3.5Z"
        fill="#4285F4"
      />
      <circle cx="18.5" cy="15.5" r="3.5" fill="#34A853" />
    </svg>
  );
}
