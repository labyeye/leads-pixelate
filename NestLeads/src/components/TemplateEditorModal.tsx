import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { whatsappAPI } from '../services/api';
import { PERF_VARS } from '../constants/whatsappTemplateLibrary';
import FieldLabel from './FieldLabel';

const BLUE = '#024BAB';

export const EMPTY_TEMPLATE = {
  displayName: '',
  name: '',
  category: 'UTILITY',
  language: 'en',
  headerType: 'NONE',
  headerText: '',
  headerMediaId: '',
  headerMediaName: '',
  headerMediaHandle: '',
  exampleValues: [] as string[],
  bodyText: '',
  footerText: '',
  metaTemplateName: '',
  status: 'DRAFT',
  notes: '',
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
const varNumbers = (body: string) =>
  [...new Set((body.match(/\{\{(\d+)\}\}/g) || []).map(m => parseInt(m.slice(2), 10)))].sort((a, b) => a - b);

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Create or edit a template, then send it to Meta for approval (same flow as the web page). */
export default function TemplateEditorModal({
  visible,
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial: typeof EMPTY_TEMPLATE;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm(initial);
  }, [visible, initial]);

  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));
  const media = form.headerType === 'DOCUMENT' || form.headerType === 'IMAGE';
  const locked = !!editingId && ['PENDING', 'APPROVED'].includes(form.status);

  // Adds the next {{n}} for a team-performance value, with its sample and its funnel mapping.
  const addPerfVar = (v: { key: string; label: string; sample: string }) =>
    setForm((f: any) => {
      const nums = varNumbers(f.bodyText);
      const n = (nums.length ? Math.max(...nums) : 0) + 1;
      const keys = (/MAP:\s*([a-z_,\s]+)/i.exec(f.notes || '')?.[1] || '')
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);
      keys[n - 1] = v.key;
      const ev = [...(f.exampleValues || [])];
      ev[n - 1] = v.sample;
      const sep = f.bodyText && !/\s$/.test(f.bodyText) ? ' ' : '';
      const rest = (f.notes || '').replace(/MAP:\s*[a-z_,\s]+/i, '').trim();
      return {
        ...f,
        bodyText: `${f.bodyText}${sep}${v.label}: {{${n}}}`,
        exampleValues: ev,
        notes: `MAP: ${keys.join(',')}${rest ? ` ${rest}` : ''}`,
      };
    });

  const save = async () => {
    const name = form.name || slug(form.displayName);
    if (!form.displayName.trim() || !form.bodyText.trim() || !name) {
      Alert.alert('Fill the required fields', 'Name and message text are needed.');
      return;
    }
    const body = { ...form, name, metaTemplateName: form.metaTemplateName || name };
    setSaving(true);
    try {
      let toSubmit: string | null = null;
      if (editingId) {
        await whatsappAPI.updateTemplate(editingId, body);
        if (form.status === 'DRAFT' || form.status === 'REJECTED') toSubmit = editingId;
      } else {
        const created = await whatsappAPI.createTemplate(body);
        toSubmit = created.data?._id || null;
      }
      if (toSubmit) {
        try {
          const r = await whatsappAPI.submitTemplate(toSubmit);
          Alert.alert('Sent to Meta', r.message || 'Approval usually takes a few hours to 2 days.');
        } catch (e: any) {
          Alert.alert('Saved, but Meta did not accept it', `${e?.message || ''}\n\nFix it and save again to resubmit.`);
        }
      }
      onSaved();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Icon name="close" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={s.title}>{editingId ? 'Edit template' : 'New template'}</Text>
          <TouchableOpacity onPress={save} disabled={saving || locked} style={[s.saveBtn, (saving || locked) && { opacity: 0.4 }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{saving ? '…' : 'Save & send'}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 60 }} keyboardShouldPersistTaps="handled">
          {locked && <Text style={s.warn}>This template is already with Meta ({form.status}). It can't be edited now.</Text>}

          <FieldLabel style={s.label}>Template name</FieldLabel>
          <TextInput
            value={form.displayName}
            onChangeText={v => set({ displayName: v, ...(editingId ? {} : { name: slug(v), metaTemplateName: slug(v) }) })}
            placeholder="e.g. Daily scorecard"
            placeholderTextColor="#94a3b8"
            style={s.input}
            editable={!locked}
          />

          <FieldLabel style={s.label}>Category</FieldLabel>
          <View style={s.chips}>
            <Chip label="Utility" on={form.category === 'UTILITY'} onPress={() => set({ category: 'UTILITY' })} />
            <Chip label="Marketing" on={form.category === 'MARKETING'} onPress={() => set({ category: 'MARKETING' })} />
          </View>

          <FieldLabel style={s.label}>Language</FieldLabel>
          <View style={s.chips}>
            <Chip label="English" on={form.language === 'en'} onPress={() => set({ language: 'en' })} />
            <Chip label="हिन्दी" on={form.language === 'hi'} onPress={() => set({ language: 'hi' })} />
          </View>

          {media ? (
            <Text style={s.hint}>Header: {form.headerType === 'DOCUMENT' ? 'PDF document' : 'image'}. The file can only be changed on the web dashboard.</Text>
          ) : (
            <>
              <FieldLabel style={s.label}>Header (optional, text only)</FieldLabel>
              <TextInput
                value={form.headerText}
                onChangeText={v => set({ headerText: v, headerType: v.trim() ? 'TEXT' : 'NONE' })}
                placeholder="e.g. Your scorecard"
                placeholderTextColor="#94a3b8"
                maxLength={60}
                style={s.input}
                editable={!locked}
              />
            </>
          )}

          <FieldLabel style={s.label}>Message text</FieldLabel>
          <TextInput
            value={form.bodyText}
            onChangeText={v => set({ bodyText: v })}
            placeholder={'Hello {{1}}, thank you for your enquiry about {{2}}.'}
            placeholderTextColor="#94a3b8"
            multiline
            editable={!locked}
            style={[s.input, { minHeight: 130, textAlignVertical: 'top' }]}
          />
          <Text style={s.hint}>Use {'{{1}}'}, {'{{2}}'}… for values that change. Don't start or end the text with one.</Text>

          <FieldLabel style={s.label}>Team performance values (tap to add)</FieldLabel>
          <View style={s.chips}>
            {PERF_VARS.map(v => (
              <Chip key={v.key} label={`+ ${v.label}`} onPress={() => !locked && addPerfVar(v)} />
            ))}
          </View>

          {varNumbers(form.bodyText).map(n => (
            <View key={n}>
              <FieldLabel style={s.label}>{`Sample for {{${n}}} (Meta needs it to review)`}</FieldLabel>
              <TextInput
                value={form.exampleValues?.[n - 1] || ''}
                onChangeText={v =>
                  setForm((f: any) => {
                    const ev = [...(f.exampleValues || [])];
                    ev[n - 1] = v;
                    return { ...f, exampleValues: ev };
                  })
                }
                style={s.input}
                editable={!locked}
              />
            </View>
          ))}

          <FieldLabel style={s.label}>Footer (optional)</FieldLabel>
          <TextInput
            value={form.footerText}
            onChangeText={v => set({ footerText: v })}
            maxLength={60}
            placeholder="e.g. Powered by NestLeads"
            placeholderTextColor="#94a3b8"
            style={s.input}
            editable={!locked}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#000', flex: 1, textAlign: 'center' },
  divider: { height: 2, backgroundColor: '#000' },
  saveBtn: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 7 },
  label: { fontSize: 11, color: '#64748b', marginTop: 12, marginBottom: 4 },
  hint: { fontSize: 11, color: '#64748b', marginTop: 6 },
  warn: { fontSize: 12, color: '#b45309', backgroundColor: '#fef3c7', padding: 8, borderWidth: 1, borderColor: '#f59e0b' },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipOn: { backgroundColor: BLUE },
  chipText: { fontSize: 12, fontWeight: '600', color: '#000' },
});
