import React, {useState, useEffect} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Alert, RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {whatsappAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

export default function WhatsAppInboxScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await whatsappAPI.getConversations();
      setConversations(res.data || []);
    } catch {}
    finally {setLoading(false); setRefreshing(false);}
  };

  useEffect(() => {fetchConversations();}, []);

  const renderItem = ({item: c}: {item: any}) => {
    const unread = c.unreadCount > 0;
    return (
      <TouchableOpacity style={[styles.convoItem, unread && styles.convoItemUnread]}>
        <View style={[styles.avatar, {backgroundColor: unread ? '#25D366' : '#e2e8f0'}]}>
          <Text style={[styles.avatarText, {color: unread ? '#fff' : '#64748b'}]}>
            {(c.contactName || c.phone || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.convoInfo}>
          <View style={styles.convoTop}>
            <Text style={styles.convoName} numberOfLines={1}>
              {c.contactName || c.phone}
            </Text>
            <Text style={styles.convoTime}>
              {c.lastMessageTime
                ? new Date(c.lastMessageTime).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})
                : ''}
            </Text>
          </View>
          <View style={styles.convoBottom}>
            <Text style={[styles.convoLast, unread && styles.convoLastUnread]} numberOfLines={1}>
              {c.lastMessage || 'No messages yet'}
            </Text>
            {unread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{c.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Icon name="logo-whatsapp" size={20} color="#25D366" />
        <Text style={styles.headerTitle}>WhatsApp Inbox</Text>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#25D366" /></View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Icon name="logo-whatsapp" size={40} color="#25D366" />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>WhatsApp messages will appear here</Text>
          <View style={styles.emptyNote}>
            <Icon name="information-circle-outline" size={14} color="#64748b" />
            <Text style={styles.emptyNoteText}>Connect WhatsApp from the web app settings</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => i._id || i.phone}
          renderItem={renderItem}
          contentContainerStyle={{paddingBottom: insets.bottom + 24}}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchConversations(true)} tintColor="#25D366" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  convoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  convoItemUnread: {backgroundColor: '#f0fdf4'},
  avatar: {width: 44, height: 44, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 16, fontWeight: '900'},
  convoInfo: {flex: 1},
  convoTop: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3},
  convoName: {fontSize: 14, fontWeight: '700', color: '#000', flex: 1},
  convoTime: {fontSize: 11, color: '#94a3b8'},
  convoBottom: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  convoLast: {fontSize: 12, color: '#64748b', flex: 1},
  convoLastUnread: {color: '#000', fontWeight: '600'},
  unreadBadge: {backgroundColor: '#25D366', borderWidth: 2, borderColor: '#000', minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  unreadText: {fontSize: 10, fontWeight: '900', color: '#fff'},
  emptyBox: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40},
  emptyIcon: {width: 80, height: 80, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...NB_SHADOW},
  emptyTitle: {fontSize: 18, fontWeight: '900', color: '#000', marginBottom: 4},
  emptySub: {fontSize: 13, color: '#64748b', marginBottom: 20},
  emptyNote: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e2e8f0', padding: 10},
  emptyNoteText: {fontSize: 12, color: '#64748b'},
});

