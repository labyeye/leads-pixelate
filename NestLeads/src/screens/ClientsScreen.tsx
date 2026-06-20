import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, Modal,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {clientsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const PROJECT_COLORS: Record<string, {bg: string; text: string}> = {
  Active:    {bg: '#024BAB', text: '#fff'},
  Completed: {bg: '#000',    text: '#fff'},
  'On Hold': {bg: '#FFDE00', text: '#000'},
};
const PAYMENT_COLORS: Record<string, {bg: string; text: string}> = {
  Paid:    {bg: '#024BAB', text: '#fff'},
  Pending: {bg: '#FFDE00', text: '#000'},
  Overdue: {bg: '#000',    text: '#fff'},
};

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    projectStatus: 'Active', paymentStatus: 'Pending', address: '',
  });

  const fetchClients = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await clientsAPI.getAll();
      setClients(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => {fetchClients();}, [fetchClients]);

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q);
  });

  const openAdd = () => {
    setEditClient(null);
    setForm({name: '', company: '', email: '', phone: '', projectStatus: 'Active', paymentStatus: 'Pending', address: ''});
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditClient(c);
    setForm({
      name: c.name || '', company: c.company || '', email: c.email || '',
      phone: c.phone || '', projectStatus: c.projectStatus || 'Active',
      paymentStatus: c.paymentStatus || 'Pending', address: c.address || '',
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Client', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {await clientsAPI.delete(id); fetchClients();} catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {Alert.alert('Validation', 'Name is required'); return;}
    try {
      setSaving(true);
      if (editClient) {await clientsAPI.update(editClient._id, form);}
      else {await clientsAPI.create(form);}
      setModalOpen(false);
      fetchClients();
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const set = (k: string, v: string) => setForm(f => ({...f, [k]: v}));

  const renderCard = ({item: c}: {item: any}) => {
    const proj = PROJECT_COLORS[c.projectStatus] || {bg: '#e2e8f0', text: '#000'};
    const pay = PAYMENT_COLORS[c.paymentStatus] || {bg: '#e2e8f0', text: '#000'};
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(c.name || 'C')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.clientName} numberOfLines={1}>{c.name}</Text>
            {c.company && <Text style={styles.clientCompany} numberOfLines={1}>{c.company}</Text>}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(c)}>
              <Icon name="pencil-outline" size={15} color="#024BAB" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(c._id)}>
              <Icon name="trash-outline" size={15} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardMeta}>
          {c.phone && (
            <View style={styles.metaRow}>
              <Icon name="call-outline" size={12} color="#64748b" />
              <Text style={styles.metaText}>{c.phone}</Text>
            </View>
          )}
          {c.email && (
            <View style={styles.metaRow}>
              <Icon name="mail-outline" size={12} color="#64748b" />
              <Text style={styles.metaText} numberOfLines={1}>{c.email}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBadges}>
          <View style={[styles.badge, {backgroundColor: proj.bg}]}>
            <Text style={[styles.badgeText, {color: proj.text}]}>{c.projectStatus || 'Active'}</Text>
          </View>
          <View style={[styles.badge, {backgroundColor: pay.bg}]}>
            <Text style={[styles.badgeText, {color: pay.text}]}>{c.paymentStatus || 'Pending'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>
        <Text style={styles.headerSub}>{clients.length} total</Text>
        <View style={{flex: 1}} />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
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
      </View>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchClients(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="briefcase-outline" size={40} color="#e2e8f0" />
              <Text style={styles.emptyText}>No clients yet</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editClient ? 'EDIT CLIENT' : 'NEW CLIENT'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Icon name="close" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <View style={{gap: 12}}>
              <MField label="NAME *" value={form.name} onChange={v => set('name', v)} placeholder="John Doe" />
              <MField label="COMPANY" value={form.company} onChange={v => set('company', v)} placeholder="Acme Corp" />
              <MField label="PHONE" value={form.phone} onChange={v => set('phone', v)} placeholder="+91 9876543210" kb="phone-pad" />
              <MField label="EMAIL" value={form.email} onChange={v => set('email', v)} placeholder="john@company.com" kb="email-address" cap="none" />
              <MField label="ADDRESS" value={form.address} onChange={v => set('address', v)} placeholder="City, State" multiline />
              <StatusPicker
                label="PROJECT STATUS"
                value={form.projectStatus}
                options={['Active', 'Completed', 'On Hold']}
                onChange={v => set('projectStatus', v)}
              />
              <StatusPicker
                label="PAYMENT STATUS"
                value={form.paymentStatus}
                options={['Paid', 'Pending', 'Overdue']}
                onChange={v => set('paymentStatus', v)}
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && {opacity: 0.7}]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MField({label, value, onChange, placeholder, kb, cap, multiline}: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBorder}>
        <TextInput
          style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={kb}
          autoCapitalize={cap || 'sentences'}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

function StatusPicker({label, value, options, onChange}: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map((o: string) => (
          <TouchableOpacity
            key={o}
            style={[styles.pickerOption, value === o && styles.pickerOptionActive]}
            onPress={() => onChange(o)}>
            <Text style={[styles.pickerOptionText, value === o && styles.pickerOptionTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  addBtn: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 8, gap: 4, ...NB_SHADOW},
  addBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  searchRow: {paddingHorizontal: 12, paddingVertical: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchIcon: {marginRight: 6},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  avatar: {width: 36, height: 36, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 14, fontWeight: '900', color: '#fff'},
  cardInfo: {flex: 1},
  clientName: {fontSize: 14, fontWeight: '900', color: '#000'},
  clientCompany: {fontSize: 11, color: '#64748b'},
  cardActions: {flexDirection: 'row', gap: 6},
  iconBtn: {width: 30, height: 30, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardMeta: {gap: 4, marginBottom: 8},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  metaText: {fontSize: 12, color: '#64748b', fontWeight: '500'},
  cardBadges: {flexDirection: 'row', gap: 6},
  badge: {paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: '#000'},
  badgeText: {fontSize: 10, fontWeight: '900', textTransform: 'uppercase'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 10},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  // Modal
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#000', padding: 20, maxHeight: '90%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
  modalTitle: {fontSize: 12, fontWeight: '900', color: '#64748b', letterSpacing: 1},
  modalDivider: {height: 2, backgroundColor: '#000', marginBottom: 16},
  modalFooter: {flexDirection: 'row', gap: 10, marginTop: 20},
  cancelBtn: {flex: 1, paddingVertical: 13, borderWidth: 2, borderColor: '#000', alignItems: 'center'},
  cancelBtnText: {fontWeight: '700', color: '#000'},
  saveBtn: {flex: 1, paddingVertical: 13, backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', alignItems: 'center', ...NB_SHADOW},
  saveBtnText: {fontWeight: '900', color: '#fff'},
  fieldLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5},
  fieldBorder: {borderWidth: 2, borderColor: '#000'},
  fieldInput: {paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000'},
  fieldInputMulti: {height: 64, textAlignVertical: 'top'},
  pickerRow: {flexDirection: 'row', gap: 6},
  pickerOption: {flex: 1, paddingVertical: 8, borderWidth: 2, borderColor: '#000', alignItems: 'center'},
  pickerOptionActive: {backgroundColor: '#024BAB'},
  pickerOptionText: {fontSize: 11, fontWeight: '700', color: '#000'},
  pickerOptionTextActive: {color: '#fff'},
});

