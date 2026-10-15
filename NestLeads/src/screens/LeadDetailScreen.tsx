import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from '../components/Icon';
import WhatsAppLogo from '../components/WhatsAppLogo';
import SendWhatsAppModal from '../components/SendWhatsAppModal';
import {leadsAPI, settingsAPI, productsAPI} from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import {
  getStatusColor,
  getStatusLabel,
  getCategoryByStatus,
  categories,
} from '../constants/statusConstants';
import SourceBadge from '../components/SourceBadge';
import {useTheme} from '../contexts/ThemeContext';

const TAG_COLORS: Record<string, {bg: string; text: string}> = {
  HOT: {bg: '#ef4444', text: '#fff'},
  WARM: {bg: '#FFDE00', text: '#000'},
  COLD: {bg: '#024BAB', text: '#fff'},
};

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: {width: 4, height: 4},
  elevation: 4,
};

// Same gating as the web's StatusUpdateModal.tsx: these are the only target
// statuses that prompt for a contact-tag pick (and only when actually changing).
const TAG_PROMPT_STATUSES = [
  '1',
  'DISCUSSION',
  'DISCUSSION 1',
  'DISCUSSION 2',
  'DISCUSSION 3',
  'DISCUSSION COMPLETED',
];

const EDIT_FIELDS = [
  ['name', 'Name'], ['company', 'Company'], ['phone', 'Phone'], ['email', 'Email'],
  ['website', 'Website'], ['location', 'Location / Pincode'], ['budget', 'Budget'],
  ['requirement', 'Requirement'], ['remarks', 'Remarks'],
] as const;

// Same defaults as the backend's checkPermission.js for Leads (tenant overrides come from settings).
const LEAD_DEFAULTS: Record<string, {update: boolean; delete: boolean}> = {
  super_admin: {update: true, delete: true},
  admin: {update: true, delete: true},
};

export default function LeadDetailScreen({navigation, route}: any) {
  const leadId = route?.params?.leadId;
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [localTag, setLocalTag] = useState('');
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [followUpTime, setFollowUpTime] = useState('12:00');
  const [visitScheduledDate, setVisitScheduledDate] = useState<Date | null>(null);
  const [visitScheduledTime, setVisitScheduledTime] = useState('10:00');
  const [visitActualDate, setVisitActualDate] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<
    null | 'followUpDate' | 'followUpTime' | 'visitScheduledDate' | 'visitScheduledTime' | 'visitActualDate'
  >(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const {user} = useAuth();
  const [perm, setPerm] = useState<{update?: boolean; delete?: boolean}>(LEAD_DEFAULTS[user?.role] || {});
  const [editOpen, setEditOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    settingsAPI.get().then((s: any) => {
      const l = s?.data?.permissions?.Leads;
      const p = (user?.roleId && l?.[user.roleId]) || l?.[user?.role];
      if (p) setPerm(prev => ({...prev, ...p}));
    }).catch(() => {});
  }, [user?.role, user?.roleId]);

  const openEdit = () => {
    setEditForm(Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, lead?.[k] ? String(lead[k]) : ''])));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) { Alert.alert('Name is required'); return; }
    try {
      setSavingEdit(true);
      await leadsAPI.update(leadId, editForm);
      setEditOpen(false);
      await fetchLead();
    } catch (err: any) {
      Alert.alert('Update failed', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () =>
    Alert.alert('Move to trash', `Move "${lead.name}" to trash?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Move', style: 'destructive', onPress: async () => {
        try {
          await leadsAPI.delete(leadId);
          navigation.goBack();
        } catch (err: any) {
          Alert.alert('Delete failed', err.message);
        }
      }},
    ]);

  useEffect(() => {
    fetchLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getById(leadId);
      setLead(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (lead?.phone) Linking.openURL(`tel:${lead.phone}`);
  };
  const handleWhatsApp = () => {
    if (!lead?.phone) {
      Alert.alert('No Phone Number', 'This lead does not have a phone number.');
      return;
    }
    setWhatsappModalOpen(true);
  };
  const handleEmail = () => {
    if (lead?.email) Linking.openURL(`mailto:${lead.email}`);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      setAddingNote(true);
      await leadsAPI.addNote(leadId, noteText.trim());
      setNoteText('');
      await fetchLead();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const resetStatusForm = () => {
    setRemarksInput('');
    setBudgetInput('');
    setLocalTag(lead?.contactTag || '');
    setSelectedProducts(lead?.interestedProducts || []);
    setNewProductName('');
    setFollowUpDate(null);
    setFollowUpTime('12:00');
    setVisitScheduledDate(null);
    setVisitScheduledTime('10:00');
    setVisitActualDate(null);
  };

  const handleStatusSelect = (status: string) => {
    setPendingStatus(status);
    resetStatusForm();
    setStatusModalOpen(true);
    if (allProducts.length === 0) {
      productsAPI.getAll().then((res: any) => setAllProducts(res.data || [])).catch(() => {});
    }
  };

  const toggleProduct = (name: string) => {
    setSelectedProducts(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name],
    );
  };

  const handleAddNewProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      setAddingProduct(true);
      const res: any = await productsAPI.create({
        name: newProductName.trim(),
        category: 'Machines',
        price: 0,
        description: 'Added from lead remarks',
      });
      const created = res.data;
      setAllProducts(prev => [...prev, created]);
      setSelectedProducts(prev => [...prev, created.name]);
      setNewProductName('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingProduct(false);
    }
  };

  const showTagPicker =
    TAG_PROMPT_STATUSES.includes(pendingStatus) && lead?.status !== pendingStatus;
  const showFollowupPicker = !['WON', 'DROP', 'VISIT SCHEDULED'].includes(pendingStatus);
  const showVisitScheduledPicker = pendingStatus === 'VISIT SCHEDULED';
  const showVisitActualPicker = pendingStatus === 'VISITED';

  const combineDateTime = (date: Date, time: string) => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  };

  const handleUpdateStatus = async () => {
    if (!remarksInput.trim()) {
      Alert.alert('Remarks Required', 'Please add a remark for this status change.');
      return;
    }
    if (showFollowupPicker && !followUpDate) {
      Alert.alert('Date Required', 'Please pick a follow-up date & time.');
      return;
    }
    if (showVisitScheduledPicker && !visitScheduledDate) {
      Alert.alert('Visit Date Required', 'Please pick the scheduled visit date & time.');
      return;
    }
    if (showVisitActualPicker && !visitActualDate) {
      Alert.alert('Visit Date Required', 'Please pick the actual visit date.');
      return;
    }

    try {
      setUpdatingStatus(true);

      if (pendingStatus === 'WON') {
        await leadsAPI.convertToClient(leadId, {
          address: 'Not Provided',
          businessType: 'Not Specified',
          remarks: remarksInput.trim(),
        });
      } else {
        const updateData: any = {
          status: pendingStatus,
          remarks: remarksInput.trim(),
          interestedProducts: selectedProducts,
        };
        if (budgetInput.trim()) updateData.budget = budgetInput.trim();
        if (showTagPicker && localTag) updateData.contactTag = localTag;
        if (showFollowupPicker && followUpDate) {
          updateData.followUpDate = combineDateTime(followUpDate, followUpTime);
        }
        if (showVisitScheduledPicker && visitScheduledDate) {
          const dt = combineDateTime(visitScheduledDate, visitScheduledTime);
          updateData.visitScheduledDate = dt;
          updateData.followUpDate = dt;
        }
        if (showVisitActualPicker && visitActualDate) {
          updateData.visitActualDate = visitActualDate;
        }
        await leadsAPI.update(leadId, updateData);
      }

      setStatusModalOpen(false);
      resetStatusForm();
      await fetchLead();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lead Details</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!lead) return null;

  const sc = getStatusColor(lead.status);
  const tag = lead.contactTag ? TAG_COLORS[lead.contactTag] : null;
  const activeCategory = getCategoryByStatus(lead.status || 'PENDING CONTACT');

  // Next status options per category. Pulls from `categories` (which
  // includes tenant custom stages) rather than a hardcoded list, so newly
  // added stages show up here automatically — the backend is still the
  // source of truth on which transitions are actually allowed.
  const nextStatuses: string[] = [];
  if (activeCategory === 'New Lead') {
    nextStatuses.push('DISCUSSION', ...categories['New Lead'].slice(1), 'DROP');
  } else if (activeCategory === 'Discussion/Requirement') {
    nextStatuses.push(...categories['Discussion/Requirement'].slice(1), 'QUOTATION', 'VISIT SCHEDULED', 'DROP');
  } else if (activeCategory === 'Quotation') {
    nextStatuses.push(...categories['Quotation'].slice(1), 'VISIT SCHEDULED', 'WON', 'DROP');
  } else if (activeCategory === 'Visit Scheduled' || activeCategory === 'Visited') {
    nextStatuses.push('VISITED', 'WON', 'DROP');
  }

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{lead.name}</Text>
        <TouchableOpacity onPress={handleCall} hitSlop={8} style={styles.headerIconBtn}>
          <Icon name="call-outline" size={18} color="#22c55e" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleWhatsApp} hitSlop={8} style={styles.headerIconBtn}>
          <WhatsAppLogo size={18} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEmail} hitSlop={8} style={styles.headerIconBtn}>
          <Icon name="mail-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        {perm.update && (
          <TouchableOpacity onPress={openEdit} hitSlop={8}>
            <Icon name="pencil-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        )}
        {perm.delete && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Icon name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, {paddingBottom: insets.bottom + 24}]}
        showsVerticalScrollIndicator={false}>

        {/* Identity section */}
        <View style={styles.section}>
          <View style={styles.nameRow}>
            {/* Avatar â€" same as sidebar: square, blue, white initial */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(lead.name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.nameInfo}>
              <Text style={styles.leadName}>{lead.name}</Text>
              {lead.company ? <Text style={styles.leadCompany}>{lead.company}</Text> : null}
            </View>
            {tag && (
              <View style={[styles.tagPill, {backgroundColor: tag.bg}]}>
                <Text style={[styles.tagPillText, {color: tag.text}]}>
                  {lead.contactTag}
                </Text>
              </View>
            )}
          </View>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            <View style={[styles.statusPill, {backgroundColor: sc.bg, borderColor: '#000'}]}>
              <Text style={[styles.statusPillText, {color: sc.text}]}>
                {getStatusLabel(lead.status) || 'PENDING CONTACT'}
              </Text>
            </View>
            <View>
              <SourceBadge source={lead.source}/>
            </View>
            <View style={styles.catPill}>
              <Text style={styles.catPillText}>{activeCategory.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Update Status â€" surfaced right up top so it's the first thing reachable */}
        {nextStatuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
            <View style={styles.statusGrid}>
              {nextStatuses.map(s => {
                const c = getStatusColor(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, {backgroundColor: c.bg, borderColor: '#000'}]}
                    onPress={() => handleStatusSelect(s)}>
                    <Text style={[styles.statusOptionText, {color: c.text}]}>{getStatusLabel(s)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT INFORMATION</Text>
          <InfoRow icon="call-outline" label="Phone" value={lead.phone || '—'} />
          <InfoRow icon="mail-outline" label="Email" value={lead.email || '—'} />
          <InfoRow
            icon="location-outline"
            label="Location"
            value={[lead.location, lead.state].filter(Boolean).join(', ') || '—'}
          />
          {lead.facebookAdName && (
            <InfoRow icon="megaphone-outline" label="Campaign" value={lead.facebookAdName} />
          )}
        </View>

        {/* Lead Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEAD DETAILS</Text>
          <InfoRow
            icon="calendar-outline"
            label="Inquiry Date"
            value={
              lead.indiamartQueryTime || lead.createdAt
                ? new Date(
                    lead.indiamartQueryTime || lead.createdAt,
                  ).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'
            }
          />
          <InfoRow icon="cash-outline" label="Budget" value={lead.budget || 'Not Specified'} />
          <InfoRow icon="document-text-outline" label="Requirement" value={lead.requirement || '—'} />
          <InfoRow icon="chatbox-ellipses-outline" label="Remarks" value={lead.remarks || '—'} />
          {lead.assignedTo?.name && (
            <InfoRow icon="person-outline" label="Assigned To" value={lead.assignedTo.name} />
          )}
          {lead.visitScheduledDate && (
            <InfoRow
              icon="calendar-outline"
              label="Visit Scheduled"
              value={new Date(lead.visitScheduledDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          )}
          {lead.followUpDate && (
            <InfoRow
              icon="calendar-outline"
              label="Follow-up Date"
              value={new Date(lead.followUpDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          )}
        </View>

        {/* Interested Products */}
        {lead.interestedProducts?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INTERESTED IN</Text>
            <View style={styles.chipsWrap}>
              {lead.interestedProducts.map((p: string, i: number) => (
                <View key={i} style={styles.productChip}>
                  <Text style={styles.productChipText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor="#94a3b8"
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <TouchableOpacity
              style={[styles.noteSendBtn, !noteText.trim() && {opacity: 0.4}]}
              onPress={handleAddNote}
              disabled={!noteText.trim() || addingNote}>
              {addingNote ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.noteSendText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
          {lead.notes?.length > 0 ? (
            <View style={styles.notesList}>
              {[...lead.notes].reverse().map((n: any, i: number) => (
                <View key={i} style={styles.noteItem}>
                  <View style={styles.noteItemHeader}>
                    <Text style={styles.noteAuthor}>{n.createdBy?.name || 'System'}</Text>
                    <Text style={styles.noteDate}>
                      {new Date(n.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.noteText}>{n.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNotes}>No notes yet</Text>
          )}
        </View>

        {/* Status History */}
        {lead.statusHistory?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STATUS HISTORY</Text>
            {[...lead.statusHistory].reverse().map((h: any, i: number) => {
              const hsc = getStatusColor(h.status);
              const STATUS_ICON: Record<string, string> = {
                'PENDING CONTACT': 'time-outline',
                'DISCUSSION': 'chatbubbles-outline',
                'QUOTATION SENT': 'document-text-outline',
                'VISIT SCHEDULED': 'calendar-outline',
                'VISITED': 'eye-outline',
                'NEGOTIATION': 'swap-horizontal-outline',
                'CLIENT': 'star-outline',
                'DROPPED': 'close-circle-outline',
              };
              const iconName = STATUS_ICON[h.status] || 'ellipse-outline';
              return (
                <View key={i} style={styles.historyRow}>
                  <View style={[styles.historyDot, {backgroundColor: hsc.bg, borderColor: '#000'}]}>
                    <Icon name={iconName} size={10} color={hsc.text || '#000'} />
                  </View>
                  <View style={styles.historyContent}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyStatus}>{getStatusLabel(h.status)}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(h.changedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    {h.remarks ? <Text style={styles.historyRemarks}>{h.remarks}</Text> : null}
                    {h.changedBy?.name ? (
                      <Text style={styles.historyBy}>by {h.changedBy.name}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Edit Lead Modal */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalSheet, {maxHeight: '90%'}]}>
            <Text style={styles.modalTitle}>Edit Lead</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {EDIT_FIELDS.map(([k, label]) => (
                <View key={k}>
                  <Text style={styles.modalLabel}>{label.toUpperCase()}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editForm[k] || ''}
                    onChangeText={v => setEditForm(f => ({...f, [k]: v}))}
                    multiline={k === 'requirement' || k === 'remarks'}
                    maxLength={k === 'name' ? 100 : k === 'company' ? 120 : k === 'budget' ? 15 : k === 'requirement' ? 1000 : k === 'remarks' ? 500 : undefined}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={saveEdit} disabled={savingEdit}>
                {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        visible={statusModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalSheet, {maxHeight: '90%'}]}>
            <Text style={styles.modalTitle}>Update Status</Text>
            <Text style={styles.modalSub}>
              Changing to: <Text style={{fontWeight: '600'}}>{getStatusLabel(pendingStatus) || pendingStatus}</Text>
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {showTagPicker && (
                <>
                  <Text style={styles.modalLabel}>ASSIGN CONTACT TAG *</Text>
                  <View style={styles.tagRow}>
                    {(['HOT', 'WARM', 'COLD'] as const).map(t => {
                      const tc = TAG_COLORS[t];
                      const active = localTag === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.tagOptionBtn,
                            {backgroundColor: active ? tc.bg : '#fff', borderColor: '#000'},
                          ]}
                          onPress={() => setLocalTag(t)}>
                          <Text style={[styles.tagOptionText, {color: active ? tc.text : '#000'}]}>
                            {t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.modalLabel}>BUDGET</Text>
              <TextInput
                style={styles.modalInputSingle}
                placeholder="Enter budget (e.g. 50,000)"
                placeholderTextColor="#94a3b8"
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>REMARKS *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Add a remark for this status change (required)..."
                placeholderTextColor="#94a3b8"
                value={remarksInput}
                onChangeText={setRemarksInput}
                multiline
                maxLength={500}
              />
              <Text style={{fontSize: 10, color: '#64748b', textAlign: 'right'}}>{remarksInput.length}/500</Text>

              <Text style={styles.modalLabel}>INTERESTED PRODUCTS</Text>
              <View style={styles.chipsWrap}>
                {allProducts.map((p: any) => {
                  const active = selectedProducts.includes(p.name);
                  return (
                    <TouchableOpacity
                      key={p._id || p.name}
                      style={[styles.productChip, active && styles.productChipActive]}
                      onPress={() => toggleProduct(p.name)}>
                      <Text style={[styles.productChipText, active && {color: '#fff'}]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.addProductRow}>
                <TextInput
                  style={styles.addProductInput}
                  placeholder="New product..."
                  placeholderTextColor="#94a3b8"
                  value={newProductName}
                  onChangeText={setNewProductName}
                />
                <TouchableOpacity
                  style={styles.addProductBtn}
                  onPress={handleAddNewProduct}
                  disabled={addingProduct}>
                  {addingProduct ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.addProductBtnText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>

              {showFollowupPicker && (
                <>
                  <Text style={styles.modalLabel}>FOLLOW-UP DATE & TIME *</Text>
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={styles.dateTimeBtn}
                      onPress={() => setActivePicker('followUpDate')}>
                      <Icon name="calendar-outline" size={14} color={colors.text} />
                      <Text style={styles.dateTimeBtnText}>
                        {followUpDate ? followUpDate.toLocaleDateString('en-IN') : 'Pick date'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateTimeBtn}
                      onPress={() => setActivePicker('followUpTime')}>
                      <Icon name="time-outline" size={14} color={colors.text} />
                      <Text style={styles.dateTimeBtnText}>{followUpTime}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {showVisitScheduledPicker && (
                <>
                  <Text style={styles.modalLabel}>SCHEDULED VISIT DATE & TIME *</Text>
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={styles.dateTimeBtn}
                      onPress={() => setActivePicker('visitScheduledDate')}>
                      <Icon name="calendar-outline" size={14} color={colors.text} />
                      <Text style={styles.dateTimeBtnText}>
                        {visitScheduledDate ? visitScheduledDate.toLocaleDateString('en-IN') : 'Pick date'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateTimeBtn}
                      onPress={() => setActivePicker('visitScheduledTime')}>
                      <Icon name="time-outline" size={14} color={colors.text} />
                      <Text style={styles.dateTimeBtnText}>{visitScheduledTime}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {showVisitActualPicker && (
                <>
                  <Text style={styles.modalLabel}>ACTUAL VISIT DATE *</Text>
                  <TouchableOpacity
                    style={styles.dateTimeBtn}
                    onPress={() => setActivePicker('visitActualDate')}>
                    <Icon name="calendar-outline" size={14} color={colors.text} />
                    <Text style={styles.dateTimeBtnText}>
                      {visitActualDate ? visitActualDate.toLocaleDateString('en-IN') : 'Pick date'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setStatusModalOpen(false);
                  resetStatusForm();
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleUpdateStatus}
                disabled={updatingStatus}>
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {activePicker && (
        <DateTimePicker
          value={
            activePicker === 'followUpDate' || activePicker === 'followUpTime'
              ? followUpDate || new Date()
              : activePicker === 'visitScheduledDate' || activePicker === 'visitScheduledTime'
                ? visitScheduledDate || new Date()
                : visitActualDate || new Date()
          }
          mode={activePicker.endsWith('Time') ? 'time' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={
            activePicker === 'followUpDate' || activePicker === 'visitScheduledDate'
              ? new Date()
              : undefined
          }
          onChange={(event: any, selected?: Date) => {
            const picker = activePicker;
            setActivePicker(null);
            if (event.type === 'dismissed' || !selected) return;
            if (picker === 'followUpDate') setFollowUpDate(selected);
            else if (picker === 'followUpTime')
              setFollowUpTime(
                `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`,
              );
            else if (picker === 'visitScheduledDate') setVisitScheduledDate(selected);
            else if (picker === 'visitScheduledTime')
              setVisitScheduledTime(
                `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`,
              );
            else if (picker === 'visitActualDate') setVisitActualDate(selected);
          }}
        />
      )}

      <SendWhatsAppModal
        visible={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        lead={lead}
        onSent={fetchLead}
      />
    </View>
  );
}

function InfoRow({icon, label, value}: {icon: string; label: string; value: string}) {
  const {colors} = useTheme();
  const infoStyles = useMemo(() => makeInfoStyles(colors), [colors]);
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.labelRow}>
        <Icon name={icon} size={13} color={colors.textMuted} />
        <Text style={infoStyles.label}>{label}</Text>
      </View>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function makeInfoStyles(colors: import('../contexts/ThemeContext').ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingVertical: 6,
    },
    labelRow: {
      width: 110,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    value: {flex: 1, fontSize: 13, color: colors.text, fontWeight: '500'},
  });
}

function makeStyles(colors: import('../contexts/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},

  header: {
    height: 64,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  backBtn: {paddingVertical: 4, paddingRight: 4},
  headerIconBtn: {paddingVertical: 4},
  backBtnText: {fontSize: 14, fontWeight: '700', color: colors.primary},
  headerTitle: {flex: 1, fontSize: 18, fontWeight: '600', color: colors.text},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {marginTop: 12, color: colors.textMuted, fontSize: 14},
  scroll: {padding: 12, gap: 8},

  // Sections â€" white, border-2 border-black, nb shadow
  section: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Identity
  nameRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10},
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontSize: 18, fontWeight: '600', color: '#fff'},
  nameInfo: {flex: 1},
  leadName: {fontSize: 17, fontWeight: '600', color: colors.text},
  leadCompany: {fontSize: 12, color: colors.textMuted, fontWeight: '500'},
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
  },
  tagPillText: {fontSize: 11, fontWeight: '600'},
  badgesRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
  },
  statusPillText: {fontSize: 10, fontWeight: '600', textTransform: 'uppercase'},
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
  },
  sourcePillText: {fontSize: 10, fontWeight: '700'},
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  catPillText: {fontSize: 10, fontWeight: '700', color: colors.textMuted},


  // Products
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  productChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  productChipText: {fontSize: 12, color: colors.primary, fontWeight: '700'},

  // Status update grid
  statusGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  statusOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
  },
  statusOptionText: {fontSize: 11, fontWeight: '600', textTransform: 'uppercase'},

  // Notes
  noteInputRow: {flexDirection: 'row', gap: 8, marginBottom: 10},
  noteInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    padding: 9,
    fontSize: 13,
    color: colors.text,
    maxHeight: 70,
    textAlignVertical: 'top',
  },
  noteSendBtn: {
    backgroundColor: '#FF751F',
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSendText: {color: '#fff', fontWeight: '600', fontSize: 13},
  notesList: {gap: 8},
  noteItem: {
    borderWidth: 2,
    borderColor: colors.border,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  noteItemHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4},
  noteAuthor: {fontSize: 11, fontWeight: '700', color: colors.primary},
  noteDate: {fontSize: 10, color: colors.placeholder},
  noteText: {fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18},
  emptyNotes: {color: colors.placeholder, fontSize: 13, textAlign: 'center', paddingVertical: 8},

  // History
  historyRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10},
  historyDot: {
    width: 22,
    height: 22,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {flex: 1},
  historyTop: {flexDirection: 'row', justifyContent: 'space-between'},
  historyStatus: {fontSize: 12, fontWeight: '600', color: colors.text},
  historyDate: {fontSize: 11, color: colors.placeholder},
  historyRemarks: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  historyBy: {fontSize: 11, color: colors.placeholder, marginTop: 1},

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.border,
    padding: 24,
  },
  modalTitle: {fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 4},
  modalSub: {fontSize: 13, color: colors.textMuted, marginBottom: 16, fontWeight: '500'},
  modalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtns: {flexDirection: 'row', gap: 10},
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  modalCancelText: {fontWeight: '700', color: colors.text, fontSize: 14},
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#FF751F',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalConfirmText: {fontWeight: '600', color: '#fff', fontSize: 14},
  tagRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  tagOptionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
  },
  tagOptionText: {fontSize: 13, fontWeight: '700'},
  modalInputSingle: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
  },
  productChipActive: {backgroundColor: colors.primary, borderColor: colors.border},
  addProductRow: {flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16},
  addProductInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  addProductBtn: {
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  dateTimeRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRightColor: colors.shadowColor,
    borderBottomColor: colors.shadowColor,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  dateTimeBtnText: {fontSize: 13, fontWeight: '600', color: colors.text},
  });
}

