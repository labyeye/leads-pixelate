import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, StatusBar, ActivityIndicator, Modal} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {activityAPI} from '../services/api';

const ACTION_COLOR: Record<string, string> = {
  CREATE: '#00C48C', LOGIN: '#00C48C', REGISTER: '#00C48C', LEAD_CONVERTED: '#00C48C',
  UPDATE: '#FFDE00', STATUS_UPDATED: '#FFDE00',
  DELETE: '#ef4444', LOGIN_FAILED: '#ef4444',
  PASSWORD_CHANGED: '#024BAB', PASSWORD_RESET_REQUESTED: '#024BAB', PASSWORD_RESET: '#024BAB', PROFILE_UPDATED: '#024BAB',
  LOGOUT: '#64748b', NOTE_ADDED: '#64748b', INDIAMART_SYNC: '#64748b', PRINT_LOGGED: '#64748b',
};

export default function ActivityLogScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [actionPickerOpen, setActionPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {limit: '200'};
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const res = await activityAPI.getLogs(params);
      setLogs(res.data || []);
    } catch {
      // silent — polling loop, avoid alert spam
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, actionFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load, isAdmin]);

  const modules = useMemo(() => Array.from(new Set(logs.map(l => l.module))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Log</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.deniedBox}>
          <Icon name="lock-closed-outline" size={28} color="#94a3b8" />
          <Text style={styles.deniedText}>Admins only</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Log</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.filters}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search description, user…"
          placeholderTextColor="#64748b"
          style={styles.searchInput}
        />
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip} onPress={() => setModulePickerOpen(true)}>
            <Text style={styles.filterChipText}>{moduleFilter || 'All Modules'}</Text>
            <Icon name="chevron-down" size={12} color="#22c55e" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip} onPress={() => setActionPickerOpen(true)}>
            <Text style={styles.filterChipText}>{actionFilter || 'All Actions'}</Text>
            <Icon name="chevron-down" size={12} color="#22c55e" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#22c55e" /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={l => l._id}
          contentContainerStyle={[styles.feed, {paddingBottom: insets.bottom + 24}]}
          ListEmptyComponent={<Text style={styles.emptyText}>No activity logged yet</Text>}
          renderItem={({item: l}) => {
            const color = ACTION_COLOR[l.action] || '#94a3b8';
            return (
              <View style={styles.row}>
                <Text style={styles.timestamp}>[{new Date(l.timestamp).toLocaleString('en-IN')}]</Text>
                <Text>
                  <Text style={[styles.action, {color}]}>{l.action}</Text>
                  <Text style={styles.module}> ({l.module})</Text>
                </Text>
                <Text style={styles.desc}>{l.description}</Text>
                <Text style={styles.userLine}>{l.userName} · {l.userRole}</Text>
              </View>
            );
          }}
        />
      )}

      <Modal visible={modulePickerOpen} transparent animationType="fade" onRequestClose={() => setModulePickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModulePickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <TouchableOpacity style={styles.pickerRow} onPress={() => { setModuleFilter(''); setModulePickerOpen(false); }}>
              <Text style={styles.pickerRowText}>All Modules</Text>
            </TouchableOpacity>
            {modules.map(m => (
              <TouchableOpacity key={m} style={styles.pickerRow} onPress={() => { setModuleFilter(m); setModulePickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={actionPickerOpen} transparent animationType="fade" onRequestClose={() => setActionPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setActionPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <TouchableOpacity style={styles.pickerRow} onPress={() => { setActionFilter(''); setActionPickerOpen(false); }}>
              <Text style={styles.pickerRowText}>All Actions</Text>
            </TouchableOpacity>
            {actions.map(a => (
              <TouchableOpacity key={a} style={styles.pickerRow} onPress={() => { setActionFilter(a); setActionPickerOpen(false); }}>
                <Text style={styles.pickerRowText}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0b0f0c'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: '#fff'},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '600', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  deniedBox: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff'},
  deniedText: {fontSize: 13, color: '#94a3b8', fontWeight: '700'},
  filters: {padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 2, borderBottomColor: '#000'},
  searchInput: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 12},
  filterRow: {flexDirection: 'row', gap: 8},
  filterChip: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 7},
  filterChipText: {fontSize: 11, fontWeight: '800', color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  feed: {padding: 12},
  emptyText: {textAlign: 'center', color: '#4b5563', marginTop: 40, fontSize: 12, fontFamily: 'monospace'},
  row: {borderBottomWidth: 1, borderBottomColor: '#1f2937', paddingVertical: 8, gap: 2},
  timestamp: {fontFamily: 'monospace', fontSize: 10, color: '#4b5563'},
  action: {fontFamily: 'monospace', fontSize: 12, fontWeight: '600'},
  module: {fontFamily: 'monospace', fontSize: 12, color: '#9ca3af'},
  desc: {fontFamily: 'monospace', fontSize: 11, color: '#d1d5db', marginTop: 2},
  userLine: {fontFamily: 'monospace', fontSize: 10, color: '#6b7280', marginTop: 1},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  pickerSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', maxHeight: '60%'},
  pickerRow: {paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  pickerRowText: {fontSize: 13, color: '#000', fontWeight: '600'},
});
