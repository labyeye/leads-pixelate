import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  TextInput, Alert, ActivityIndicator, RefreshControl, Modal, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {facebookAPI} from '../services/api';
import {
  parseInsight, matchesDeliveryFilter,
  DeliveryToggle, DeliveryFilterBar, PeriodFilterBar, usePeriodFilter,
  CTA_OPTIONS, StatusBadge, type Insight, type DeliveryFilter,
} from '../lib/metaAdsShared';

const FB_COLOR = '#1877F2';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const BLANK_FORM = {
  adset_id: '', name: '', status: 'ACTIVE', page_id: '', title: '', body: '',
  image_url: '', link_url: '', call_to_action_type: 'LEARN_MORE',
};

export default function FacebookAdsListScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [adSets, setAdSets] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const {period, setPeriod, periodOpts} = usePeriodFilter();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [adSetPickerOpen, setAdSetPickerOpen] = useState(false);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [ctaPickerOpen, setCtaPickerOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [adsRes, adSetsRes, pagesRes] = await Promise.all([
        facebookAPI.getAllAds(),
        facebookAPI.getAllAdSets(),
        facebookAPI.getConnectedPages().catch(() => ({data: []} as any)),
      ]);
      const list = adsRes.data || [];
      setAds(list);
      setAdSets(adSetsRes.data || []);
      setPages(pagesRes.data || []);

      const results = await Promise.allSettled(list.map((a: any) => facebookAPI.getMetaCampaignInsights(a.id, periodOpts as any)));
      const map: Record<string, Insight> = {};
      list.forEach((a: any, i: number) => {
        const r = results[i];
        map[a.id] = r.status === 'fulfilled' ? parseInsight(r.value.data) : parseInsight(null);
      });
      setInsights(map);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load ads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodOpts]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => ads.filter(a =>
    matchesDeliveryFilter(a.status, deliveryFilter) &&
    (!search || a.name?.toLowerCase().includes(search.toLowerCase())),
  ), [ads, deliveryFilter, search]);

  const openAdd = () => { setEditing(null); setForm(BLANK_FORM); setModalVisible(true); };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      adset_id: a.adset_id || '', name: a.name || '', status: a.status || 'ACTIVE',
      page_id: '', title: a.creative?.title || '', body: a.creative?.body || '',
      image_url: a.creative?.image_url || '', link_url: a.creative?.link_url || '',
      call_to_action_type: a.creative?.call_to_action_type || 'LEARN_MORE',
    });
    setModalVisible(true);
  };

  const handleToggle = async (a: any) => {
    const next = a.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setTogglingId(a.id);
    try { await facebookAPI.updateAd(a.id, {status: next}); load(true); }
    catch (e: any) { Alert.alert('Error', e.message || 'Failed to update status'); }
    finally { setTogglingId(null); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || (!editing && !form.adset_id)) {
      Alert.alert('Missing fields', 'Ad set and name are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name, status: form.status, title: form.title, body: form.body,
        image_url: form.image_url, link_url: form.link_url, call_to_action_type: form.call_to_action_type,
      };
      if (editing) {
        await facebookAPI.updateAd(editing.id, payload);
      } else {
        payload.adset_id = form.adset_id;
        payload.page_id = form.page_id;
        await facebookAPI.createAd(payload);
      }
      setModalVisible(false);
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save ad');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (a: any) => {
    Alert.alert('Delete ad', `Delete "${a.name}"? This cannot be undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await facebookAPI.deleteAd(a.id); load(true); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ads</Text>
        {isAdmin && (
          <TouchableOpacity onPress={openAdd} style={styles.backBtn}>
            <Icon name="add" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.divider} />

      <View style={styles.filters}>
        <DeliveryFilterBar value={deliveryFilter} onChange={setDeliveryFilter} search={search} onSearchChange={setSearch} />
        <PeriodFilterBar period={period} setPeriod={setPeriod} />
      </View>

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={FB_COLOR} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => a.id}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={FB_COLOR} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No ads found</Text>}
          renderItem={({item: a}) => {
            const ins = insights[a.id] || parseInsight(null);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <DeliveryToggle active={a.status === 'ACTIVE'} onToggle={() => handleToggle(a)} disabled={togglingId === a.id} />
                  {a.creative?.image_url ? (
                    <Image source={{uri: a.creative.image_url}} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Icon name="image-outline" size={16} color="#94a3b8" />
                    </View>
                  )}
                  <View style={{flex: 1}}>
                    <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.subLabel} numberOfLines={1}>{a.campaignName || a.adSetName || a.adset_id}</Text>
                  </View>
                  <StatusBadge status={a.status} />
                </View>

                <View style={styles.metricsGrid}>
                  <Metric label="CTA" value={CTA_OPTIONS[a.creative?.call_to_action_type] || '—'} />
                  <Metric label="Results" value={ins.results.toLocaleString('en-IN')} color="#00C48C" />
                  <Metric label="Spent" value={`₹${Math.round(ins.spend).toLocaleString('en-IN')}`} color={FB_COLOR} />
                  <Metric label="Impr." value={ins.impressions.toLocaleString('en-IN')} />
                </View>

                {isAdmin && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(a)}>
                      <Icon name="create-outline" size={13} color="#000" />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(a)}>
                      <Icon name="trash-outline" size={13} color="#ef4444" />
                      <Text style={[styles.actionBtnText, {color: '#ef4444'}]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editing ? 'Edit Ad' : 'New Ad'}</Text>

            {!editing && (
              <>
                <Text style={styles.formLabel}>Ad Set</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setAdSetPickerOpen(true)}>
                  <Text style={styles.pickerBtnText}>
                    {adSets.find(s => s.id === form.adset_id)?.name || 'Select ad set'}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#000" />
                </TouchableOpacity>

                <Text style={styles.formLabel}>Facebook Page</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setPagePickerOpen(true)}>
                  <Text style={styles.pickerBtnText}>
                    {pages.find((p: any) => p.pageId === form.page_id)?.pageName || 'Select page'}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#000" />
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.formLabel}>Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={t => setForm({...form, name: t})} placeholder="Ad name" />

            <Text style={styles.formLabel}>Status</Text>
            <View style={styles.toggleRow}>
              {['ACTIVE', 'PAUSED'].map(st => (
                <TouchableOpacity key={st} style={[styles.togglePill, form.status === st && {backgroundColor: FB_COLOR}]} onPress={() => setForm({...form, status: st})}>
                  <Text style={[styles.togglePillText, form.status === st && {color: '#fff'}]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Headline</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={t => setForm({...form, title: t})} placeholder="Ad headline" />

            <Text style={styles.formLabel}>Ad Body</Text>
            <TextInput style={[styles.input, {height: 70}]} value={form.body} onChangeText={t => setForm({...form, body: t})} placeholder="Ad text" multiline textAlignVertical="top" />

            <Text style={styles.formLabel}>Image URL</Text>
            <TextInput style={styles.input} value={form.image_url} onChangeText={t => setForm({...form, image_url: t})} placeholder="https://…" autoCapitalize="none" />

            <Text style={styles.formLabel}>Destination URL</Text>
            <TextInput style={styles.input} value={form.link_url} onChangeText={t => setForm({...form, link_url: t})} placeholder="https://…" autoCapitalize="none" />

            <Text style={styles.formLabel}>Call to Action</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setCtaPickerOpen(true)}>
              <Text style={styles.pickerBtnText}>{CTA_OPTIONS[form.call_to_action_type]}</Text>
              <Icon name="chevron-down" size={14} color="#000" />
            </TouchableOpacity>

            <View style={styles.formFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, {opacity: saving ? 0.6 : 1}]} disabled={saving} onPress={handleSave}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={adSetPickerOpen} transparent animationType="fade" onRequestClose={() => setAdSetPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAdSetPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <FlatList data={adSets} keyExtractor={s => s.id} style={{maxHeight: 360}} renderItem={({item: s}) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setForm({...form, adset_id: s.id}); setAdSetPickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{s.name}</Text>
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={pagePickerOpen} transparent animationType="fade" onRequestClose={() => setPagePickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPagePickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <FlatList data={pages} keyExtractor={(p: any) => p.pageId} style={{maxHeight: 360}} renderItem={({item: p}: any) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setForm({...form, page_id: p.pageId}); setPagePickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{p.pageName}</Text>
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={ctaPickerOpen} transparent animationType="fade" onRequestClose={() => setCtaPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCtaPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            {Object.entries(CTA_OPTIONS).map(([k, v]) => (
              <TouchableOpacity key={k} style={styles.pickerRow} onPress={() => { setForm({...form, call_to_action_type: k}); setCtaPickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Metric({label, value, color}: {label: string; value: string; color?: string}) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.metricValue, color && {color}]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  filters: {padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  emptyText: {textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 12},
  card: {borderWidth: 2, borderColor: '#000', padding: 12, gap: 10, ...NB_SHADOW},
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: 10},
  thumb: {width: 36, height: 36, borderWidth: 2, borderColor: '#000'},
  thumbPlaceholder: {alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9'},
  name: {fontSize: 13, fontWeight: '900', color: '#000'},
  subLabel: {fontSize: 10, color: '#64748b', marginTop: 2},
  metricsGrid: {flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8},
  metricBox: {width: '25%', alignItems: 'center', gap: 2, marginBottom: 4},
  metricLabel: {fontSize: 7, fontWeight: '900', color: '#94a3b8'},
  metricValue: {fontSize: 11, fontWeight: '900', color: '#000'},
  actionRow: {flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 6},
  actionBtnText: {fontSize: 10, fontWeight: '800', color: '#000'},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', padding: 18, gap: 6, maxHeight: '88%'},
  sheetTitle: {fontSize: 16, fontWeight: '900', color: '#000', marginBottom: 6},
  formLabel: {fontSize: 10, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13},
  pickerBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10},
  pickerBtnText: {fontSize: 12, color: '#000', fontWeight: '600'},
  toggleRow: {flexDirection: 'row', gap: 8},
  togglePill: {flex: 1, alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 8},
  togglePillText: {fontSize: 11, fontWeight: '800', color: '#000'},
  formFooter: {flexDirection: 'row', gap: 10, marginTop: 14},
  cancelBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  cancelBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: FB_COLOR, paddingVertical: 12},
  saveBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  pickerSheet: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', margin: 30, maxHeight: '60%'},
  pickerRow: {paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  pickerRowText: {fontSize: 13, color: '#000', fontWeight: '600'},
});
