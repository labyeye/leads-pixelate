import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import WhatsAppLogo from '../components/WhatsAppLogo';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

const PRIMARY = '#024BAB';
const SECONDARY = '#FF751F';
const BG = '#F8F9FA';

type MenuItem = {
  icon: string;
  label: string;
  sub: string;
  screen: string;
  color: string;
  adminOnly?: boolean;
};

const GROUPS: { title: string; color: string; screens: string[] }[] = [
  {
    title: 'Sales & Billing',
    color: PRIMARY,
    screens: [
      'Clients',
      'Quotations',
      'SalesOrders',
      'PurchaseOrders',
      'Invoices',
      'PriceBooks',
      'Products',
      'Services',
    ],
  },
  {
    title: 'WhatsApp',
    color: '#22c55e',
    screens: [
      'WhatsAppInbox',
      'WhatsAppLogs',
      'DocumentVault',
      'WhatsAppSetup',
      'Campaigns',
      'Funnels',
    ],
  },
  {
    title: 'Marketing & Insights',
    color: SECONDARY,
    screens: ['AdCampaignsHub', 'Autopilot', 'Reports'],
  },
  {
    title: 'Workspace',
    color: PRIMARY,
    screens: ['Users', 'Integrations', 'ApiKeys'],
  },
  {
    title: 'Account',
    color: SECONDARY,
    screens: ['Billing', 'AccountSecurity', 'Support', 'Settings'],
  },
  {
    title: 'Admin',
    color: '#000000',
    screens: ['LivePerformance', 'ActivityLog', 'Trash'],
  },
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
    icon: 'folder-open-outline',
    label: 'Document Vault',
    sub: 'Brochures & catalogues to send on WhatsApp',
    screen: 'DocumentVault',
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
    icon: 'git-branch-outline',
    label: 'Auto Funnels',
    sub: 'Automatic WhatsApp message sequences',
    screen: 'Funnels',
    color: '#25D366',
    adminOnly: true,
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
    icon: 'pulse-outline',
    label: 'Live Performance',
    sub: 'Team calls, conversations & targets',
    screen: 'LivePerformance',
    color: PRIMARY,
    adminOnly: true,
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

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const maxContentWidth = 1040;

  const { unread, refresh: refreshUnread } = useUnreadNotifications();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', refreshUnread);
    return unsub;
  }, [navigation, refreshUnread]);

  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const visible = MENU_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const q = query.trim().toLowerCase();

  const sections = GROUPS.map(g => ({
    ...g,
    items: g.screens
      .map(sc => visible.find(i => i.screen === sc))
      .filter(
        (i): i is MenuItem =>
          !!i &&
          (!q ||
            i.label.toLowerCase().includes(q) ||
            i.sub.toLowerCase().includes(q)),
      ),
  })).filter(g => g.items.length > 0);

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header matching NestHR MoreScreen */}
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Icon name="grid-outline" size={20} color={PRIMARY} />
          <Text style={styles.headerTitle}>More</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setSearchOpen(true)}
            accessibilityLabel="Search"
            hitSlop={8}
          >
            <Icon name="search-outline" size={22} color="#000" />
            {!!query && <View style={styles.searchDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
            hitSlop={8}
          >
            <Icon name="notifications-outline" size={22} color="#000" />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Modal matching NestHR SearchModal */}
      <Modal
        visible={searchOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSearchOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.searchModalCard}>
            <View style={styles.searchInputRow}>
              <Icon name="search-outline" size={18} color="#000" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search features…"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Icon name="close-circle" size={18} color="#6B7280" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setSearchOpen(false)}
                style={{ marginLeft: 4 }}
                hitSlop={8}
              >
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
            >
              {visible
                .filter(
                  i =>
                    !q ||
                    i.label.toLowerCase().includes(q) ||
                    i.sub.toLowerCase().includes(q),
                )
                .map(item => (
                  <TouchableOpacity
                    key={item.screen}
                    style={styles.searchResultRow}
                    onPress={() => {
                      setSearchOpen(false);
                      navigation.navigate(item.screen);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle}>{item.label}</Text>
                      <Text style={styles.searchResultSub} numberOfLines={1}>
                        {item.sub}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {/* Compact Profile Hero matching NestHR MoreScreen */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
              ) : (
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(user?.name || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.premiumAvatarBadge}>
                <Icon name="star" size={11} color="#000" />
              </View>
            </View>

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
                  {(user?.role || 'agent').replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Right-side icon-only action buttons */}
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: '#eff6ff' }]}
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.8}
              >
                <Icon name="person-outline" size={18} color={PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Icon name="log-out-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Grouped 3-column tiles matching NestHR MoreScreen */}
        {sections.map(g => (
          <View key={g.title}>
            <View style={styles.grid}>
              {g.items.map(item => (
                <View
                  key={item.screen}
                  style={[styles.tileWrap, isTablet && { width: '18.8%' }]}
                >
                  <TouchableOpacity
                    style={styles.tile}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate(item.screen)}
                  >
                    <View
                      style={[
                        styles.tileIcon,
                        {
                          backgroundColor: g.color + '1A',
                          borderColor: g.color,
                        },
                      ]}
                    >
                      {item.icon === 'logo-whatsapp' ? (
                        <WhatsAppLogo size={22} />
                      ) : (
                        <Icon name={item.icon} size={22} color={g.color} />
                      )}
                    </View>
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </View>
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

        <Text style={styles.versionText}>
          NestLeads v{Platform.select({ android: '1.4', default: '1.0' })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '400', color: '#000' },
  headerIconBtn: { padding: 4, position: 'relative' },
  searchDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  scroll: { padding: 16, gap: 16 },

  hero: { ...box, backgroundColor: '#fff', padding: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  userAvatar: {
    width: 56,
    height: 56,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 50,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 22, fontWeight: '400' },
  premiumAvatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { fontSize: 16, fontWeight: '400', color: '#000' },
  profileEmail: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: 10, fontWeight: '400', color: '#000' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '31.3%' },
  tile: {
    ...box,
    backgroundColor: '#fff',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 6,
    alignItems: 'center',
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#000',
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  searchModalCard: {
    ...box,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },
  doneText: { fontSize: 13, fontWeight: '400', color: PRIMARY },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultTitle: { fontSize: 14, fontWeight: '400', color: '#000' },
  searchResultSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  bellBtn: { padding: 4, position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 11, fontWeight: '400' },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '400',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '400', color: '#6B7280' },
});