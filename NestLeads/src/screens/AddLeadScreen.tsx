import React, { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { leadsAPI, usersAPI, productsAPI } from '../services/api';
import { ALL_SOURCES } from '../constants/statusConstants';

export default function AddLeadScreen({ navigation }: any) {
  const onBack = () => navigation.goBack();
  const onSuccess = () => {
    navigation.goBack();
  };
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
          usersAPI.getAll({ status: 'active' }),
          productsAPI.getAll(),
        ]);
        setUsers(uRes.data || []);
        setProducts(pRes.data || []);
        if (uRes.data?.length) {
          setForm(f => ({ ...f, assignedTo: uRes.data[0]._id }));
        }
      } catch {}
    })();
  }, []);

  const set = (key: string, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleLocationChange = async (val: string) => {
    set('location', val);
    if (/^\d{6}$/.test(val.trim())) {
      setPincodeLoading(true);
      try {
        const res = await fetch(
          `https://api.postalpincode.in/pincode/${val.trim()}`,
        );
        const data = await res.json();
        const po = data?.[0]?.PostOffice?.[0];
        if (po) {
          setForm(f => ({
            ...f,
            location: po.District || po.Name,
            state: po.State,
          }));
        }
      } catch {
      } finally {
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
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    if (!form.phone.trim()) {
      Alert.alert('Validation', 'Phone is required');
      return;
    }
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
  const hasAssignment = users.length > 0;
  const hasProducts = products.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Lead</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
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

      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info — 2 inputs per row */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>

          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Field
                label="Full Name *"
                value={form.name}
                onChangeText={(v: string) => set('name', v)}
                placeholder="John Doe"
                maxLength={100}
              />
            </View>
            <View style={styles.halfCol}>
              <Field
                label="Company"
                value={form.company}
                onChangeText={(v: string) => set('company', v)}
                placeholder="Acme Corp"
                maxLength={120}
              />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Field
                label="Phone *"
                value={form.phone}
                onChangeText={(v: string) => set('phone', v)}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfCol}>
              <Field
                label="Email"
                value={form.email}
                onChangeText={(v: string) => set('email', v)}
                placeholder="john@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Lead Details — Source + Budget in 1 row, Requirement full width */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEAD DETAILS</Text>

          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Lead Source</Text>
              <TouchableOpacity
                style={styles.selectRow}
                onPress={() => setSourceModalOpen(true)}
              >
                <Text style={styles.selectText} numberOfLines={1}>
                  {form.source}
                </Text>
                <Icon name="chevron-forward" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.halfCol}>
              <Field
                label="Budget"
                value={form.budget}
                onChangeText={(v: string) => set('budget', v)}
                placeholder="e.g. 50000"
                keyboardType="numeric"
                maxLength={15}
              />
            </View>
          </View>

          <Field
            label="Requirement"
            value={form.requirement}
            onChangeText={(v: string) => set('requirement', v)}
            placeholder="What does the client need?"
            multiline
            maxLength={1000}
          />
        </View>

        {/* Location — City/Pincode + State in 1 row */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>

          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Text style={styles.label} numberOfLines={1}>
                City / Pincode{pincodeLoading ? '…' : ''}
              </Text>
              <View style={styles.inputBorder}>
                <TextInput
                  style={styles.input}
                  placeholder="City or 6-digit PIN"
                  placeholderTextColor="#94a3b8"
                  value={form.location}
                  onChangeText={handleLocationChange}
                />
              </View>
            </View>

            <View style={styles.halfCol}>
              <Field
                label="State"
                value={form.state}
                onChangeText={(v: string) => set('state', v)}
                placeholder="e.g. Telangana"
                maxLength={60}
              />
            </View>
          </View>

          {!!form.state && (
            <View style={styles.statePill}>
              <Icon name="location-outline" size={14} color="#15803d" />
              <Text style={styles.statePillText}>State: {form.state}</Text>
            </View>
          )}
        </View>

        {/* Assignment & Interested Products — 2 per row */}
        {(hasAssignment || hasProducts) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSIGNMENT & PRODUCTS</Text>

            <View style={styles.twoCol}>
              {hasAssignment && (
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Assign To</Text>
                  <TouchableOpacity
                    style={styles.selectRow}
                    onPress={() => setAssignModalOpen(true)}
                  >
                    <Text style={styles.selectText} numberOfLines={1}>
                      {assignedUser?.name || 'Select user'}
                    </Text>
                    <Icon name="chevron-forward" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}

              {hasProducts && (
                <View style={styles.halfCol}>
                  <Text style={styles.label}>Interested In</Text>
                  <TouchableOpacity
                    style={styles.selectRow}
                    onPress={() => setProductModalOpen(true)}
                  >
                    <Text style={styles.selectText} numberOfLines={1}>
                      {form.interestedProducts.length
                        ? `${form.interestedProducts.length} selected`
                        : 'Select products'}
                    </Text>
                    <Icon name="chevron-forward" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {form.interestedProducts.length > 0 && (
              <View style={styles.chipWrap}>
                {form.interestedProducts.map(prod => (
                  <TouchableOpacity
                    key={prod}
                    style={styles.prodChip}
                    onPress={() => toggleProduct(prod)}
                  >
                    <Text style={styles.prodChipText}>{prod}</Text>
                    <Icon name="close" size={12} color="#024BAB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Pickers */}
      <PickerModal
        visible={sourceModalOpen}
        title="SELECT SOURCE"
        items={ALL_SOURCES.map(s => ({ label: s, value: s }))}
        selected={form.source}
        onSelect={(v: string) => {
          set('source', v);
          setSourceModalOpen(false);
        }}
        onClose={() => setSourceModalOpen(false)}
      />
      <PickerModal
        visible={assignModalOpen}
        title="ASSIGN TO"
        items={users.map(u => ({ label: u.name, value: u._id }))}
        selected={form.assignedTo}
        onSelect={(v: string) => {
          set('assignedTo', v);
          setAssignModalOpen(false);
        }}
        onClose={() => setAssignModalOpen(false)}
      />

      {/* Products multi-select modal */}
      <Modal
        visible={productModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProductModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>SELECT PRODUCTS</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {products.map((p: any) => {
                const sel = form.interestedProducts.includes(p.name);
                return (
                  <TouchableOpacity
                    key={p._id}
                    style={[styles.checkRow, sel && styles.checkRowActive]}
                    onPress={() => toggleProduct(p.name)}
                  >
                    <View
                      style={[styles.checkbox, sel && styles.checkboxChecked]}
                    >
                      {sel && <Icon name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.checkLabel}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setProductModalOpen(false)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  maxLength,
}: any) {
  return (
    <View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
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
          maxLength={maxLength}
        />
      </View>
    </View>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selected,
  onSelect,
  onClose,
}: any) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(i: any) => i.value}
            style={{ maxHeight: 320 }}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={[
                  styles.pickerRow,
                  item.value === selected && styles.pickerRowActive,
                ]}
                onPress={() => onSelect(item.value)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    item.value === selected && styles.pickerTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === selected && (
                  <Icon name="checkmark" size={16} color="#024BAB" />
                )}
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

const NB_BOX = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    height: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: '#000' },
  saveBtn: {
    ...NB_BOX,
    backgroundColor: '#FF751F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  divider: { height: 2, backgroundColor: '#000' },
  scroll: { padding: 16, gap: 14 },

  section: {
    ...NB_BOX,
    backgroundColor: '#fff',
    padding: 14,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  label: { fontSize: 12, fontWeight: '500', color: '#000', marginBottom: 6 },
  inputBorder: {
    ...NB_BOX,
    backgroundColor: '#fff',
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  inputMultiline: { height: 76, textAlignVertical: 'top' },
  selectRow: {
    ...NB_BOX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 6,
  },
  selectText: { fontSize: 13, color: '#000', flex: 1, fontWeight: '500' },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 6,
    borderColor: '#15803d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
  },
  statePillText: { fontSize: 12, color: '#15803d', fontWeight: '500' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#024BAB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  prodChipText: {
    fontSize: 11,
    color: '#024BAB',
    fontWeight: '500',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerRowActive: { backgroundColor: '#eff6ff' },
  pickerText: { fontSize: 15, color: '#000', fontWeight: '500' },
  pickerTextActive: { color: '#024BAB', fontWeight: '500' },
  modalCancelBtn: {
    ...NB_BOX,
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalCancelText: { fontWeight: '500', color: '#000', fontSize: 14 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  checkRowActive: { backgroundColor: '#eff6ff' },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#024BAB' },
  checkLabel: { fontSize: 14, color: '#000', flex: 1, fontWeight: '500' },
  modalDoneBtn: {
    ...NB_BOX,
    marginTop: 14,
    backgroundColor: '#FF751F',
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalDoneText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});
