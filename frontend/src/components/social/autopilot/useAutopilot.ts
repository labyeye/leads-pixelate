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
  competitive: { positioning: string; whatTheyDoWell: string[]; gapsToExploit: string[] };
}

export interface Competitor {
  id: string;
  username: string;
  notes: string;
  followers: number | null;
  summary: string;
  error: string;
  readAt: string | null;
}

export interface Reference {
  id: string;
  url: string;
  note: string;
}

export type LogoPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface BrandKit {
  logos: { id: string; name: string; url: string }[];
  logoId: string;
  logoEnabled: boolean;
  logoMode: "fixed" | "auto";
  logoPosition: LogoPosition;
  colors: string[];
}

// One campaign's full state (GET /autopilot/campaigns/:id).
export interface AutopilotStatus {
  campaign: { id: string; name: string };
  configured: boolean;
  plan: string;
  limits: { plan: string; daysPerWeek: number; monthlyPosts: number };
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
    schedule: { days: number[]; times: string[] };
    contentTypes: string[];
    lessons: string[];
  };
  contentTypes: string[];
  intro: { text: string; pdfName: string };
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
  competitors: Competitor[];
  references: Reference[];
  campaignMonthCount: number;
  lastRunAt: string | null;
  lastError: string;
  monthCount: number;
  monthlyCap: number;
  accounts: {
    _id: string;
    platform: string;
    accountName: string;
    profilePicture?: string;
    campaign: { id: string; name: string } | null; // the campaign that already uses this account
  }[];
}

// Loads one campaign's status and keeps it fresh. Pass a short interval while a scan or a
// generation is running, a long one otherwise, or null to load once. campaignId null = nothing to load.
export function useAutopilot(campaignId: string | null, intervalMs: number | null, onError?: (message: string) => void) {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const errRef = useRef(onError);
  errRef.current = onError;

  const reload = useCallback(async () => {
    if (!campaignId) return null;
    try {
      const res = await autopilotAPI.campaign(campaignId).get();
      setStatus(res.data);
      return res.data as AutopilotStatus;
    } catch (err: any) {
      errRef.current?.(err.message || "Failed to load Autopilot");
      return null;
    }
  }, [campaignId]);

  // Another campaign: don't show the previous one's data while the new one loads.
  useEffect(() => setStatus(null), [campaignId]);

  useEffect(() => {
    reload();
    if (!intervalMs) return;
    const t = setInterval(reload, intervalMs);
    return () => clearInterval(t);
  }, [reload, intervalMs]);

  return { status, reload };
}
