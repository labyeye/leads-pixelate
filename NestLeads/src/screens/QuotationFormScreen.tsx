import React, {useState} from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {quotationsAPI} from '../services/api';

// Create / edit a quotation. Field set, validation and the total calculation
// (18% tax on the discounted subtotal) mirror the web QuotationsPage.

const STATUSES = ['Draft', 'Sent', 'Approved', 'Rejected'] as const;
const STATUS_COLORS: Record<string, {bg: string; text: string}> = {
  Draft:    {bg: '#fff',    text: '#000'},
  Sent:     {bg: '#024BAB', text: '#fff'},
  Approved: {bg: '#FFDE00', text: '#000'},
  Rejected: {bg: '#000',    text: '#fff'},
};

type Item = {name: string; hsnCode: string; price: string; quantity: string};
const EMPTY_ITEM: Item = {name: '', hsnCode: '', price: '', quantity: '1'};
const today = () => new Date().toISOString().split('T')[0];

const inr = (n: number) => `₹${n.toLocaleString('en-IN', {maximumFractionDigits: 2})}`;

export default function QuotationFormScreen({navigation, route}: any) {
  const insets = useSafeAreaInsets();
  const q = route?.params?.quotation;
  const editing = !!q;

  const [f, setF] = useState({
    clientName: q?.clientName || '',
    companyName: q?.companyName || '',
    address: q?.address || '',
    gst: q?.gst || '',
    aadhar: q?.aadhar || '',
    pan: q?.pan || '',
    mobile: q?.mobile || '',
    projectTitle: q?.projectTitle || '',
    leadTag: q?.leadTag || '',
    date: q?.date ? new Date(q.date).toISOString().split('T')[0] : today(),
    discount: String(q?.discount || 0),
    status: q?.status || 'Draft',
  });
  const [items, setItems] = useState<Item[]>(
    q?.services?.length
      ? q.services.map((s: any) => ({
          name: s.name || '',
          hsnCode: s.hsnCode || '',
          price: String(s.price ?? ''),
          quantity: String(s.quantity ?? 1),
        }))
      : [{...EMPTY_ITEM}],
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof f, v: string) => setF(p => ({...p, [k]: v}));
  const setItem = (i: number, k: keyof Item, v: string) =>
    setItems(prev => prev.map((it, idx) => (idx === i ? {...it, [k]: v} : it)));

  const subtotal = items.reduce((a, s) => a + (Number(s.price) || 0) * (Number(s.quantity) || 0), 0);
  const discount = Number(f.discount) || 0;
  const tax = (subtotal - discount) * 0.18;
  const total = subtotal - discount + tax;

  const validate = (): string | null => {
    if (!f.clientName.trim()) return 'Client name is required';
    if (!f.projectTitle.trim()) return 'Project title is required';
    if (items.length === 0) return 'Add at least one service item';
    if (items.some(s => !s.name.trim())) return 'Every line item must have a name';
    if (items.some(s => !(Number(s.price) > 0))) return 'Each item must have a price greater than 0';
    if (items.some(s => !(Number(s.quantity) >= 1))) return 'Quantity must be at least 1 for each item';
    if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile)) return 'Enter a valid 10-digit Indian mobile number';
    if (f.gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(f.gst)) return 'GSTIN must be 15 characters (e.g. 07AAAAA0000A1Z5)';
    if (f.aadhar && !/^\d{12}$/.test(f.aadhar)) return 'Aadhar must be exactly 12 digits';
    if (f.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan)) return 'PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Date must be YYYY-MM-DD';
    if (discount < 0 || discount > subtotal) return 'Discount must be between 0 and the subtotal';
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Check the form', err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        discount,
        services: items.map(s => ({
          name: s.name.trim(),
          hsnCode: s.hsnCode.trim(),
          price: Number(s.price),
          quantity: Number(s.quantity),
        })),
        subtotal,
        tax,
        total,
      };
      if (editing) await quotationsAPI.update(q._id || q.id, payload);
      else await quotationsAPI.create(payload);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof f, label: string, extra: object = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={f[k]}
        onChangeText={v => set(k, v)}
        placeholderTextColor="#94a3b8"
        {...extra}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[s.container, {paddingTop: insets.top}]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{editing ? 'Edit Quotation' : 'New Quotation'}</Text>
      </View>
      <View style={s.divider} />

      <ScrollView contentContainerStyle={{padding: 14, paddingBottom: insets.bottom + 40}} keyboardShouldPersistTaps="handled">
        <Text style={s.section}>Buyer</Text>
        {field('clientName', 'Name *', {placeholder: 'e.g. Raj Kumar'})}
        {field('companyName', 'Company', {placeholder: 'e.g. Raj Enterprises'})}
        {field('address', 'Address', {multiline: true, style: [s.input, {height: 70, textAlignVertical: 'top'}]})}
        {field('gst', 'GST No', {autoCapitalize: 'characters', maxLength: 15, placeholder: '09AAGCB9274N1ZW'})}
        {field('mobile', 'Mobile', {keyboardType: 'phone-pad', maxLength: 10, placeholder: '9999999999'})}
        {field('aadhar', 'Aadhar', {keyboardType: 'number-pad', maxLength: 12})}
        {field('pan', 'PAN', {autoCapitalize: 'characters', maxLength: 10, placeholder: 'ABCDE1234F'})}

        <Text style={s.section}>Project</Text>
        {field('projectTitle', 'Project / Title *', {placeholder: 'e.g. Supply of Machinery'})}
        {field('leadTag', 'Lead Tag', {placeholder: 'e.g. IndiaMART'})}
        {field('date', 'Date (YYYY-MM-DD)', {placeholder: today()})}

        <Text style={s.section}>Services</Text>
        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemHead}>
              <Text style={s.itemNo}>Item {i + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => setItems(prev => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Icon name="trash-outline" size={15} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
            <TextInput style={s.input} value={it.name} onChangeText={v => setItem(i, 'name', v)} placeholder="Item description *" placeholderTextColor="#94a3b8" />
            <View style={s.row3}>
              <TextInput style={[s.input, {flex: 1.2}]} value={it.hsnCode} onChangeText={v => setItem(i, 'hsnCode', v)} placeholder="HSN" placeholderTextColor="#94a3b8" />
              <TextInput style={[s.input, {flex: 1}]} value={it.price} onChangeText={v => setItem(i, 'price', v)} placeholder="Price *" keyboardType="numeric" placeholderTextColor="#94a3b8" />
              <TextInput style={[s.input, {flex: 0.7}]} value={it.quantity} onChangeText={v => setItem(i, 'quantity', v)} placeholder="Qty" keyboardType="number-pad" placeholderTextColor="#94a3b8" />
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addItem} onPress={() => setItems(prev => [...prev, {...EMPTY_ITEM}])}>
          <Icon name="add" size={14} color="#024BAB" />
          <Text style={s.addItemText}>Add item</Text>
        </TouchableOpacity>

        {field('discount', 'Discount (₹)', {keyboardType: 'numeric'})}

        <Text style={s.section}>Status</Text>
        <View style={s.statusRow}>
          {STATUSES.map(st => {
            const on = f.status === st;
            const c = STATUS_COLORS[st];
            return (
              <TouchableOpacity key={st} style={[s.statusChip, on && {backgroundColor: c.bg === '#fff' ? '#000' : c.bg}]} onPress={() => set('status', st)}>
                <Text style={[s.statusText, on && {color: c.bg === '#fff' ? '#fff' : c.text}]}>{st}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalValue}>{inr(subtotal)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Discount</Text><Text style={s.totalValue}>-{inr(discount)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Tax (18%)</Text><Text style={s.totalValue}>{inr(tax)}</Text></View>
          <View style={[s.totalRow, s.grand]}><Text style={s.grandLabel}>Total</Text><Text style={s.grandValue}>{inr(total)}</Text></View>
        </View>

        <TouchableOpacity style={[s.save, saving && {opacity: 0.6}]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editing ? 'Save Changes' : 'Create Quotation'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10},
  backBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  section: {fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', marginTop: 16, marginBottom: 8},
  field: {marginBottom: 10},
  label: {fontSize: 11, fontWeight: '800', color: '#000', textTransform: 'uppercase', marginBottom: 4},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#000', backgroundColor: '#fff'},
  itemCard: {borderWidth: 2, borderColor: '#000', padding: 10, marginBottom: 10, gap: 8},
  itemHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  itemNo: {fontSize: 11, fontWeight: '900', color: '#64748b', textTransform: 'uppercase'},
  row3: {flexDirection: 'row', gap: 8},
  addItem: {flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 2, borderColor: '#024BAB', paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12},
  addItemText: {fontSize: 12, fontWeight: '800', color: '#024BAB', textTransform: 'uppercase'},
  statusRow: {flexDirection: 'row', gap: 6, marginBottom: 6},
  statusChip: {flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 8, alignItems: 'center'},
  statusText: {fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: '#000'},
  totals: {borderWidth: 2, borderColor: '#000', padding: 12, marginTop: 14, gap: 6, backgroundColor: '#f8fafc'},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between'},
  totalLabel: {fontSize: 12, color: '#64748b', fontWeight: '700'},
  totalValue: {fontSize: 13, color: '#000', fontWeight: '800'},
  grand: {borderTopWidth: 2, borderTopColor: '#000', paddingTop: 8, marginTop: 4},
  grandLabel: {fontSize: 14, fontWeight: '900', color: '#000'},
  grandValue: {fontSize: 16, fontWeight: '900', color: '#000'},
  save: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center', marginTop: 18},
  saveText: {color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase'},
});
