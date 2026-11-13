import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigateToLead(leadId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('LeadsStack', {
      screen: 'LeadDetail',
      params: { leadId },
    });
  }
}

/** Where a tapped notification (inbox row or push) should land. `screen` names the destination. */
export function navigateFromNotification(data?: {
  screen?: string;
  id?: string;
  leadId?: string;
}) {
  if (!navigationRef.isReady()) return;
  const screen = data?.screen;
  const leadId = data?.leadId || (screen === 'LeadDetail' ? data?.id : undefined);
  if (leadId) return navigateToLead(leadId);
  if (screen === 'Leads')
    return navigationRef.navigate('LeadsStack', { screen: 'LeadsList' });
  if (screen === 'SocialPlanner') return navigationRef.navigate('SocialStack');
  if (screen === 'Quotations' || screen === 'WhatsAppInbox')
    return navigationRef.navigate('More', { screen });
  navigationRef.navigate('More', { screen: 'Notifications' });
}
