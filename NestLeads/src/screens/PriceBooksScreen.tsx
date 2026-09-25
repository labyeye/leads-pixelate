import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {priceBooksAPI, productsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};
const PRIMARY = '#024BAB';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
const blank = () => ({name: '', description: '', status: 'Active', items: [{product: '', price: ''}]});

// A named list of special prices (wholesale, festival, one big client...). Mirrors
// frontend/src/pages/PriceBooksPage.tsx.
export default function PriceBooksScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [b, p] = await Promise.all([priceBooksAPI.getAll(), productsAPI.getAll()]);
      setRows(b.data || []);
      setProducts(p.data || []);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(b => !search || (b.name || '').toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditing(null); setForm(blank()); setModalVisible(true); };
  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      name: b.name, description: b.description || '', status: b.status,
      items: b.items.length ? b.items.map((i: any) => ({product: String(i.product), price: String(i.price)})) : [{product: '', price: ''}],
    });
    setModalVisible(true);
  };

  const setRow = (i: number, patch: any) =>
    setForm(f => ({...f, items: f.items.map((r, k) => (k === i ? {...r, ...patch} : r))}));
  const pick = (i: number, id: string) => {
    const p = products.find(x => x._id === id);
    setRow(i, {product: id, ...(p && !form.items[i].price ? {price: String(p.price)} : {})});
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Name the price book'); return; }
    const items = form.items.filter(r => r.product);
    if (items.some(r => r.price === '' || parseFloat(r.price) < 0)) { Alert.alert('Error', 'Every product needs a price'); return; }
    if (new Set(items.map(r => r.product)).size !== items.length) { Alert.alert('Error', 'A product is listed twice'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), description: form.description, status: form.status,
        items: items.map(r => ({product: r.product, name: products.find(p => p._id === r.product)?.name || '', price: parseFloat(r.price)})),
      };
      if (editing) await priceBooksAPI.update(editing._id, payload); else await priceBooksAPI.create(payload);
      setModalVisible(false);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (b: any) => {
    Alert.alert('Delete Price Book', `Delete "${b.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try { await priceBooksAPI.delete(b._id); load(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const renderCard = ({item: b}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.bookName} numberOfLines={1}>{b.name}</Text>
          {b.description ? <Text style={styles.bookDesc} numberOfLines={1}>{b.description}</Text> : null}
        </View>
        <View style={[styles.statusBox, {borderColor: b.status === 'Active' ? '#22c55e' : '#64748b'}]}>
          <Text style={[styles.statusText, {color: b.status === 'Active' ? '#22c55e' : '#64748b'}]}>{b.status}</Text>
        </View>
      </View>
      <Text style={styles.countText}>{b.items.length} product{b.items.length === 1 ? '' : 's'}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(b)}>
          <Icon name="pencil-outline" size={13} color={PRIMARY} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(b)}>
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
        <Text style={styles.headerTitle}>Price Books</Text>
        <Text style={styles.headerSub}>{rows.length} items</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={{marginRight: 6}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search price books..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="pricetag-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>{rows.length ? 'No price books match your search.' : 'No price books yet. Make one for wholesale, festival or special-client prices.'}</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>New Price Book</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Price Book' : 'New Price Book'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Wholesale 2026"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={v => setForm(f => ({...f, name: v}))}
              />
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={styles.input}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={v => setForm(f => ({...f, description: v}))}
              />
              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.statusChips}>
                {['Active', 'Inactive'].map(s => (
                  <TouchableOpacity key={s} style={[styles.statusChip, form.status === s && styles.statusChipActive]} onPress={() => setForm(f => ({...f, status: s}))}>
                    <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>SPECIAL PRICES</Text>
              {form.items.map((r, i) => {
                const normal = products.find(p => p._id === r.product)?.price;
                return (
                  <View key={i} style={{marginBottom: 6}}>
                    <View style={styles.priceRow}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productPicker}>
                        {products.map(p => (
                          <TouchableOpacity
                            key={p._id}
                            style={[styles.productChip, r.product === p._id && styles.productChipActive]}
                            onPress={() => pick(i, p._id)}
                          >
                            <Text style={[styles.productChipText, r.product === p._id && styles.productChipTextActive]} numberOfLines={1}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.priceRow}>
                      <TextInput
                        style={[styles.input, {flex: 1}]}
                        placeholder="Price ₹"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={r.price}
                        onChangeText={v => setRow(i, {price: v})}
                      />
                      <TouchableOpacity
                        disabled={form.items.length === 1}
                        onPress={() => setForm(f => ({...f, items: f.items.filter((_, k) => k !== i)}))}
                        style={styles.removeItemBtn}
                      >
                        <Icon name="trash-outline" size={16} color={form.items.length === 1 ? '#cbd5e1' : '#EF4444'} />
                      </TouchableOpacity>
                    </View>
                    {normal != null && <Text style={styles.normalPriceText}>Normal price {money(normal)}</Text>}
                  </View>
                );
              })}
              <TouchableOpacity style={styles.addItemBtn} onPress={() => setForm(f => ({...f, items: [...f.items, {product: '', price: ''}]}))}>
                <Icon name="add" size={14} color={PRIMARY} />
                <Text style={styles.addItemBtnText}>Add product</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Icon name="checkmark" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Create price book'}</Text>
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
  headerTitle: {fontSize: 16, fontWeight: '600', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  addBtn: {
    marginLeft: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000',
    paddingHorizontal: 12, paddingVertical: 7, ...NB_SHADOW,
  },
  addBtnText: {fontSize: 12, fontWeight: '600', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  searchRow: {paddingHorizontal: 12, paddingVertical: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4},
  cardInfo: {flex: 1},
  bookName: {fontSize: 14, fontWeight: '600', color: '#000'},
  bookDesc: {fontSize: 12, color: '#64748b', marginTop: 1},
  statusBox: {borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3},
  statusText: {fontSize: 10, fontWeight: '600', textTransform: 'uppercase'},
  countText: {fontSize: 11, color: '#64748b', marginBottom: 8},
  cardActions: {flexDirection: 'row', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  editBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  editBtnText: {fontSize: 12, fontWeight: '700', color: PRIMARY},
  deleteBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  deleteBtnText: {fontSize: 12, fontWeight: '700', color: '#EF4444'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 12},
  emptyIcon: {width: 80, height: 80, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', ...NB_SHADOW},
  emptyText: {fontSize: 13, fontWeight: '700', color: '#94a3b8', textAlign: 'center', paddingHorizontal: 30},
  emptyAddBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 10, ...NB_SHADOW},
  emptyAddBtnText: {fontSize: 13, fontWeight: '600', color: '#fff'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', maxHeight: '92%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  modalTitle: {flex: 1, fontSize: 16, fontWeight: '600', color: '#000'},
  modalClose: {width: 32, height: 32, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  modalDivider: {height: 2, backgroundColor: '#000'},
  modalBody: {padding: 16},
  fieldLabel: {fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000'},
  statusChips: {flexDirection: 'row', gap: 8},
  statusChip: {borderWidth: 2, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 7},
  statusChipActive: {borderColor: PRIMARY, backgroundColor: '#eff6ff'},
  statusChipText: {fontSize: 11, fontWeight: '800', color: '#64748b'},
  statusChipTextActive: {color: PRIMARY},
  priceRow: {flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4},
  productPicker: {flexGrow: 0},
  productChip: {borderWidth: 2, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, maxWidth: 140},
  productChipActive: {borderColor: PRIMARY, backgroundColor: '#eff6ff'},
  productChipText: {fontSize: 11, fontWeight: '700', color: '#64748b'},
  productChipTextActive: {color: PRIMARY},
  removeItemBtn: {width: 32, height: 40, alignItems: 'center', justifyContent: 'center'},
  normalPriceText: {fontSize: 10, color: '#94a3b8', marginBottom: 4},
  addItemBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  addItemBtnText: {fontSize: 12, fontWeight: '600', color: PRIMARY, textTransform: 'uppercase'},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '600', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '600', color: '#fff'},
});
