import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  TextInput, Alert, ActivityIndicator, RefreshControl, Linking, Modal,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {facebookAPI, campaignAssignmentAPI} from '../services/api';
import {
  parseInsight, matchesDeliveryFilter, paiseToRupees, rupeesToPaise,
  DeliveryToggle, DeliveryFilterBar, PeriodFilterBar, usePeriodFilter,
  META_OBJECTIVES, StatusBadge, type Insight, type DeliveryFilter,
} from '../lib/metaAdsShared';

const FB_COLOR = '#1877F2';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const BLANK_FORM = {
  adAccountId: '', name: '', objective: 'OUTCOME_LEADS', status: 'ACTIVE',
  budgetType: 'daily' as 'daily' | 'lifetime', budget: '', start_time: '', stop_time: '',
};

export default function FacebookAdCampaignsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const {period, setPeriod, periodOpts} = usePeriodFilter();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [objectivePickerOpen, setObjectivePickerOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [campRes, assignRes] = await Promise.all([
        facebookAPI.getMetaCampaigns(),
        campaignAssignmentAPI.getAll('facebook').catch(() => ({data: []} as any)),
      ]);
      const list = campRes.data || [];
      setCampaigns(list);
      setAdAccounts(campRes.adAccounts || []);
      const assignMap: Record<string, any> = {};
      (assignRes.data || []).forEach((a: any) => { assignMap[`facebook:${a.campaignId}`] = a; });
      setAssignments(assignMap);

      const results = await Promise.allSettled(list.map((c: any) => facebookAPI.getMetaCampaignInsights(c.id, periodOpts as any)));
      const map: Record<string, Insight> = {};
      list.forEach((c: any, i: number) => {
        const r = results[i];
        map[c.id] = r.status === 'fulfilled' ? parseInsight(r.value.data) : parseInsight(null);
      });
      setInsights(map);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodOpts]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => campaigns.filter(c =>
    matchesDeliveryFilter(c.status, deliveryFilter) &&
    (!search || c.name?.toLowerCase().includes(search.toLowerCase())),
  ), [campaigns, deliveryFilter, search]);

  const openAdd = () => { setEditing(null); setForm(BLANK_FORM); setModalVisible(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      adAccountId: c.adAccountId || '', name: c.name || '', objective: c.objective || 'OUTCOME_LEADS',
      status: c.status || 'ACTIVE', budgetType: c.lifetime_budget ? 'lifetime' : 'daily',
      budget: String(paiseToRupees(c.daily_budget || c.lifetime_budget) || ''),
      start_time: c.start_time?.slice(0, 10) || '', stop_time: c.stop_time?.slice(0, 10) || '',
    });
    setModalVisible(true);
  };

  const handleToggle = async (c: any) => {
    const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setTogglingId(c.id);
    try {
      await facebookAPI.updateCampaign(c.id, {status: next});
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || (!editing && !form.adAccountId)) {
      Alert.alert('Missing fields', 'Ad account and name are required');
      return;
    }
    setSaving(true);
    try {
      const budgetPaise = form.budget ? rupeesToPaise(Number(form.budget)) : undefined;
      const payload: any = {
        name: form.name, status: form.status,
        start_time: form.start_time || undefined, stop_time: form.stop_time || undefined,
      };
      if (form.budgetType === 'daily') payload.daily_budget = budgetPaise;
      else payload.lifetime_budget = budgetPaise;
      if (editing) {
        await facebookAPI.updateCampaign(editing.id, payload);
      } else {
        payload.adAccountId = form.adAccountId;
        payload.objective = form.objective;
        await facebookAPI.createCampaign(payload);
      }
      setModalVisible(false);
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: any) => {
    Alert.alert('Delete campaign', `Delete "${c.name}"? This cannot be undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await facebookAPI.deleteCampaign(c.id); load(true); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
        },
      },
    ]);
  };

  const assigneeName = (id: string) => assignments[`facebook:${id}`]?.assignedTo?.name;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ad Campaigns</Text>
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
          keyExtractor={c => c.id}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={FB_COLOR} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No campaigns found</Text>}
          renderItem={({item: c}) => {
            const ins = insights[c.id] || parseInsight(null);
            const budget = paiseToRupees(c.daily_budget || c.lifetime_budget);
            const assignedName = assigneeName(c.id);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <DeliveryToggle active={c.status === 'ACTIVE'} onToggle={() => handleToggle(c)} disabled={togglingId === c.id} />
                  <View style={{flex: 1}}>
                    <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.subLabel} numberOfLines={1}>{c.adAccountName} · {META_OBJECTIVES[c.objective] || c.objective}</Text>
                  </View>
                  <StatusBadge status={c.status} />
                </View>

                {assignedName && (
                  <View style={styles.assignedRow}>
                    <Icon name="person-add-outline" size={11} color="#64748b" />
                    <Text style={styles.assignedText}>{assignedName}</Text>
                  </View>
                )}

                <View style={styles.metricsGrid}>
                  <Metric label="Results" value={ins.results.toLocaleString('en-IN')} color="#00C48C" />
                  <Metric label="Cost/Result" value={ins.results ? `₹${(ins.spend / ins.results).toFixed(0)}` : '—'} />
                  <Metric label="Budget" value={budget ? `₹${budget.toLocaleString('en-IN')}` : '—'} />
                  <Metric label="Spent" value={`₹${Math.round(ins.spend).toLocaleString('en-IN')}`} color={FB_COLOR} />
                  <Metric label="Impressions" value={ins.impressions.toLocaleString('en-IN')} />
                </View>

                <View style={styles.actionRow}>
                  {isAdmin && (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(c)}>
                        <Icon name="create-outline" size={13} color="#000" />
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(c)}>
                        <Icon name="trash-outline" size={13} color="#ef4444" />
                        <Text style={[styles.actionBtnText, {color: '#ef4444'}]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, {marginLeft: 'auto'}]}
                    onPress={() => Linking.openURL('https://www.facebook.com/adsmanager')}>
                    <Icon name="open-outline" size={13} color="#000" />
                    <Text style={styles.actionBtnText}>Ads Manager</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editing ? 'Edit Campaign' : 'New Campaign'}</Text>

            {!editing && (
              <>
                <Text style={styles.formLabel}>Ad Account</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setAccountPickerOpen(true)}>
                  <Text style={styles.pickerBtnText}>
                    {adAccounts.find(a => a.id === form.adAccountId)?.name || 'Select ad account'}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#000" />
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.formLabel}>Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={t => setForm({...form, name: t})} placeholder="Campaign name" />

            {!editing && (
              <>
                <Text style={styles.formLabel}>Objective</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setObjectivePickerOpen(true)}>
                  <Text style={styles.pickerBtnText}>{META_OBJECTIVES[form.objective]}</Text>
                  <Icon name="chevron-down" size={14} color="#000" />
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.formLabel}>Status</Text>
            <View style={styles.toggleRow}>
              {['ACTIVE', 'PAUSED'].map(s => (
                <TouchableOpacity key={s} style={[styles.togglePill, form.status === s && {backgroundColor: FB_COLOR}]} onPress={() => setForm({...form, status: s})}>
                  <Text style={[styles.togglePillText, form.status === s && {color: '#fff'}]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Budget Type</Text>
            <View style={styles.toggleRow}>
              {(['daily', 'lifetime'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.togglePill, form.budgetType === t && {backgroundColor: FB_COLOR}]} onPress={() => setForm({...form, budgetType: t})}>
                  <Text style={[styles.togglePillText, form.budgetType === t && {color: '#fff'}]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Budget (₹)</Text>
            <TextInput style={styles.input} value={form.budget} onChangeText={t => setForm({...form, budget: t.replace(/[^0-9]/g, '')})} keyboardType="number-pad" placeholder="e.g. 500" />

            <View style={styles.dateRow}>
              <View style={{flex: 1}}>
                <Text style={styles.formLabel}>Start Date</Text>
                <TextInput style={styles.input} value={form.start_time} onChangeText={t => setForm({...form, start_time: t})} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.formLabel}>End Date</Text>
                <TextInput style={styles.input} value={form.stop_time} onChangeText={t => setForm({...form, stop_time: t})} placeholder="YYYY-MM-DD" />
              </View>
            </View>

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

      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAccountPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            {adAccounts.map(a => (
              <TouchableOpacity key={a.id} style={styles.pickerRow} onPress={() => { setForm({...form, adAccountId: a.id}); setAccountPickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={objectivePickerOpen} transparent animationType="fade" onRequestClose={() => setObjectivePickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setObjectivePickerOpen(false)}>
          <View style={styles.pickerSheet}>
            {Object.entries(META_OBJECTIVES).map(([k, v]) => (
              <TouchableOpacity key={k} style={styles.pickerRow} onPress={() => { setForm({...form, objective: k}); setObjectivePickerOpen(false); }}>
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
      <Text style={[styles.metricValue, color && {color}]}>{value}</Text>
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
  name: {fontSize: 13, fontWeight: '900', color: '#000'},
  subLabel: {fontSize: 10, color: '#64748b', marginTop: 2},
  assignedRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  assignedText: {fontSize: 10, color: '#64748b'},
  metricsGrid: {flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8},
  metricBox: {width: '20%', alignItems: 'center', gap: 2, marginBottom: 4},
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
  dateRow: {flexDirection: 'row', gap: 10},
  formFooter: {flexDirection: 'row', gap: 10, marginTop: 14},
  cancelBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  cancelBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: FB_COLOR, paddingVertical: 12},
  saveBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  pickerSheet: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', margin: 30, maxHeight: '60%'},
  pickerRow: {paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  pickerRowText: {fontSize: 13, color: '#000', fontWeight: '600'},
});
