import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { notificationsAPI } from '../services/api';

/** Unread count for the bell badge: checked on mount, when the app comes back, and every minute. */
export function useUnreadNotifications(enabled = true) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsAPI.unreadCount();
      setUnread(res.unread || 0);
    } catch {
      /* offline: keep the last number */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, refresh]);

  return { unread, refresh };
}
