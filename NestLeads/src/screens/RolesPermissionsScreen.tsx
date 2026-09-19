import React, {useCallback, useEffect, useState} from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator, Modal,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {rolesAPI, settingsAPI} from '../services/api';

// Admin-only. Two parts, matching the web Settings page:
//  • Roles: named labels a tenant maps onto one of four permission tiers.
//  • Permissions: per-tier create / read / update / delete access per resource.

const TIERS = [
  {id: 'admin', label: 'Admin'},
  {id: 'sales_executive', label: 'Sales Exec'},
  {id: 'service_manager', label: 'Service Mgr'},
  {id: 'accountant', label: 'Accountant'},
] as const;
// The permission matrix additionally lists the fixed super_admin tier.
const MATRIX_TIERS = [{id: 'super_admin', label: 'Super Admin'}, ...TIERS] as const;
const OPS = [
  {key: 'create', letter: 'C'},
  {key: 'read', letter: 'R'},
  {key: 'update', letter: 'U'},
  {key: 'delete', letter: 'D'},
] as const;

// Web defaults ("crud" letters allowed, "-" denied), used until something is saved.
const DEFAULTS: Record<string, Record<string, string>> = {
  'Leads': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-r--', accountant: '-r--'},
  'Products': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-r--', accountant: '-r--'},
  'Clients': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-ru-', accountant: '-r--'},
  'Quotations': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-r--', accountant: 'cru-'},
  'Services': {super_admin: 'crud', admin: 'crud', sales_executive: '-r--', service_manager: 'cru-', accountant: '-r--'},
  'Reports': {super_admin: 'crud', admin: 'crud', sales_executive: '-r--', service_manager: '-r--', accountant: '-r--'},
  'Campaigns': {super_admin: 'crud', admin: 'crud', sales_executive: '-r--', service_manager: '-r--', accountant: '-r--'},
  'Visit Calendar': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-r--', accountant: '----'},
  'Follow-ups': {super_admin: 'crud', admin: 'crud', sales_executive: 'cru-', service_manager: '-r--', accountant: '----'},
  'Team / Users': {super_admin: 'crud', admin: 'cru-', sales_executive: '----', service_manager: '----', accountant: '----'},
  'Integrations': {super_admin: 'crud', admin: 'crud', sales_executive: '----', service_manager: '----', accountant: '----'},
  'Billing': {super_admin: 'cru-', admin: '-r--', sales_executive: '----', service_manager: '----', accountant: '-r--'},
  'Settings': {super_admin: 'crud', admin: '-ru-', sales_executive: '----', service_manager: '----', accountant: '----'},
};

type Matrix = Record<string, Record<string, Record<string, boolean>>>;

const defaultMatrix = (): Matrix => {
  const m: Matrix = {};
  for (const [res, roles] of Object.entries(DEFAULTS)) {
    m[res] = {};
    for (const [role, letters] of Object.entries(roles)) {
      m[res][role] = Object.fromEntries(OPS.map((o, i) => [o.key, letters[i] !== '-']));
    }
  }
  return m;
};

export default function RolesPermissionsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'roles' | 'permissions'>('roles');
  const [loading, setLoading] = useState(true);

  // roles
  const [roles, setRoles] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({name: '', tier: 'sales_executive'});
  const [saving, setSaving] = useState(false);

  // permissions
  const [matrix, setMatrix] = useState<Matrix>(defaultMatrix);
  const [tier, setTier] = useState<string>('sales_executive');
  const [dirty, setDirty] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, s]: any[] = await Promise.all([rolesAPI.getAll(), settingsAPI.get().catch(() => null)]);
      setRoles(r.data || []);
      const saved = s?.data?.permissions;
      if (saved) {
        setMatrix(prev => {
          const next: Matrix = JSON.parse(JSON.stringify(prev));
          for (const res of Object.keys(next)) {
            if (saved[res]) for (const role of Object.keys(saved[res])) next[res][role] = {...next[res][role], ...saved[res][role]};
          }
          return next;
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {load();}, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({name: '', tier: 'sales_executive'});
    setFormOpen(true);
  };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({name: r.name, tier: r.tier});
    setFormOpen(true);
  };

  const saveRole = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Enter a role name');
      return;
    }
    setSaving(true);
    try {
      if (editing) await rolesAPI.update(editing._id, {name: form.name.trim(), tier: form.tier});
      else await rolesAPI.create({name: form.name.trim(), tier: form.tier});
      setFormOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRole = (r: any) =>
    Alert.alert('Delete role', `Delete the role "${r.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await rolesAPI.delete(r._id);
          await load();
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }},
    ]);

  const toggle = (res: string, op: string) => {
    setMatrix(m => ({...m, [res]: {...m[res], [tier]: {...m[res][tier], [op]: !m[res][tier][op]}}}));
    setDirty(true);
  };

  const savePerms = async () => {
    setSavingPerms(true);
    try {
      await settingsAPI.update({permissions: matrix});
      setDirty(false);
      Alert.alert('Saved', 'Role permissions updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPerms(false);
    }
  };

  const tierLabel = (id: string) => MATRIX_TIERS.find(t => t.id === id)?.label || id;

  return (
    <View style={[s.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Roles & Permissions</Text>
        {tab === 'roles' && (
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Icon name="add" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.divider} />

      <View style={s.tabs}>
        {(['roles', 'permissions'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && {color: '#fff'}]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : tab === 'roles' ? (
        <ScrollView contentContainerStyle={{padding: 12, gap: 10, paddingBottom: insets.bottom + 24}}>
          <Text style={s.hint}>A role is a name you can assign to team members. Each role maps to one permission tier.</Text>
          {roles.length === 0 && <Text style={s.empty}>No roles yet</Text>}
          {roles.map(r => (
            <View key={r._id} style={s.card}>
              <View style={{flex: 1}}>
                <Text style={s.roleName}>{r.name}</Text>
                <View style={s.tags}>
                  <View style={s.tag}><Text style={s.tagText}>{tierLabel(r.tier)}</Text></View>
                  {r.isDefault && <View style={[s.tag, {borderColor: '#94a3b8'}]}><Text style={[s.tagText, {color: '#64748b'}]}>Default</Text></View>}
                </View>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(r)}>
                <Icon name="create-outline" size={15} color="#024BAB" />
              </TouchableOpacity>
              {!r.isDefault && (
                <TouchableOpacity style={[s.iconBtn, {borderColor: '#EF4444'}]} onPress={() => removeRole(r)}>
                  <Icon name="trash-outline" size={15} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{padding: 12, paddingBottom: insets.bottom + 90}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginBottom: 12}}>
            {MATRIX_TIERS.map(t => (
              <TouchableOpacity key={t.id} style={[s.pill, tier === t.id && s.pillOn]} onPress={() => setTier(t.id)}>
                <Text style={[s.pillText, tier === t.id && {color: '#fff'}]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.matrixHead}>
            <Text style={[s.matrixHeadText, {flex: 1}]}>Resource</Text>
            {OPS.map(o => <Text key={o.key} style={s.opHead}>{o.letter}</Text>)}
          </View>
          {Object.keys(matrix).map(res => (
            <View key={res} style={s.matrixRow}>
              <Text style={s.resName}>{res}</Text>
              {OPS.map(o => {
                const on = !!matrix[res][tier]?.[o.key];
                return (
                  <TouchableOpacity key={o.key} style={[s.check, on && s.checkOn]} onPress={() => toggle(res, o.key)}>
                    {on && <Icon name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <Text style={s.hint}>C = create, R = read, U = update, D = delete.</Text>
        </ScrollView>
      )}

      {tab === 'permissions' && !loading && (
        <View style={[s.saveBar, {paddingBottom: insets.bottom + 10}]}>
          <TouchableOpacity style={[s.save, (!dirty || savingPerms) && {opacity: 0.5}]} onPress={savePerms} disabled={!dirty || savingPerms}>
            {savingPerms ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save permissions</Text>}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>{editing ? 'Edit role' : 'New role'}</Text>
            <Text style={s.label}>Name</Text>
            <TextInput style={s.input} value={form.name} onChangeText={v => setForm(f => ({...f, name: v}))} placeholder="e.g. Field Sales" placeholderTextColor="#94a3b8" />
            <Text style={s.label}>Permission tier</Text>
            <View style={s.tierWrap}>
              {TIERS.map(t => (
                <TouchableOpacity key={t.id} style={[s.pill, form.tier === t.id && s.pillOn]} onPress={() => setForm(f => ({...f, tier: t.id}))}>
                  <Text style={[s.pillText, form.tier === t.id && {color: '#fff'}]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
              <TouchableOpacity style={[s.dialogBtn, {backgroundColor: '#fff'}]} onPress={() => setFormOpen(false)}>
                <Text style={[s.dialogBtnText, {color: '#000'}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dialogBtn, saving && {opacity: 0.6}]} onPress={saveRole} disabled={saving}>
                <Text style={s.dialogBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10},
  backBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  headerTitle: {flex: 1, fontSize: 18, fontWeight: '900', color: '#000'},
  addBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#024BAB'},
  divider: {height: 2, backgroundColor: '#000'},
  tabs: {flexDirection: 'row', gap: 8, padding: 12},
  tab: {flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 9, alignItems: 'center'},
  tabOn: {backgroundColor: '#024BAB'},
  tabText: {fontSize: 12, fontWeight: '900', textTransform: 'uppercase', color: '#000'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  hint: {fontSize: 12, color: '#64748b', marginTop: 4},
  empty: {textAlign: 'center', color: '#94a3b8', fontWeight: '700', marginTop: 30},
  card: {flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#000', padding: 12},
  roleName: {fontSize: 15, fontWeight: '900', color: '#000'},
  tags: {flexDirection: 'row', gap: 6, marginTop: 6},
  tag: {borderWidth: 2, borderColor: '#024BAB', paddingHorizontal: 8, paddingVertical: 1},
  tagText: {fontSize: 10, fontWeight: '900', color: '#024BAB', textTransform: 'uppercase'},
  iconBtn: {width: 32, height: 32, borderWidth: 2, borderColor: '#024BAB', alignItems: 'center', justifyContent: 'center'},
  pill: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 7},
  pillOn: {backgroundColor: '#024BAB', borderColor: '#024BAB'},
  pillText: {fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#000'},
  matrixHead: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 10},
  matrixHeadText: {fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#000'},
  opHead: {width: 40, textAlign: 'center', fontSize: 11, fontWeight: '900', color: '#000'},
  matrixRow: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 10},
  resName: {flex: 1, fontSize: 13, fontWeight: '700', color: '#000'},
  check: {width: 32, height: 32, marginHorizontal: 4, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  checkOn: {backgroundColor: '#00C48C'},
  saveBar: {position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000'},
  save: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 13, alignItems: 'center'},
  saveText: {color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase'},
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24},
  dialog: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 16},
  dialogTitle: {fontSize: 16, fontWeight: '900', color: '#000', marginBottom: 10},
  label: {fontSize: 11, fontWeight: '800', color: '#000', textTransform: 'uppercase', marginTop: 8, marginBottom: 4},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#000'},
  tierWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  dialogBtn: {flex: 1, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 11, alignItems: 'center'},
  dialogBtnText: {color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase'},
});
