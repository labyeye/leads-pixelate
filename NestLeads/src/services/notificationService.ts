import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native';
import {Platform, PermissionsAndroid} from 'react-native';
import storage from '../utils/storage';

export const CHANNEL_ID = 'nestleads_leads';
export const CHANNEL_FOLLOWUP = 'nestleads_followup';

export async function createNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'New Leads',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500],
    sound: 'default',
    visibility: AndroidVisibility.PUBLIC,
    badge: true,
    description: 'Notifications for new incoming leads',
  });
  await notifee.createChannel({
    id: CHANNEL_FOLLOWUP,
    name: 'Follow-up Reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
    sound: 'default',
    visibility: AndroidVisibility.PUBLIC,
    badge: true,
    description: 'Reminders for scheduled follow-ups and visits',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'NestLeads Notification Permission',
          message:
            'NestLeads needs notification permission to alert you about new leads and follow-ups instantly.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // Android < 13 doesn't need runtime permission
  }
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

export async function showNewLeadNotification(lead: {
  _id: string;
  name: string;
  source?: string;
  phone?: string;
  company?: string;
}) {
  await notifee.displayNotification({
    id: `lead_${lead._id}`,
    title: '🎯 New Lead Arrived!',
    body: `${lead.name}${lead.company ? ` · ${lead.company}` : ''}${lead.source ? ` via ${lead.source}` : ''}`,
    data: {leadId: lead._id, type: 'new_lead'},
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_notification',
      color: '#024BAB',
      pressAction: {id: 'open_lead', launchActivity: 'default'},
      actions: [
        {
          title: 'View Lead',
          pressAction: {id: 'open_lead', launchActivity: 'default'},
        },
        {
          title: 'Call',
          pressAction: {id: 'call_lead'},
        },
      ],
    },
  });
}

export async function showFollowupNotification(lead: {
  _id: string;
  name: string;
  followUpDate?: string;
}) {
  const time = lead.followUpDate
    ? new Date(lead.followUpDate).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'now';
  await notifee.displayNotification({
    id: `followup_${lead._id}`,
    title: '📅 Follow-up Due',
    body: `${lead.name} · Scheduled at ${time}`,
    data: {leadId: lead._id, type: 'followup'},
    android: {
      channelId: CHANNEL_FOLLOWUP,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_notification',
      color: '#FF751F',
      pressAction: {id: 'open_lead', launchActivity: 'default'},
    },
  });
}

export async function showVisitNotification(lead: {
  _id: string;
  name: string;
  visitScheduledDate?: string;
}) {
  const time = lead.visitScheduledDate
    ? new Date(lead.visitScheduledDate).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'now';
  await notifee.displayNotification({
    id: `visit_${lead._id}`,
    title: '🏢 Visit Scheduled',
    body: `${lead.name} · Visit at ${time}`,
    data: {leadId: lead._id, type: 'visit'},
    android: {
      channelId: CHANNEL_FOLLOWUP,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_notification',
      color: '#FF751F',
      pressAction: {id: 'open_lead', launchActivity: 'default'},
    },
  });
}

export async function setBadgeCount(count: number) {
  await notifee.setBadgeCount(count);
}

export async function clearAllNotifications() {
  await notifee.cancelAllNotifications();
  await notifee.setBadgeCount(0);
}

// Store last seen lead count for polling comparison
export async function getLastLeadCount(): Promise<number> {
  const val = await storage.getItem('last_lead_count');
  return val ? parseInt(val, 10) : -1;
}

export async function setLastLeadCount(count: number) {
  await storage.setItem('last_lead_count', String(count));
}

// Store last seen lead IDs so we know which are new
export async function getLastLeadIds(): Promise<string[]> {
  const val = await storage.getItem('last_lead_ids');
  try {
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export async function setLastLeadIds(ids: string[]) {
  await storage.setItem('last_lead_ids', JSON.stringify(ids));
}

export function setupForegroundNotificationHandler(
  onLeadPress: (leadId: string) => void,
) {
  return notifee.onForegroundEvent(({type, detail}) => {
    if (
      type === EventType.PRESS ||
      type === EventType.ACTION_PRESS
    ) {
      const leadId = detail.notification?.data?.leadId as string | undefined;
      if (leadId) onLeadPress(leadId);
    }
  });
}

export function setupBackgroundNotificationHandler() {
  notifee.onBackgroundEvent(async ({type, detail}) => {
    // Background tap is handled by the app resume flow via initial notification
    if (type === EventType.ACTION_PRESS) {
      const action = detail.pressAction?.id;
      const leadId = detail.notification?.data?.leadId as string | undefined;
      if (action === 'call_lead' && leadId) {
        // We can't navigate here, but we can store the intent
        await storage.setItem('pending_lead_action', leadId);
      }
    }
  });
}

export async function getInitialNotification() {
  return notifee.getInitialNotification();
}
