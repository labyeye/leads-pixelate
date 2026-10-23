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
import { withSlideUp } from '../components/motion';

const AccountSecurityScreenAnim = withSlideUp(AccountSecurityScreen);
const ActivityLogScreenAnim = withSlideUp(ActivityLogScreen);
const AdCampaignsHubScreenAnim = withSlideUp(AdCampaignsHubScreen);
const AdPlatformLockedScreenAnim = withSlideUp(AdPlatformLockedScreen);
const AddLeadScreenAnim = withSlideUp(AddLeadScreen);
const ApiKeysScreenAnim = withSlideUp(ApiKeysScreen);
const AutopilotScreenAnim = withSlideUp(AutopilotScreen);
const BillingScreenAnim = withSlideUp(BillingScreen);
const CampaignManagementOverviewScreenAnim = withSlideUp(CampaignManagementOverviewScreen);
const CampaignReportsScreenAnim = withSlideUp(CampaignReportsScreen);
const CampaignsScreenAnim = withSlideUp(CampaignsScreen);
const ClientsScreenAnim = withSlideUp(ClientsScreen);
const CreatePostScreenAnim = withSlideUp(CreatePostScreen);
const FacebookAdCampaignsScreenAnim = withSlideUp(FacebookAdCampaignsScreen);
const FacebookAdSetsScreenAnim = withSlideUp(FacebookAdSetsScreen);
const FacebookAdsDashboardScreenAnim = withSlideUp(FacebookAdsDashboardScreen);
const FacebookAdsListScreenAnim = withSlideUp(FacebookAdsListScreen);
const FacebookCampaignManagementScreenAnim = withSlideUp(FacebookCampaignManagementScreen);
const FiltersScreenAnim = withSlideUp(FiltersScreen);
const GoogleAdsSetupScreenAnim = withSlideUp(GoogleAdsSetupScreen);
const IntegrationsScreenAnim = withSlideUp(IntegrationsScreen);
const LeadDetailScreenAnim = withSlideUp(LeadDetailScreen);
const LeadStatusesScreenAnim = withSlideUp(LeadStatusesScreen);
const LeadsListScreenAnim = withSlideUp(LeadsListScreen);
const LinkedInCampaignManagementScreenAnim = withSlideUp(LinkedInCampaignManagementScreen);
const LinkedInSetupScreenAnim = withSlideUp(LinkedInSetupScreen);
const MoreScreenAnim = withSlideUp(MoreScreen);
const PriceBooksScreenAnim = withSlideUp(PriceBooksScreen);
const ProductsScreenAnim = withSlideUp(ProductsScreen);
const QuotationFormScreenAnim = withSlideUp(QuotationFormScreen);
const QuotationsScreenAnim = withSlideUp(QuotationsScreen);
const ReportsScreenAnim = withSlideUp(ReportsScreen);
const RolesPermissionsScreenAnim = withSlideUp(RolesPermissionsScreen);
const ScheduleScreenAnim = withSlideUp(ScheduleScreen);
const ServicesScreenAnim = withSlideUp(ServicesScreen);
const SettingsScreenAnim = withSlideUp(SettingsScreen);
const SocialPlannerScreenAnim = withSlideUp(SocialPlannerScreen);
const SupportScreenAnim = withSlideUp(SupportScreen);
const TradeDocumentsScreenAnim = withSlideUp(TradeDocumentsScreen);
const TrashScreenAnim = withSlideUp(TrashScreen);
const UsersScreenAnim = withSlideUp(UsersScreen);
const WhatsAppInboxScreenAnim = withSlideUp(WhatsAppInboxScreen);
const WhatsAppLogsScreenAnim = withSlideUp(WhatsAppLogsScreen);
const WhatsAppSetupScreenAnim = withSlideUp(WhatsAppSetupScreen);

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
      <LeadsStack.Screen name="LeadsList" component={LeadsListScreenAnim} />
      <LeadsStack.Screen name="LeadDetail" component={LeadDetailScreenAnim} />
      <LeadsStack.Screen name="AddLead" component={AddLeadScreenAnim} />
      <LeadsStack.Screen name="Filters" component={FiltersScreenAnim} />
    </LeadsStack.Navigator>
  );
}

function SocialNavigator() {
  return (
    <SocialStack.Navigator screenOptions={{ headerShown: false }}>
      <SocialStack.Screen
        name="SocialPlanner"
        component={SocialPlannerScreenAnim}
      />
      <SocialStack.Screen name="CreatePost" component={CreatePostScreenAnim} />
    </SocialStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreenAnim} />
      <MoreStack.Screen name="Reports" component={ReportsScreenAnim} />
      <MoreStack.Screen name="WhatsAppInbox" component={WhatsAppInboxScreenAnim} />
      <MoreStack.Screen name="Products" component={ProductsScreenAnim} />
      <MoreStack.Screen name="PriceBooks" component={PriceBooksScreenAnim} />
      <MoreStack.Screen
        name="SalesOrders"
        component={TradeDocumentsScreenAnim}
        initialParams={{ kind: 'sales_order' }}
      />
      <MoreStack.Screen
        name="PurchaseOrders"
        component={TradeDocumentsScreenAnim}
        initialParams={{ kind: 'purchase_order' }}
      />
      <MoreStack.Screen
        name="Invoices"
        component={TradeDocumentsScreenAnim}
        initialParams={{ kind: 'invoice' }}
      />
      <MoreStack.Screen name="Settings" component={SettingsScreenAnim} />
      <MoreStack.Screen name="Campaigns" component={CampaignsScreenAnim} />
      <MoreStack.Screen name="Users" component={UsersScreenAnim} />
      <MoreStack.Screen name="Integrations" component={IntegrationsScreenAnim} />
      <MoreStack.Screen name="Clients" component={ClientsScreenAnim} />
      <MoreStack.Screen name="Quotations" component={QuotationsScreenAnim} />
      <MoreStack.Screen name="QuotationForm" component={QuotationFormScreenAnim} />
      <MoreStack.Screen
        name="RolesPermissions"
        component={RolesPermissionsScreenAnim}
      />
      <MoreStack.Screen name="Autopilot" component={AutopilotScreenAnim} />
      <MoreStack.Screen name="Services" component={ServicesScreenAnim} />
      <MoreStack.Screen name="ApiKeys" component={ApiKeysScreenAnim} />
      <MoreStack.Screen name="Support" component={SupportScreenAnim} />
      <MoreStack.Screen name="Billing" component={BillingScreenAnim} />
      <MoreStack.Screen name="WhatsAppLogs" component={WhatsAppLogsScreenAnim} />
      <MoreStack.Screen name="WhatsAppSetup" component={WhatsAppSetupScreenAnim} />
      <MoreStack.Screen name="LeadStatuses" component={LeadStatusesScreenAnim} />
      <MoreStack.Screen
        name="AdCampaignsHub"
        component={AdCampaignsHubScreenAnim}
      />
      <MoreStack.Screen name="LinkedInSetup" component={LinkedInSetupScreenAnim} />
      <MoreStack.Screen
        name="GoogleAdsSetup"
        component={GoogleAdsSetupScreenAnim}
      />
      <MoreStack.Screen
        name="AdPlatformLocked"
        component={AdPlatformLockedScreenAnim}
      />
      <MoreStack.Screen
        name="FacebookAdsDashboard"
        component={FacebookAdsDashboardScreenAnim}
      />
      <MoreStack.Screen
        name="FacebookAdCampaigns"
        component={FacebookAdCampaignsScreenAnim}
      />
      <MoreStack.Screen
        name="FacebookAdSets"
        component={FacebookAdSetsScreenAnim}
      />
      <MoreStack.Screen
        name="FacebookAdsList"
        component={FacebookAdsListScreenAnim}
      />
      <MoreStack.Screen
        name="FacebookCampaignManagement"
        component={FacebookCampaignManagementScreenAnim}
      />
      <MoreStack.Screen
        name="LinkedInCampaignManagement"
        component={LinkedInCampaignManagementScreenAnim}
      />
      <MoreStack.Screen
        name="CampaignManagementOverview"
        component={CampaignManagementOverviewScreenAnim}
      />
      <MoreStack.Screen
        name="CampaignReports"
        component={CampaignReportsScreenAnim}
      />
      <MoreStack.Screen name="ActivityLog" component={ActivityLogScreenAnim} />
      <MoreStack.Screen name="Trash" component={TrashScreenAnim} />
      <MoreStack.Screen
        name="AccountSecurity"
        component={AccountSecurityScreenAnim}
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
            if (event.defaultPrevented) return;
            if (route.name === 'LeadsStack') {
              // Leads tab always lands on the Leads List
              (navigation as any).navigate('LeadsStack', {
                screen: 'LeadsList',
              });
            } else if (!focused) {
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
          component={ScheduleScreenAnim}
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
