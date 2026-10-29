import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { settingsAPI } from '../services/api';

// Owner sets the quotation number pattern (same rules as web Settings > Numbering,
// backend/utils/docNumber.js). The server rejects anyone who isn't the account owner.
function preview(format: string, seq: number) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return format.replace(
    /\{(YYYY|YY|MM|DD|seq(?::(\d{1,2}))?)\}/g,
    (_, t, pad) =>
      t === 'YYYY'
        ? String(d.getFullYear())
        : t === 'YY'
          ? p(d.getFullYear() % 100)
          : t === 'MM'
            ? p(d.getMonth() + 1)
            : t === 'DD'
              ? p(d.getDate())
              : String(seq).padStart(Number(pad) || 1, '0'),
  );
}

export default function QuotationNumberingCard() {
  const [format, setFormat] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI
      .get()
      .then((r: any) => {
        const q = r.data?.numbering?.quotation;
        setFormat(q?.format || '');
        setNext(q?.next ? String(q.next) : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await settingsAPI.saveNumbering({
        quotation: {
          format: format.trim(),
          ...(next ? { next: Number(next) } : {}),
        },
      });
      const q = res.data?.quotation;
      setNext(q?.next ? String(q.next) : '');
      Alert.alert('Saved', 'New quotations will use this numbering.');
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator color="#024BAB" />;
  return (
    <View style={s.card}>
      <Text style={s.title}>Quotation number</Text>
      <Text style={s.hint}>
        {'{seq:4}'} = running number, plus {'{YYYY} {YY} {MM} {DD}'}. e.g.
        QT/{'{YY}'}-{'{seq:4}'} → QT/26-0001
      </Text>
      <TextInput
        style={s.input}
        value={format}
        onChangeText={setFormat}
        maxLength={40}
        autoCapitalize="characters"
        placeholder="QT-{seq:4}"
        placeholderTextColor="#94a3b8"
      />
      <TextInput
        style={s.input}
        value={next}
        onChangeText={t => setNext(t.replace(/\D/g, '').slice(0, 8))}
        keyboardType="numeric"
        placeholder="Next number (auto)"
        placeholderTextColor="#94a3b8"
      />
      <Text style={s.hint}>
        Next: <Text style={{ fontWeight: '500' }}>
          {format.trim() ? preview(format, Number(next) || 1) : '— (default)'}
        </Text>
      </Text>
      <TouchableOpacity
        style={[s.btn, (!format.trim() || saving) && { opacity: 0.4 }]}
        disabled={!format.trim() || saving}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnText}>Save numbering</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 2, borderColor: '#000', padding: 12, gap: 8 },
  title: { fontSize: 14, fontWeight: '500', color: '#000' },
  hint: { fontSize: 11, color: '#64748b' },
  input: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
  },
  btn: {
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '500', fontSize: 13 },
});
