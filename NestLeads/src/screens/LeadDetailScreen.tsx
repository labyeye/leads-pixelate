import React, { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import WhatsAppLogo from '../components/WhatsAppLogo';
import SendWhatsAppModal from '../components/SendWhatsAppModal';
import { leadsAPI, settingsAPI, callsAPI, aiCallingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  getStatusColor,
  getStatusLabel,
  getCategoryByStatus,
} from '../constants/statusConstants';
import SourceBadge from '../components/SourceBadge';
import StatusFlow from '../components/StatusFlow';

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  HOT: { bg: '#ef4444', text: '#fff' },
  WARM: { bg: '#FFDE00', text: '#000' },
  COLD: { bg: '#024BAB', text: '#fff' },
};

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

const EDIT_FIELDS = [
  ['name', 'Name'],
  ['company', 'Company'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['website', 'Website'],
  ['location', 'Location / Pincode'],
  ['budget', 'Budget'],
  ['requirement', 'Requirement'],
  ['remarks', 'Remarks'],
] as const;

// Same defaults as the backend's checkPermission.js for Leads (tenant overrides come from settings).
const LEAD_DEFAULTS: Record<string, { update: boolean; delete: boolean }> = {
  super_admin: { update: true, delete: true },
  admin: { update: true, delete: true },
};

const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const fmtDateTime = (d?: string) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function LeadDetailScreen({ navigation, route }: any) {
  const leadId = route?.params?.leadId;
  const insets = useSafeAreaInsets();
  const [lead, setLead] = useState<any>(null);
  const [waLead, setWaLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const { user } = useAuth();
  const [perm, setPerm] = useState<{ update?: boolean; delete?: boolean }>(
    LEAD_DEFAULTS[user?.role] || {},
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    settingsAPI
      .get()
      .then((s: any) => {
        const l = s?.data?.permissions?.Leads;
        const p = (user?.roleId && l?.[user.roleId]) || l?.[user?.role];
        if (p) setPerm(prev => ({ ...prev, ...p }));
      })
      .catch(() => {});
  }, [user?.role, user?.roleId]);

  const openEdit = () => {
    setEditForm(
      Object.fromEntries(
        EDIT_FIELDS.map(([k]) => [k, lead?.[k] ? String(lead[k]) : '']),
      ),
    );
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) {
      Alert.alert('Name is required');
      return;
    }
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
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move',
        style: 'destructive',
        onPress: async () => {
          try {
            await leadsAPI.delete(leadId);
            navigation.navigate('LeadsList');
          } catch (err: any) {
            Alert.alert('Delete failed', err.message);
          }
        },
      },
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
  // Twilio rings the agent's own phone first, then bridges to the lead (same as web).
  const placeCall = (kind: 'manual' | 'ai') => {
    const ai = kind === 'ai';
    Alert.alert(
      ai ? 'AI voice call' : 'Call via app',
      ai
        ? `AI agent will call ${lead.name}.`
        : `We ring your phone first, then connect you to ${lead.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              const r = await (ai ? aiCallingAPI.callLead(leadId) : callsAPI.manual(leadId));
              Alert.alert('Call started', r.message || 'Pick up your phone.');
            } catch (err: any) {
              Alert.alert("Couldn't place call", err.message);
            }
          },
        },
      ],
    );
  };
  const handleWhatsApp = () => {
    if (lead?.phone) setWaLead(lead);
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

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('LeadsList')}
            style={styles.backBtn}
          >
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lead Details</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#024BAB" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!lead) return null;

  const sc = getStatusColor(lead.status);
  const tag = lead.contactTag ? TAG_COLORS[lead.contactTag] : null;
  const activeCategory = getCategoryByStatus(lead.status || 'PENDING CONTACT');
  const location = [lead.location, lead.state].filter(Boolean).join(', ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('LeadsList')}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {lead.name}
        </Text>
        {perm.update && (
          <TouchableOpacity
            onPress={() => setStatusModalOpen(true)}
            hitSlop={8}
            accessibilityLabel="Change status"
          >
            <Icon name="swap-horizontal" size={18} color="#024BAB" />
          </TouchableOpacity>
        )}
        {perm.update && (
          <TouchableOpacity onPress={openEdit} hitSlop={8}>
            <Icon name="pencil-outline" size={18} color="#000" />
          </TouchableOpacity>
        )}
        {perm.delete && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Icon name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity + quick actions */}
        <View style={styles.section}>
          <View style={styles.nameRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(lead.name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.nameInfo}>
              <Text style={styles.leadName} numberOfLines={1}>
                {lead.name}
              </Text>
              {lead.company ? (
                <Text style={styles.leadCompany} numberOfLines={1}>
                  {lead.company}
                </Text>
              ) : null}
            </View>
            {tag && (
              <View style={[styles.tagPill, { backgroundColor: tag.bg }]}>
                <Text style={[styles.tagPillText, { color: tag.text }]}>
                  {lead.contactTag}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: sc.bg, borderColor: '#000' },
              ]}
            >
              <Text style={[styles.statusPillText, { color: sc.text }]}>
                {getStatusLabel(lead.status) || 'PENDING CONTACT'}
              </Text>
            </View>
            <SourceBadge source={lead.source} />
            <View style={styles.catPill}>
              <Text style={styles.catPillText}>
                {activeCategory.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={[styles.actionsRow, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FBFBFB' }, !lead.phone && { opacity: 0.4 }]}
              onPress={handleCall}
              disabled={!lead.phone}
            >
              <Icon name="call-outline" size={16} color="#044bab" />
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FBFBFB' }, !lead.phone && { opacity: 0.4 }]}
              onPress={() => placeCall('manual')}
              disabled={!lead.phone}
            >
              <Icon name="swap-horizontal-outline" size={16} color="#044bab" />
              <Text style={styles.actionBtnText}>In-app</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FBFBFB' }, !lead.phone && { opacity: 0.4 }]}
              onPress={() => placeCall('ai')}
              disabled={!lead.phone}
            >
              <Icon name="flash-outline" size={16} color="#044bab" />
              <Text style={styles.actionBtnText}>AI Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FBFBFB' }, !lead.phone && { opacity: 0.4 }]}
              onPress={handleWhatsApp}
              disabled={!lead.phone}
            >
              <View style={styles.whatsappLogoChip}>
                <WhatsAppLogo size={12} />
              </View>
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#024BAB' }, !lead.email && { opacity: 0.4 }]}
              onPress={handleEmail}
              disabled={!lead.email}
            >
              <Icon name="mail-outline" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* All details in one compact two-column grid */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.grid}>
            <Field icon="call-outline" label="Phone" value={lead.phone} />
            <Field icon="mail-outline" label="Email" value={lead.email} />
            <Field icon="wallet-outline" label="Budget" value={lead.budget || 'Not specified'} strong />
            <Field icon="person-outline" label="Assigned to" value={lead.assignedTo?.name} />
            <Field icon="calendar-outline" label="Inquiry" value={fmtDate(lead.indiamartQueryTime || lead.createdAt)} />
            <Field icon="location-outline" label="Location" value={location} />
            {lead.company ? <Field icon="business-outline" label="Company" value={lead.company} /> : null}
            {lead.website ? <Field icon="globe-outline" label="Website" value={lead.website} /> : null}
            {lead.followUpDate ? <Field icon="time-outline" label="Follow-up" value={fmtDateTime(lead.followUpDate)} /> : null}
            {lead.visitScheduledDate ? <Field icon="location-outline" label="Visit" value={fmtDateTime(lead.visitScheduledDate)} /> : null}
            {lead.visitActualDate ? <Field icon="checkmark-circle-outline" label="Visited on" value={fmtDate(lead.visitActualDate)} /> : null}
            {lead.facebookAdName ? <Field icon="megaphone-outline" label="Campaign" value={lead.facebookAdName} /> : null}
          </View>
          {lead.requirement ? (
            <View style={styles.textBlock}>
              <Text style={styles.fieldLabel}>Requirement</Text>
              <Text style={styles.fieldText} selectable>{lead.requirement}</Text>
            </View>
          ) : null}
          {lead.remarks ? (
            <View style={styles.textBlock}>
              <Text style={styles.fieldLabel}>Remarks</Text>
              <Text style={styles.fieldText} selectable>{lead.remarks}</Text>
            </View>
          ) : null}
          {lead.interestedProducts?.length > 0 && (
            <View style={styles.textBlock}>
              <Text style={styles.fieldLabel}>Interested in</Text>
              <View style={styles.chipsWrap}>
                {lead.interestedProducts.map((p: string, i: number) => (
                  <View key={i} style={styles.productChip}>
                    <Text style={styles.productChipText}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

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
              style={[styles.noteSendBtn, !noteText.trim() && { opacity: 0.4 }]}
              onPress={handleAddNote}
              disabled={!noteText.trim() || addingNote}
            >
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
                    <Text style={styles.noteAuthor}>
                      {n.createdBy?.name || 'System'}
                    </Text>
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
          ) : null}
        </View>

        {/* Status history (collapsed by default) */}
        {lead.statusHistory?.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.histHead}
              onPress={() => setHistOpen(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionLabel, { marginBottom: 0, flex: 1 }]}>
                STATUS HISTORY ({lead.statusHistory.length})
              </Text>
              <Icon name={histOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
            </TouchableOpacity>
            {histOpen &&
              [...lead.statusHistory].reverse().map((h: any, i: number) => {
                const hsc = getStatusColor(h.status);
                return (
                  <View key={i} style={[styles.historyRow, i === 0 && { marginTop: 10 }]}>
                    <View
                      style={[
                        styles.historyDot,
                        { backgroundColor: hsc.bg, borderColor: '#000' },
                      ]}
                    />
                    <View style={styles.historyContent}>
                      <View style={styles.historyTop}>
                        <Text style={styles.historyStatus}>
                          {getStatusLabel(h.status)}
                        </Text>
                        <Text style={styles.historyDate}>
                          {fmtDate(h.changedAt)}
                        </Text>
                      </View>
                      {h.remarks ? (
                        <Text style={styles.historyRemarks}>{h.remarks}</Text>
                      ) : null}
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
      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Edit Lead</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {EDIT_FIELDS.map(([k, label]) => (
                <View key={k}>
                  <Text style={styles.modalLabel}>{label.toUpperCase()}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editForm[k] || ''}
                    onChangeText={v => setEditForm(f => ({ ...f, [k]: v }))}
                    multiline={k === 'requirement' || k === 'remarks'}
                    maxLength={
                      k === 'name'
                        ? 100
                        : k === 'company'
                          ? 120
                          : k === 'budget'
                            ? 15
                            : k === 'requirement'
                              ? 1000
                              : k === 'remarks'
                                ? 500
                                : undefined
                    }
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <StatusFlow
        visible={statusModalOpen}
        lead={lead}
        onClose={() => setStatusModalOpen(false)}
        onDone={fetchLead}
      />
      <SendWhatsAppModal lead={waLead} onClose={() => setWaLead(null)} />
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  strong,
}: {
  icon: string;
  label: string;
  value?: string;
  strong?: boolean;
}) {
  return (
    <View style={fieldStyles.cell}>
      <View style={fieldStyles.labelRow}>
        <Icon name={icon} size={12} color="#64748b" />
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      <Text
        style={[fieldStyles.value, strong && { color: '#024BAB' }]}
        numberOfLines={2}
        selectable
      >
        {value || '—'}
      </Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  cell: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  label: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  value: { fontSize: 13, color: '#000', fontWeight: '500' },
});

function InfoRow({
  icon,
  label,
  value,
  strong,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[infoStyles.row, last && { borderBottomWidth: 0 }]}>
      <Icon name={icon} size={16} color="#64748b" />
      <Text style={infoStyles.label}>{label}</Text>
      <Text
        style={[infoStyles.value, strong && { color: '#024BAB' }]}
        selectable
      >
        {value || '—'}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  label: { width: 96, fontSize: 13, color: '#64748b', fontWeight: '500' },
  value: { flex: 1, fontSize: 14, color: '#000', fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    height: 52,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { paddingVertical: 4, paddingRight: 4 },
  backBtnText: { fontSize: 14, fontWeight: '500', color: '#024BAB' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '500', color: '#000' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  scroll: { padding: 12, gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  textBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  fieldLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 3 },
  fieldText: { fontSize: 13, color: '#000', fontWeight: '500', lineHeight: 18 },
  histHead: { flexDirection: 'row', alignItems: 'center' },

  // Sections â€" white, border-2 border-black, nb shadow
  section: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Identity
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#fff' },
  nameInfo: { flex: 1 },
  leadName: { fontSize: 17, fontWeight: '500', color: '#000' },
  leadCompany: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  tagPillText: { fontSize: 11, fontWeight: '500' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  sourcePillText: { fontSize: 10, fontWeight: '500' },
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  catPillText: { fontSize: 10, fontWeight: '500', color: '#64748b' },

  // Actions
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    minWidth: '30%',
    flex: 1,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
  },
  whatsappLogoChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 2,
  },
  actionBtnText: { fontSize: 12, fontWeight: '500', color: '#044bab' },

  // Products
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  productChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#eff6ff',
  },
  productChipText: { fontSize: 12, color: '#024BAB', fontWeight: '500' },

  // Status update grid
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderRadius: 8,
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // Notes
  noteInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  noteInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 10,
    fontSize: 13,
    color: '#000',
    maxHeight: 80,
    textAlignVertical: 'top',
  },
  noteSendBtn: {
    backgroundColor: '#FF751F',
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSendText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  notesList: { gap: 8 },
  noteItem: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#024BAB',
    backgroundColor: '#f8fafc',
  },
  noteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteAuthor: { fontSize: 11, fontWeight: '500', color: '#024BAB' },
  noteDate: { fontSize: 10, color: '#94a3b8' },
  noteText: { fontSize: 13, color: '#000', fontWeight: '500', lineHeight: 18 },
  emptyNotes: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  historyDot: {
    width: 22,
    height: 22,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: { flex: 1 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyStatus: { fontSize: 12, fontWeight: '500', color: '#000' },
  historyDate: { fontSize: 11, color: '#94a3b8' },
  historyRemarks: { fontSize: 12, color: '#475569', marginTop: 2 },
  historyBy: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '500',
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    fontSize: 14,
    color: '#000',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  modalCancelText: { fontWeight: '500', color: '#000', fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#FF751F',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    alignItems: 'center',
  },
  modalConfirmText: { fontWeight: '500', color: '#fff', fontSize: 14 },
  tagOptionBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    marginBottom: 8,
  },
  tagOptionText: { fontSize: 16, fontWeight: '500' },
});
