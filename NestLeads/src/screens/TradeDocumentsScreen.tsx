import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {invoicesAPI, productsAPI, purchaseOrdersAPI, salesOrdersAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};
const PRIMARY = '#024BAB';

// Sales orders, purchase orders and invoices are the same screen: a client, line items, totals,
// a status. `route.params.kind` picks which one. Mirrors frontend/src/pages/TradeDocumentsPage.tsx.
const KINDS: Record<string, {title: string; one: string; api: any; statuses: string[]; dateLabel: string; empty: string}> = {
  sales_order: {
    title: 'Sales Orders', one: 'Sales order', api: salesOrdersAPI,
    statuses: ['Draft', 'Confirmed', 'Fulfilled', 'Cancelled'], dateLabel: 'Expected delivery',
    empty: 'No sales orders yet. Create one when a client confirms a quotation.',
  },
  purchase_order: {
    title: 'Purchase Orders', one: 'Purchase order', api: purchaseOrdersAPI,
    statuses: ['Draft', 'Issued', 'Received', 'Cancelled'], dateLabel: 'Expected delivery',
    empty: 'No purchase orders yet.',
  },
  invoice: {
    title: 'Invoices', one: 'Invoice', api: invoicesAPI,
    statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], dateLabel: 'Due date',
    empty: 'No invoices yet. Create one to bill a client.',
  },
};

const STATUS_COLOR: Record<string, string> = {
  Draft: '#64748b', Sent: '#024BAB', Issued: '#024BAB', Confirmed: '#024BAB',
  Paid: '#22c55e', Fulfilled: '#22c55e', Received: '#22c55e',
  Overdue: '#EF4444', Cancelled: '#EF4444',
};

const blankItem = () => ({productId: '', name: '', hsnCode: '', quantity: '1', rate: ''});
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({
  partyName: '', reference: '', date: today(), dueDate: '', status: 'Draft',
  discount: '0', taxPercent: '18', notes: '', items: [blankItem()],
});
const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) : '—');

export default function TradeDocumentsScreen({navigation, route}: any) {
  const kind: keyof typeof KINDS = route.params?.kind || 'invoice';
  const cfg = KINDS[kind];
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setRows((await cfg.api.getAll()).data || []);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [cfg.api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    productsAPI.getAll().then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const filtered = rows.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [d.number, d.partyName, d.reference].some(x => (x || '').toLowerCase().includes(s));
  });

  const openAdd = () => { setEditing(null); setForm(blank()); setModalVisible(true); };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      partyName: d.partyName, reference: d.reference || '',
      date: (d.date || today()).slice(0, 10), dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
      status: d.status, discount: String(d.discount ?? 0), taxPercent: String(d.taxPercent ?? 18),
      notes: d.notes || '',
      items: d.items.map((i: any) => ({productId: i.productId || '', name: i.name, hsnCode: i.hsnCode || '', quantity: String(i.quantity), rate: String(i.rate)})),
    });
    setModalVisible(true);
  };

  const setItem = (i: number, patch: any) =>
    setForm(f => ({...f, items: f.items.map((it, k) => (k === i ? {...it, ...patch} : it))}));
  const pickProduct = (i: number, name: string) => {
    const p = products.find(x => x.name === name);
    setItem(i, p ? {productId: p._id, name, rate: String(p.price), hsnCode: p.hsnCode || ''} : {productId: '', name});
  };

  const totals = useMemo(() => {
    const sub = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0);
    const taxable = Math.max(0, sub - (parseFloat(form.discount) || 0));
    const tax = (taxable * (parseFloat(form.taxPercent) || 0)) / 100;
    return {sub, tax, total: taxable + tax};
  }, [form.items, form.discount, form.taxPercent]);

  const handleSave = async () => {
    if (!form.partyName.trim()) { Alert.alert('Error', 'Add who this is for'); return; }
    const items = form.items.filter(i => i.name.trim());
    if (!items.length) { Alert.alert('Error', 'Add at least one item'); return; }
    if (items.some(i => !(parseFloat(i.quantity) > 0) || i.rate === '' || parseFloat(i.rate) < 0)) {
      Alert.alert('Error', 'Each item needs a quantity above 0 and a rate.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        partyName: form.partyName.trim(), reference: form.reference.trim(),
        date: form.date, dueDate: form.dueDate || null, status: form.status,
        discount: parseFloat(form.discount) || 0, taxPercent: parseFloat(form.taxPercent) || 0,
        notes: form.notes,
        items: items.map(i => ({productId: i.productId || null, name: i.name.trim(), hsnCode: i.hsnCode, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate)})),
      };
      if (editing) await cfg.api.update(editing._id, payload); else await cfg.api.create(payload);
      setModalVisible(false);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (d: any) => {
    Alert.alert(`Delete ${cfg.one}`, `Delete ${cfg.one.toLowerCase()} ${d.number}?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try { await cfg.api.delete(d._id); load(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const renderCard = ({item: d}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.docNumber}>{d.number}</Text>
          <Text style={styles.partyName} numberOfLines={1}>{d.partyName}</Text>
        </View>
        <View style={[styles.statusBox, {borderColor: STATUS_COLOR[d.status] || '#64748b'}]}>
          <Text style={[styles.statusText, {color: STATUS_COLOR[d.status] || '#64748b'}]}>{d.status}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{fmtDate(d.date)}</Text>
        <Text style={styles.metaText}>{cfg.dateLabel}: {fmtDate(d.dueDate)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{money(d.total)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(d)}>
          <Icon name="pencil-outline" size={13} color={PRIMARY} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(d)}>
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
        <Text style={styles.headerTitle}>{cfg.title}</Text>
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
            placeholder={`Search ${cfg.title.toLowerCase()}...`}
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
                <Icon name="document-text-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>{rows.length ? 'Nothing matches your search.' : cfg.empty}</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>New {cfg.one}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? `Edit ${cfg.one}` : `New ${cfg.one}`}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>CLIENT *</Text>
              <TextInput
                style={styles.input}
                placeholder="Client or company name"
                placeholderTextColor="#94a3b8"
                value={form.partyName}
                onChangeText={v => setForm(f => ({...f, partyName: v}))}
              />
              <Text style={styles.fieldLabel}>REFERENCE (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="Quotation or PO number"
                placeholderTextColor="#94a3b8"
                value={form.reference}
                onChangeText={v => setForm(f => ({...f, reference: v}))}
              />

              <Text style={styles.fieldLabel}>ITEMS</Text>
              {form.items.map((it, i) => {
                const stock = products.find(p => p._id === it.productId);
                const short = kind === 'sales_order' && stock && Number(it.quantity) > (stock.stockQuantity ?? 0);
                return (
                <View key={i}>
                <View style={styles.itemRow}>
                  <TextInput
                    style={[styles.input, styles.itemName]}
                    placeholder="Item or service"
                    maxLength={160}
                    placeholderTextColor="#94a3b8"
                    value={it.name}
                    onChangeText={v => pickProduct(i, v)}
                  />
                  <TextInput
                    style={[styles.input, styles.itemQty]}
                    placeholder="Qty"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={it.quantity}
                    onChangeText={v => setItem(i, {quantity: v})}
                  />
                  <TextInput
                    style={[styles.input, styles.itemRate]}
                    placeholder="Rate"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={it.rate}
                    onChangeText={v => setItem(i, {rate: v})}
                  />
                  <TouchableOpacity
                    disabled={form.items.length === 1}
                    onPress={() => setForm(f => ({...f, items: f.items.filter((_, k) => k !== i)}))}
                    style={styles.removeItemBtn}
                  >
                    <Icon name="trash-outline" size={16} color={form.items.length === 1 ? '#cbd5e1' : '#EF4444'} />
                  </TouchableOpacity>
                </View>
                {stock && kind !== 'invoice' && (
                  <Text style={{fontSize: 11, marginBottom: 6, color: short ? '#dc2626' : '#64748b', fontWeight: short ? '800' : '400'}}>
                    {short ? 'Only ' : 'In stock: '}{stock.stockQuantity ?? 0} {stock.unit || 'pcs'}{short ? ' available - order exceeds stock' : ''}
                  </Text>
                )}
                </View>
                );
              })}
              <TouchableOpacity style={styles.addItemBtn} onPress={() => setForm(f => ({...f, items: [...f.items, blankItem()]}))}>
                <Icon name="add" size={14} color={PRIMARY} />
                <Text style={styles.addItemBtnText}>Add item</Text>
              </TouchableOpacity>

              <View style={styles.rowInputs}>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>DISCOUNT (₹)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={form.discount} onChangeText={v => setForm(f => ({...f, discount: v}))} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.fieldLabel}>GST %</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={form.taxPercent} onChangeText={v => setForm(f => ({...f, taxPercent: v}))} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.statusChips}>
                {cfg.statuses.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, form.status === s && styles.statusChipActive]}
                    onPress={() => setForm(f => ({...f, status: s}))}
                  >
                    <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.totalsBox}>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>{money(totals.sub)}</Text></View>
                <View style={styles.totalsRow}><Text style={styles.totalsLabel}>GST</Text><Text style={styles.totalsValue}>{money(totals.tax)}</Text></View>
                <View style={[styles.totalsRow, styles.totalsRowBold]}><Text style={styles.totalsLabelBold}>Total</Text><Text style={styles.totalsValueBold}>{money(totals.total)}</Text></View>
              </View>

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes..."
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
                    <Text style={styles.saveBtnText}>{editing ? 'Save changes' : `Create ${cfg.one.toLowerCase()}`}</Text>
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
  headerTitle: {fontSize: 16, fontWeight: '900', color: '#000'},
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
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6},
  cardInfo: {flex: 1},
  docNumber: {fontSize: 14, fontWeight: '900', color: '#000'},
  partyName: {fontSize: 12, color: '#64748b', marginTop: 1},
  statusBox: {borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3},
  statusText: {fontSize: 10, fontWeight: '900', textTransform: 'uppercase'},
  metaRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  metaText: {fontSize: 11, color: '#64748b'},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  totalLabel: {fontSize: 12, color: '#64748b'},
  totalValue: {fontSize: 15, fontWeight: '900', color: '#000'},
  cardActions: {flexDirection: 'row', gap: 12, paddingTop: 8, marginTop: 4},
  editBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  editBtnText: {fontSize: 12, fontWeight: '700', color: PRIMARY},
  deleteBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  deleteBtnText: {fontSize: 12, fontWeight: '700', color: '#EF4444'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 12},
  emptyIcon: {width: 80, height: 80, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', ...NB_SHADOW},
  emptyText: {fontSize: 13, fontWeight: '700', color: '#94a3b8', textAlign: 'center', paddingHorizontal: 30},
  emptyAddBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 10, ...NB_SHADOW},
  emptyAddBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', maxHeight: '92%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  modalTitle: {flex: 1, fontSize: 16, fontWeight: '900', color: '#000'},
  modalClose: {width: 32, height: 32, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  modalDivider: {height: 2, backgroundColor: '#000'},
  modalBody: {padding: 16},
  fieldLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000'},
  textArea: {minHeight: 70},
  rowInputs: {flexDirection: 'row', gap: 12},
  itemRow: {flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6},
  itemName: {flex: 1},
  itemQty: {width: 56},
  itemRate: {width: 72},
  removeItemBtn: {width: 32, height: 40, alignItems: 'center', justifyContent: 'center'},
  addItemBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  addItemBtnText: {fontSize: 12, fontWeight: '900', color: PRIMARY, textTransform: 'uppercase'},
  statusChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  statusChip: {borderWidth: 2, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 7},
  statusChipActive: {borderColor: PRIMARY, backgroundColor: '#eff6ff'},
  statusChipText: {fontSize: 11, fontWeight: '800', color: '#64748b'},
  statusChipTextActive: {color: PRIMARY},
  totalsBox: {borderWidth: 2, borderColor: '#000', padding: 10, marginTop: 14, backgroundColor: '#f8fafc'},
  totalsRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3},
  totalsRowBold: {borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, paddingTop: 6},
  totalsLabel: {fontSize: 12, color: '#64748b'},
  totalsValue: {fontSize: 12, color: '#000'},
  totalsLabelBold: {fontSize: 13, fontWeight: '900', color: '#000'},
  totalsValueBold: {fontSize: 13, fontWeight: '900', color: '#000'},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
});
