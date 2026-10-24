import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { leadsAPI } from '../services/api';
import {
  showNewLeadNotification,
  showFollowupNotification,
  showVisitNotification,
  showNewLeadsSummary,
  getLastLeadIds,
  setLastLeadIds,
  getLastLeadUser,
  setLastLeadUser,
  setBadgeCount,
} from '../services/notificationService';

const POLL_INTERVAL_FOREGROUND = 60_000; // 60s when app is open
const POLL_INTERVAL_BACKGROUND = 60_000; // 1min conceptually (AppState handles it)
const FOLLOWUP_WARN_MINUTES = 30; // notify if follow-up is within 30 minutes

function isWithinMinutes(dateStr: string, minutes: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  return diff > 0 && diff <= minutes * 60 * 1000;
}

export function useLeadPolling(enabled: boolean, userId?: string) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFirstPollRef = useRef(true);
  const pollingRef = useRef(false);
  // follow-up / visit reminders already shown this session (don't re-post every poll)
  const remindedRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (pollingRef.current) return; // never overlap polls
    pollingRef.current = true;
    try {
      const res = await leadsAPI.getAll();
      const leads: any[] = res.data || [];
      // The heavy list work below runs after animations/touches, so the UI stays smooth.
      await new Promise<void>(resolve =>
        InteractionManager.runAfterInteractions(() => resolve()),
      );

      // ── New lead detection ──
      const currentIds = leads.map((l: any) => l._id as string);
      const previousIds = await getLastLeadIds();

      // A different account than last time: start from its own baseline silently,
      // otherwise every lead of this account would look "new".
      const lastUser = await getLastLeadUser();
      const sameUser = !userId || lastUser === userId;
      if (userId && !sameUser) await setLastLeadUser(userId);
      else if (userId && !lastUser) await setLastLeadUser(userId);

      if (!isFirstPollRef.current && sameUser && previousIds.length > 0) {
        const seen = new Set(previousIds); // O(1) lookups instead of includes() per lead
        const newLeads = leads.filter((l: any) => !seen.has(l._id));
        if (newLeads.length > 3) {
          await showNewLeadsSummary(newLeads.length);
        } else {
          for (const lead of newLeads) {
            await showNewLeadNotification(lead);
          }
        }
        if (newLeads.length > 0) {
          await setBadgeCount(newLeads.length);
        }
      }

      // Skip the (large) storage write when nothing changed
      const unchanged =
        previousIds.length === currentIds.length &&
        previousIds[0] === currentIds[0] &&
        previousIds[previousIds.length - 1] ===
          currentIds[currentIds.length - 1];
      if (!unchanged || !sameUser) await setLastLeadIds(currentIds);
      isFirstPollRef.current = false;

      // ── Follow-up reminders ──
      const upcoming = leads.filter(
        (l: any) =>
          l.followUpDate &&
          isWithinMinutes(l.followUpDate, FOLLOWUP_WARN_MINUTES),
      );
      for (const lead of upcoming) {
        const key = `f_${lead._id}_${lead.followUpDate}`;
        if (remindedRef.current.has(key)) continue;
        remindedRef.current.add(key);
        await showFollowupNotification(lead);
      }

      // ── Visit reminders ──
      const upcomingVisits = leads.filter(
        (l: any) =>
          l.visitScheduledDate &&
          isWithinMinutes(l.visitScheduledDate, FOLLOWUP_WARN_MINUTES),
      );
      for (const lead of upcomingVisits) {
        const key = `v_${lead._id}_${lead.visitScheduledDate}`;
        if (remindedRef.current.has(key)) continue;
        remindedRef.current.add(key);
        await showVisitNotification(lead);
      }
    } catch {
      // Silently ignore — user might be offline
    } finally {
      pollingRef.current = false;
    }
  }, [userId]);

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
      isFirstPollRef.current = true;
      remindedRef.current.clear();
      return;
    }

    startPolling();

    const sub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === 'active' && prev !== 'active') {
          // App came to foreground — poll immediately then restart timer
          startPolling();
        } else if (nextState !== 'active' && prev === 'active') {
          // App went to background — stop the interval (battery friendly)
          stopPolling();
        }
      },
    );

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [enabled, startPolling, stopPolling]);
}
