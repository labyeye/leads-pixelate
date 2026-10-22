import React from 'react';
import { API_BASE as TRACK_BASE } from '../services/api';
import { initUsageTracker, setUsageIdentity, trackNavState } from '../utils/usageTracker';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TabBounce } from '../components/motion';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

initUsageTracker(TRACK_BASE);

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string };
  AddLead: undefined;
  Filters: { filters: any; onApply: (f: any) => void };
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
  SalesOrders: { kind: 'sales_order' } | undefined;
  PurchaseOrders: { kind: 'purchase_order' } | undefined;
  Invoices: { kind: 'invoice' } | undefined;
  Settings: undefined;
  Campaigns: undefined;
  Users: undefined;
  Integrations: undefined;
  Clients: undefined;
  Quotations: undefined;
  QuotationForm: { quotation?: any } | undefined;
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
  AdPlatformLocked: { platform: 'linkedin' | 'google'; section: string };
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
    <LeadsStack.Navigator screenOptions={{ headerShown: false }}>
      <LeadsStack.Screen name="LeadsList" component={LeadsListScreen} />
      <LeadsStack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <LeadsStack.Screen name="AddLead" component={AddLeadScreen} />
      <LeadsStack.Screen name="Filters" component={FiltersScreen} />
    </LeadsStack.Navigator>
  );
}

function SocialNavigator() {
  return (
    <SocialStack.Navigator screenOptions={{ headerShown: false }}>
      <SocialStack.Screen
        name="SocialPlanner"
        component={SocialPlannerScreen}
      />
      <SocialStack.Screen name="CreatePost" component={CreatePostScreen} />
    </SocialStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} />
      <MoreStack.Screen name="WhatsAppInbox" component={WhatsAppInboxScreen} />
      <MoreStack.Screen name="Products" component={ProductsScreen} />
      <MoreStack.Screen name="PriceBooks" component={PriceBooksScreen} />
      <MoreStack.Screen
        name="SalesOrders"
        component={TradeDocumentsScreen}
        initialParams={{ kind: 'sales_order' }}
      />
      <MoreStack.Screen
        name="PurchaseOrders"
        component={TradeDocumentsScreen}
        initialParams={{ kind: 'purchase_order' }}
      />
      <MoreStack.Screen
        name="Invoices"
        component={TradeDocumentsScreen}
        initialParams={{ kind: 'invoice' }}
      />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Campaigns" component={CampaignsScreen} />
      <MoreStack.Screen name="Users" component={UsersScreen} />
      <MoreStack.Screen name="Integrations" component={IntegrationsScreen} />
      <MoreStack.Screen name="Clients" component={ClientsScreen} />
      <MoreStack.Screen name="Quotations" component={QuotationsScreen} />
      <MoreStack.Screen name="QuotationForm" component={QuotationFormScreen} />
      <MoreStack.Screen
        name="RolesPermissions"
        component={RolesPermissionsScreen}
      />
      <MoreStack.Screen name="Autopilot" component={AutopilotScreen} />
      <MoreStack.Screen name="Services" component={ServicesScreen} />
      <MoreStack.Screen name="ApiKeys" component={ApiKeysScreen} />
      <MoreStack.Screen name="Support" component={SupportScreen} />
      <MoreStack.Screen name="Billing" component={BillingScreen} />
      <MoreStack.Screen name="WhatsAppLogs" component={WhatsAppLogsScreen} />
      <MoreStack.Screen name="WhatsAppSetup" component={WhatsAppSetupScreen} />
      <MoreStack.Screen name="LeadStatuses" component={LeadStatusesScreen} />
      <MoreStack.Screen
        name="AdCampaignsHub"
        component={AdCampaignsHubScreen}
      />
      <MoreStack.Screen name="LinkedInSetup" component={LinkedInSetupScreen} />
      <MoreStack.Screen
        name="GoogleAdsSetup"
        component={GoogleAdsSetupScreen}
      />
      <MoreStack.Screen
        name="AdPlatformLocked"
        component={AdPlatformLockedScreen}
      />
      <MoreStack.Screen
        name="FacebookAdsDashboard"
        component={FacebookAdsDashboardScreen}
      />
      <MoreStack.Screen
        name="FacebookAdCampaigns"
        component={FacebookAdCampaignsScreen}
      />
      <MoreStack.Screen
        name="FacebookAdSets"
        component={FacebookAdSetsScreen}
      />
      <MoreStack.Screen
        name="FacebookAdsList"
        component={FacebookAdsListScreen}
      />
      <MoreStack.Screen
        name="FacebookCampaignManagement"
        component={FacebookCampaignManagementScreen}
      />
      <MoreStack.Screen
        name="LinkedInCampaignManagement"
        component={LinkedInCampaignManagementScreen}
      />
      <MoreStack.Screen
        name="CampaignManagementOverview"
        component={CampaignManagementOverviewScreen}
      />
      <MoreStack.Screen
        name="CampaignReports"
        component={CampaignReportsScreen}
      />
      <MoreStack.Screen name="ActivityLog" component={ActivityLogScreen} />
      <MoreStack.Screen name="Trash" component={TrashScreen} />
      <MoreStack.Screen
        name="AccountSecurity"
        component={AccountSecurityScreen}
      />
    </MoreStack.Navigator>
  );
}

const BAR_ROW = 60;
const FAB = 64;
const NOTCH_W = 60;
const NOTCH_DEPTH = 40;
const PRIMARY = '#024BAB';

const TAB_ICONS: Record<string, [string, string]> = {
  Dashboard: ['home', 'home'],
  Schedule: ['calendar-outline', 'calendar'],
  LeadsStack: ['people-outline', 'people'],
  SocialStack: ['megaphone-outline', 'megaphone'],
  More: ['grid-outline', 'grid'],
};

// Same curved-notch bar as NestHR; Leads sits raised in the centre.
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = React.useState(0);
  const height = BAR_ROW + insets.bottom;
  const cx = width / 2;
  const path = `M-2,0 L${cx - NOTCH_W},0 C${cx - NOTCH_W + 22},0 ${
    cx - 36
  },${NOTCH_DEPTH} ${cx},${NOTCH_DEPTH} C${cx + 36},${NOTCH_DEPTH} ${
    cx + NOTCH_W - 22
  },0 ${cx + NOTCH_W},0 L${width + 2},0 L${width + 2},${height + 2} L-2,${
    height + 2
  } Z`;

  return (
    <View
      style={[tb.barWrap, { height }]}
      onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path
            d={path}
            fill="#fff"
            stroke="#000"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <View style={[tb.barRow, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const raised = route.name === 'LeadsStack';
          const color = focused ? PRIMARY : '#9CA3AF';
          const [off, on] = TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse-outline'];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : route.name;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.8}
              style={tb.tabItem}
            >
              {raised ? (
                <>
                  <View style={tb.fab}>
                    <Icon name={on} size={28} color="#fff" />
                  </View>
                  <View style={tb.iconWrap} />
                </>
              ) : (
                <TabBounce focused={focused}>
                  <View style={tb.iconWrap}>
                    <Icon name={focused ? on : off} size={20} color={color} />
                  </View>
                </TabBounce>
              )}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[tb.tabLabel, raised && { marginTop: 5 }, { color }]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  barWrap: { backgroundColor: 'transparent' },
  barRow: { flexDirection: 'row', flex: 1, paddingTop: 4 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    top: -(FAB / 2) - 2,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    maxWidth: '100%',
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef} onStateChange={trackNavState}>
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarLabel: 'Home' }}
        />
        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{ tabBarLabel: 'Schedule' }}
        />
        <Tab.Screen
          name="LeadsStack"
          component={LeadsNavigator}
          options={{ tabBarLabel: 'Leads' }}
        />
        <Tab.Screen
          name="SocialStack"
          component={SocialNavigator}
          options={{ tabBarLabel: 'Social' }}
        />
        <Tab.Screen
          name="More"
          component={MoreNavigator}
          options={{ tabBarLabel: 'More' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
