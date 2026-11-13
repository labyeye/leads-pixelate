import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../components/Icon';
import { notificationsAPI, AppNotification } from '../services/api';
import { navigateFromNotification } from '../navigation/navigationRef';

const PRIMARY = '#024BAB';

const KIND: Record<string, { icon: string; color: string }> = {
  new_lead: { icon: 'person-add-outline', color: PRIMARY },
  lead_assigned: { icon: 'person-outline', color: PRIMARY },
  followup_due: { icon: 'time-outline', color: '#FA731C' },
  visit_due: { icon: 'calendar-outline', color: '#FA731C' },
  quotation_approval: { icon: 'document-text-outline', color: '#8B5CF6' },
  quotation_decision: { icon: 'document-text-outline', color: '#1FA85A' },
  whatsapp_reply: { icon: 'logo-whatsapp', color: '#1FA85A' },
  post_failed: { icon: 'alert-circle-outline', color: '#DC2626' },
};

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsAPI.list();
      setItems(res.data || []);
    } catch {
      /* keep what is shown */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unread = items.filter(n => !n.read).length;

  const open = (n: AppNotification) => {
    if (!n.read) {
      setItems(cur => cur.map(x => (x._id === n._id ? { ...x, read: true } : x)));
      notificationsAPI.markRead(n._id).catch(() => {});
    }
    navigateFromNotification({ screen: n.data?.screen, id: n.data?.id });
  };

  const markAll = async () => {
    setItems(cur => cur.map(x => ({ ...x, read: true })));
    notificationsAPI.markAllRead().catch(() => {});
  };

  const clearAll = () =>
    Alert.alert('Clear all', 'Remove every notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await notificationsAPI.clear().catch(() => {});
          setItems([]);
        },
      },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <View style={styles.count}>
            <Text style={styles.countText}>{unread}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {unread > 0 && (
          <TouchableOpacity onPress={markAll} style={styles.iconBtn}>
            <Icon name="checkmark-done-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>
        )}
        {items.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.iconBtn}>
            <Icon name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n._id}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="notifications-outline" size={36} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.muted}>New leads, reminders and approvals show up here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const k = KIND[item.type] || { icon: 'notifications-outline', color: PRIMARY };
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => open(item)}
                style={[styles.row, !item.read && styles.rowUnread]}
              >
                <View style={[styles.chip, { backgroundColor: k.color }]}>
                  <Icon name={k.icon} size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.time}>{ago(item.createdAt)}</Text>
                  </View>
                  {!!item.body && (
                    <Text style={styles.body} numberOfLines={2}>
                      {item.body}
                    </Text>
                  )}
                </View>
                {!item.read && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FD' },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#fff',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: { fontSize: 17, fontWeight: '500', color: '#000' },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  divider: { height: 2, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontSize: 16, color: '#000' },
  muted: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
    borderRadius: 8,
  },
  rowUnread: { backgroundColor: '#FFF8F1' },
  chip: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontSize: 13, color: '#475569' },
  rowTitleUnread: { color: '#000', fontWeight: '600' },
  time: { fontSize: 11, color: '#64748b' },
  body: { marginTop: 3, fontSize: 12, color: '#64748b', lineHeight: 17 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FA731C', marginTop: 5 },
});
