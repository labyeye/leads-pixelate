import { useCountUp } from "@/hooks/useCountUp";

/** Counts up to `value`; non-numeric values render as-is. */
export function AnimatedNumber({ value }: { value: number | string }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const animated = useCountUp(isNum ? value : 0);
  if (!isNum) return <>{value}</>;
  return <>{Math.round(animated).toLocaleString()}</>;
}
