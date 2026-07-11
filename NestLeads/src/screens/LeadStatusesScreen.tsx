import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, ScrollView, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {settingsAPI} from '../services/api';
import {
  categories,
  COLOR_PRESETS,
  setCustomLeadStatuses,
  CustomLeadStatus,
} from '../constants/statusConstants';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const EXTENDABLE_CATEGORIES = ['New Lead', 'Discussion/Requirement', 'Quotation'];

export default function LeadStatusesScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customStatuses, setLocalCustomStatuses] = useState<CustomLeadStatus[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.get();
      const list = res.data?.customLeadStatuses || [];
      setLocalCustomStatuses(list);
      setCustomLeadStatuses(list);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false);}
  }, []);

  useEffect(() => {load();}, [load]);

  const addStatus = (category: string) => {
    const tempValue = `NEW_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLocalCustomStatuses(prev => [
      ...prev,
      {
        value: tempValue,
        category,
        label: 'New Stage',
        colorKey: 'slate',
        order: prev.filter(s => s.category === category).length,
      },
    ]);
  };

  const updateStatus = (value: string, patch: Partial<CustomLeadStatus>) => {
    setLocalCustomStatuses(prev =>
      prev.map(s => (s.value === value ? {...s, ...patch} : s)),
    );
  };

  const removeStatus = (value: string) => {
    Alert.alert('Remove Stage', 'Remove this custom stage? Leads currently on it will keep showing it, but it will no longer appear in the pipeline.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: () => {
        setLocalCustomStatuses(prev => prev.filter(s => s.value !== value));
      }},
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsAPI.update({customLeadStatuses: customStatuses});
      const saved = res.data?.customLeadStatuses || [];
      setLocalCustomStatuses(saved);
      setCustomLeadStatuses(saved);
      Alert.alert('Saved', 'Lead statuses updated.');
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Statuses</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, {paddingBottom: insets.bottom + 32}]}>
          <View style={styles.noteBox}>
            <Icon name="pricetag-outline" size={16} color="#024BAB" />
            <Text style={styles.noteText}>
              Add brand-new stages within New Lead, Discussion, or Quotation. New stages inherit that category's transition rules (drop, jump to Discussion/Quotation) automatically.
            </Text>
          </View>

          {EXTENDABLE_CATEGORIES.map(cat => {
            const stagesInCat = customStatuses.filter(s => s.category === cat);
            return (
              <View key={cat} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{cat}</Text>
                <Text style={styles.categoryFixed}>
                  Fixed stages: {categories[cat]?.filter(v => !stagesInCat.some(s => s.value === v)).join(', ')}
                </Text>

                {stagesInCat.map(s => {
                  const selectedPreset = COLOR_PRESETS.find(p => p.name === s.colorKey) || COLOR_PRESETS[0];
                  return (
                    <View key={s.value} style={styles.stageCard}>
                      <TextInput
                        style={styles.stageInput}
                        value={s.label}
                        onChangeText={v => updateStatus(s.value, {label: v})}
                        placeholder="Stage name"
                        placeholderTextColor="#94a3b8"
                        maxLength={40}
                      />
                      <View style={styles.colorRow}>
                        {COLOR_PRESETS.map(preset => (
                          <TouchableOpacity
                            key={preset.name}
                            onPress={() => updateStatus(s.value, {colorKey: preset.name})}
                            style={[
                              styles.colorSwatch,
                              {backgroundColor: preset.colors.bg, borderColor: preset.colors.border},
                              selectedPreset.name === preset.name && styles.colorSwatchActive,
                            ]}
                          />
                        ))}
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeStatus(s.value)}>
                          <Icon name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addStageBtn} onPress={() => addStatus(cat)}>
                  <Icon name="add" size={14} color="#024BAB" />
                  <Text style={styles.addStageBtnText}>Add Stage to {cat}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 18, fontWeight: '900', color: '#000'},
  saveBtn: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 8, minWidth: 64, alignItems: 'center', ...NB_SHADOW},
  saveBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scroll: {padding: 16, gap: 16},
  noteBox: {flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 2, borderColor: '#024BAB', backgroundColor: '#eff6ff', padding: 12},
  noteText: {flex: 1, fontSize: 11, color: '#1e3a8a', lineHeight: 15},
  categoryBlock: {gap: 8},
  categoryTitle: {fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5},
  categoryFixed: {fontSize: 10, color: '#94a3b8', marginBottom: 4},
  stageCard: {borderWidth: 2, borderColor: '#000', padding: 10, gap: 8, ...NB_SHADOW},
  stageInput: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#000'},
  colorRow: {flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'},
  colorSwatch: {width: 22, height: 22, borderWidth: 2},
  colorSwatchActive: {borderColor: '#024BAB', borderWidth: 3},
  removeBtn: {marginLeft: 'auto' as any, width: 30, height: 30, borderWidth: 2, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center'},
  addStageBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#024BAB', borderStyle: 'dashed', paddingVertical: 10, justifyContent: 'center'},
  addStageBtnText: {fontSize: 12, fontWeight: '800', color: '#024BAB'},
});
