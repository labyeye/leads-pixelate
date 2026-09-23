import React from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from './Icon';

// Lead assignment for connect/edit forms. None = admin, one = that person, several = block round
// robin: `batchSize` leads each before moving to the next person. Mirrors web AssigneePicker.
export default function AssigneePicker({users, assigneeIds, onAssigneeIdsChange, batchSize, onBatchSizeChange}: {
  users: {_id: string; name: string; role?: string}[];
  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  batchSize: number;
  onBatchSizeChange: (n: number) => void;
}) {
  return (
    <View>
      <Text style={s.hint}>
        {assigneeIds.length === 0
          ? 'None selected: leads go to the admin.'
          : assigneeIds.length === 1
            ? 'All leads go to this person.'
            : `Round-robin: ${batchSize} lead${batchSize === 1 ? '' : 's'} per person, then next.`}
      </Text>
      <View style={s.box}>
        {users.map(u => {
          const on = assigneeIds.includes(u._id);
          return (
            <TouchableOpacity
              key={u._id}
              style={s.row}
              onPress={() => onAssigneeIdsChange(on ? assigneeIds.filter(id => id !== u._id) : [...assigneeIds, u._id])}>
              <View style={[s.check, on && s.checkOn]}>{on && <Icon name="checkmark" size={12} color="#fff" />}</View>
              <Text style={s.name}>{u.name}{u.role ? ` (${u.role.replace('_', ' ')})` : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {assigneeIds.length > 1 && (
        <View style={s.batchRow}>
          <Text style={s.name}>Leads per person before rotating</Text>
          <TextInput
            style={s.batchInput}
            keyboardType="number-pad"
            value={String(batchSize)}
            onChangeText={v => onBatchSizeChange(Math.max(1, Math.min(1000, parseInt(v, 10) || 1)))}
          />
        </View>
      )}
    </View>
  );
}

type Assigned = {assigneeIds?: string[]; assignBatchSize?: number; defaultAssigneeId?: string};

// One-line summary for a connected page/account card; falls back to the legacy single assignee.
export function describeAssignment(a: Assigned, users: {_id: string; name: string}[], fallback = 'Auto-assign') {
  const ids = a.assigneeIds?.length ? a.assigneeIds : a.defaultAssigneeId ? [a.defaultAssigneeId] : [];
  if (ids.length === 0) return fallback;
  if (ids.length === 1) return users.find(u => u._id === ids[0])?.name || 'Assigned';
  return `${ids.length} people, ${a.assignBatchSize || 1} at a time`;
}

const s = StyleSheet.create({
  hint: {fontSize: 11, color: '#64748b', marginBottom: 6},
  box: {borderWidth: 2, borderColor: '#000', padding: 6, maxHeight: 180, backgroundColor: '#F9FAFB'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4},
  check: {width: 18, height: 18, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  checkOn: {backgroundColor: '#024BAB'},
  name: {fontSize: 12, fontWeight: '700', color: '#000', flexShrink: 1},
  batchRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8},
  batchInput: {width: 56, borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '800', color: '#000'},
});
