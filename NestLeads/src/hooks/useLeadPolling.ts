import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {leadsAPI} from '../services/api';
import {
  showNewLeadNotification,
  showFollowupNotification,
  showVisitNotification,
  getLastLeadIds,
  setLastLeadIds,
  setBadgeCount,
} from '../services/notificationService';

const POLL_INTERVAL_FOREGROUND = 30_000; // 30s when app is open
const POLL_INTERVAL_BACKGROUND = 60_000; // 1min conceptually (AppState handles it)
const FOLLOWUP_WARN_MINUTES = 30; // notify if follow-up is within 30 minutes

function isWithinMinutes(dateStr: string, minutes: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  return diff > 0 && diff <= minutes * 60 * 1000;
}

export function useLeadPolling(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFirstPollRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await leadsAPI.getAll();
      const leads: any[] = res.data || [];

      // ── New lead detection ──
      const currentIds = leads.map((l: any) => l._id as string);
      const previousIds = await getLastLeadIds();

      if (!isFirstPollRef.current && previousIds.length > 0) {
        const newLeads = leads.filter(
          (l: any) => !previousIds.includes(l._id),
        );
        for (const lead of newLeads) {
          await showNewLeadNotification(lead);
        }
        if (newLeads.length > 0) {
          await setBadgeCount(newLeads.length);
        }
      }

      await setLastLeadIds(currentIds);
      isFirstPollRef.current = false;

      // ── Follow-up reminders ──
      const upcoming = leads.filter(
        (l: any) =>
          l.followUpDate && isWithinMinutes(l.followUpDate, FOLLOWUP_WARN_MINUTES),
      );
      for (const lead of upcoming) {
        await showFollowupNotification(lead);
      }

      // ── Visit reminders ──
      const upcomingVisits = leads.filter(
        (l: any) =>
          l.visitScheduledDate &&
          isWithinMinutes(l.visitScheduledDate, FOLLOWUP_WARN_MINUTES),
      );
      for (const lead of upcomingVisits) {
        await showVisitNotification(lead);
      }
    } catch {
      // Silently ignore — user might be offline
    }
  }, []);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    poll(); // immediate first poll
    timerRef.current = setInterval(poll, POLL_INTERVAL_FOREGROUND);
  }, [poll]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    startPolling();

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active' && prev !== 'active') {
        // App came to foreground — poll immediately then restart timer
        startPolling();
      } else if (nextState !== 'active' && prev === 'active') {
        // App went to background — stop the interval (battery friendly)
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [enabled, startPolling, stopPolling]);
}
