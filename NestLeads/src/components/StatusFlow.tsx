import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import DateTimeField from './DateTimeField';
import { leadsAPI, productsAPI } from '../services/api';
import {
  categories,
  getCategoryByStatus,
  getStatusColor,
  getStatusLabel,
  contactTagsEnabled,
} from '../constants/statusConstants';
import FieldLabel from './FieldLabel';

const PRIMARY = '#024BAB';

type Tone = 'success' | 'warn' | 'danger' | 'primary' | 'neutral';
interface Action {
  label: string;
  status: string;
  icon: string;
  tone: Tone;
}

const TONES: Record<Tone, { bg: string; text: string }> = {
  success: { bg: '#16a34a', text: '#fff' },
  warn: { bg: '#fff7ed', text: '#c2410c' },
  danger: { bg: '#fef2f2', text: '#dc2626' },
  primary: { bg: '#eff6ff', text: PRIMARY },
  neutral: { bg: '#fff', text: '#000' },
};

const TAG_STATUSES = [
  '1',
  'DISCUSSION',
  'DISCUSSION 1',
  'DISCUSSION 2',
  'DISCUSSION 3',
  'DISCUSSION COMPLETED',
];

const TAGS = [
  { key: 'HOT', hint: 'Needed within 1 week', bg: '#ef4444', text: '#fff', icon: 'flame-outline' },
  { key: 'WARM', hint: 'Within 30 days', bg: '#FFDE00', text: '#000', icon: 'sunny-outline' },
  { key: 'COLD', hint: 'Just looking', bg: PRIMARY, text: '#fff', icon: 'snow-outline' },
] as const;

/** Same transitions the web LeadDetailPanel offers for the lead's current stage. */
export function getStatusActions(lead: any): Action[] {
  const st: string = lead?.status || 'PENDING CONTACT';
  const cat = getCategoryByStatus(st);
  const out: Action[] = [];
  const attempt = (
    chain: Record<string, [string, string]>,
    doneStatuses: string[],
    doneStatus: string,
  ) => {
    const next = chain[st];
    if (next)
      out.push({ label: next[0], status: next[1], icon: 'call-outline', tone: 'warn' });
    if (doneStatuses.includes(st))
      out.push({
        label: 'Not Picked (Attempt 4+ → Mark Completed)',
        status: doneStatus,
        icon: 'call-outline',
        tone: 'danger',
      });
  };

  if (st === 'WON') return out;
  if (st === 'DROP') {
    out.push({ label: 'Restore to New Lead', status: 'PENDING CONTACT', icon: 'refresh', tone: 'neutral' });
    return out;
  }
  if (cat === 'New Lead') {
    out.push({ label: 'Contacted', status: 'DISCUSSION', icon: 'checkmark', tone: 'success' });
    attempt(
      {
        'PENDING CONTACT': ['Not Picked (Attempt 1)', '1'],
        '1': ['Not Picked (Attempt 2)', '2'],
        '2': ['Not Picked (Attempt 3)', '3'],
      },
      ['3', 'COMPLETED'],
      'COMPLETED',
    );
    out.push({ label: 'Drop Lead', status: 'DROP', icon: 'ban', tone: 'danger' });
  } else if (cat === 'Discussion/Requirement') {
    out.push({ label: 'Contacted (Update Remarks)', status: st, icon: 'checkmark', tone: 'success' });
    attempt(
      {
        DISCUSSION: ['Not Picked (Attempt 1)', 'DISCUSSION 1'],
        'DISCUSSION 1': ['Not Picked (Attempt 2)', 'DISCUSSION 2'],
        'DISCUSSION 2': ['Not Picked (Attempt 3)', 'DISCUSSION 3'],
      },
      ['DISCUSSION 3', 'DISCUSSION COMPLETED'],
      'DISCUSSION COMPLETED',
    );
    out.push({ label: 'Send Quotation', status: 'QUOTATION', icon: 'document-text-outline', tone: 'primary' });
    out.push({ label: 'Schedule Visit', status: 'VISIT SCHEDULED', icon: 'location-outline', tone: 'primary' });
    out.push({ label: 'Drop Lead', status: 'DROP', icon: 'ban', tone: 'danger' });
  } else if (cat === 'Quotation') {
    out.push({ label: 'Contacted (Update Remarks)', status: st, icon: 'checkmark', tone: 'success' });
    attempt(
      {
        QUOTATION: ['Not Picked (Attempt 1)', 'QUOTATION 1'],
        'QUOTATION 1': ['Not Picked (Attempt 2)', 'QUOTATION 2'],
        'QUOTATION 2': ['Not Picked (Attempt 3)', 'QUOTATION 3'],
      },
      ['QUOTATION 3', 'QUOTATION COMPLETED'],
      'QUOTATION COMPLETED',
    );
    out.push({ label: 'Schedule Visit', status: 'VISIT SCHEDULED', icon: 'location-outline', tone: 'primary' });
    out.push({ label: 'Drop Lead', status: 'DROP', icon: 'ban', tone: 'danger' });
  } else if (st === 'VISIT SCHEDULED') {
    out.push({ label: 'Mark Visit Completed', status: 'VISITED', icon: 'location-outline', tone: 'success' });
    out.push({ label: 'Reschedule Visit', status: 'VISIT SCHEDULED', icon: 'calendar-outline', tone: 'primary' });
    out.push({ label: 'Drop Lead', status: 'DROP', icon: 'ban', tone: 'danger' });
  } else if (st === 'VISITED') {
    out.push({ label: 'Convert to Client (Won)', status: 'WON', icon: 'checkmark-circle-outline', tone: 'success' });
    out.push({ label: 'Drop Lead', status: 'DROP', icon: 'ban', tone: 'danger' });
  }
  return out;
}

type Step = 'actions' | 'tag' | 'form';

export const LOST_REASONS = [
  'Price too high',
  'Chose a competitor',
  'No budget / loan not approved',
  'Postponed the decision',
  "Machine didn't fit (features / capacity)",
  'Delivery time too long',
  'Not responding',
  'Not a genuine enquiry',
  'Other',
];

export default function StatusFlow({
  visible,
  lead,
  onClose,
  onDone,
  editEntry,
}: {
  visible: boolean;
  lead: any;
  onClose: () => void;
  onDone: () => void;
  /** Latest status-history entry: opens in "correct this update" mode. */
  editEntry?: any;
}) {
  const isEdit = !!editEntry;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('actions');
  const [pending, setPending] = useState('');
  const [tag, setTag] = useState<string | undefined>();
  const [remarks, setRemarks] = useState('');
  const [budget, setBudget] = useState('');
  const [products, setProducts] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [followUp, setFollowUp] = useState(new Date());
  const [visitAt, setVisitAt] = useState(new Date());
  const [visitedOn, setVisitedOn] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [competitor, setCompetitor] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editEntry) {
      prepareForm(editEntry.status, editEntry.contactTag || lead?.contactTag || undefined);
      setRemarks(editEntry.remarks || '');
      if (editEntry.budget) setBudget(editEntry.budget);
      if (editEntry.followUpDate) setFollowUp(new Date(editEntry.followUpDate));
      if (editEntry.visitScheduledDate) setVisitAt(new Date(editEntry.visitScheduledDate));
      if (editEntry.visitActualDate) setVisitedOn(new Date(editEntry.visitActualDate));
    } else {
      setStep('actions');
      setPending('');
      setTag(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sameStatus = !isEdit && lead?.status === pending;
  const showTag =
    TAG_STATUSES.includes(pending) && !sameStatus && contactTagsEnabled();
  const showFollowUp = !['WON', 'DROP', 'VISIT SCHEDULED'].includes(pending);

  const prepareForm = (status: string, presetTag?: string) => {
    setPending(status);
    setTag(presetTag);
    setRemarks(lead?.remarks || '');
    setBudget(lead?.budget || '');
    setProducts(lead?.interestedProducts || []);
    setFollowUp(lead?.followUpDate ? new Date(lead.followUpDate) : new Date());
    setVisitAt(
      lead?.visitScheduledDate ? new Date(lead.visitScheduledDate) : new Date(),
    );
    setVisitedOn(
      lead?.visitActualDate ? new Date(lead.visitActualDate) : new Date(),
    );
    setLostReason(lead?.lostReason || '');
    setCompetitor(lead?.competitor || '');
    productsAPI
      .getAll()
      .then(r => setAllProducts(r.data || []))
      .catch(() => {});
    setStep('form');
  };

  const pick = (status: string) => {
    // Editing: only the stage changes, the filled-in details stay.
    if (isEdit) {
      setPending(status);
      setStep('form');
      return;
    }
    if (status === 'DISCUSSION' && contactTagsEnabled()) {
      setPending(status);
      setStep('tag');
    } else {
      prepareForm(status);
    }
  };

  const addProduct = async () => {
    if (!newProduct.trim()) return;
    try {
      setAddingProduct(true);
      const res = await productsAPI.create({
        name: newProduct.trim(),
        category: 'Machines',
        price: 0,
        description: 'Added from lead remarks',
      });
      if (res.success) {
        setAllProducts(p => [...p, res.data]);
        setProducts(p => [...p, res.data.name]);
        setNewProduct('');
      }
    } catch (e: any) {
      Alert.alert('Error adding product', e.message);
    } finally {
      setAddingProduct(false);
    }
  };

  const submit = async () => {
    if (!remarks.trim()) {
      Alert.alert('Remarks Required', 'Please add remarks for this status change');
      return;
    }
    if (pending === 'DROP' && !lostReason) {
      Alert.alert('Lost Reason Required', 'Please choose why this lead is being dropped');
      return;
    }
    const id = lead._id || lead.id;
    try {
      setSaving(true);
      if (isEdit) {
        const data: any = {
          remarks,
          budget: budget.trim(),
          interestedProducts: products,
        };
        if (pending !== editEntry.status) data.status = pending;
        if (pending === 'DROP') {
          data.lostReason = lostReason;
          data.competitor = competitor.trim();
        }
        if (showTag && tag) data.contactTag = tag;
        if (showFollowUp) data.followUpDate = followUp;
        if (pending === 'VISIT SCHEDULED') {
          data.visitScheduledDate = visitAt;
          data.followUpDate = visitAt;
        }
        if (pending === 'VISITED') data.visitActualDate = visitedOn;
        await leadsAPI.editLatestStatus(id, data);
      } else if (pending === 'WON') {
        await leadsAPI.convertToClient(id, {
          address: 'Not Provided',
          businessType: 'Not Specified',
          remarks,
        });
      } else {
        const data: any = {
          status: pending,
          remarks,
          interestedProducts: products,
        };
        if (budget.trim()) data.budget = budget;
        if (TAG_STATUSES.includes(pending) && tag && contactTagsEnabled())
          data.contactTag = tag;
        if (showFollowUp) data.followUpDate = followUp;
        if (pending === 'VISIT SCHEDULED') {
          data.visitScheduledDate = visitAt;
          data.followUpDate = visitAt;
        }
        if (pending === 'VISITED') data.visitActualDate = visitedOn;
        if (pending === 'DROP') {
          data.lostReason = lostReason;
          data.competitor = competitor.trim();
        }
        await leadsAPI.update(id, data);
      }
      onDone();
      onClose();
    } catch (e: any) {
      Alert.alert('Error updating status', e.message);
    } finally {
      setSaving(false);
    }
  };

  const actions = getStatusActions(lead);
  const current = getStatusColor(lead?.status);
  const target = getStatusColor(pending);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {step === 'actions' && (
            <>
              <View style={s.titleRow}>
                <Text style={s.title}>{isEdit ? 'Correct status to' : 'Change Status'}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={10}>
                  <Icon name="close" size={22} color="#000" />
                </TouchableOpacity>
              </View>
              <View style={s.currentRow}>
                <Text style={s.sub}>Current:</Text>
                <View style={[s.pill, { backgroundColor: current.bg }]}>
                  <Text style={[s.pillText, { color: current.text }]}>
                    {getStatusLabel(lead?.status) || 'PENDING CONTACT'}
                  </Text>
                </View>
              </View>
              {actions.length === 0 && (
                <View style={s.doneBox}>
                  <Icon name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={s.doneText}>Successfully converted to Client</Text>
                </View>
              )}
              <ScrollView style={{ maxHeight: 440 }}>
                {!isEdit && actions.map(a => {
                  const t = TONES[a.tone];
                  return (
                    <TouchableOpacity
                      key={a.label}
                      style={[s.action, { backgroundColor: t.bg }]}
                      onPress={() => pick(a.status)}
                      activeOpacity={0.85}
                    >
                      <Icon name={a.icon} size={18} color={t.text} />
                      <Text style={[s.actionText, { color: t.text }]}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
                {/* Any status can follow any status: the shortcuts above are not the only way. */}
                {!isEdit && <Text style={[s.sub, { marginTop: 12 }]}>Or move to any status</Text>}
                {Object.values(categories)
                  .flat()
                  .filter(st => isEdit || st !== lead?.status)
                  .map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[s.action, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }]}
                      onPress={() => pick(st)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.actionText, { color: '#000' }]}>
                        {st === 'WON' ? 'Client (Won)' : getStatusLabel(st)}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </>
          )}

          {step === 'tag' && (
            <>
              <Text style={s.title}>Select Contact Tag</Text>
              <Text style={s.sub}>How interested is this lead?</Text>
              {TAGS.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.action, { backgroundColor: t.bg }]}
                  onPress={() => prepareForm(pending, t.key)}
                >
                  <Icon name={t.icon} size={18} color={t.text} />
                  <Text style={[s.actionText, { color: t.text }]}>
                    {t.key} ({t.hint})
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.ghost} onPress={() => setStep('actions')}>
                <Text style={s.ghostText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'form' && (
            <>
              <View style={s.currentRow}>
                <Text style={s.sub}>{isEdit ? 'Editing update:' : 'Updating to:'}</Text>
                <View style={[s.pill, { backgroundColor: target.bg }]}>
                  <Text style={[s.pillText, { color: target.text }]}>
                    {getStatusLabel(pending)}
                  </Text>
                </View>
                {isEdit && (
                  <TouchableOpacity onPress={() => setStep('actions')} hitSlop={8}>
                    <Text style={s.ghostText}>Change</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isEdit && pending !== editEntry.status && (
                <Text style={[s.sub, { marginBottom: 10 }]}>
                  {getStatusLabel(editEntry.status)} → {getStatusLabel(pending)}. No new history entry is added.
                </Text>
              )}
              <ScrollView
                style={{ maxHeight: 460 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {showTag && (
                  <>
                    <FieldLabel style={s.label}>ASSIGN CONTACT TAG *</FieldLabel>
                    <View style={s.tagRow}>
                      {TAGS.map(t => (
                        <TouchableOpacity
                          key={t.key}
                          style={[
                            s.tagBtn,
                            tag === t.key && { backgroundColor: t.bg },
                          ]}
                          onPress={() => setTag(t.key)}
                        >
                          <Icon
                            name={t.icon}
                            size={15}
                            color={tag === t.key ? t.text : '#000'}
                          />
                          <Text
                            style={[
                              s.tagBtnText,
                              tag === t.key && { color: t.text },
                            ]}
                          >
                            {t.key}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {pending === 'DROP' && (
                  <>
                    <FieldLabel style={s.label}>LOST REASON *</FieldLabel>
                    <View style={s.chips}>
                      {LOST_REASONS.map(r => {
                        const on = lostReason === r;
                        return (
                          <TouchableOpacity
                            key={r}
                            style={[s.chip, on && { backgroundColor: '#DC2626' }]}
                            onPress={() => setLostReason(r)}
                          >
                            <Text style={[s.chipText, on && { color: '#fff' }]}>{r}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <FieldLabel style={s.label}>COMPETITOR (IF ANY)</FieldLabel>
                    <TextInput
                      style={s.input}
                      value={competitor}
                      onChangeText={setCompetitor}
                      placeholder="Who did they buy from?"
                      placeholderTextColor="#94a3b8"
                      maxLength={80}
                    />
                  </>
                )}

                <FieldLabel style={s.label}>BUDGET</FieldLabel>
                <TextInput
                  style={s.input}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="Enter budget (e.g. 50,000)"
                  placeholderTextColor="#94a3b8"
                  maxLength={15}
                />

                <FieldLabel style={s.label}>REMARKS *</FieldLabel>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Add a remark for this status change (required)..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  maxLength={500}
                />

                <FieldLabel style={s.label}>INTERESTED PRODUCTS</FieldLabel>
                <View style={s.chips}>
                  {allProducts.map(p => {
                    const on = products.includes(p.name);
                    return (
                      <TouchableOpacity
                        key={p._id}
                        style={[s.chip, on && s.chipOn]}
                        onPress={() =>
                          setProducts(prev =>
                            on ? prev.filter(x => x !== p.name) : [...prev, p.name],
                          )
                        }
                      >
                        <Text style={[s.chipText, on && { color: '#fff' }]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.addRow}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0, paddingVertical: 8 }]}
                    value={newProduct}
                    onChangeText={setNewProduct}
                    placeholder="New product..."
                    placeholderTextColor="#94a3b8"
                    onSubmitEditing={addProduct}
                  />
                  <TouchableOpacity
                    style={[s.addBtn, !newProduct.trim() && { opacity: 0.4 }]}
                    onPress={addProduct}
                    disabled={addingProduct || !newProduct.trim()}
                  >
                    {addingProduct ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.addBtnText}>+ Add</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {showFollowUp && (
                  <>
                    <FieldLabel style={s.label}>FOLLOW-UP DATE & TIME *</FieldLabel>
                    <DateTimeField value={followUp} onChange={setFollowUp} />
                  </>
                )}
                {pending === 'VISIT SCHEDULED' && (
                  <>
                    <FieldLabel style={s.label}>SCHEDULED VISIT DATE & TIME *</FieldLabel>
                    <DateTimeField value={visitAt} onChange={setVisitAt} />
                  </>
                )}
                {pending === 'VISITED' && (
                  <>
                    <FieldLabel style={s.label}>ACTUAL VISIT DATE *</FieldLabel>
                    <DateTimeField value={visitedOn} onChange={setVisitedOn} withTime={false} />
                  </>
                )}
                <View style={{ height: 12 }} />
              </ScrollView>

              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancel} onPress={() => (isEdit ? onClose() : setStep('actions'))}>
                  <Text style={s.cancelText}>{isEdit ? 'Cancel' : 'Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirm, (saving || !remarks.trim() || (pending === 'DROP' && !lostReason)) && { opacity: 0.5 }]}
                  onPress={submit}
                  disabled={saving || !remarks.trim() || (pending === 'DROP' && !lostReason)}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.confirmText}>{isEdit ? 'Save changes' : 'Update Status'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
    padding: 20,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '500', color: '#000' },
  sub: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 14 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, borderWidth: 2, borderColor: '#000' },
  pillText: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  action: { ...box, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 10 },
  actionText: { flex: 1, fontSize: 14, fontWeight: '500' },
  doneBox: { ...box, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#f0fdf4' },
  doneText: { fontSize: 14, fontWeight: '500', color: '#166534' },
  ghost: { alignItems: 'center', paddingVertical: 10 },
  ghostText: { fontWeight: '500', color: PRIMARY },
  label: { fontSize: 10, fontWeight: '500', color: '#64748b', letterSpacing: 1, marginTop: 6, marginBottom: 6 },
  input: { ...box, padding: 12, fontSize: 14, color: '#000', backgroundColor: '#fff', marginBottom: 10 },
  textarea: { height: 90, textAlignVertical: 'top' },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tagBtn: { ...box, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#fff' },
  tagBtnText: { fontSize: 12, fontWeight: '500', color: '#000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: '#000', borderRadius: 16, backgroundColor: '#fff' },
  chipOn: { backgroundColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: '500', color: '#000' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  addBtn: { paddingHorizontal: 14, height: 40, borderRadius: 8, borderWidth: 2, borderColor: '#000', backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '500', fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancel: { ...box, flex: 1, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' },
  cancelText: { fontWeight: '500', color: '#000', fontSize: 14 },
  confirm: { ...box, flex: 1.5, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FF751F' },
  confirmText: { fontWeight: '500', color: '#fff', fontSize: 14 },
});
