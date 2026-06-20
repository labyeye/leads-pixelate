import {createNavigationContainerRef} from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigateToLead(leadId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('LeadsStack', {
      screen: 'LeadDetail',
      params: {leadId},
    });
  }
}
