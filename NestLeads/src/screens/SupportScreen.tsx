import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {supportAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUS_COLORS: Record<string, string> = {
  open: '#f59e0b',
  in_progress: '#024BAB',
  resolved: '#22c55e',
  closed: '#94a3b8',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f97316',
  critical: '#EF4444',
};

export default function SupportScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const fetchTickets = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await supportAPI.getAll();
      setTickets(res.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchTickets();}, [fetchTickets]);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) {Alert.alert('Error', 'Subject and description are required'); return;}
    setSaving(true);
    try {
      await supportAPI.create({subject: subject.trim(), description: description.trim(), priority});
      setCreateVisible(false);
      setSubject('');
      setDescription('');
      setPriority('medium');
      fetchTickets();
      Alert.alert('Ticket Raised', 'Our team will get back to you shortly.');
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const renderCard = ({item: t}: {item: any}) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(t)}>
      <View style={styles.cardHeader}>
        <View style={styles.ticketIcon}>
          <Icon name="help-buoy-outline" size={18} color="#024BAB" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.subjectText} numberOfLines={1}>{t.subject}</Text>
          <Text style={styles.ticketMeta}>{t.ticketId} · {new Date(t.createdAt).toLocaleDateString('en-IN')}</Text>
        </View>
      </View>
      <View style={styles.pillRow}>
        <View style={[styles.pill, {borderColor: PRIORITY_COLORS[t.priority] || '#94a3b8'}]}>
          <Text style={[styles.pillText, {color: PRIORITY_COLORS[t.priority] || '#94a3b8'}]}>{t.priority}</Text>
        </View>
        <View style={[styles.pill, {borderColor: STATUS_COLORS[t.status] || '#94a3b8'}]}>
          <Text style={[styles.pillText, {color: STATUS_COLORS[t.status] || '#94a3b8'}]}>{(t.status || '').replace('_', ' ')}</Text>
        </View>
        {t.replies?.length > 0 && (
          <View style={styles.replyBadge}>
            <Icon name="chatbubble-outline" size={11} color="#64748b" />
            <Text style={styles.replyBadgeText}>{t.replies.length}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <Text style={styles.headerSub}>{tickets.length} tickets</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={i => i._id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchTickets(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="help-buoy-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>No tickets yet</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setCreateVisible(true)}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Raise a Ticket</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create ticket */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise a Ticket</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>SUBJECT</Text>
              <TextInput
                style={styles.input}
                placeholder="Briefly describe the issue"
                placeholderTextColor="#94a3b8"
                value={subject}
                onChangeText={setSubject}
              />
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What happened, what you expected, steps to reproduce..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.fieldLabel}>PRIORITY</Text>
              <View style={styles.statusChips}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.statusChip, priority === p && {backgroundColor: '#024BAB'}]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.statusChipText, priority === p && {color: '#fff'}]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.saveBtnText}>Submit Ticket</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ticket detail */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16, maxHeight: '85%'}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selected?.subject}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            {selected && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.pillRow}>
                  <Text style={styles.ticketMeta}>{selected.ticketId}</Text>
                  <View style={[styles.pill, {borderColor: PRIORITY_COLORS[selected.priority] || '#94a3b8'}]}>
                    <Text style={[styles.pillText, {color: PRIORITY_COLORS[selected.priority] || '#94a3b8'}]}>{selected.priority}</Text>
                  </View>
                  <View style={[styles.pill, {borderColor: STATUS_COLORS[selected.status] || '#94a3b8'}]}>
                    <Text style={[styles.pillText, {color: STATUS_COLORS[selected.status] || '#94a3b8'}]}>{(selected.status || '').replace('_', ' ')}</Text>
                  </View>
                </View>
                <View style={styles.descBox}>
                  <Text style={styles.descText}>{selected.description}</Text>
                </View>
                {selected.replies?.length > 0 && (
                  <View style={{marginTop: 12, gap: 8}}>
                    <Text style={styles.fieldLabel}>REPLIES</Text>
                    {selected.replies.map((r: any, i: number) => (
                      <View key={i} style={[styles.replyBox, r.from === 'crm' ? styles.replyBoxMine : styles.replyBoxTheirs]}>
                        <Text style={styles.replySender}>{r.senderName || (r.from === 'crm' ? 'You' : 'Support Team')}</Text>
                        <Text style={styles.replyMessage}>{r.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
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
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  ticketIcon: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardInfo: {flex: 1},
  subjectText: {fontSize: 14, fontWeight: '900', color: '#000'},
  ticketMeta: {fontSize: 11, color: '#64748b', marginTop: 2},
  pillRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  pill: {borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3},
  pillText: {fontSize: 10, fontWeight: '900', textTransform: 'capitalize'},
  replyBadge: {flexDirection: 'row', alignItems: 'center', gap: 3},
  replyBadgeText: {fontSize: 11, color: '#64748b'},
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
  textArea: {minHeight: 90},
  statusChips: {flexDirection: 'row', gap: 8},
  statusChip: {flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 8, alignItems: 'center'},
  statusChipText: {fontSize: 11, fontWeight: '800', color: '#000', textTransform: 'capitalize'},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  descBox: {borderWidth: 2, borderColor: '#000', backgroundColor: '#f8fafc', padding: 12, marginTop: 12},
  descText: {fontSize: 13, color: '#000', lineHeight: 18},
  replyBox: {borderWidth: 2, padding: 10},
  replyBoxMine: {borderColor: '#000', backgroundColor: '#fff', marginLeft: 24},
  replyBoxTheirs: {borderColor: '#024BAB', backgroundColor: '#eff6ff', marginRight: 24},
  replySender: {fontSize: 11, fontWeight: '900', color: '#000', marginBottom: 4},
  replyMessage: {fontSize: 12, color: '#000'},
});
