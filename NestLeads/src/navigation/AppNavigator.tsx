import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {navigationRef} from './navigationRef';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';

import DashboardScreen from '../screens/DashboardScreen';
import LeadsListScreen from '../screens/LeadsListScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';
import AddLeadScreen from '../screens/AddLeadScreen';
import FiltersScreen from '../screens/FiltersScreen';
import ClientsScreen from '../screens/ClientsScreen';
import QuotationsScreen from '../screens/QuotationsScreen';
import QuotationFormScreen from '../screens/QuotationFormScreen';
import RolesPermissionsScreen from '../screens/RolesPermissionsScreen';
import MoreScreen from '../screens/MoreScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import WhatsAppInboxScreen from '../screens/WhatsAppInboxScreen';
import ProductsScreen from '../screens/ProductsScreen';
import PriceBooksScreen from '../screens/PriceBooksScreen';
import TradeDocumentsScreen from '../screens/TradeDocumentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import UsersScreen from '../screens/UsersScreen';
import IntegrationsScreen from '../screens/IntegrationsScreen';
import SocialPlannerScreen from '../screens/SocialPlannerScreen';
import AutopilotScreen from '../screens/AutopilotScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import ServicesScreen from '../screens/ServicesScreen';
import ApiKeysScreen from '../screens/ApiKeysScreen';
import SupportScreen from '../screens/SupportScreen';
import BillingScreen from '../screens/BillingScreen';
import WhatsAppLogsScreen from '../screens/WhatsAppLogsScreen';
import WhatsAppSetupScreen from '../screens/WhatsAppSetupScreen';
import LeadStatusesScreen from '../screens/LeadStatusesScreen';
import AdCampaignsHubScreen from '../screens/AdCampaignsHubScreen';
import LinkedInSetupScreen from '../screens/LinkedInSetupScreen';
import GoogleAdsSetupScreen from '../screens/GoogleAdsSetupScreen';
import AdPlatformLockedScreen from '../screens/AdPlatformLockedScreen';
import FacebookAdsDashboardScreen from '../screens/FacebookAdsDashboardScreen';
import FacebookAdCampaignsScreen from '../screens/FacebookAdCampaignsScreen';
import FacebookAdSetsScreen from '../screens/FacebookAdSetsScreen';
import FacebookAdsListScreen from '../screens/FacebookAdsListScreen';
import FacebookCampaignManagementScreen from '../screens/FacebookCampaignManagementScreen';
import LinkedInCampaignManagementScreen from '../screens/LinkedInCampaignManagementScreen';
import CampaignManagementOverviewScreen from '../screens/CampaignManagementOverviewScreen';
import CampaignReportsScreen from '../screens/CampaignReportsScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import TrashScreen from '../screens/TrashScreen';
import AccountSecurityScreen from '../screens/AccountSecurityScreen';

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: {leadId: string};
  AddLead: undefined;
  Filters: {filters: any; onApply: (f: any) => void};
};

export type RootTabParamList = {
  Dashboard: undefined;
  LeadsStack: undefined;
  Schedule: undefined;
  SocialStack: undefined;
  More: undefined;
};

export type SocialStackParamList = {
  SocialPlanner: undefined;
  CreatePost: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Reports: undefined;
  WhatsAppInbox: undefined;
  Products: undefined;
  PriceBooks: undefined;
  SalesOrders: {kind: "sales_order"} | undefined;
  PurchaseOrders: {kind: "purchase_order"} | undefined;
  Invoices: {kind: "invoice"} | undefined;
  Settings: undefined;
  Campaigns: undefined;
  Users: undefined;
  Integrations: undefined;
  Clients: undefined;
  Quotations: undefined;
  QuotationForm: {quotation?: any} | undefined;
  RolesPermissions: undefined;
  Autopilot: undefined;
  Services: undefined;
  ApiKeys: undefined;
  Support: undefined;
  Billing: undefined;
  WhatsAppLogs: undefined;
  WhatsAppSetup: undefined;
  LeadStatuses: undefined;
  AdCampaignsHub: undefined;
  LinkedInSetup: undefined;
  GoogleAdsSetup: undefined;
  AdPlatformLocked: {platform: 'linkedin' | 'google'; section: string};
  FacebookAdsDashboard: undefined;
  FacebookAdCampaigns: undefined;
  FacebookAdSets: undefined;
  FacebookAdsList: undefined;
  FacebookCampaignManagement: undefined;
  LinkedInCampaignManagement: undefined;
  CampaignManagementOverview: undefined;
  CampaignReports: undefined;
  ActivityLog: undefined;
  Trash: undefined;
  AccountSecurity: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const LeadsStack = createNativeStackNavigator<LeadsStackParamList>();
const SocialStack = createNativeStackNavigator<SocialStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function LeadsNavigator() {
  return (
    <LeadsStack.Navigator screenOptions={{headerShown: false}}>
      <LeadsStack.Screen name="LeadsList" component={LeadsListScreen} />
      <LeadsStack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <LeadsStack.Screen name="AddLead" component={AddLeadScreen} />
      <LeadsStack.Screen name="Filters" component={FiltersScreen} />
    </LeadsStack.Navigator>
  );
}

function SocialNavigator() {
  return (
    <SocialStack.Navigator screenOptions={{headerShown: false}}>
      <SocialStack.Screen name="SocialPlanner" component={SocialPlannerScreen} />
      <SocialStack.Screen name="CreatePost" component={CreatePostScreen} />
    </SocialStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{headerShown: false}}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} />
      <MoreStack.Screen name="WhatsAppInbox" component={WhatsAppInboxScreen} />
      <MoreStack.Screen name="Products" component={ProductsScreen} />
      <MoreStack.Screen name="PriceBooks" component={PriceBooksScreen} />
      <MoreStack.Screen name="SalesOrders" component={TradeDocumentsScreen} initialParams={{kind: "sales_order"}} />
      <MoreStack.Screen name="PurchaseOrders" component={TradeDocumentsScreen} initialParams={{kind: "purchase_order"}} />
      <MoreStack.Screen name="Invoices" component={TradeDocumentsScreen} initialParams={{kind: "invoice"}} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Campaigns" component={CampaignsScreen} />
      <MoreStack.Screen name="Users" component={UsersScreen} />
      <MoreStack.Screen name="Integrations" component={IntegrationsScreen} />
      <MoreStack.Screen name="Clients" component={ClientsScreen} />
      <MoreStack.Screen name="Quotations" component={QuotationsScreen} />
      <MoreStack.Screen name="QuotationForm" component={QuotationFormScreen} />
      <MoreStack.Screen name="RolesPermissions" component={RolesPermissionsScreen} />
      <MoreStack.Screen name="Autopilot" component={AutopilotScreen} />
      <MoreStack.Screen name="Services" component={ServicesScreen} />
      <MoreStack.Screen name="ApiKeys" component={ApiKeysScreen} />
      <MoreStack.Screen name="Support" component={SupportScreen} />
      <MoreStack.Screen name="Billing" component={BillingScreen} />
      <MoreStack.Screen name="WhatsAppLogs" component={WhatsAppLogsScreen} />
      <MoreStack.Screen name="WhatsAppSetup" component={WhatsAppSetupScreen} />
      <MoreStack.Screen name="LeadStatuses" component={LeadStatusesScreen} />
      <MoreStack.Screen name="AdCampaignsHub" component={AdCampaignsHubScreen} />
      <MoreStack.Screen name="LinkedInSetup" component={LinkedInSetupScreen} />
      <MoreStack.Screen name="GoogleAdsSetup" component={GoogleAdsSetupScreen} />
      <MoreStack.Screen name="AdPlatformLocked" component={AdPlatformLockedScreen} />
      <MoreStack.Screen name="FacebookAdsDashboard" component={FacebookAdsDashboardScreen} />
      <MoreStack.Screen name="FacebookAdCampaigns" component={FacebookAdCampaignsScreen} />
      <MoreStack.Screen name="FacebookAdSets" component={FacebookAdSetsScreen} />
      <MoreStack.Screen name="FacebookAdsList" component={FacebookAdsListScreen} />
      <MoreStack.Screen name="FacebookCampaignManagement" component={FacebookCampaignManagementScreen} />
      <MoreStack.Screen name="LinkedInCampaignManagement" component={LinkedInCampaignManagementScreen} />
      <MoreStack.Screen name="CampaignManagementOverview" component={CampaignManagementOverviewScreen} />
      <MoreStack.Screen name="CampaignReports" component={CampaignReportsScreen} />
      <MoreStack.Screen name="ActivityLog" component={ActivityLogScreen} />
      <MoreStack.Screen name="Trash" component={TrashScreen} />
      <MoreStack.Screen name="AccountSecurity" component={AccountSecurityScreen} />
    </MoreStack.Navigator>
  );
}

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarStyle: {
            height: 60 + insets.bottom,
            borderTopWidth: 2,
            borderTopColor: '#000',
            backgroundColor: '#fff',
            paddingBottom: 6 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          },
          tabBarActiveTintColor: '#024BAB',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarIcon: ({color, size, focused}) => {
            const icons: Record<string, string> = {
              Dashboard:        focused ? 'grid'             : 'grid-outline',
              LeadsStack:       focused ? 'people'           : 'people-outline',
              Schedule:         focused ? 'calendar'         : 'calendar-outline',
              SocialStack:      focused ? 'megaphone'        : 'megaphone-outline',
              More:             focused ? 'apps'             : 'apps-outline',
            };
            return <Icon name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
          },
        })}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen
          name="LeadsStack"
          component={LeadsNavigator}
          options={{tabBarLabel: 'Leads'}}
        />
        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{tabBarLabel: 'Schedule'}}
        />
        <Tab.Screen
          name="SocialStack"
          component={SocialNavigator}
          options={{tabBarLabel: 'Social'}}
        />
        <Tab.Screen
          name="More"
          component={MoreNavigator}
          options={{tabBarLabel: 'More'}}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
