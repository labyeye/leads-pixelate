import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {servicesAPI, clientsAPI, productsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const STATUS_OPTIONS = ['Pending', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const STATUS_COLORS: Record<string, string> = {
  Pending: '#94a3b8',
  'In Progress': '#024BAB',
  'On Hold': '#f59e0b',
  Completed: '#22c55e',
  Cancelled: '#EF4444',
};

const BLANK = {allocatedClient: '', product: '', status: 'Pending', timeline: '', progress: '0', notes: ''};

export default function ServicesScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const [productPicker, setProductPicker] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [sRes, cRes, pRes] = await Promise.all([
        servicesAPI.getAll(),
        clientsAPI.getAll(),
        productsAPI.getAll(),
      ]);
      setServices(sRes.data || []);
      setClients(cRes.data || []);
      setProducts(pRes.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchAll();}, [fetchAll]);

  const filtered = services.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.allocatedClient?.name || '').toLowerCase().includes(q) ||
           (s.product?.name || '').toLowerCase().includes(q);
  });

  const openAdd = () => {setEditing(null); setForm(BLANK); setModalVisible(true);};
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      allocatedClient: s.allocatedClient?._id || s.allocatedClient || '',
      product: s.product?._id || s.product || '',
      status: s.status || 'Pending',
      timeline: s.timeline || '',
      progress: String(s.progress || 0),
      notes: s.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.allocatedClient) {Alert.alert('Error', 'Please select a client'); return;}
    if (!form.product) {Alert.alert('Error', 'Please select a product/service'); return;}
    const prog = Number(form.progress);
    if (isNaN(prog) || prog < 0 || prog > 100) {Alert.alert('Error', 'Progress must be between 0 and 100'); return;}
    setSaving(true);
    try {
      const payload = {...form, progress: prog};
      if (editing) await servicesAPI.update(editing._id, payload);
      else await servicesAPI.create(payload);
      setModalVisible(false);
      fetchAll();
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Allocation', 'Delete this service allocation?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {await servicesAPI.delete(id); fetchAll();}
        catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const selectedClientName = clients.find(c => c._id === form.allocatedClient)?.name || 'Select client...';
  const selectedProductName = products.find(p => p._id === form.product)?.name || 'Select product/service...';

  const renderCard = ({item: s}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.svcIcon}>
          <Icon name="briefcase-outline" size={18} color="#024BAB" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.clientName} numberOfLines={1}>{s.allocatedClient?.name || 'Unknown'}</Text>
          <Text style={styles.productName} numberOfLines={1}>{s.product?.name || 'Unknown Product'}</Text>
        </View>
        <View style={[styles.statusPill, {borderColor: STATUS_COLORS[s.status] || '#94a3b8'}]}>
          <Text style={[styles.statusPillText, {color: STATUS_COLORS[s.status] || '#94a3b8'}]}>{s.status}</Text>
        </View>
      </View>
      {s.timeline ? <Text style={styles.timeline}>Timeline: {s.timeline}</Text> : null}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${s.progress || 0}%`}]} />
        </View>
        <Text style={styles.progressText}>{s.progress || 0}%</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(s)}>
          <Icon name="pencil-outline" size={13} color="#024BAB" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(s._id)}>
          <Icon name="trash-outline" size={13} color="#EF4444" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Services</Text>
        <Text style={styles.headerSub}>{services.length} allocations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={{marginRight: 6}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search allocations..."
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="briefcase-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>No service allocations yet</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Allocate Service</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Allocation' : 'Allocate Service'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>CLIENT *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setClientPicker(!clientPicker)}>
                <Text style={styles.pickerText} numberOfLines={1}>{selectedClientName}</Text>
                <Icon name={clientPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#64748b" />
              </TouchableOpacity>
              {clientPicker && (
                <View style={styles.optionList}>
                  {clients.map(c => (
                    <TouchableOpacity key={c._id} style={styles.optionRow} onPress={() => {setForm(f => ({...f, allocatedClient: c._id})); setClientPicker(false);}}>
                      <Text style={styles.optionText}>{c.name}{c.company ? ` (${c.company})` : ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>PRODUCT / SERVICE *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setProductPicker(!productPicker)}>
                <Text style={styles.pickerText} numberOfLines={1}>{selectedProductName}</Text>
                <Icon name={productPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#64748b" />
              </TouchableOpacity>
              {productPicker && (
                <View style={styles.optionList}>
                  {products.map(p => (
                    <TouchableOpacity key={p._id} style={styles.optionRow} onPress={() => {setForm(f => ({...f, product: p._id})); setProductPicker(false);}}>
                      <Text style={styles.optionText}>{p.name} - ₹{p.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.statusChips}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, form.status === s && {backgroundColor: '#024BAB', borderColor: '#000'}]}
                    onPress={() => setForm(f => ({...f, status: s}))}
                  >
                    <Text style={[styles.statusChipText, form.status === s && {color: '#fff'}]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.rowInputs}>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>PROGRESS %</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    value={form.progress}
                    onChangeText={v => setForm(f => ({...f, progress: v}))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>TIMELINE</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2 weeks"
                    placeholderTextColor="#94a3b8"
                    value={form.timeline}
                    onChangeText={v => setForm(f => ({...f, timeline: v}))}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Implementation notes..."
                placeholderTextColor="#94a3b8"
                value={form.notes}
                onChangeText={v => setForm(f => ({...f, notes: v}))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Icon name="checkmark" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Save'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  addBtn: {
    marginLeft: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000',
    paddingHorizontal: 12, paddingVertical: 7, ...NB_SHADOW,
  },
  addBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  searchRow: {paddingHorizontal: 12, paddingVertical: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  svcIcon: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardInfo: {flex: 1},
  clientName: {fontSize: 14, fontWeight: '900', color: '#000'},
  productName: {fontSize: 11, color: '#64748b', marginTop: 1},
  statusPill: {borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4},
  statusPillText: {fontSize: 10, fontWeight: '900'},
  timeline: {fontSize: 11, color: '#64748b', marginBottom: 6},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  progressTrack: {flex: 1, height: 6, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#000'},
  progressFill: {height: '100%', backgroundColor: '#024BAB'},
  progressText: {fontSize: 11, fontWeight: '800', color: '#000', width: 32, textAlign: 'right'},
  cardActions: {flexDirection: 'row', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  editBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  editBtnText: {fontSize: 12, fontWeight: '700', color: '#024BAB'},
  deleteBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  deleteBtnText: {fontSize: 12, fontWeight: '700', color: '#EF4444'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 12},
  emptyIcon: {width: 80, height: 80, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', ...NB_SHADOW},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptyAddBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 10, ...NB_SHADOW},
  emptyAddBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', maxHeight: '90%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  modalTitle: {flex: 1, fontSize: 16, fontWeight: '900', color: '#000'},
  modalClose: {width: 32, height: 32, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  modalDivider: {height: 2, backgroundColor: '#000'},
  modalBody: {padding: 16},
  fieldLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000'},
  textArea: {minHeight: 80},
  rowInputs: {flexDirection: 'row', gap: 12},
  picker: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  pickerText: {fontSize: 13, color: '#000', flex: 1},
  optionList: {borderWidth: 2, borderColor: '#000', borderTopWidth: 0, maxHeight: 160},
  optionRow: {paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  optionText: {fontSize: 13, color: '#000'},
  statusChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  statusChip: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff'},
  statusChipText: {fontSize: 11, fontWeight: '800', color: '#000'},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
});
