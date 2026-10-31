import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, StyleSheet, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { whatsappAPI } from '../services/api';
import { mappingFromNotes } from '../constants/whatsappTemplateLibrary';

const BLUE = '#024BAB';
const fieldText = (lead: any, key: string) =>
  ({ name: lead?.name, company: lead?.company, phone: lead?.phone, location: lead?.location, requirement: lead?.requirement, budget: lead?.budget } as any)[key] || '';

/** Sends a template or a message to a lead through the WhatsApp Business API; it then shows in the Inbox. */
export default function SendWhatsAppModal({ lead, onClose }: { lead: any | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [mode, setMode] = useState<'template' | 'text'>('template');
  const [picked, setPicked] = useState<any>(null);
  const [mapping, setMapping] = useState<{ position: number; fieldKey: string; customValue: string }[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setPicked(null);
    setMessage('');
    setTemplates(null);
    whatsappAPI
      .getTemplates()
      .then(r => setTemplates((r.data || []).filter((t: any) => t.status === 'APPROVED' && !['DOCUMENT', 'IMAGE'].includes(t.headerType))))
      .catch(() => setTemplates([]));
  }, [lead]);

  const pick = (t: any) => {
    setPicked(t);
    setMapping(mappingFromNotes(t.notes, t.variableCount || 0));
  };

  const preview = picked
    ? String(picked.bodyText).replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const m = mapping[Number(n) - 1];
        return (m?.fieldKey === 'custom' ? m.customValue : fieldText(lead, m?.fieldKey)) || '…';
      })
    : '';

  const send = async () => {
    setSending(true);
    try {
      if (mode === 'template' && picked)
        await whatsappAPI.sendToLead({ leadId: lead._id, templateId: picked._id, variableMapping: mapping });
      else await whatsappAPI.sendToLead({ leadId: lead._id, messageType: 'text', messageText: message.trim() });
      Alert.alert('Sent', 'It will show in your WhatsApp Inbox.');
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/not connected/i.test(msg)) {
        // No Business API on this account: fall back to the normal WhatsApp app.
        Linking.openURL(`https://wa.me/${String(lead.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`);
        onClose();
      } else Alert.alert("Couldn't send", msg);
    } finally {
      setSending(false);
    }
  };

  const ready = mode === 'template' ? !!picked : !!message.trim();

  return (
    <Modal visible={!!lead} animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Icon name="close" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>
            WhatsApp · {lead?.name}
          </Text>
          <TouchableOpacity onPress={send} disabled={!ready || sending} style={[s.sendBtn, (!ready || sending) && { opacity: 0.4 }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{sending ? '…' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.chips}>
            <TouchableOpacity onPress={() => setMode('template')} style={[s.chip, mode === 'template' && s.chipOn]}>
              <Text style={[s.chipText, mode === 'template' && { color: '#fff' }]}>Template</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('text')} style={[s.chip, mode === 'text' && s.chipOn]}>
              <Text style={[s.chipText, mode === 'text' && { color: '#fff' }]}>Message</Text>
            </TouchableOpacity>
          </View>

          {mode === 'text' ? (
            <>
              <Text style={s.hint}>A free message only reaches them within 24 hours of their last reply. Otherwise use a template.</Text>
              <TextInput value={message} onChangeText={setMessage} multiline placeholder="Type your message" placeholderTextColor="#94a3b8" style={[s.input, { minHeight: 120, textAlignVertical: 'top' }]} />
            </>
          ) : templates === null ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={BLUE} />
          ) : templates.length === 0 ? (
            <Text style={s.hint}>No approved templates yet. Create one in WhatsApp Setup, or use a Message.</Text>
          ) : (
            <>
              {templates.map(t => (
                <TouchableOpacity key={t._id} onPress={() => pick(t)} style={[s.tpl, picked?._id === t._id && s.tplOn]}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: '#000' }}>{t.displayName}</Text>
                  <Text style={s.hint} numberOfLines={2}>
                    {t.bodyText}
                  </Text>
                </TouchableOpacity>
              ))}
              {picked &&
                mapping.map((m, i) =>
                  m.fieldKey === 'custom' || m.fieldKey.startsWith('perf_') ? (
                    <View key={m.position}>
                      <Text style={s.hint}>{`Value for {{${m.position}}}`}</Text>
                      <TextInput
                        value={m.customValue}
                        onChangeText={v => setMapping(list => list.map((x, j) => (j === i ? { ...x, fieldKey: 'custom', customValue: v } : x)))}
                        style={s.input}
                      />
                    </View>
                  ) : null,
                )}
              {!!preview && (
                <View style={s.bubble}>
                  <Text style={{ fontSize: 13, color: '#000' }}>{preview}</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  iconBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#000', textAlign: 'center' },
  divider: { height: 2, backgroundColor: '#000' },
  sendBtn: { backgroundColor: '#25D366', borderWidth: 2, borderColor: '#000', paddingHorizontal: 14, paddingVertical: 7 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: BLUE },
  chipText: { fontSize: 12, fontWeight: '700', color: '#000' },
  hint: { fontSize: 11, color: '#64748b', marginVertical: 4 },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  tpl: { borderWidth: 2, borderColor: '#cbd5e1', padding: 8, marginBottom: 6 },
  tplOn: { borderColor: BLUE, backgroundColor: '#eff6ff' },
  bubble: { backgroundColor: '#DCF8C6', borderWidth: 2, borderColor: '#000', padding: 10, marginTop: 10 },
});
