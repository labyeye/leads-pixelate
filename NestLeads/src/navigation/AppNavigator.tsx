import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {navigationRef} from './navigationRef';
import Icon from '../components/Icon';

import DashboardScreen from '../screens/DashboardScreen';
import LeadsListScreen from '../screens/LeadsListScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';
import AddLeadScreen from '../screens/AddLeadScreen';
import FiltersScreen from '../screens/FiltersScreen';
import ClientsScreen from '../screens/ClientsScreen';
import QuotationsScreen from '../screens/QuotationsScreen';
import MoreScreen from '../screens/MoreScreen';
import ReportsScreen from '../screens/ReportsScreen';
import FollowupCalendarScreen from '../screens/FollowupCalendarScreen';
import VisitCalendarScreen from '../screens/VisitCalendarScreen';
import WhatsAppInboxScreen from '../screens/WhatsAppInboxScreen';
import ProductsScreen from '../screens/ProductsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import UsersScreen from '../screens/UsersScreen';
import IntegrationsScreen from '../screens/IntegrationsScreen';
import SocialPlannerScreen from '../screens/SocialPlannerScreen';
import CreatePostScreen from '../screens/CreatePostScreen';

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: {leadId: string};
  AddLead: undefined;
  Filters: {filters: any; onApply: (f: any) => void};
};

export type RootTabParamList = {
  Dashboard: undefined;
  LeadsStack: undefined;
  FollowupCalendar: undefined;
  VisitCalendar: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Reports: undefined;
  FollowupCalendar: undefined;
  VisitCalendar: undefined;
  WhatsAppInbox: undefined;
  Products: undefined;
  Settings: undefined;
  Campaigns: undefined;
  Users: undefined;
  Integrations: undefined;
  Clients: undefined;
  Quotations: undefined;
  SocialPlanner: undefined;
  CreatePost: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const LeadsStack = createNativeStackNavigator<LeadsStackParamList>();
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

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{headerShown: false}}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} />
      <MoreStack.Screen name="FollowupCalendar" component={FollowupCalendarScreen} />
      <MoreStack.Screen name="VisitCalendar" component={VisitCalendarScreen} />
      <MoreStack.Screen name="WhatsAppInbox" component={WhatsAppInboxScreen} />
      <MoreStack.Screen name="Products" component={ProductsScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Campaigns" component={CampaignsScreen} />
      <MoreStack.Screen name="Users" component={UsersScreen} />
      <MoreStack.Screen name="Integrations" component={IntegrationsScreen} />
      <MoreStack.Screen name="Clients" component={ClientsScreen} />
      <MoreStack.Screen name="Quotations" component={QuotationsScreen} />
      <MoreStack.Screen name="SocialPlanner" component={SocialPlannerScreen} />
      <MoreStack.Screen name="CreatePost" component={CreatePostScreen} />
    </MoreStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarStyle: {
            height: 60,
            borderTopWidth: 2,
            borderTopColor: '#000',
            backgroundColor: '#fff',
            paddingBottom: 6,
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
              FollowupCalendar: focused ? 'calendar'         : 'calendar-outline',
              VisitCalendar:    focused ? 'business'         : 'business-outline',
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
          name="FollowupCalendar"
          component={FollowupCalendarScreen}
          options={{tabBarLabel: 'Follow-up'}}
        />
        <Tab.Screen
          name="VisitCalendar"
          component={VisitCalendarScreen}
          options={{tabBarLabel: 'Visits'}}
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
