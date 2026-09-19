import { useCallback, useEffect, useRef, useState } from "react";
import { autopilotAPI } from "@/services/api";

export interface BrandProfile {
  summary: string;
  industry: string;
  audience: string;
  tone: string;
  visualStyle: string;
  hashtagStyle: string;
  contentPillars: string[];
  topPerformingThemes: string[];
  doList: string[];
  avoidList: string[];
  palette: string[];
}

export type LogoPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface BrandKit {
  logos: { id: string; name: string; url: string }[];
  logoId: string;
  logoEnabled: boolean;
  logoPosition: LogoPosition;
  colors: string[];
}

export interface AutopilotStatus {
  configured: boolean;
  price: number;
  trialDays: number;
  entitlement: { state: "none" | "trial" | "paid" | "expired"; endsAt: string | null };
  settings: {
    enabled: boolean;
    postsPerDay: number;
    tone: string;
    language: string;
    notes: string;
    reviewFirst: boolean;
    accountIds: string[];
  };
  running: boolean;
  progress: { stage: string; at: string } | null;
  onboarded: boolean;
  firstApproved: boolean;
  analysis: {
    status: "idle" | "running" | "done" | "failed";
    stage: string;
    error: string;
    note: string;
    at: string | null;
  };
  brandProfile: BrandProfile;
  brandKit: BrandKit;
  lastRunAt: string | null;
  lastError: string;
  monthCount: number;
  monthlyCap: number;
  accounts: { _id: string; platform: string; accountName: string; profilePicture?: string }[];
}

// Loads Autopilot status and keeps it fresh. Pass a short interval while a scan or
// a generation is running, a long one otherwise, or null to load once.
export function useAutopilot(intervalMs: number | null, onError?: (message: string) => void) {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const errRef = useRef(onError);
  errRef.current = onError;

  const reload = useCallback(async () => {
    try {
      const res = await autopilotAPI.get();
      setStatus(res.data);
      return res.data as AutopilotStatus;
    } catch (err: any) {
      errRef.current?.(err.message || "Failed to load Autopilot");
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
    if (!intervalMs) return;
    const t = setInterval(reload, intervalMs);
    return () => clearInterval(t);
  }, [reload, intervalMs]);

  return { status, reload };
}
