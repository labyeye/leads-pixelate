import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import WhatsAppLogo from '../components/WhatsAppLogo';
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
  adminOnly?: boolean;
};

const GROUPS: { title: string; icon: string; screens: string[] }[] = [
  { title: 'Sales & Billing', icon: 'wallet-outline', screens: ['Clients', 'Quotations', 'SalesOrders', 'PurchaseOrders', 'Invoices', 'PriceBooks', 'Products', 'Services'] },
  { title: 'WhatsApp', icon: 'chatbubbles-outline', screens: ['WhatsAppInbox', 'WhatsAppLogs', 'WhatsAppSetup', 'Campaigns'] },
  { title: 'Marketing & Insights', icon: 'megaphone-outline', screens: ['AdCampaignsHub', 'Autopilot', 'Reports'] },
  { title: 'Workspace', icon: 'people-outline', screens: ['Users', 'Integrations', 'ApiKeys'] },
  { title: 'Account', icon: 'person-outline', screens: ['Billing', 'AccountSecurity', 'Support', 'Settings'] },
  { title: 'Admin', icon: 'shield-checkmark-outline', screens: ['ActivityLog', 'Trash'] },
];

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
    color: PRIMARY,
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
    color: '#000',
    adminOnly: true,
  },
  {
    icon: 'trash-outline',
    label: 'Trash',
    sub: 'Restore deleted leads, clients & more',
    screen: 'Trash',
    color: '#000',
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

const TILE_W = (Dimensions.get('window').width - 32 - 12) / 2;

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const items = MENU_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const q = query.trim().toLowerCase();
  const matches = (i: MenuItem) =>
    !q || i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q);

  const sections = GROUPS.map(g => ({
    ...g,
    items: g.screens
      .map(sc => items.find(i => i.screen === sc))
      .filter((i): i is MenuItem => !!i && matches(i)),
  })).filter(g => g.items.length > 0);

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <UserAvatar name={user?.name} avatar={user?.avatar} size={64} index={0} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
              {!!user?.email && (
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>
                  {(user?.role || 'agent').replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBtns}>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: '#eff6ff' }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="person-outline" size={15} color={PRIMARY} />
              <Text style={[styles.heroBtnText, { color: PRIMARY }]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: '#fef2f2' }]}
              onPress={handleLogout}
            >
              <Icon name="log-out-outline" size={15} color="#EF4444" />
              <Text style={[styles.heroBtnText, { color: '#EF4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={16} color="#000" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search features..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close" size={16} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Grouped tiles */}
        {sections.map(g => (
          <View key={g.title}>
            <View style={styles.sectionHead}>
              <Icon name={g.icon} size={14} color="#000" />
              <Text style={styles.sectionTitle}>{g.title.toUpperCase()}</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.grid}>
              {g.items.map(item => (
                <TouchableOpacity
                  key={item.screen}
                  style={styles.tile}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate(item.screen)}
                >
                  <View style={[styles.tileIcon, { backgroundColor: item.color + '1A', borderColor: item.color }]}>
                    {item.icon === 'logo-whatsapp' ? (
                      <WhatsAppLogo size={22} />
                    ) : (
                      <Icon name={item.icon} size={22} color={item.color} />
                    )}
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.tileSub} numberOfLines={2}>
                    {item.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {sections.length === 0 && (
          <View style={styles.empty}>
            <Icon name="search-outline" size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No features match "{query}"</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: '500', color: '#000' },
  scroll: { padding: 16, gap: 18 },

  hero: { ...box, backgroundColor: '#fff', padding: 14, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileName: { fontSize: 18, fontWeight: '500', color: '#000' },
  profileEmail: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: 10, fontWeight: '500', color: '#000' },
  heroBtns: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
  },
  heroBtnText: { fontSize: 13, fontWeight: '500' },

  searchBox: {
    ...box,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#000', fontWeight: '500' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '500', color: '#000', letterSpacing: 1 },
  sectionLine: { flex: 1, height: 2, backgroundColor: '#000', marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { ...box, width: TILE_W, backgroundColor: '#fff', padding: 12, gap: 6, minHeight: 124 },
  tileIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { fontSize: 14, fontWeight: '500', color: '#000' },
  tileSub: { fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 15 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
});
