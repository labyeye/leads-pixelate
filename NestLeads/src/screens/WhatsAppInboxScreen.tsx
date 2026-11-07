import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import WhatsAppLogo from '../components/WhatsAppLogo';
import { whatsappAPI } from '../services/api';

const DAY = 24 * 60 * 60 * 1000;
const timeOf = (d?: string) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const dayOf = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const ticks = (st?: string) => (st === 'READ' ? '✓✓' : st === 'DELIVERED' ? '✓✓' : st === 'FAILED' ? '!' : '✓');

// Everything sent from the leads page, quotations and funnels, plus whatever customers send back, per phone.
export default function WhatsAppInboxScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [senderId, setSenderId] = useState('');
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await whatsappAPI.getConversations();
      setConversations(res.data || []);
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    whatsappAPI
      .getStatus()
      .then(r => setSenderId(r.data?.phoneNumbers?.[0]?.phoneNumberId || ''))
      .catch(() => {});
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const open = conversations.find(c => c.phone === openPhone) || null;
  const windowOpen = !!open?.lastInboundAt && Date.now() - new Date(open.lastInboundAt).getTime() < DAY;

  useEffect(() => {
    if (open) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [openPhone, open?.messages?.length]);

  const send = async () => {
    const body = text.trim();
    if (!open || !body) return;
    setSending(true);
    try {
      await whatsappAPI.replyToConversation({ phone: open.phone, text: body, phoneNumberId: senderId || undefined });
      setText('');
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't send", e?.message || '');
    } finally {
      setSending(false);
    }
  };

  const convert = async () => {
    if (!open) return;
    try {
      await whatsappAPI.convertToLead({ phone: open.phone, name: open.name });
      Alert.alert('Added', 'This contact is now a lead.');
      load();
    } catch (e: any) {
      Alert.alert("Couldn't add", e?.message || '');
    }
  };

  const Header = (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={() => (open ? setOpenPhone(null) : navigation.goBack())} style={s.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        {open ? (
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {open.name || `+${open.phone}`}
            </Text>
            {!!open.name && <Text style={s.sub}>+{open.phone}</Text>}
          </View>
        ) : (
          <>
            <WhatsAppLogo size={20} />
            <Text style={s.headerTitle}>WhatsApp Inbox</Text>
          </>
        )}
        {open && !open.leadId && (
          <TouchableOpacity onPress={convert} style={s.addBtn}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#000' }}>Add as lead</Text>
          </TouchableOpacity>
        )}
        {open && !!open.leadId && (
          <TouchableOpacity
            onPress={() => navigation.navigate('LeadsStack', { screen: 'LeadDetail', params: { leadId: open.leadId } })}
            style={s.addBtn}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#000' }}>View lead</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.divider} />
    </>
  );

  if (open) {
    return (
      <KeyboardAvoidingView
        style={[s.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {Header}
        <FlatList
          ref={listRef}
          data={open.messages}
          keyExtractor={m => String(m._id)}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          style={{ backgroundColor: '#ECE5DD' }}
          renderItem={({ item: m, index }) => {
            const out = m.direction === 'out';
            const prev = open.messages[index - 1];
            const newDay = !prev || dayOf(prev.timestamp) !== dayOf(m.timestamp);
            return (
              <View>
                {newDay && <Text style={s.day}>{dayOf(m.timestamp)}</Text>}
                <View style={[s.bubble, out ? s.out : s.in]}>
                  <Text style={s.msg}>{m.text}</Text>
                  <Text style={s.meta}>
                    {timeOf(m.timestamp)}
                    {out ? `  ${ticks(m.status)}` : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        {windowOpen ? (
          <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor="#94a3b8"
              multiline
              style={s.input}
            />
            <TouchableOpacity onPress={send} disabled={sending || !text.trim()} style={[s.sendBtn, (sending || !text.trim()) && { opacity: 0.4 }]}>
              <Icon name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.closed, { paddingBottom: insets.bottom + 10 }]}>
            <Text style={s.closedText}>
              WhatsApp only allows free messages within 24 hours of their last reply. Send an approved template from the lead's page to start again.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {Header}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, number or message"
        placeholderTextColor="#94a3b8"
        style={s.search}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#25D366" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <WhatsAppLogo size={40} />
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.muted}>Messages you send and replies from customers appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations.filter(c => {
            const q = search.trim().toLowerCase();
            return (
              !q ||
              (c.name || '').toLowerCase().includes(q) ||
              String(c.phone).includes(q) ||
              (c.messages || []).some((m: any) => String(m.text || '').toLowerCase().includes(q))
            );
          })}
          keyExtractor={c => c.phone}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#25D366" />}
          renderItem={({ item: c }) => {
            const last = c.lastMessage;
            const waiting = last?.direction === 'in';
            return (
              <TouchableOpacity style={[s.row, waiting && { backgroundColor: '#f0fdf4' }]} onPress={() => setOpenPhone(c.phone)}>
                <View style={[s.avatar, { backgroundColor: waiting ? '#25D366' : '#e2e8f0' }]}>
                  <Text style={{ fontWeight: '700', color: waiting ? '#fff' : '#64748b' }}>
                    {(c.name || c.phone || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={s.name} numberOfLines={1}>
                      {c.name || `+${c.phone}`}
                    </Text>
                    <Text style={s.muted}>{timeOf(last?.timestamp)}</Text>
                  </View>
                  <Text style={[s.last, waiting && { color: '#000', fontWeight: '600' }]} numberOfLines={1}>
                    {last?.direction === 'out' ? 'You: ' : ''}
                    {last?.text || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 64 },
  backBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#000' },
  sub: { fontSize: 11, color: '#64748b' },
  addBtn: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 6 },
  divider: { height: 2, backgroundColor: '#000' },
  search: { margin: 10, borderWidth: 2, borderColor: '#000', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  muted: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  last: { fontSize: 13, color: '#64748b', marginTop: 2 },
  day: { alignSelf: 'center', fontSize: 11, color: '#475569', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, marginVertical: 6 },
  bubble: { maxWidth: '82%', padding: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  in: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  out: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
  msg: { fontSize: 14, color: '#000' },
  meta: { fontSize: 10, color: '#64748b', alignSelf: 'flex-end', marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: 2, borderTopColor: '#000', backgroundColor: '#fff' },
  input: { flex: 1, maxHeight: 110, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  sendBtn: { width: 42, height: 42, backgroundColor: '#25D366', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  closed: { padding: 12, borderTopWidth: 2, borderTopColor: '#000', backgroundColor: '#fffbeb' },
  closedText: { fontSize: 12, color: '#92400e' },
});
