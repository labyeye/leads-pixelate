import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {ALL_SOURCES, ALL_STATUSES, getStatusColor, getStatusLabel} from '../constants/statusConstants';
import {FilterState} from './LeadsListScreen';
import SourceBadge from '../components/SourceBadge';
import {leadsAPI, SavedView} from '../services/api';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: {width: 4, height: 4},
  elevation: 4,
};

export default function FiltersScreen({navigation, route}: any) {
  const insets = useSafeAreaInsets();
  const filters: FilterState = route?.params?.filters || {sources: [], statuses: [], startDate: '', endDate: ''};
  const onApply: (f: FilterState) => void = route?.params?.onApply || (() => {});
  const [local, setLocal] = useState<FilterState>({...filters});

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [savingViewLoading, setSavingViewLoading] = useState(false);

  const fetchSavedViews = useCallback(() => {
    leadsAPI
      .getSavedViews()
      .then(res => setSavedViews(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSavedViews();
  }, [fetchSavedViews]);

  const applySavedView = (view: SavedView) => {
    setLocal({
      sources: view.filters.sources || [],
      statuses: view.filters.statuses || [],
      startDate: view.filters.startDate || '',
      endDate: view.filters.endDate || '',
      budgetMin: view.filters.budgetMin || '',
      budgetMax: view.filters.budgetMax || '',
      products: view.filters.products || [],
    });
  };

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;
    try {
      setSavingViewLoading(true);
      const res = await leadsAPI.createSavedView(newViewName.trim(), local);
      setSavedViews(prev => [...prev, res.data]);
      setNewViewName('');
      setSavingView(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save view');
    } finally {
      setSavingViewLoading(false);
    }
  };

  const handleDeleteView = (id: string) => {
    Alert.alert('Delete View', 'Remove this saved view for your team?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await leadsAPI.deleteSavedView(id);
            setSavedViews(prev => prev.filter(v => v._id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete view');
          }
        },
      },
    ]);
  };

  const toggleSource = (s: string) =>
    setLocal(f => ({
      ...f,
      sources: f.sources.includes(s)
        ? f.sources.filter(x => x !== s)
        : [...f.sources, s],
    }));

  const toggleStatus = (s: string) =>
    setLocal(f => ({
      ...f,
      statuses: f.statuses.includes(s)
        ? f.statuses.filter(x => x !== s)
        : [...f.statuses, s],
    }));

  const handleReset = () =>
    setLocal({sources: [], statuses: [], startDate: '', endDate: '', budgetMin: '', budgetMax: '', products: []});

  const activeCount =
    local.sources.length + local.statuses.length + (local.startDate ? 1 : 0);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Text>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[styles.scroll, {paddingBottom: insets.bottom + 90}]}>

        {/* Saved Views */}
        <View style={styles.section}>
          <View style={styles.savedViewsHeader}>
            <Text style={styles.sectionLabel}>SAVED VIEWS</Text>
            <TouchableOpacity onPress={() => setSavingView(v => !v)}>
              <Text style={styles.savedViewAddText}>
                {savingView ? 'Cancel' : '+ Save Current'}
              </Text>
            </TouchableOpacity>
          </View>

          {savingView && (
            <View style={styles.saveViewRow}>
              <View style={[styles.inputBorder, {flex: 1}]}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="View name"
                  placeholderTextColor="#94a3b8"
                  value={newViewName}
                  onChangeText={setNewViewName}
                />
              </View>
              <TouchableOpacity
                style={styles.saveViewBtn}
                disabled={savingViewLoading || !newViewName.trim()}
                onPress={handleSaveView}>
                <Text style={styles.saveViewBtnText}>
                  {savingViewLoading ? '...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {savedViews.length === 0 ? (
            <Text style={styles.noViewsText}>
              No saved views yet — filters you save are shared with your team.
            </Text>
          ) : (
            <View style={styles.chipWrap}>
              {savedViews.map(v => (
                <TouchableOpacity
                  key={v._id}
                  style={styles.viewChip}
                  onPress={() => applySavedView(v)}
                  onLongPress={() => handleDeleteView(v._id)}>
                  <Icon name="star" size={11} color="#000" />
                  <Text style={styles.viewChipText}>{v.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DATE RANGE</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>From</Text>
              <View style={styles.inputBorder}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={local.startDate}
                  onChangeText={v => setLocal(f => ({...f, startDate: v}))}
                />
              </View>
            </View>
            <Text style={styles.dateSep}>to</Text>
            <View style={styles.dateField}>
              <Text style={styles.label}>To</Text>
              <View style={styles.inputBorder}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={local.endDate}
                  onChangeText={v => setLocal(f => ({...f, endDate: v}))}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Source */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEAD SOURCE</Text>
          <View style={styles.chipWrap}>
            {ALL_SOURCES.map(s => {
              const active = local.sources.includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.sourceChip, active && styles.sourceChipActive]}
                  onPress={() => toggleSource(s)}>
                  <SourceBadge source={s} size="sm"/>
                  {active && <Icon name="checkmark" size={10} color="#000"/>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.chipWrap}>
            {ALL_STATUSES.map(s => {
              const active = local.statuses.includes(s);
              const c = getStatusColor(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    active
                      ? {backgroundColor: c.bg, borderColor: '#000'}
                      : {backgroundColor: '#fff', borderColor: '#000'},
                  ]}
                  onPress={() => toggleStatus(s)}>
                  <Text style={[styles.chipText, {color: active ? c.text : '#000'}]}>
                    {getStatusLabel(s)}
                  </Text>
                  {active && (
                    <Text style={[styles.chipCheck, {color: c.text}]}>âœ"</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Apply â€" orange like web CTA */}
      <View style={[styles.footer, {paddingBottom: insets.bottom + 12}]}>
        <View style={styles.divider} />
        <View style={styles.footerInner}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              onApply(local);
              navigation.goBack();
            }}>
            <Text style={styles.applyBtnText}>
              Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    height: 64,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  resetText: {fontSize: 13, fontWeight: '700', color: '#EF4444'},
  divider: {height: 2, backgroundColor: '#000'},
  scroll: {padding: 16, gap: 12},

  section: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 0,
    ...NB_SHADOW,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 12,
  },
  dateRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  dateField: {flex: 1},
  dateSep: {fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8},
  label: {fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 6},
  inputBorder: {borderWidth: 2, borderColor: '#000', backgroundColor: '#fff'},
  dateInput: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },

  savedViewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  savedViewAddText: {fontSize: 11, fontWeight: '800', color: '#024BAB'},
  saveViewRow: {flexDirection: 'row', gap: 8, marginBottom: 10},
  saveViewBtn: {
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveViewBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  noViewsText: {fontSize: 12, color: '#64748b', fontWeight: '500'},
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  viewChipText: {fontSize: 11, fontWeight: '700', color: '#000'},
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    gap: 4,
  },
  chipText: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  chipCheck: {fontSize: 10, fontWeight: '900'},
  sourceChip: {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:6,paddingVertical:5,borderWidth:2,borderColor:'#e2e8f0',backgroundColor:'#f8fafc'},
  sourceChipActive: {borderColor:'#000',backgroundColor:'#FFDE00'},

  footer: {backgroundColor: '#fff'},
  footerInner: {paddingHorizontal: 16, paddingTop: 12},
  applyBtn: {
    backgroundColor: '#FF751F',
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    ...NB_SHADOW,
  },
  applyBtnText: {color: '#fff', fontSize: 15, fontWeight: '900'},
});

