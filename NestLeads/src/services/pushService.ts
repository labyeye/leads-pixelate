/**
 * Push notifications (Firebase Cloud Messaging).
 *
 * Native setup lives in android/app/google-services.json, ios/NestLeads/GoogleService-Info.plist and AppDelegate.swift.
 * The Firebase module is loaded lazily so an app binary built without it keeps working (push is just off and the
 * in-app inbox plus the local lead alerts carry on as before).
 */
import { Platform, PermissionsAndroid } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { notificationsAPI } from './api';

export const PUSH_CHANNEL = 'nestleads_push';

type PushData = { type?: string; screen?: string; id?: string } | undefined;

function fcm(): any | null {
  try {
    return require('@react-native-firebase/messaging');
  } catch {
    return null;
  }
}

let currentToken: string | null = null;
let active = false;

/** True once this phone is registered for server push, so local alerts don't double up. */
export const isPushActive = () => active;

async function register(token: string) {
  currentToken = token;
  await notificationsAPI.registerDevice(token);
  active = true;
}

async function askPermission(m: any): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await m.requestPermission(m.getMessaging());
  return (
    status === m.AuthorizationStatus.AUTHORIZED ||
    status === m.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Asks for permission, registers this phone with the backend and listens for pushes.
 * onOpen fires when the user taps a notification. Returns a cleanup function.
 * Never throws: without Firebase (old binary, simulator) it is a no-op.
 */
export async function setupPushNotifications(
  onOpen?: (data: PushData) => void,
): Promise<() => void> {
  const m = fcm();
  if (!m) return () => {};
  try {
    const messaging = m.getMessaging();
    if (!(await askPermission(m))) return () => {};

    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: PUSH_CHANNEL,
        name: 'Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const token = await m.getToken(messaging);
    if (token) await register(token);

    const unsubs: (() => void)[] = [
      m.onTokenRefresh(messaging, (t: string) => {
        register(t).catch(() => {});
      }),
      // App open: the system shows no banner for a push, so show it ourselves (a tap is handled in App.tsx).
      m.onMessage(messaging, async (msg: any) => {
        const n = msg?.notification;
        if (!n) return;
        await notifee.displayNotification({
          title: n.title || 'NestLeads',
          body: n.body || '',
          data: msg.data || {},
          android: {
            channelId: PUSH_CHANNEL,
            smallIcon: 'ic_notification',
            color: '#024BAB',
            pressAction: { id: 'default' },
          },
        });
      }),
      // App in background: the user tapped the notification.
      m.onNotificationOpenedApp(messaging, (msg: any) => onOpen?.(msg?.data)),
    ];

    // App was closed and got opened by tapping a notification.
    const initial = await m.getInitialNotification(messaging);
    if (initial) setTimeout(() => onOpen?.(initial.data), 800);

    return () => unsubs.forEach(u => u());
  } catch (e: any) {
    active = false;
    return () => {};
  }
}

/** Call before signing out so this phone stops receiving the previous user's notifications. */
export async function unregisterPush() {
  active = false;
  try {
    if (currentToken) await notificationsAPI.removeDevice(currentToken);
    currentToken = null;
  } catch {}
}
