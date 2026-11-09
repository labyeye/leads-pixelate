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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {
  leadsAPI,
  indiamartAPI,
  facebookAPI,
  googleAdsAPI,
  tradeindiaSyncAPI,
  justdialSyncAPI,
  productsAPI,
  usersAPI,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ExportFieldsDialog, { type ExportField } from '../components/ExportFieldsDialog';
import { csvToLeads } from '../lib/leadsImport';
import {
  categoryOrder,
  getCategoryByStatus,
  getStatusColor,
  getStatusLabel,
  ALL_SOURCES,
  ALL_STATUSES,
} from '../constants/statusConstants';
import SourceBadge, { SourceLogo } from '../components/SourceBadge';
import {
  ArrowRight,
  Mail,
  PhoneCall,
} from 'lucide-react-native';

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
  assignees?: string[];
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

const PRIORITY: Record<string, { label: string; bg: string; text: string }> = {
  HOT: { label: 'High Priority', bg: '#ef4444', text: '#fff' },
  WARM: { label: 'Medium Priority', bg: '#FFDE00', text: '#000' },
  COLD: { label: 'Low Priority', bg: '#024BAB', text: '#fff' },
};

function timeAgo(d?: string) {
  if (!d) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const BLANK_FILTER: FilterState = {
  sources: [],
  statuses: [],
  startDate: '',
  endDate: '',
  budgetMin: '',
  budgetMax: '',
  products: [],
  assignees: [],
};

const BUDGET_PRESETS = [
  { label: 'Under ₹1L', min: '0', max: '100000' },
  { label: '₹1L–5L', min: '100000', max: '500000' },
  { label: '₹5L–10L', min: '500000', max: '1000000' },
  { label: '₹10L+', min: '1000000', max: '' },
];

const LEAD_EXPORT_FIELDS: ExportField[] = [
  { key: 'name', label: 'Name', get: (l: any) => l.name || '' },
  { key: 'phone', label: 'Phone', get: (l: any) => l.phone || '' },
  { key: 'email', label: 'Email', get: (l: any) => l.email || '' },
  { key: 'company', label: 'Company', get: (l: any) => l.company || '' },
  { key: 'source', label: 'Source', get: (l: any) => l.source || '' },
  { key: 'status', label: 'Status', get: (l: any) => l.status || '' },
  { key: 'assigned', label: 'Assigned', get: (l: any) => l.assignedTo?.name || '' },
  { key: 'budget', label: 'Budget', get: (l: any) => l.budget || '' },
  { key: 'product', label: 'Interested', get: (l: any) => l.interestedProduct || l.product?.name || '' },
  { key: 'city', label: 'City', default: false, get: (l: any) => l.city || '' },
  { key: 'state', label: 'State', default: false, get: (l: any) => l.state || '' },
  { key: 'requirement', label: 'Requirement', default: false, get: (l: any) => l.requirement || '' },
  { key: 'remarks', label: 'Remarks', default: false, get: (l: any) => l.remarks || '' },
  { key: 'tag', label: 'Tag', default: false, get: (l: any) => l.contactTag || '' },
  { key: 'created', label: 'Created At', default: false, get: (l: any) => l.createdAt || '' },
];

export default function LeadsListScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'budget' | 'updated'>('newest');
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const runImport = async () => {
    const { leads: rows, error } = csvToLeads(importText);
    if (error) return Alert.alert('Import', error);
    try {
      setImporting(true);
      const r = await leadsAPI.importBulk(rows);
      Alert.alert('Import complete', r.message || `${r.count} imported`);
      setImportOpen(false);
      setImportText('');
      fetchLeads(true);
    } catch (e: any) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  };
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const selecting = selected.length > 0;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const toggleSel = (id: string) =>
    setSelected(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const bulkStatus = async (status: string) => {
    setBulkStatusOpen(false);
    try {
      const r = await leadsAPI.bulkUpdateStatus(selected, status);
      Alert.alert('Updated', `${r.updatedCount} lead(s) moved to ${status}.`);
      setSelected([]);
      fetchLeads(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };
  const bulkAssign = async (userId: string) => {
    setBulkAssignOpen(false);
    try {
      const r = await leadsAPI.bulkAssign(selected, userId);
      Alert.alert('Reassigned', `${r.updatedCount} updated, ${r.skippedCount} skipped.`);
      setSelected([]);
      fetchLeads(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };
  const bulkDelete = () =>
    Alert.alert('Delete leads', `Move ${selected.length} lead(s) to Trash?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await leadsAPI.bulkDelete(selected);
            setSelected([]);
            fetchLeads(true);
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  const [draftFilters, setDraftFilters] = useState<FilterState>(BLANK_FILTER);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [syncDateOption, setSyncDateOption] = useState<
    'today' | 'yesterday' | 'custom'
  >('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateModalSource, setDateModalSource] = useState<
    'indiamart' | 'facebook' | 'googleAds' | null
  >(null);
  const [productsList, setProductsList] = useState<
    { _id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!isAdmin) return;
    usersAPI
      .getAll()
      .then(res => setUsers(res.data || []))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    productsAPI
      .getAll()
      .then(res => setProductsList(res.data || []))
      .catch(() => {});
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
    const list = leads.filter(l => {
      const cat = getCategoryByStatus(l.status || 'PENDING CONTACT');
      if (activeCategory !== 'All' && cat !== activeCategory) return false;
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
      if (filters.assignees?.length && !filters.assignees.includes(l.assignedTo?._id || l.assignedTo))
        return false;
      if (filters.products.length && !filters.products.includes(l.product?._id || l.product))
        return false;
      if (filters.budgetMin || filters.budgetMax) {
        const b = Number(String(l.budget || '').replace(/[^\d.]/g, ''));
        if (!b) return false;
        if (filters.budgetMin && b < Number(filters.budgetMin)) return false;
        if (filters.budgetMax && b > Number(filters.budgetMax)) return false;
      }
      return true;
    });
    const time = (l: any) => new Date(l.createdAt || 0).getTime();
    const num = (l: any) => Number(String(l.budget || '').replace(/[^\d.]/g, '')) || 0;
    const upd = (l: any) => new Date(l.updatedAt || l.createdAt || 0).getTime();
    return [...list].sort((a, b) =>
      sortBy === 'budget'
        ? num(b) - num(a)
        : sortBy === 'updated'
          ? upd(b) - upd(a)
          : sortBy === 'name'
            ? (a.name || '').localeCompare(b.name || '')
            : sortBy === 'oldest'
              ? time(a) - time(b)
              : time(b) - time(a),
    );
  }, [leads, activeCategory, search, filters, sortBy]);

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
    filters.products.length > 0 ||
    !!filters.assignees?.length;
  const filterCount =
    filters.sources.length +
    filters.statuses.length +
    (filters.startDate ? 1 : 0) +
    (filters.budgetMin ? 1 : 0) +
    filters.products.length +
    (filters.assignees?.length || 0);

  const openSort = () =>
    Alert.alert('Sort leads', undefined, [
      { text: 'Newest first', onPress: () => setSortBy('newest') },
      { text: 'Oldest first', onPress: () => setSortBy('oldest') },
      { text: 'Name (A–Z)', onPress: () => setSortBy('name') },
      { text: 'Budget (high → low)', onPress: () => setSortBy('budget') },
      { text: 'Recently updated', onPress: () => setSortBy('updated') },
      { text: 'Cancel', style: 'cancel' },
    ]);

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
    source: 'indiamart' | 'facebook' | 'googleAds' | 'tradeindia' | 'justdial',
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
      } else if (source === 'googleAds') {
        await googleAdsAPI.sync(undefined, from ?? fmt(today));
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
    source: 'indiamart' | 'facebook' | 'googleAds' | 'tradeindia' | 'justdial',
  ) => {
    if (
      source === 'indiamart' ||
      source === 'facebook' ||
      source === 'googleAds'
    ) {
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
    const tag = l.contactTag ? PRIORITY[l.contactTag] : null;
    const sc = getStatusColor(l.status);
    const subtitle =
      l.interestedProduct || l.product?.name || l.company || l.requirement;
    const budget = /^[\d,.]+$/.test(String(l.budget || '').trim())
      ? `₹${l.budget}`
      : l.budget;
    const score = Number(l.aiScore);
    const id = l._id || l.id;
    const open = () =>
      selecting ? toggleSel(id) : navigation.navigate('LeadDetail', { leadId: id });
    return (
      <TouchableOpacity
        style={[styles.card, selected.includes(id) && { borderColor: PRIMARY, borderWidth: 3 }]}
        onPress={open}
        onLongPress={() => toggleSel(id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(l.name || '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardTopMid}>
            <Text style={styles.leadName} numberOfLines={1}>
              {l.name || '—'}
            </Text>
            {!!subtitle && (
              <Text style={styles.leadSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <View style={styles.pillCol}>
            <View style={[styles.pill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.pillText, { color: sc.text }]} numberOfLines={1}>
                {getStatusLabel(l.status) || 'Pending'}
              </Text>
            </View>
            {tag && (
              <View style={[styles.pill, { backgroundColor: tag.bg }]}>
                <Text style={[styles.pillText, { color: tag.text }]}>{tag.label}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaInfo}>
            {!!l.source && <SourceLogo source={l.source} size={16} />}
            <Text style={styles.metaText} numberOfLines={1}>
              {[l.source, budget, timeAgo(l.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, !l.phone && styles.actionDisabled]}
            disabled={!l.phone}
            onPress={() => Linking.openURL(`tel:${l.phone}`)}
            hitSlop={4}
          >
            <PhoneCall size={16} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !l.phone && styles.actionDisabled]}
            disabled={!l.phone}
            onPress={() =>
              Linking.openURL(`https://wa.me/${String(l.phone).replace(/\D/g, '')}`)
            }
            hitSlop={4}
          >
            <Icon name="logo-whatsapp" size={16} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !l.email && styles.actionDisabled]}
            disabled={!l.email}
            onPress={() => Linking.openURL(`mailto:${l.email}`)}
            hitSlop={4}
          >
            <Mail size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('More')} hitSlop={10}>
          <Icon name="menu" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leads</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              if (searchOpen) setSearch('');
              setSearchOpen(v => !v);
            }}
            hitSlop={10}
          >
            <Icon name={searchOpen ? 'close' : 'search-outline'} size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} hitSlop={10}>
            <Icon name="notifications-outline" size={24} color="#000" />
            {leads.length > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => navigation.navigate('AddLead')}
            accessibilityLabel="Add lead"
            activeOpacity={0.85}
          >
            <Icon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Icon name="search-outline" size={14} color="#000" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search leads..."
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>
      )}

      {selecting && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FFDE00', borderBottomWidth: 2, borderColor: '#000' }}>
          <TouchableOpacity onPress={() => setSelected([])} hitSlop={8}>
            <Icon name="close" size={20} color="#000" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontWeight: '500', color: '#000' }}>{selected.length} selected</Text>
          <TouchableOpacity style={styles.pillBtn} onPress={() => setSelected(filtered.map(l => l._id || l.id))}>
            <Text style={styles.pillBtnText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillBtn} onPress={() => setBulkStatusOpen(true)}>
            <Text style={styles.pillBtnText}>Status</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.pillBtn} onPress={() => setBulkAssignOpen(true)}>
              <Text style={styles.pillBtnText}>Assign</Text>
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity style={[styles.pillBtn, { backgroundColor: '#dc2626' }]} onPress={bulkDelete}>
              <Text style={[styles.pillBtnText, { color: '#fff' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ExportFieldsDialog
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title={selecting ? `Export ${selected.length} selected` : 'Export Leads'}
        fields={LEAD_EXPORT_FIELDS}
        data={selecting ? filtered.filter(l => selected.includes(l._id || l.id)) : filtered}
        filenamePrefix="leads"
      />

      <Modal visible={importOpen} transparent animationType="slide" onRequestClose={() => setImportOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Import leads (paste CSV)</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
              First row = headers (name required; phone, email, company, source, city, budget, requirement, remarks optional). Copy rows from Excel/Sheets and paste.
            </Text>
            <TextInput
              style={{ minHeight: 160, maxHeight: 280, borderWidth: 2, borderColor: '#000', padding: 8, textAlignVertical: 'top', color: '#000' }}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder={'name,phone,email\nAsha,9876543210,asha@x.com'}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.pillBtn, { flex: 1, justifyContent: 'center' }]} onPress={() => setImportOpen(false)}>
                <Text style={styles.pillBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, styles.pillBtnActive, { flex: 1, justifyContent: 'center' }]}
                onPress={runImport}
                disabled={importing || !importText.trim()}
              >
                <Text style={[styles.pillBtnText, { color: '#fff' }]}>{importing ? 'Importing…' : 'Import'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bulkAssignOpen} transparent animationType="slide" onRequestClose={() => setBulkAssignOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Assign {selected.length} lead(s) to</Text>
            <ScrollView>
              {users.map(u => (
                <TouchableOpacity key={u._id} style={{ paddingVertical: 12 }} onPress={() => bulkAssign(u._id)}>
                  <Text style={{ color: '#000', fontWeight: '500' }}>{u.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={{ paddingVertical: 12 }} onPress={() => setBulkAssignOpen(false)}>
              <Text style={{ color: '#64748b' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={bulkStatusOpen} transparent animationType="slide" onRequestClose={() => setBulkStatusOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Set status for {selected.length}</Text>
            <ScrollView>
              {ALL_STATUSES.map(st => (
                <TouchableOpacity key={st} style={{ paddingVertical: 12 }} onPress={() => bulkStatus(st)}>
                  <Text style={{ color: '#000', fontWeight: '500' }}>{getStatusLabel(st) || st}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={{ paddingVertical: 12 }} onPress={() => setBulkStatusOpen(false)}>
              <Text style={{ color: '#64748b' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.pipelineRow}>
        <Text style={styles.pipelineTitle}>Lead Pipeline</Text>
        <View style={styles.pipelineBtns}>
          <TouchableOpacity
            style={[styles.pillBtn, hasFilters && styles.pillBtnActive]}
            onPress={openFilterModal}
          >
            <Icon name="funnel-outline" size={15} color={hasFilters ? '#fff' : '#000'} />
            <Text style={[styles.pillBtnText, hasFilters && { color: '#fff' }]}>
              Filter{hasFilters ? ` (${filterCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillBtn} onPress={openSort}>
            <Icon name="swap-vertical" size={15} color="#000" />
            <Text style={styles.pillBtnText}>Sort</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillBtn} onPress={() => setExportOpen(true)}>
            <Icon name="download-outline" size={15} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillBtn} onPress={() => setImportOpen(true)}>
            <Icon name="cloud-upload-outline" size={15} color="#000" />
          </TouchableOpacity>
        </View>
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

      {/* Sync row — equal width chips, no scroll */}

      <View style={styles.syncRowDivider} />

      {/* Category tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['All', ...categoryOrder]}
        keyExtractor={i => i}
        style={styles.tabsFlatList}
        contentContainerStyle={styles.tabsRow}
        renderItem={({ item: cat }) => {
          const active = cat === activeCategory;
          const count = cat === 'All' ? leads.length : categoryCounts[cat] || 0;
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
          style={styles.leadsList}
          data={filtered}
          keyExtractor={i => i._id || i.id}
          renderItem={renderLeadCard}
          extraData={selected}
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
                {dateModalSource === 'indiamart'
                  ? 'IndiaMART'
                  : dateModalSource === 'googleAds'
                    ? 'Google Ads'
                    : 'Facebook'}{' '}
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
                      placeholderTextColor="#000"
                    />
                  </View>
                  <View style={styles.customDateField}>
                    <Text style={styles.customDateLabel}>TO (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.customDateInput}
                      value={customTo}
                      onChangeText={setCustomTo}
                      placeholder="2024-01-31"
                      placeholderTextColor="#000"
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
                    <Icon
                      name="apps-outline"
                      size={16}
                      color={isClean ? '#fff' : '#000'}
                    />
                    <Text
                      style={[
                        styles.allBtnText,
                        isClean && styles.allBtnTextActive,
                      ]}
                    >
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
                      style={[
                        styles.sourceChip,
                        active && styles.sourceChipActive,
                      ]}
                      onPress={() => toggleDraftSource(s)}
                    >
                      <SourceBadge source={s} size="md" />

                      {active && (
                        <Icon
                          name="checkmark-circle"
                          size={16}
                          color={PRIMARY}
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Status filter */}
              <Text style={styles.filterSectionLabel}>STATUS</Text>
              <View style={styles.chipGrid}>
                {ALL_STATUSES.map(s => {
                  const active = draftFilters.statuses.includes(s);
                  const c = getStatusColor(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusChip,
                        active && {
                          backgroundColor: c.bg,
                          borderColor: '#000',
                        },
                      ]}
                      onPress={() => toggleDraftStatus(s)}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          active && { color: c.text },
                        ]}
                      >
                        {getStatusLabel(s)}
                      </Text>
                      {active && (
                        <Icon name="checkmark" size={10} color={c.text} />
                      )}
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
                    onChangeText={v =>
                      setDraftFilters(f => ({ ...f, startDate: v }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#000"
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
                    onChangeText={v =>
                      setDraftFilters(f => ({ ...f, endDate: v }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#000"
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
                      style={[
                        styles.sourceChip,
                        active && styles.sourceChipActive,
                      ]}
                      onPress={() =>
                        active
                          ? setDraftFilters(f => ({
                              ...f,
                              budgetMin: '',
                              budgetMax: '',
                            }))
                          : applyBudgetPreset(bp.min, bp.max)
                      }
                    >
                      <Icon
                        name="cash-outline"
                        size={14}
                        color={active ? PRIMARY : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.sourceChipLabel,
                          active && styles.sourceChipLabelActive,
                        ]}
                      >
                        {bp.label}
                      </Text>
                      {active && (
                        <Icon
                          name="checkmark-circle"
                          size={14}
                          color={PRIMARY}
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
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
                    onChangeText={v =>
                      setDraftFilters(f => ({ ...f, budgetMin: v }))
                    }
                    placeholder="0"
                    placeholderTextColor="#000"
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
                    onChangeText={v =>
                      setDraftFilters(f => ({ ...f, budgetMax: v }))
                    }
                    placeholder="Any"
                    placeholderTextColor="#000"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {isAdmin && users.length > 0 && (
                <>
                  <Text style={styles.filterSectionLabel}>ASSIGNED TO</Text>
                  <View style={styles.sourceGrid}>
                    {users.map(u => {
                      const active = draftFilters.assignees?.includes(u._id);
                      return (
                        <TouchableOpacity
                          key={u._id}
                          style={[styles.sourceChip, active && styles.sourceChipActive]}
                          onPress={() =>
                            setDraftFilters(f => {
                              const cur = f.assignees || [];
                              return {
                                ...f,
                                assignees: cur.includes(u._id)
                                  ? cur.filter(x => x !== u._id)
                                  : [...cur, u._id],
                              };
                            })
                          }
                        >
                          <Text style={[styles.sourceChipLabel, active && styles.sourceChipLabelActive]} numberOfLines={1}>
                            {u.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

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
                        style={[
                          styles.sourceChip,
                          active && styles.sourceChipActive,
                        ]}
                        onPress={() => toggleDraftProduct(p._id)}
                      >
                        <Icon
                          name="cube-outline"
                          size={14}
                          color={active ? PRIMARY : '#64748b'}
                        />
                        <Text
                          style={[
                            styles.sourceChipLabel,
                            active && styles.sourceChipLabelActive,
                          ]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        {active && (
                          <Icon
                            name="checkmark-circle"
                            size={14}
                            color={PRIMARY}
                            style={{ marginLeft: 'auto' }}
                          />
                        )}
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
    height: 56,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B6FF0',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  pipelineTitle: { fontSize: 18, fontWeight: '500', color: '#000' },
  pipelineBtns: { flexDirection: 'row', gap: 8 },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  pillBtnActive: { backgroundColor: PRIMARY },
  pillBtnText: { fontSize: 13, fontWeight: '500', color: '#000' },
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
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
  },
  syncLogo: { width: 26, height: 26 },
  syncChipText: { fontSize: 9, fontWeight: '500', textAlign: 'center' },
  filterBtn: {
    width: 39.5,
    height: 39.5,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
  filterDotText: { fontSize: 8, fontWeight: '500', color: '#fff' },

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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
  },
  clearAllText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFDE00',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  activeChipText: { fontSize: 10, fontWeight: '500', color: '#000' },

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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addBtnInlineText: { fontSize: 13, fontWeight: '500', color: '#fff' },

  // Tabs
  // Fixed height so this row can never stretch to fill leftover vertical
  // space (e.g. when the leads list below it is empty) — chip size must
  // stay constant regardless of how much data is loaded.
  tabsFlatList: { flexGrow: 0, flexShrink: 0, height: 54 },
  tabsRow: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#fff',
    gap: 5,
  },
  tabActive: { backgroundColor: PRIMARY },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
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
  tabCountText: { fontSize: 10, fontWeight: '500', color: '#fff' },
  tabCountTextActive: { color: PRIMARY },
  divider: { height: 2, backgroundColor: '#000' },

  // Cards
  leadsList: { flex: 1 },
  listContent: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 10,
    marginBottom: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#044bab',
    borderWidth: 2,
    borderColor: '#000',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#FBFBFB' },
  cardTopMid: { flex: 1 },
  leadName: { fontSize: 15, fontWeight: '500', color: '#000' },
  leadSubtitle: { fontSize: 12, color: '#374151', fontWeight: '500', marginTop: 1 },
  pillCol: { alignItems: 'flex-end', gap: 4, maxWidth: 120 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  metaInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: '#374151' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', marginTop: 8 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  pillText: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  scoreWrap: { alignItems: 'center', gap: 4 },
  scoreLabel: { fontSize: 10, color: '#000', fontWeight: '500', textTransform: 'uppercase' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000',
  },
  statCol: { flex: 1 },
  statLabel: {
    fontSize: 10,
    color: '#000',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 15, fontWeight: '500', color: '#000' },
  statDivider: { width: 2, alignSelf: 'stretch', backgroundColor: '#000', marginHorizontal: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontSize: 13, fontWeight: '500', color: '#000', textTransform: 'uppercase' },
  detailsBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 8,
    backgroundColor: SECONDARY,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  detailsText: { fontSize: 13, fontWeight: '500', color: '#fff', textTransform: 'uppercase' },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  followUpText: { fontSize: 11, color: PRIMARY, fontWeight: '500' },
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
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#000' },
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
  modalTitle: { fontSize: 18, fontWeight: '500', color: '#000' },
  modalHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#ef4444',
  },
  resetBtnText: { fontSize: 12, fontWeight: '500', color: '#ef4444' },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderRadius: 8,
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  allBtnActive: { backgroundColor: PRIMARY },
  allBtnText: { fontSize: 14, fontWeight: '500', color: '#000' },
  allBtnTextActive: { color: '#fff' },

  filterSectionLabel: {
    fontSize: 10,
    fontWeight: '500',
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
    borderRadius: 8,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  sourceChipActive: { borderColor: PRIMARY, backgroundColor: '#eff6ff' },
  sourceChipLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  sourceChipLabelActive: { color: PRIMARY, fontWeight: '500' },
  // Date range in filter
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  dateRangeField: { flex: 1 },
  dateRangeFieldLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateRangeInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
    backgroundColor: '#fff',
  },
  dateRangeSep: { paddingBottom: 10 },
  dateRangeSepText: { fontSize: 16, fontWeight: '500', color: '#000' },
  budgetCustomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  filterEmptyText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
    marginBottom: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: '#000',
  },

  // Modal footer
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500', color: '#000' },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SECONDARY,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingVertical: 13,
  },
  applyBtnText: { fontSize: 14, fontWeight: '500', color: '#fff' },

  syncDateRow: { flexDirection: 'row', gap: 8 },
  syncDateBtn: {
    flex: 1,
    paddingVertical: 9,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  syncDateBtnActive: { backgroundColor: PRIMARY },
  syncDateText: { fontSize: 12, fontWeight: '500', color: '#000' },
  syncDateTextActive: { color: '#fff' },
  customDateRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  customDateField: { flex: 1 },
  customDateLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  customDateInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
});
