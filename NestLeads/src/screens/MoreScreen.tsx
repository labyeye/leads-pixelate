import React, {useMemo} from 'react';
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
import WhatsAppLogo from '../components/WhatsAppLogo';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import {useTheme} from '../contexts/ThemeContext';

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
  adminOnly?: boolean;
};

const getMenuItems = (PRIMARY: string, NEUTRAL: string): MenuItem[] => [
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
    icon: 'logo-whatsapp',
    label: 'WhatsApp Inbox',
    sub: 'Messages from leads',
    screen: 'WhatsAppInbox',
    color: '#25D366',
  },
  {
    icon: 'stats-chart-outline',
    label: 'WhatsApp Logs',
    sub: 'Campaign delivery & read status',
    screen: 'WhatsAppLogs',
    color: '#25D366',
  },
  {
    icon: 'settings-outline',
    label: 'WhatsApp Setup',
    sub: 'Connection status & templates',
    screen: 'WhatsAppSetup',
    color: '#25D366',
  },
  {
    icon: 'megaphone-outline',
    label: 'Campaigns',
    sub: 'WhatsApp broadcast campaigns',
    screen: 'Campaigns',
    color: SECONDARY,
  },
  {
    icon: 'stats-chart-outline',
    label: 'Ad Campaigns',
    sub: 'Facebook, LinkedIn & Google Ads',
    screen: 'AdCampaignsHub',
    color: '#0A66C2',
  },
  {
    icon: 'flash-outline',
    label: 'Social Autopilot',
    sub: 'AI posts: dashboard, setup & report',
    screen: 'Autopilot',
    color: '#0ea5e9',
    adminOnly: true,
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
    icon: 'briefcase-outline',
    label: 'Services',
    sub: 'Service allocations & delivery',
    screen: 'Services',
    color: '#22c55e',
  },
  {
    icon: 'pricetag-outline',
    label: 'Price Books',
    sub: 'Wholesale & special-client prices',
    screen: 'PriceBooks',
    color: SECONDARY,
  },
  {
    icon: 'cart-outline',
    label: 'Sales Orders',
    sub: 'Orders confirmed with a client',
    screen: 'SalesOrders',
    color: PRIMARY,
  },
  {
    icon: 'bag-handle-outline',
    label: 'Purchase Orders',
    sub: 'What you order from suppliers',
    screen: 'PurchaseOrders',
    color: PRIMARY,
  },
  {
    icon: 'receipt-outline',
    label: 'Invoices',
    sub: 'Bill your clients',
    screen: 'Invoices',
    color: PRIMARY,
  },
  {
    icon: 'git-network-outline',
    label: 'Integrations',
    sub: 'Connect IndiaMart, FB & more',
    screen: 'Integrations',
    color: PRIMARY  ,
  },
  {
    icon: 'key-outline',
    label: 'API Keys',
    sub: 'Generate keys for website forms',
    screen: 'ApiKeys',
    color: PRIMARY,
  },
  {
    icon: 'help-buoy-outline',
    label: 'Support',
    sub: 'Raise & track support tickets',
    screen: 'Support',
    color: SECONDARY,
  },
  {
    icon: 'card-outline',
    label: 'Billing',
    sub: 'Plan, usage & invoices',
    screen: 'Billing',
    color: PRIMARY,
  },
  {
    icon: 'shield-checkmark-outline',
    label: 'Account Security',
    sub: 'Password, WhatsApp & 2FA',
    screen: 'AccountSecurity',
    color: PRIMARY,
  },
  {
    icon: 'terminal-outline',
    label: 'Activity Log',
    sub: 'Admin & team activity history',
    screen: 'ActivityLog',
    color: NEUTRAL,
    adminOnly: true,
  },
  {
    icon: 'trash-outline',
    label: 'Trash',
    sub: 'Restore deleted leads, clients & more',
    screen: 'Trash',
    color: NEUTRAL,
    adminOnly: true,
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const MENU_ITEMS = useMemo(() => getMenuItems(colors.primary, colors.text), [colors.primary, colors.text]);
  const initial = (user?.name || user?.email || 'U')[0].toUpperCase();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const menuItems = MENU_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    const { Alert } = require('react-native');
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="grid-outline" size={22} color={colors.text} />
          <Text style={styles.headerTitle}>More</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Icon name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

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

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {(user?.name || 'User').toUpperCase()}
            </Text>
            <Text style={styles.profileRole}>
              {(user?.role || 'AGENT').toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.roundBtn, { borderColor: colors.primary }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="person-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roundBtn, { borderColor: colors.danger }]}
            onPress={handleLogout}
          >
            <Icon name="log-out-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Individual menu cards */}
        {menuItems.map(item => (
          <TouchableOpacity
            key={item.screen}
            style={styles.menuRow}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.menuIconBox, { borderColor: item.color }]}>
              {item.icon === 'logo-whatsapp' ? (
                <WhatsAppLogo size={22} />
              ) : (
                <Icon name={item.icon} size={22} color={item.color} />
              )}
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.sub}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: import('../contexts/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
  bellBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '600', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 0.3,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  // Menu cards
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  menuIconBox: {
    width: 46,
    height: 46,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  menuSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  });
}
