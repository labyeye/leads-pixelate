import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.65)_50%,transparent_75%)] bg-[length:200%_100%]", className)}
      {...props}
    />
  );
}

export { Skeleton };
