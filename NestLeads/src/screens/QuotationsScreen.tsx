import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {quotationsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const STATUS_COLORS: Record<string, {bg: string; text: string}> = {
  Draft:    {bg: '#fff',    text: '#000'},
  Sent:     {bg: '#024BAB', text: '#fff'},
  Approved: {bg: '#FFDE00', text: '#000'},
  Rejected: {bg: '#000',    text: '#fff'},
};

export default function QuotationsScreen() {
  const insets = useSafeAreaInsets();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchQuotations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await quotationsAPI.getAll();
      setQuotations(res.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchQuotations();}, [fetchQuotations]);

  const filtered = quotations.filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (q.clientName || '').toLowerCase().includes(s) ||
           (q.projectTitle || '').toLowerCase().includes(s);
  });

  const handleDelete = (id: string) => {
    Alert.alert('Delete Quotation', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {await quotationsAPI.delete(id); fetchQuotations();}
        catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const renderCard = ({item: q}: {item: any}) => {
    const sc = STATUS_COLORS[q.status] || {bg: '#e2e8f0', text: '#000'};
    const total = q.services?.reduce((sum: number, s: any) => sum + (s.price * s.quantity), 0) || 0;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.docIcon}>
            <Icon name="document-text-outline" size={18} color="#024BAB" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.projectTitle} numberOfLines={1}>{q.projectTitle || 'Untitled'}</Text>
            <Text style={styles.clientName} numberOfLines={1}>{q.clientName}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: sc.bg}]}>
            <Text style={[styles.statusText, {color: sc.text}]}>{q.status}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {q.date && (
              <View style={styles.metaRow}>
                <Icon name="calendar-outline" size={12} color="#64748b" />
                <Text style={styles.metaText}>
                  {new Date(q.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}
                </Text>
              </View>
            )}
            {q.companyName && (
              <View style={styles.metaRow}>
                <Icon name="business-outline" size={12} color="#64748b" />
                <Text style={styles.metaText} numberOfLines={1}>{q.companyName}</Text>
              </View>
            )}
          </View>
          <View style={styles.totalBox}>
            <Icon name="logo-usd" size={12} color="#000" />
            <Text style={styles.totalText}>
              {total.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(q._id)}>
          <Icon name="trash-outline" size={13} color="#EF4444" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quotations</Text>
        <Text style={styles.headerSub}>{quotations.length} total</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={{marginRight: 6}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotations..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.thinDivider} />

      {/* Status summary row */}
      <View style={styles.summaryRow}>
        {Object.entries(STATUS_COLORS).map(([status, colors]) => {
          const count = quotations.filter(q => q.status === status).length;
          return (
            <View key={status} style={[styles.summaryChip, {backgroundColor: colors.bg}]}>
              <Text style={[styles.summaryChipText, {color: colors.text}]}>{status}</Text>
              <Text style={[styles.summaryChipCount, {color: colors.text}]}>{count}</Text>
            </View>
          );
        })}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchQuotations(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="document-text-outline" size={40} color="#e2e8f0" />
              <Text style={styles.emptyText}>No quotations yet</Text>
              <Text style={styles.emptySub}>Create quotations from the web app</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  searchRow: {paddingHorizontal: 12, paddingVertical: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  summaryRow: {flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6},
  summaryChip: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 5, borderWidth: 2, borderColor: '#000'},
  summaryChipText: {fontSize: 9, fontWeight: '900', textTransform: 'uppercase'},
  summaryChipCount: {fontSize: 13, fontWeight: '900'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  docIcon: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardInfo: {flex: 1},
  projectTitle: {fontSize: 14, fontWeight: '900', color: '#000'},
  clientName: {fontSize: 11, color: '#64748b'},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: '#000'},
  statusText: {fontSize: 10, fontWeight: '900', textTransform: 'uppercase'},
  cardFooter: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between'},
  footerLeft: {gap: 3},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  metaText: {fontSize: 12, color: '#64748b'},
  totalBox: {flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f8fafc'},
  totalText: {fontSize: 14, fontWeight: '900', color: '#000'},
  deleteBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  deleteBtnText: {fontSize: 12, fontWeight: '700', color: '#EF4444'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 8},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptySub: {fontSize: 12, color: '#cbd5e1'},
});

