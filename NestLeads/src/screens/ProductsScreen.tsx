import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {productsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const BLANK = {name: '', description: '', price: '', unit: '', category: ''};

export default function ProductsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await productsAPI.getAll();
      setProducts(res.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchProducts();}, [fetchProducts]);

  const filtered = products.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(s) ||
           (p.category || '').toLowerCase().includes(s);
  });

  const openAdd = () => {setEditing(null); setForm(BLANK); setModalVisible(true);};
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: String(p.price || ''),
      unit: p.unit || '',
      category: p.category || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {Alert.alert('Error', 'Product name is required'); return;}
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price) || 0,
      };
      if (editing) {
        await productsAPI.update(editing._id, payload);
      } else {
        await productsAPI.create(payload);
      }
      setModalVisible(false);
      fetchProducts();
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Delete "${name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {await productsAPI.delete(id); fetchProducts();}
        catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const renderCard = ({item: p}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.productIcon}>
          <Icon name="cube-outline" size={18} color="#024BAB" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
          {p.category ? <Text style={styles.productCat} numberOfLines={1}>{p.category}</Text> : null}
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceText}>â‚¹{(p.price || 0).toLocaleString('en-IN')}</Text>
          {p.unit ? <Text style={styles.unitText}>/{p.unit}</Text> : null}
        </View>
      </View>
      {p.description ? (
        <Text style={styles.description} numberOfLines={2}>{p.description}</Text>
      ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
          <Icon name="pencil-outline" size={13} color="#024BAB" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p._id, p.name)}>
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
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSub}>{products.length} items</Text>
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
            placeholder="Search products..."
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchProducts(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="cube-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>No products yet</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Add First Product</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>PRODUCT NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter product name"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={v => setForm(f => ({...f, name: v}))}
              />
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Software, Service, Hardware"
                placeholderTextColor="#94a3b8"
                value={form.category}
                onChangeText={v => setForm(f => ({...f, category: v}))}
              />
              <View style={styles.rowInputs}>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>PRICE (â‚¹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    value={form.price}
                    onChangeText={v => setForm(f => ({...f, price: v}))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>UNIT</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. month, piece"
                    placeholderTextColor="#94a3b8"
                    value={form.unit}
                    onChangeText={v => setForm(f => ({...f, unit: v}))}
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Product description..."
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={v => setForm(f => ({...f, description: v}))}
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
  productIcon: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardInfo: {flex: 1},
  productName: {fontSize: 14, fontWeight: '900', color: '#000'},
  productCat: {fontSize: 11, color: '#64748b', marginTop: 1},
  priceBox: {flexDirection: 'row', alignItems: 'baseline', gap: 1, borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f8fafc'},
  priceText: {fontSize: 14, fontWeight: '900', color: '#000'},
  unitText: {fontSize: 10, color: '#64748b', fontWeight: '600'},
  description: {fontSize: 12, color: '#64748b', marginBottom: 8},
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
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
});

