import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { whatsappAPI } from '../services/api';

const STATUS_COLOR: Record<string, string> = {
  SENT: '#64748b',
  DELIVERED: '#16a34a',
  READ: '#2563eb',
  FAILED: '#dc2626',
};
const SOURCE_LABEL: Record<string, string> = {
  chat: 'Chat',
  campaign: 'Campaign',
  quotation: 'Quotation',
  automation: 'Automation',
};
const STATUSES = ['', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
const DAYS = ['7', '30', '90'];

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function WhatsAppMessageLog({ bottomInset }: { bottomInset: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [ins, setIns] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (p = 1, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else if (p === 1) setLoading(true);
        const params: Record<string, string> = { days, page: String(p), limit: '25' };
        if (status) params.status = status;
        if (query) params.search = query;
        const res = await whatsappAPI.getMessageLogs(params);
        setIns(res.insights);
        setPages(res.pages || 1);
        setPage(p);
        setRows(prev => (p === 1 ? res.data || [] : [...prev, ...(res.data || [])]));
      } catch {
        /* keep what we have */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, status, query],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const cards = [
    { label: 'Sent', value: ins?.total ?? 0, sub: `last ${days}d`, color: '#2563eb' },
    { label: 'Delivered', value: ins?.delivered ?? 0, sub: `${ins?.deliveryRate ?? 0}%`, color: '#16a34a' },
    { label: 'Read', value: ins?.read ?? 0, sub: `${ins?.readRate ?? 0}%`, color: '#7c3aed' },
    { label: 'Failed', value: ins?.failed ?? 0, sub: `${ins?.failureRate ?? 0}%`, color: '#dc2626' },
  ];

  const header = (
    <View>
      <View style={s.cards}>
        {cards.map(c => (
          <View key={c.label} style={s.card}>
            <Text style={[s.cardValue, { color: c.color }]}>{c.value}</Text>
            <Text style={s.cardLabel}>{c.label}</Text>
            <Text style={s.cardSub}>{c.sub}</Text>
          </View>
        ))}
      </View>
      <Text style={s.replies}>{ins?.replies ?? 0} replies received</Text>

      <View style={s.searchBox}>
        <TextInput
          style={s.searchInput}
          placeholder="Search phone, name, message…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(search)}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {STATUSES.map(st => (
          <TouchableOpacity
            key={st || 'all'}
            onPress={() => setStatus(st)}
            style={[s.chip, status === st && { backgroundColor: STATUS_COLOR[st] || '#000' }]}
          >
            <Text style={[s.chipText, status === st && { color: '#fff' }]}>
              {st ? st[0] + st.slice(1).toLowerCase() : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ width: 10 }} />
        {DAYS.map(d => (
          <TouchableOpacity
            key={d}
            onPress={() => setDays(d)}
            style={[s.chip, days === d && { backgroundColor: '#024BAB' }]}
          >
            <Text style={[s.chipText, days === d && { color: '#fff' }]}>{d}d</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#024BAB" />
      </View>
    );

  return (
    <FlatList
      data={rows}
      keyExtractor={r => r.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor="#024BAB" />
      }
      onEndReached={() => page < pages && load(page + 1)}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<Text style={s.empty}>No messages found</Text>}
      renderItem={({ item: r }) => (
        <View style={s.row}>
          <View style={s.rowTop}>
            <Text style={s.name} numberOfLines={1}>
              {r.name || r.phone}
            </Text>
            <View style={[s.pill, { borderColor: STATUS_COLOR[r.status] }]}>
              <Text style={[s.pillText, { color: STATUS_COLOR[r.status] }]}>{r.status}</Text>
            </View>
          </View>
          {r.name ? <Text style={s.sub}>{r.phone}</Text> : null}
          <Text style={s.sub} numberOfLines={2}>
            {SOURCE_LABEL[r.source] || r.source}
            {r.campaign ? ` · ${r.campaign}` : ''}
            {r.text ? ` · ${r.text}` : ''}
          </Text>
          <Text style={s.times}>
            Sent {fmt(r.sentAt)} · Delivered {fmt(r.deliveredAt)} · Read {fmt(r.readAt)}
          </Text>
          {r.error ? <Text style={s.error}>{r.error}</Text> : null}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cards: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  card: { flex: 1, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', padding: 8, alignItems: 'center' },
  cardValue: { fontSize: 20, fontWeight: '700' },
  cardLabel: { fontSize: 11, color: '#000', fontWeight: '600' },
  cardSub: { fontSize: 10, color: '#64748b' },
  replies: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: '#64748b' },
  searchBox: { marginHorizontal: 16, marginTop: 10, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10 },
  searchInput: { height: 40, color: '#000', fontSize: 14 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#000' },
  row: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  pill: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 1 },
  pillText: { fontSize: 10, fontWeight: '700' },
  sub: { fontSize: 12, color: '#475569', marginTop: 3 },
  times: { fontSize: 11, color: '#64748b', marginTop: 6 },
  error: { fontSize: 11, color: '#dc2626', marginTop: 4 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
