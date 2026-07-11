import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {leadsAPI} from '../services/api';
import {
  getStatusColor,
  getStatusLabel,
  getCategoryByStatus,
  categories,
} from '../constants/statusConstants';
import SourceBadge from '../components/SourceBadge';

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

export default function LeadDetailScreen({navigation, route}: any) {
  const leadId = route?.params?.leadId;
  const insets = useSafeAreaInsets();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    if (lead?.phone) {
      const num = lead.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/91${num}`);
    }
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

  const handleStatusSelect = (status: string) => {
    setPendingStatus(status);
    if (status === 'DISCUSSION') {
      setTagModalOpen(true);
    } else {
      setStatusModalOpen(true);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      setUpdatingStatus(true);
      const updateData: any = {status: pendingStatus};
      if (remarksInput.trim()) updateData.remarks = remarksInput.trim();
      await leadsAPI.update(leadId, updateData);
      setStatusModalOpen(false);
      setTagModalOpen(false);
      setRemarksInput('');
      await fetchLead();
      // refresh handled by navigation focus
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{lead.name}</Text>
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

        {/* Quick Actions â€" 3 buttons like web (Call / WhatsApp / Email) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#22c55e'}]}
              onPress={handleCall}>
              <Icon name="call-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#25D366'}]}
              onPress={handleWhatsApp}>
              <Icon name="logo-whatsapp" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#024BAB'}]}
              onPress={handleEmail}>
              <Icon name="mail-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT INFORMATION</Text>
          <InfoRow label="Phone" value={lead.phone || 'â€"'} />
          <InfoRow label="Email" value={lead.email || 'â€"'} />
          <InfoRow
            label="Location"
            value={[lead.location, lead.state].filter(Boolean).join(', ') || 'â€"'}
          />
          {lead.facebookAdName && (
            <InfoRow label="Campaign" value={lead.facebookAdName} />
          )}
        </View>

        {/* Lead Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEAD DETAILS</Text>
          <InfoRow
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
                : 'â€"'
            }
          />
          <InfoRow label="Budget" value={lead.budget || 'Not Specified'} />
          <InfoRow label="Requirement" value={lead.requirement || 'â€"'} />
          <InfoRow label="Remarks" value={lead.remarks || 'â€"'} />
          {lead.assignedTo?.name && (
            <InfoRow label="Assigned To" value={lead.assignedTo.name} />
          )}
          {lead.visitScheduledDate && (
            <InfoRow
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
            <Text style={styles.sectionLabel}>INTERESTED PRODUCTS</Text>
            <View style={styles.chipsWrap}>
              {lead.interestedProducts.map((p: string, i: number) => (
                <View key={i} style={styles.productChip}>
                  <Text style={styles.productChipText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Update Status */}
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

      {/* Status Update Modal */}
      <Modal
        visible={statusModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Update Status</Text>
            <Text style={styles.modalSub}>
              Changing to: <Text style={{fontWeight: '900'}}>{pendingStatus}</Text>
            </Text>
            <Text style={styles.modalLabel}>REMARKS (OPTIONAL)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add remarks..."
              placeholderTextColor="#94a3b8"
              value={remarksInput}
              onChangeText={setRemarksInput}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setStatusModalOpen(false);
                  setRemarksInput('');
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
        </View>
      </Modal>

      {/* Contact Tag Modal */}
      <Modal
        visible={tagModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTagModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Contact Tag</Text>
            <Text style={styles.modalSub}>How warm is this lead?</Text>
            {(['HOT', 'WARM', 'COLD'] as const).map(t => {
              const tc = TAG_COLORS[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tagOptionBtn, {backgroundColor: tc.bg}]}
                  onPress={async () => {
                    setTagModalOpen(false);
                    try {
                      await leadsAPI.update(leadId, {contactTag: t});
                    } catch {}
                    setStatusModalOpen(true);
                  }}>
                  <Text style={[styles.tagOptionText, {color: tc.text}]}>
                    {t === 'HOT' ? 'ðŸ"¥' : t === 'WARM' ? 'ðŸŒ¡' : 'â„ï¸'} {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setTagModalOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  label: {
    width: 110,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {flex: 1, fontSize: 13, color: '#000', fontWeight: '500'},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},

  header: {
    height: 64,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {paddingVertical: 4, paddingRight: 4},
  backBtnText: {fontSize: 14, fontWeight: '700', color: '#024BAB'},
  headerTitle: {flex: 1, fontSize: 18, fontWeight: '900', color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {marginTop: 12, color: '#64748b', fontSize: 14},
  scroll: {padding: 16, gap: 12},

  // Sections â€" white, border-2 border-black, nb shadow
  section: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    ...NB_SHADOW,
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Identity
  nameRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10},
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontSize: 18, fontWeight: '900', color: '#fff'},
  nameInfo: {flex: 1},
  leadName: {fontSize: 17, fontWeight: '900', color: '#000'},
  leadCompany: {fontSize: 12, color: '#64748b', fontWeight: '500'},
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  tagPillText: {fontSize: 11, fontWeight: '900'},
  badgesRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
  },
  statusPillText: {fontSize: 10, fontWeight: '900', textTransform: 'uppercase'},
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  sourcePillText: {fontSize: 10, fontWeight: '700'},
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  catPillText: {fontSize: 10, fontWeight: '700', color: '#64748b'},

  // Actions
  actionsRow: {flexDirection: 'row', gap: 8},
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#000',
    ...NB_SHADOW,
  },
  actionBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},

  // Products
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  productChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#eff6ff',
  },
  productChipText: {fontSize: 12, color: '#024BAB', fontWeight: '700'},

  // Status update grid
  statusGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  statusOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
  },
  statusOptionText: {fontSize: 11, fontWeight: '900', textTransform: 'uppercase'},

  // Notes
  noteInputRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
  noteInput: {
    flex: 1,
    borderWidth: 2,
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
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    ...NB_SHADOW,
  },
  noteSendText: {color: '#fff', fontWeight: '900', fontSize: 13},
  notesList: {gap: 8},
  noteItem: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#024BAB',
    backgroundColor: '#f8fafc',
  },
  noteItemHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4},
  noteAuthor: {fontSize: 11, fontWeight: '700', color: '#024BAB'},
  noteDate: {fontSize: 10, color: '#94a3b8'},
  noteText: {fontSize: 13, color: '#000', fontWeight: '500', lineHeight: 18},
  emptyNotes: {color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingVertical: 8},

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
  historyStatus: {fontSize: 12, fontWeight: '900', color: '#000'},
  historyDate: {fontSize: 11, color: '#94a3b8'},
  historyRemarks: {fontSize: 12, color: '#475569', marginTop: 2},
  historyBy: {fontSize: 11, color: '#94a3b8', marginTop: 1},

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
  modalTitle: {fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 4},
  modalSub: {fontSize: 13, color: '#64748b', marginBottom: 16, fontWeight: '500'},
  modalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    fontSize: 14,
    color: '#000',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtns: {flexDirection: 'row', gap: 10},
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  modalCancelText: {fontWeight: '700', color: '#000', fontSize: 14},
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#FF751F',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    ...NB_SHADOW,
  },
  modalConfirmText: {fontWeight: '900', color: '#fff', fontSize: 14},
  tagOptionBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 8,
    ...NB_SHADOW,
  },
  tagOptionText: {fontSize: 16, fontWeight: '900'},
});

