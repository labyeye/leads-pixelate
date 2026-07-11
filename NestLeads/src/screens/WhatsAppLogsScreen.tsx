import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {whatsappAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#22c55e',
  SENDING: '#3b82f6',
  FAILED: '#EF4444',
  PARTIAL: '#f97316',
  DRAFT: '#94a3b8',
};

export default function WhatsAppLogsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await whatsappAPI.getCampaigns();
      setCampaigns(res.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchCampaigns();}, [fetchCampaigns]);

  const toggleDetail = async (id: string) => {
    if (expanded === id) {setExpanded(null); setDetail(null); return;}
    setExpanded(id);
    setLoadingDetail(true);
    try {
      const res = await whatsappAPI.getCampaign(id);
      setDetail(res.data);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoadingDetail(false);}
  };

  const filtered = campaigns.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) ||
      (c.template?.displayName || c.templateSnapshot?.displayName || '').toLowerCase().includes(q);
  });

  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.deliveredCount || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.readCount || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.repliedCount || 0), 0);

  const renderCard = ({item: c}: {item: any}) => {
    const isOpen = expanded === c._id;
    const deliveryPct = c.totalCount > 0 ? Math.round((c.deliveredCount / c.totalCount) * 100) : 0;
    const readPct = c.totalCount > 0 ? Math.round((c.readCount / c.totalCount) * 100) : 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => toggleDetail(c._id)}>
          <View style={styles.cardHeader}>
            <Icon name="logo-whatsapp" size={16} color="#25D366" />
            <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
            <View style={[styles.statusPill, {borderColor: STATUS_COLORS[c.status] || '#94a3b8'}]}>
              <Text style={[styles.statusPillText, {color: STATUS_COLORS[c.status] || '#94a3b8'}]}>{c.status}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statItem}>Total {c.totalCount || 0}</Text>
            <Text style={styles.statItem}>Sent {c.sentCount || 0}</Text>
            <Text style={styles.statItem}>Delivered {c.deliveredCount || 0}</Text>
            <Text style={styles.statItem}>Read {c.readCount || 0}</Text>
          </View>
          <View style={styles.pctRow}>
            <Text style={styles.pctText}>{deliveryPct}% delivered</Text>
            <Text style={styles.pctText}>{readPct}% read</Text>
            <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" style={{marginLeft: 'auto'}} />
          </View>
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.detailBox}>
            {loadingDetail ? (
              <ActivityIndicator size="small" color="#024BAB" />
            ) : detail ? (
              (detail.messages || []).slice(0, 30).map((msg: any) => (
                <View key={msg._id} style={styles.msgRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.msgName}>{msg.leadName}</Text>
                    <Text style={styles.msgPhone}>{msg.phone}</Text>
                  </View>
                  <Text style={styles.msgStatus}>{msg.status}</Text>
                </View>
              ))
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp Logs</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{totalSent}</Text><Text style={styles.summaryLabel}>Sent</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{totalDelivered}</Text><Text style={styles.summaryLabel}>Delivered</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{totalRead}</Text><Text style={styles.summaryLabel}>Read</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{totalReplied}</Text><Text style={styles.summaryLabel}>Replied</Text></View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={{marginRight: 6}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search campaigns..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCampaigns(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="logo-whatsapp" size={40} color="#94a3b8" />
              <Text style={styles.emptyText}>No campaigns yet</Text>
            </View>
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
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  summaryRow: {flexDirection: 'row', padding: 12, gap: 8},
  summaryCard: {flex: 1, borderWidth: 2, borderColor: '#000', padding: 10, alignItems: 'center'},
  summaryValue: {fontSize: 16, fontWeight: '900', color: '#000'},
  summaryLabel: {fontSize: 9, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginTop: 2},
  searchRow: {paddingHorizontal: 12, paddingBottom: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 12, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  campaignName: {flex: 1, fontSize: 13, fontWeight: '900', color: '#000'},
  statusPill: {borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2},
  statusPillText: {fontSize: 9, fontWeight: '900'},
  statRow: {flexDirection: 'row', gap: 10, flexWrap: 'wrap'},
  statItem: {fontSize: 11, color: '#64748b'},
  pctRow: {flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center'},
  pctText: {fontSize: 11, fontWeight: '800', color: '#024BAB'},
  detailBox: {marginTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, gap: 6},
  msgRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 4},
  msgName: {fontSize: 12, fontWeight: '700', color: '#000'},
  msgPhone: {fontSize: 10, color: '#94a3b8'},
  msgStatus: {fontSize: 10, fontWeight: '800', color: '#64748b'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 8},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
});
