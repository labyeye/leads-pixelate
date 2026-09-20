import { useCallback, useEffect, useState } from "react";
import { autopilotAPI, type AutopilotStats } from "@/services/api";

export type RangeDays = 7 | 30 | 90;

// Loads the Autopilot numbers for a range and refreshes them while the page is open
// (posts get approved, published and rejected in the background).
export function useAutopilotStats(days: RangeDays) {
  const [stats, setStats] = useState<AutopilotStats | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await autopilotAPI.stats(days);
      setStats(res.data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Could not load numbers");
    }
  }, [days]);

  useEffect(() => {
    setStats(null);
    reload();
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  return { stats, error, reload };
}
