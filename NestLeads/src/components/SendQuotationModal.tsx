import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { whatsappAPI } from '../services/api';

// Quotation -> WhatsApp. Pick an approved template with a Document header; the server renders the
// quotation PDF and attaches it. No such template -> tell the user to update one.

const MAP_KEYS = [
  'name',
  'company',
  'phone',
  'location',
  'requirement',
  'quotationNumber',
  'total',
];
// Used when a template has no "MAP:" hint for a variable (or says "custom", which needs typing).
const FALLBACK = ['name', 'quotationNumber', 'total', 'requirement', 'company'];

function mappingFor(t: any) {
  const hint = /MAP:\s*([A-Za-z,\s]+)/
    .exec(t?.notes || '')?.[1]
    .split(',')
    .map(x => x.trim());
  return Array.from({ length: t?.variableCount || 0 }, (_, i) => ({
    position: i + 1,
    fieldKey:
      hint?.[i] && MAP_KEYS.includes(hint[i])
        ? hint[i]
        : FALLBACK[Math.min(i, FALLBACK.length - 1)],
    customValue: '',
  }));
}

export default function SendQuotationModal({
  quotation,
  onClose,
}: {
  quotation: any | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!quotation) return;
    setTemplateId('');
    setPhone(quotation.mobile || '');
    setLoading(true);
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([t, s]) => {
        setTemplates(
          (t.data || []).filter(
            (x: any) => x.status === 'APPROVED' && x.headerType === 'DOCUMENT',
          ),
        );
        setSenders(s.data?.phoneNumbers || []);
      })
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [quotation?._id]);

  const send = async () => {
    const t = templates.find(x => x._id === templateId);
    setSending(true);
    try {
      await whatsappAPI.sendQuotation({
        quotationId: quotation._id,
        templateId,
        phone,
        phoneNumberId: senders[0]?.phoneNumberId,
        variableMapping: JSON.stringify(mappingFor(t)),
      });
      Alert.alert('Sent', 'Quotation PDF sent on WhatsApp.');
      onClose();
    } catch (e: any) {
      Alert.alert('Failed to send', e.message);
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !!templateId && phone.replace(/\D/g, '').length >= 10 && !sending;

  return (
    <Modal
      visible={!!quotation}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <Text style={s.title}>Send quotation on WhatsApp</Text>
          <Text style={s.sub}>
            {quotation?.number} · {quotation?.clientName}
          </Text>
          {loading ? (
            <ActivityIndicator color="#024BAB" style={{ marginVertical: 24 }} />
          ) : senders.length === 0 ? (
            <Text style={s.note}>
              WhatsApp isn't connected yet. Connect it from the web app first.
            </Text>
          ) : templates.length === 0 ? (
            <Text style={s.note}>
              No approved template with a Document header found, so the PDF
              can't be attached. Update or create a template with a Document
              header (web app → WhatsApp → Campaigns) and Sync.
            </Text>
          ) : (
            <>
              <Text style={s.label}>Send to (WhatsApp number)</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="10-digit number"
                placeholderTextColor="#94a3b8"
              />
              <Text style={s.label}>Choose template</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {templates.map(t => (
                  <TouchableOpacity
                    key={t._id}
                    style={[s.row, templateId === t._id && s.rowOn]}
                    onPress={() => setTemplateId(t._id)}
                  >
                    <Text
                      style={[s.rowText, templateId === t._id && s.rowTextOn]}
                    >
                      {t.displayName || t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[s.btn, !canSend && { opacity: 0.4 }]}
                disabled={!canSend}
                onPress={send}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>Send quotation PDF</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderColor: '#000',
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#000' },
  sub: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  note: {
    fontSize: 13,
    color: '#000',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
  },
  row: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 6,
  },
  rowOn: { backgroundColor: '#024BAB' },
  rowText: { fontSize: 13, fontWeight: '600', color: '#000' },
  rowTextOn: { color: '#fff' },
  btn: {
    marginTop: 14,
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
