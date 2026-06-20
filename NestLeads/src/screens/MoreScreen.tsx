import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';

const PRIMARY = '#024BAB';
const SECONDARY = '#FF751F';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

type MenuItem = {
  icon: string;
  label: string;
  sub: string;
  screen: string;
  color: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    icon: 'briefcase-outline',
    label: 'Clients',
    sub: 'Manage your converted clients',
    screen: 'Clients',
    color: '#22c55e',
  },
  {
    icon: 'document-text-outline',
    label: 'Quotations',
    sub: 'Create & track quotations',
    screen: 'Quotations',
    color: PRIMARY,
  },
  {
    icon: 'bar-chart-outline',
    label: 'Reports',
    sub: 'Lead analytics & conversion',
    screen: 'Reports',
    color: PRIMARY,
  },
  {
    icon: 'calendar-outline',
    label: 'Follow-up Calendar',
    sub: 'Scheduled follow-ups by date',
    screen: 'FollowupCalendar',
    color: SECONDARY,
  },
  {
    icon: 'business-outline',
    label: 'Visit Calendar',
    sub: 'Site visits & appointments',
    screen: 'VisitCalendar',
    color: PRIMARY,
  },
  {
    icon: 'logo-whatsapp',
    label: 'WhatsApp Inbox',
    sub: 'Messages from leads',
    screen: 'WhatsAppInbox',
    color: '#25D366',
  },
  {
    icon: 'megaphone-outline',
    label: 'Campaigns',
    sub: 'WhatsApp broadcast campaigns',
    screen: 'Campaigns',
    color: SECONDARY  ,
  },
  {
    icon: 'people-outline',
    label: 'Team',
    sub: 'Manage team members & roles',
    screen: 'Users',
    color: PRIMARY,
  },
  {
    icon: 'cube-outline',
    label: 'Products',
    sub: 'Manage products & services',
    screen: 'Products',
    color: SECONDARY,
  },
  {
    icon: 'git-network-outline',
    label: 'Integrations',
    sub: 'Connect IndiaMart, FB & more',
    screen: 'Integrations',
    color: PRIMARY  ,
  },
  {
    icon: 'settings-outline',
    label: 'Settings',
    sub: 'Profile & app settings',
    screen: 'Settings',
    color: SECONDARY,
  },
];

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const initial = (user?.name || user?.email || 'U')[0].toUpperCase();

  const handleLogout = () => {
    const { Alert } = require('react-native');
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="grid-outline" size={22} color="#000" />
          <Text style={styles.headerTitle}>More</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Icon name="notifications-outline" size={22} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <UserAvatar name={user?.name} avatar={user?.avatar} size={64} index={0} />

          <View style={styles.profileActions}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {(user?.name || 'User').toUpperCase()}
              </Text>
              <Text style={styles.profileRole}>
                {(user?.role || 'AGENT').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="person-outline" size={14} color={PRIMARY} />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtnSmall}
              onPress={handleLogout}
            >
              <Icon name="log-out-outline" size={14} color="#EF4444" />
              <Text style={styles.logoutBtnSmallText}>LOGOUT</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Menu list card */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, idx) => (
            <View key={item.screen}>
              {idx > 0 && <View style={styles.menuDivider} />}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={[styles.menuIconBox, { borderColor: item.color }]}>
                  <Icon name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                <Icon name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
  bellBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 2, backgroundColor: '#000' },

  scroll: { padding: 16, gap: 16 },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  profileInfo: { },
  profileName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.3,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  profileActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 2,
    borderColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editBtnText: { fontSize: 11, fontWeight: '900', color: PRIMARY },
  logoutBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logoutBtnSmallText: { fontSize: 11, fontWeight: '900', color: '#EF4444' },

  // Menu list
  menuCard: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    ...NB_SHADOW,
  },
  menuDivider: { height: 1, backgroundColor: '#e2e8f0' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  menuIconBox: {
    width: 46,
    height: 46,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '800', color: '#000' },
  menuSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
