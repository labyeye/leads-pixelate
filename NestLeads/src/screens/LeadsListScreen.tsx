import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {
  leadsAPI,
  indiamartAPI,
  facebookAPI,
  tradeindiaSyncAPI,
  justdialSyncAPI,
  productsAPI,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  categoryOrder,
  getCategoryByStatus,
  statusColors,
  ALL_SOURCES,
  ALL_STATUSES,
} from '../constants/statusConstants';
import SourceBadge from '../components/SourceBadge';

const PRIMARY = '#024BAB';
const SECONDARY = '#FF751F';
const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

export interface FilterState {
  sources: string[];
  statuses: string[];
  startDate: string;
  endDate: string;
  budgetMin: string;
  budgetMax: string;
  products: string[];
}

interface Props {
  navigation: any;
  route?: any;
}

const CATEGORY_SHORT: Record<string, string> = {
  'New Lead': 'New',
  'Discussion/Requirement': 'Discussion',
  Quotation: 'Quotation',
  'Visit Scheduled': 'Visit',
  Visited: 'Visited',
  Client: 'Client',
  Dropped: 'Dropped',
};

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  HOT: { bg: '#ef4444', text: '#fff' },
  WARM: { bg: '#FFDE00', text: '#000' },
  COLD: { bg: PRIMARY, text: '#fff' },
};

const BLANK_FILTER: FilterState = {
  sources: [],
  statuses: [],
  startDate: '',
  endDate: '',
  budgetMin: '',
  budgetMax: '',
  products: [],
};

const BUDGET_PRESETS = [
  { label: 'Under ₹1L', min: '0', max: '100000' },
  { label: '₹1L–5L', min: '100000', max: '500000' },
  { label: '₹5L–10L', min: '500000', max: '1000000' },
  { label: '₹10L+', min: '1000000', max: '' },
];

export default function LeadsListScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('New Lead');
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(BLANK_FILTER);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [syncDateOption, setSyncDateOption] = useState<
    'today' | 'yesterday' | 'custom'
  >('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateModalSource, setDateModalSource] = useState<
    'indiamart' | 'facebook' | null
  >(null);
  const [productsList, setProductsList] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    productsAPI.getAll().then(res => setProductsList(res.data || [])).catch(() => {});
  }, []);

  const fetchLeads = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const params: Record<string, string> = {};
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        const res = await leadsAPI.getAll(params);
        setLeads(res.data || []);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load leads');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters.startDate, filters.endDate],
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const cat = getCategoryByStatus(l.status || 'PENDING CONTACT');
      if (cat !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          (l.name || '').toLowerCase().includes(q) ||
          (l.company || '').toLowerCase().includes(q) ||
          (l.phone || '').includes(q);
        if (!match) return false;
      }
      if (filters.sources.length && !filters.sources.includes(l.source))
        return false;
      if (filters.statuses.length && !filters.statuses.includes(l.status))
        return false;
      return true;
    });
  }, [leads, activeCategory, search, filters]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      const cat = getCategoryByStatus(l.status || 'PENDING CONTACT');
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const hasFilters =
    filters.sources.length > 0 ||
    filters.statuses.length > 0 ||
    !!filters.startDate ||
    !!filters.budgetMin ||
    filters.products.length > 0;
  const filterCount =
    filters.sources.length +
    filters.statuses.length +
    (filters.startDate ? 1 : 0) +
    (filters.budgetMin ? 1 : 0) +
    filters.products.length;

  const openFilterModal = () => {
    setDraftFilters({ ...filters });
    setFilterOpen(true);
  };
  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterOpen(false);
  };
  const resetFilters = () => {
    setDraftFilters(BLANK_FILTER);
    setFilters(BLANK_FILTER);
    setFilterOpen(false);
  };
  const toggleDraftSource = (s: string) =>
    setDraftFilters(f => ({
      ...f,
      sources: f.sources.includes(s)
        ? f.sources.filter(x => x !== s)
        : [...f.sources, s],
    }));
  const toggleDraftStatus = (s: string) =>
    setDraftFilters(f => ({
      ...f,
      statuses: f.statuses.includes(s)
        ? f.statuses.filter(x => x !== s)
        : [...f.statuses, s],
    }));
  const toggleDraftProduct = (p: string) =>
    setDraftFilters(f => ({
      ...f,
      products: f.products.includes(p)
        ? f.products.filter(x => x !== p)
        : [...f.products, p],
    }));
  const applyBudgetPreset = (min: string, max: string) =>
    setDraftFilters(f => ({ ...f, budgetMin: min, budgetMax: max }));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const runSync = async (
    source: 'indiamart' | 'facebook' | 'tradeindia' | 'justdial',
    from?: string,
    to?: string,
  ) => {
    try {
      setSyncingSource(source);
      const today = new Date();
      if (source === 'indiamart') {
        await indiamartAPI.sync({
          start_time: from ?? fmt(today),
          end_time: to ?? fmt(today),
        });
      } else if (source === 'facebook') {
        await facebookAPI.sync(undefined, from ?? fmt(today), to ?? fmt(today));
      } else if (source === 'tradeindia') {
        await tradeindiaSyncAPI.sync();
      } else if (source === 'justdial') {
        await justdialSyncAPI.sync();
      }
      Alert.alert('Sync Complete', `${source} leads synced!`);
      fetchLeads();
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message || 'Something went wrong');
    } finally {
      setSyncingSource(null);
    }
  };

  const handleSyncPress = (
    source: 'indiamart' | 'facebook' | 'tradeindia' | 'justdial',
  ) => {
    if (source === 'indiamart' || source === 'facebook') {
      setDateModalSource(source);
      setSyncDateOption('today');
      setCustomFrom('');
      setCustomTo('');
    } else {
      runSync(source);
    }
  };

  const handleDateModalSync = () => {
    if (!dateModalSource) return;
    const today = new Date();
    let from: string | undefined;
    let to: string | undefined;
    if (syncDateOption === 'today') {
      from = fmt(today);
      to = fmt(today);
    } else if (syncDateOption === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      from = fmt(y);
      to = fmt(today);
    } else {
      from = customFrom;
      to = customTo;
    }
    setDateModalSource(null);
    runSync(dateModalSource, from, to);
  };

  const renderLeadCard = ({ item: l }: { item: any }) => {
    const sc = statusColors[l.status] || {
      bg: '#e2e8f0',
      text: '#0f172a',
      border: '#000',
    };
    const tag = l.contactTag ? TAG_COLORS[l.contactTag] : null;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('LeadDetail', { leadId: l._id || l.id })
        }
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.leadName} numberOfLines={1}>
              {l.name || '—'}
            </Text>
            {l.company ? (
              <Text style={styles.leadCompany} numberOfLines={1}>
                {l.company}
              </Text>
            ) : null}
          </View>
          {tag && (
            <View style={[styles.tagPill, { backgroundColor: tag.bg }]}>
              <Text style={[styles.tagPillText, { color: tag.text }]}>
                {l.contactTag}
              </Text>
            </View>
          )}
        </View>

        {l.phone ? (
          <View style={styles.phoneRow}>
            <Icon name="call-outline" size={12} color="#475569" />
            <Text style={styles.leadPhone}>{l.phone}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {/* Bigger source badge */}
          <SourceBadge source={l.source} size="md" />
          <View
            style={[
              styles.statusPill,
              { backgroundColor: sc.bg, borderColor: '#000' },
            ]}
          >
            <Text style={[styles.statusPillText, { color: sc.text }]}>
              {l.status || 'PENDING CONTACT'}
            </Text>
          </View>
        </View>

        {l.assignedTo?.name ? (
          <Text style={styles.assignedText}>Assigned: {l.assignedTo.name}</Text>
        ) : null}
        {l.followUpDate ? (
          <View style={styles.followUpRow}>
            <Icon name="calendar-outline" size={11} color={PRIMARY} />
            <Text style={styles.followUpText}>
              {new Date(l.followUpDate).toLocaleDateString('en-IN')}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Leads</Text>
          <Text style={styles.headerSub}>{leads.length} total</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtnInline}
          onPress={() => navigation.navigate('AddLead')}
        >
          <Text style={styles.addBtnInlineText}>+ Add Lead</Text>
        </TouchableOpacity>
      </View>

      {/* Active filter chips row */}
      {hasFilters && (
        <View style={styles.activeFiltersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersScroll}
          >
            <TouchableOpacity style={styles.clearAllBtn} onPress={resetFilters}>
              <Icon name="close-circle" size={13} color="#fff" />
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
            {filters.sources.map(s => (
              <TouchableOpacity
                key={s}
                style={styles.activeChip}
                onPress={() =>
                  setFilters(f => ({
                    ...f,
                    sources: f.sources.filter(x => x !== s),
                  }))
                }
              >
                <Text style={styles.activeChipText}>{s}</Text>
                <Icon name="close" size={10} color="#000" />
              </TouchableOpacity>
            ))}
            {filters.statuses.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.activeChip, { backgroundColor: '#e0e7ff' }]}
                onPress={() =>
                  setFilters(f => ({
                    ...f,
                    statuses: f.statuses.filter(x => x !== s),
                  }))
                }
              >
                <Text style={styles.activeChipText}>{s}</Text>
                <Icon name="close" size={10} color="#000" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search + Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon
            name="search-outline"
            size={14}
            color="#94a3b8"
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
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
        <TouchableOpacity
          style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
          onPress={openFilterModal}
        >
          <Icon
            name="funnel-outline"
            size={18}
            color={hasFilters ? '#fff' : '#000'}
          />
          {hasFilters && (
            <View style={styles.filterDot}>
              <Text style={styles.filterDotText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sync row — all 4 equal width, no scroll */}
      <View style={styles.syncRow}>
        {(
          [
            {key: 'indiamart',  label: 'IndiaMART',  logo: require('../assets/images/logos/indiamart.png'),   color: '#FF6B2B'},
            {key: 'facebook',   label: 'Facebook',   logo: require('../assets/images/logos/facebook.png'),    color: '#1877F2'},
            {key: 'tradeindia', label: 'TradeIndia', logo: require('../assets/images/logos/tradeindia.webp'), color: '#e11d48'},
            {key: 'justdial',   label: 'JustDial',   logo: require('../assets/images/logos/justdial.webp'),   color: '#f59e0b'},
          ] as const
        ).map(s => {
          const isSyncing = syncingSource === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.syncChip, {borderColor: s.color}, isSyncing && {opacity: 0.6}]}
              onPress={() => handleSyncPress(s.key)}
              disabled={syncingSource !== null}>
              {isSyncing
                ? <ActivityIndicator size={14} color={s.color} />
                : <Image source={s.logo} style={styles.syncLogo} resizeMode="contain" />}
              <Text style={[styles.syncChipText, {color: s.color}]} numberOfLines={1}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.syncRowDivider} />

      {/* Category tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categoryOrder}
        keyExtractor={i => i}
        contentContainerStyle={styles.tabsRow}
        renderItem={({ item: cat }) => {
          const active = cat === activeCategory;
          const count = categoryCounts[cat] || 0;
          return (
            <TouchableOpacity
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {CATEGORY_SHORT[cat] || cat}
              </Text>
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text
                  style={[
                    styles.tabCountText,
                    active && styles.tabCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id || i.id}
          renderItem={renderLeadCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchLeads(true)}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="people-outline" size={40} color="#e2e8f0" />
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptySub}>
                {search
                  ? 'Try a different search term'
                  : 'Tap "+ New" to add a lead'}
              </Text>
            </View>
          }
        />
      )}

      {/* Date picker modal — for IndiaMART & Facebook */}
      <Modal
        visible={dateModalSource !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDateModalSource(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {dateModalSource === 'indiamart' ? 'IndiaMART' : 'Facebook'}{' '}
                Sync
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDateModalSource(null)}
              >
                <Icon name="close" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.filterSectionLabel}>DATE RANGE</Text>
              <View style={styles.syncDateRow}>
                {(['today', 'yesterday', 'custom'] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.syncDateBtn,
                      syncDateOption === opt && styles.syncDateBtnActive,
                    ]}
                    onPress={() => setSyncDateOption(opt)}
                  >
                    <Text
                      style={[
                        styles.syncDateText,
                        syncDateOption === opt && styles.syncDateTextActive,
                      ]}
                    >
                      {opt === 'today'
                        ? 'Today'
                        : opt === 'yesterday'
                        ? 'Yesterday'
                        : 'Custom'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {syncDateOption === 'custom' && (
                <View style={styles.customDateRow}>
                  <View style={styles.customDateField}>
                    <Text style={styles.customDateLabel}>
                      FROM (YYYY-MM-DD)
                    </Text>
                    <TextInput
                      style={styles.customDateInput}
                      value={customFrom}
                      onChangeText={setCustomFrom}
                      placeholder="2024-01-01"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.customDateField}>
                    <Text style={styles.customDateLabel}>TO (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.customDateInput}
                      value={customTo}
                      onChangeText={setCustomTo}
                      placeholder="2024-01-31"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalDivider} />
            <View
              style={[
                styles.modalFooter,
                { paddingBottom: insets.bottom + 12 },
              ]}
            >
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDateModalSource(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleDateModalSync}
              >
                <Icon name="sync-outline" size={16} color="#fff" />
                <Text style={styles.applyBtnText}>Sync Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Filters {filterCount > 0 ? `(${filterCount})` : ''}
              </Text>
              <View style={styles.modalHeaderBtns}>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => setDraftFilters(BLANK_FILTER)}
                >
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setFilterOpen(false)}
                >
                  <Icon name="close" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalDivider} />

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* "All" quick-clear button */}
              {(() => {
                const isClean =
                  draftFilters.sources.length === 0 &&
                  draftFilters.statuses.length === 0 &&
                  !draftFilters.startDate &&
                  !draftFilters.budgetMin &&
                  draftFilters.products.length === 0;
                return (
                  <TouchableOpacity
                    style={[styles.allBtn, isClean && styles.allBtnActive]}
                    onPress={() => setDraftFilters(BLANK_FILTER)}
                  >
                    <Icon name="apps-outline" size={16} color={isClean ? '#fff' : '#000'} />
                    <Text style={[styles.allBtnText, isClean && styles.allBtnTextActive]}>
                      All (Show Everything)
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              {/* Source filter — 2 per row, multi-select */}
              <Text style={styles.filterSectionLabel}>LEAD SOURCE</Text>
              <View style={styles.sourceGrid}>
                {ALL_SOURCES.map(s => {
                  const active = draftFilters.sources.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sourceChip, active && styles.sourceChipActive]}
                      onPress={() => toggleDraftSource(s)}>
                      <SourceBadge source={s} size="md" />
                     
                      {active && <Icon name="checkmark-circle" size={16} color={PRIMARY} style={{marginLeft: 'auto'}} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Status filter */}
              <Text style={styles.filterSectionLabel}>STATUS</Text>
              <View style={styles.chipGrid}>
                {ALL_STATUSES.map(s => {
                  const active = draftFilters.statuses.includes(s);
                  const c = statusColors[s] || { bg: '#e2e8f0', text: '#000' };
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusChip,
                        active && { backgroundColor: c.bg, borderColor: '#000' },
                      ]}
                      onPress={() => toggleDraftStatus(s)}
                    >
                      <Text style={[styles.statusChipText, active && { color: c.text }]}>
                        {s}
                      </Text>
                      {active && <Icon name="checkmark" size={10} color={c.text} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date Range filter */}
              <Text style={styles.filterSectionLabel}>DATE RANGE</Text>
              <View style={styles.dateRangeRow}>
                <View style={styles.dateRangeField}>
                  <Text style={styles.dateRangeFieldLabel}>FROM</Text>
                  <TextInput
                    style={styles.dateRangeInput}
                    value={draftFilters.startDate}
                    onChangeText={v => setDraftFilters(f => ({ ...f, startDate: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.dateRangeSep}>
                  <Text style={styles.dateRangeSepText}>→</Text>
                </View>
                <View style={styles.dateRangeField}>
                  <Text style={styles.dateRangeFieldLabel}>TO</Text>
                  <TextInput
                    style={styles.dateRangeInput}
                    value={draftFilters.endDate}
                    onChangeText={v => setDraftFilters(f => ({ ...f, endDate: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Budget filter */}
              <Text style={styles.filterSectionLabel}>BUDGET</Text>
              <View style={styles.sourceGrid}>
                {BUDGET_PRESETS.map(bp => {
                  const active =
                    draftFilters.budgetMin === bp.min &&
                    draftFilters.budgetMax === bp.max;
                  return (
                    <TouchableOpacity
                      key={bp.label}
                      style={[styles.sourceChip, active && styles.sourceChipActive]}
                      onPress={() =>
                        active
                          ? setDraftFilters(f => ({ ...f, budgetMin: '', budgetMax: '' }))
                          : applyBudgetPreset(bp.min, bp.max)
                      }>
                      <Icon
                        name="cash-outline"
                        size={14}
                        color={active ? PRIMARY : '#64748b'}
                      />
                      <Text style={[styles.sourceChipLabel, active && styles.sourceChipLabelActive]}>
                        {bp.label}
                      </Text>
                      {active && <Icon name="checkmark-circle" size={14} color={PRIMARY} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.budgetCustomRow}>
                <View style={styles.dateRangeField}>
                  <Text style={styles.dateRangeFieldLabel}>MIN ₹</Text>
                  <TextInput
                    style={styles.dateRangeInput}
                    value={draftFilters.budgetMin}
                    onChangeText={v => setDraftFilters(f => ({ ...f, budgetMin: v }))}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.dateRangeSep}>
                  <Text style={styles.dateRangeSepText}>–</Text>
                </View>
                <View style={styles.dateRangeField}>
                  <Text style={styles.dateRangeFieldLabel}>MAX ₹</Text>
                  <TextInput
                    style={styles.dateRangeInput}
                    value={draftFilters.budgetMax}
                    onChangeText={v => setDraftFilters(f => ({ ...f, budgetMax: v }))}
                    placeholder="Any"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Product filter */}
              <Text style={styles.filterSectionLabel}>PRODUCT</Text>
              {productsList.length === 0 ? (
                <Text style={styles.filterEmptyText}>No products found</Text>
              ) : (
                <View style={styles.sourceGrid}>
                  {productsList.map(p => {
                    const active = draftFilters.products.includes(p._id);
                    return (
                      <TouchableOpacity
                        key={p._id}
                        style={[styles.sourceChip, active && styles.sourceChipActive]}
                        onPress={() => toggleDraftProduct(p._id)}>
                        <Icon name="cube-outline" size={14} color={active ? PRIMARY : '#64748b'} />
                        <Text style={[styles.sourceChipLabel, active && styles.sourceChipLabelActive]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {active && <Icon name="checkmark-circle" size={14} color={PRIMARY} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalDivider} />
            <View
              style={[
                styles.modalFooter,
                { paddingBottom: insets.bottom + 12 },
              ]}
            >
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFilterOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                <Icon name="checkmark" size={16} color="#fff" />
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    height: 64,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  syncRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 8,
    gap: 6,
  },
  syncRowDivider: { height: 1, backgroundColor: '#e2e8f0' },
  syncChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
  },
  syncLogo: { width: 26, height: 26 },
  syncChipText: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  filterBtn: {
    width: 39.5,
    height: 39.5,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...NB_SHADOW,
  },
  filterBtnActive: { backgroundColor: PRIMARY },
  filterDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    backgroundColor: SECONDARY,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  filterDotText: { fontSize: 8, fontWeight: '900', color: '#fff' },

  // Active filter chips
  activeFiltersRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  activeFiltersScroll: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#000',
  },
  clearAllText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFDE00',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#000',
  },
  activeChipText: { fontSize: 10, fontWeight: '700', color: '#000' },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  addBtnInline: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...NB_SHADOW,
  },
  addBtnInlineText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  // Tabs
  tabsRow: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#fff',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 20,
    minHeight: 36,
    borderWidth: 2,
    backgroundColor: '#fff',
    gap: 5,
  },
  tabActive: { backgroundColor: PRIMARY },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tabTextActive: { color: '#fff' },
  tabCount: {
    minWidth: 18,
    height: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: '#fff' },
  tabCountText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  tabCountTextActive: { color: PRIMARY },
  divider: { height: 2, backgroundColor: '#000' },

  // Cards
  listContent: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 2,
    ...NB_SHADOW,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTopLeft: { flex: 1, marginRight: 8 },
  leadName: { fontSize: 15, fontWeight: '900', color: '#000' },
  leadCompany: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  leadPhone: { fontSize: 12, color: '#475569', fontWeight: '500' },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
  },
  tagPillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2 },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  assignedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 6,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  followUpText: { fontSize: 11, color: PRIMARY, fontWeight: '700' },

  // States
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  emptySub: { fontSize: 13, color: '#64748b', marginTop: 4 },

  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopWidth: 3,
    borderTopColor: '#000',
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  modalHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  resetBtnText: { fontSize: 12, fontWeight: '900', color: '#ef4444' },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDivider: { height: 2, backgroundColor: '#000' },
  modalBody: { padding: 16, gap: 8 },

  // "All" button
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 4,
    ...NB_SHADOW,
  },
  allBtnActive: { backgroundColor: PRIMARY },
  allBtnText: { fontSize: 14, fontWeight: '900', color: '#000' },
  allBtnTextActive: { color: '#fff' },

  filterSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  sourceChipActive: { borderColor: PRIMARY, backgroundColor: '#eff6ff' },
  sourceChipLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748b' },
  sourceChipLabelActive: { color: PRIMARY, fontWeight: '800' },
  // Date range in filter
  dateRangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 4 },
  dateRangeField: { flex: 1 },
  dateRangeFieldLabel: { fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dateRangeInput: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    backgroundColor: '#fff',
  },
  dateRangeSep: { paddingBottom: 10 },
  dateRangeSepText: { fontSize: 16, fontWeight: '900', color: '#94a3b8' },
  budgetCustomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 },
  filterEmptyText: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#000',
  },

  // Modal footer
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '900', color: '#000' },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SECONDARY,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 13,
    ...NB_SHADOW,
  },
  applyBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },

  syncDateRow: { flexDirection: 'row', gap: 8 },
  syncDateBtn: {
    flex: 1,
    paddingVertical: 9,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  syncDateBtnActive: { backgroundColor: PRIMARY },
  syncDateText: { fontSize: 12, fontWeight: '700', color: '#000' },
  syncDateTextActive: { color: '#fff' },
  customDateRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  customDateField: { flex: 1 },
  customDateLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  customDateInput: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
});
