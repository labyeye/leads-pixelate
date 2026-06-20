import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {leadsAPI, usersAPI, productsAPI} from '../services/api';
import {ALL_SOURCES} from '../constants/statusConstants';
import SourceBadge from '../components/SourceBadge';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: {width: 4, height: 4},
  elevation: 4,
};

export default function AddLeadScreen({navigation}: any) {
  const onBack = () => navigation.goBack();
  const onSuccess = () => { navigation.goBack(); };
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    requirement: '',
    budget: '',
    source: 'Manual',
    assignedTo: '',
    location: '',
    state: '',
    interestedProducts: [] as string[],
  });

  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [uRes, pRes] = await Promise.all([
          usersAPI.getAll({status: 'active'}),
          productsAPI.getAll(),
        ]);
        setUsers(uRes.data || []);
        setProducts(pRes.data || []);
        if (uRes.data?.length) {
          setForm(f => ({...f, assignedTo: uRes.data[0]._id}));
        }
      } catch {}
    })();
  }, []);

  const set = (key: string, val: string) => setForm(f => ({...f, [key]: val}));

  const handleLocationChange = async (val: string) => {
    set('location', val);
    if (/^\d{6}$/.test(val.trim())) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val.trim()}`);
        const data = await res.json();
        const po = data?.[0]?.PostOffice?.[0];
        if (po) {
          setForm(f => ({...f, location: po.District || po.Name, state: po.State}));
        }
      } catch {}
      finally {
        setPincodeLoading(false);
      }
    }
  };

  const toggleProduct = (name: string) => {
    setForm(f => ({
      ...f,
      interestedProducts: f.interestedProducts.includes(name)
        ? f.interestedProducts.filter(p => p !== name)
        : [...f.interestedProducts, name],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {Alert.alert('Validation', 'Name is required'); return;}
    if (!form.phone.trim()) {Alert.alert('Validation', 'Phone is required'); return;}
    try {
      setSaving(true);
      await leadsAPI.create(form);
      Alert.alert('Success', 'Lead created successfully!');
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const assignedUser = users.find(u => u._id === form.assignedTo);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Lead</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && {opacity: 0.7}]}
          onPress={handleSubmit}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="checkmark" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[styles.scroll, {paddingBottom: insets.bottom + 24}]}
        keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
          <Field label="Full Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="John Doe" />
          <Field label="Company" value={form.company} onChangeText={v => set('company', v)} placeholder="Acme Corp" />
          <Field label="Phone *" value={form.phone} onChangeText={v => set('phone', v)} placeholder="+91 9876543210" keyboardType="phone-pad" />
          <Field label="Email" value={form.email} onChangeText={v => set('email', v)} placeholder="john@company.com" keyboardType="email-address" autoCapitalize="none" />
        </View>

        {/* Lead Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEAD DETAILS</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Lead Source</Text>
            <TouchableOpacity style={styles.selectRow} onPress={() => setSourceModalOpen(true)}>
              <Text style={styles.selectText}>{form.source}</Text>
              <Text style={styles.selectChevron}>â€º</Text>
            </TouchableOpacity>
          </View>

          <Field label="Requirement" value={form.requirement} onChangeText={v => set('requirement', v)} placeholder="What does the client need?" multiline />
          <Field label="Budget" value={form.budget} onChangeText={v => set('budget', v)} placeholder="e.g. 50000" keyboardType="numeric" />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              City / Pincode{pincodeLoading ? ' (detecting...)' : ''}
            </Text>
            <View style={styles.inputBorder}>
              <TextInput
                style={styles.input}
                placeholder="Enter city or 6-digit pincode"
                placeholderTextColor="#94a3b8"
                value={form.location}
                onChangeText={handleLocationChange}
              />
            </View>
          </View>
          {!!form.state && (
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>ðŸ" State detected: {form.state}</Text>
            </View>
          )}
        </View>

        {/* Assignment */}
        {users.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSIGNMENT</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Assign To</Text>
              <TouchableOpacity style={styles.selectRow} onPress={() => setAssignModalOpen(true)}>
                <Text style={styles.selectText}>{assignedUser?.name || 'Select user'}</Text>
                <Text style={styles.selectChevron}>â€º</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Products */}
        {products.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INTERESTED PRODUCTS</Text>
            <TouchableOpacity style={styles.selectRow} onPress={() => setProductModalOpen(true)}>
              <Text style={styles.selectText} numberOfLines={1}>
                {form.interestedProducts.length
                  ? form.interestedProducts.join(', ')
                  : 'Select products'}
              </Text>
              <Text style={styles.selectChevron}>â€º</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Pickers */}
      <PickerModal
        visible={sourceModalOpen}
        title="SELECT SOURCE"
        items={ALL_SOURCES.map(s => ({label: s, value: s}))}
        selected={form.source}
        onSelect={v => {set('source', v); setSourceModalOpen(false);}}
        onClose={() => setSourceModalOpen(false)}
      />
      <PickerModal
        visible={assignModalOpen}
        title="ASSIGN TO"
        items={users.map(u => ({label: u.name, value: u._id}))}
        selected={form.assignedTo}
        onSelect={v => {set('assignedTo', v); setAssignModalOpen(false);}}
        onClose={() => setAssignModalOpen(false)}
      />

      {/* Products multi-select modal */}
      <Modal
        visible={productModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProductModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>SELECT PRODUCTS</Text>
            {products.map((p: any) => {
              const sel = form.interestedProducts.includes(p.name);
              return (
                <TouchableOpacity
                  key={p._id}
                  style={[styles.checkRow, sel && styles.checkRowActive]}
                  onPress={() => toggleProduct(p.name)}>
                  <View style={[styles.checkbox, sel && styles.checkboxChecked]}>
                    {sel && <Text style={styles.checkMark}>âœ"</Text>}
                  </View>
                  <Text style={styles.checkLabel}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setProductModalOpen(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline}: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBorder}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'sentences'}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

function PickerModal({visible, title, items, selected, onSelect, onClose}: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(i: any) => i.value}
            style={{maxHeight: 320}}
            renderItem={({item}: any) => (
              <TouchableOpacity
                style={[styles.pickerRow, item.value === selected && styles.pickerRowActive]}
                onPress={() => onSelect(item.value)}>
                <Text style={[styles.pickerText, item.value === selected && styles.pickerTextActive]}>
                  {item.label}
                </Text>
                {item.value === selected && <Text style={styles.pickerCheck}>âœ"</Text>}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    height: 64,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  saveBtn: {
    backgroundColor: '#FF751F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#000',
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...NB_SHADOW,
  },
  saveBtnText: {color: '#fff', fontWeight: '900', fontSize: 13},
  divider: {height: 2, backgroundColor: '#000'},
  scroll: {padding: 16, gap: 12},

  section: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 0,
    ...NB_SHADOW,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 14,
  },
  fieldGroup: {marginBottom: 14},
  label: {fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 6},
  inputBorder: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  inputMultiline: {height: 80, textAlignVertical: 'top'},
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  selectText: {fontSize: 14, color: '#000', flex: 1, fontWeight: '500'},
  selectChevron: {fontSize: 20, color: '#64748b'},
  statePill: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  statePillText: {fontSize: 13, color: '#15803d', fontWeight: '600'},

  // Modals
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  modalSheet: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerRowActive: {backgroundColor: '#eff6ff'},
  pickerText: {fontSize: 15, color: '#000', fontWeight: '500'},
  pickerTextActive: {color: '#024BAB', fontWeight: '700'},
  pickerCheck: {color: '#024BAB', fontSize: 16, fontWeight: '900'},
  modalCancelBtn: {
    marginTop: 16,
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalCancelText: {fontWeight: '700', color: '#000', fontSize: 14},
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  checkRowActive: {backgroundColor: '#eff6ff'},
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {backgroundColor: '#024BAB'},
  checkMark: {color: '#fff', fontSize: 13, fontWeight: '900'},
  checkLabel: {fontSize: 14, color: '#000', flex: 1, fontWeight: '500'},
  modalDoneBtn: {
    marginTop: 16,
    backgroundColor: '#FF751F',
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    ...NB_SHADOW,
  },
  modalDoneText: {color: '#fff', fontWeight: '900', fontSize: 15},
});

