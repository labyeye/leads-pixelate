import React, {useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator, StyleSheet} from 'react-native';
import Icon from './Icon';

export interface AssignableCampaignRow {
  key: string; // `${platform}:${id}` — unique across platforms
  platform: 'facebook' | 'linkedin';
  name: string;
  subLabel: string;
  status: {label: string; bg: string; text: string};
  spend?: number;
  results?: number;
}

interface TeamUser {
  _id: string;
  name: string;
}

interface Props {
  rows: AssignableCampaignRow[];
  loading: boolean;
  users: TeamUser[];
  assignments: Record<string, any>;
  savingKey: string | null;
  onAssign: (row: AssignableCampaignRow, userId: string) => void;
  emptyTitle: string;
  emptyDesc: string;
  showPlatformColumn?: boolean;
}

export default function CampaignAssignmentList({
  rows,
  loading,
  users,
  assignments,
  savingKey,
  onAssign,
  emptyTitle,
  emptyDesc,
  showPlatformColumn,
}: Props) {
  const [pickerRow, setPickerRow] = useState<AssignableCampaignRow | null>(null);

  const sorted = [...rows].sort((a, b) => {
    const aAssigned = assignments[a.key] ? 0 : 1;
    const bAssigned = assignments[b.key] ? 0 : 1;
    return aAssigned - bAssigned;
  });

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#024BAB" />
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Icon name="megaphone-outline" size={40} color="#e2e8f0" />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyDesc}>{emptyDesc}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={sorted}
        keyExtractor={r => r.key}
        contentContainerStyle={{padding: 12, gap: 10}}
        renderItem={({item: row}) => {
          const assignedTo = assignments[row.key]?.assignedTo;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{flex: 1}}>
                  <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                  <Text style={styles.subLabel} numberOfLines={1}>{row.subLabel}</Text>
                </View>
                <View style={[styles.badge, {backgroundColor: row.status.bg}]}>
                  <Text style={[styles.badgeText, {color: row.status.text}]}>{row.status.label}</Text>
                </View>
              </View>

              {showPlatformColumn && (
                <View style={styles.platformBadge}>
                  <Text style={styles.platformBadgeText}>{row.platform.toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>SPEND</Text>
                  <Text style={[styles.metricValue, {color: '#024BAB'}]}>
                    {row.spend === undefined ? '—' : `₹${Math.round(row.spend).toLocaleString('en-IN')}`}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>RESULTS</Text>
                  <Text style={[styles.metricValue, {color: '#00C48C'}]}>
                    {row.results === undefined ? '—' : row.results.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>OWNER</Text>
                  {assignedTo ? (
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
                      <Icon name="person-add-outline" size={11} color="#00C48C" />
                      <Text style={[styles.metricValue, {color: '#00C48C', fontSize: 10}]}>Owned</Text>
                    </View>
                  ) : (
                    <Text style={styles.metricValue}>—</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.assignBtn}
                disabled={savingKey === row.key}
                onPress={() => setPickerRow(row)}>
                {savingKey === row.key ? (
                  <ActivityIndicator size="small" color="#024BAB" />
                ) : (
                  <>
                    <Icon name="person-add-outline" size={13} color="#024BAB" />
                    <Text style={styles.assignBtnText}>
                      {assignedTo ? assignedTo.name : '— Unassigned —'}
                    </Text>
                    <Icon name="chevron-down" size={12} color="#024BAB" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={!!pickerRow} transparent animationType="slide" onRequestClose={() => setPickerRow(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerRow(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Assign to</Text>
            <FlatList
              data={[{_id: '', name: '— Unassigned —'}, ...users]}
              keyExtractor={u => u._id || 'none'}
              style={{maxHeight: 360}}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => {
                    if (pickerRow) onAssign(pickerRow, item._id);
                    setPickerRow(null);
                  }}>
                  <Text style={styles.userRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centerBox: {paddingVertical: 60, alignItems: 'center'},
  emptyBox: {alignItems: 'center', paddingVertical: 50, gap: 8, paddingHorizontal: 24},
  emptyTitle: {fontSize: 14, fontWeight: '800', color: '#334155'},
  emptyDesc: {fontSize: 12, color: '#94a3b8', textAlign: 'center'},
  card: {borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', padding: 12, gap: 10},
  cardTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  name: {fontSize: 14, fontWeight: '900', color: '#000'},
  subLabel: {fontSize: 11, color: '#64748b', marginTop: 2},
  badge: {paddingHorizontal: 7, paddingVertical: 3, borderWidth: 2, borderColor: '#000'},
  badgeText: {fontSize: 9, fontWeight: '900'},
  platformBadge: {alignSelf: 'flex-start', borderWidth: 2, borderColor: '#000', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2},
  platformBadgeText: {fontSize: 9, fontWeight: '900', color: '#334155'},
  metricsRow: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8},
  metricBox: {flex: 1, alignItems: 'center', gap: 2},
  metricLabel: {fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5},
  metricValue: {fontSize: 13, fontWeight: '900', color: '#000'},
  assignBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: '#024BAB', paddingVertical: 9},
  assignBtnText: {fontSize: 12, fontWeight: '800', color: '#024BAB', flexShrink: 1},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', maxHeight: '60%', padding: 16},
  sheetTitle: {fontSize: 14, fontWeight: '900', marginBottom: 10, color: '#000'},
  userRow: {paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  userRowText: {fontSize: 14, color: '#000', fontWeight: '600'},
});
