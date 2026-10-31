import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { TEMPLATE_LIBRARY, libraryToForm, type LibraryCategory } from '../constants/whatsappTemplateLibrary';

const BLUE = '#024BAB';
const GROUPS: ('All' | LibraryCategory)[] = [
  'All',
  'Team performance',
  'Welcome & enquiry',
  'Follow-up',
  'Quotation',
  'Visit & demo',
  'Order & payment',
  'Marketing',
];

const fill = (text: string, samples: string[]) => text.replace(/\{\{(\d+)\}\}/g, (_, n) => samples[Number(n) - 1] ?? '…');

/** Ready-made templates. Picking one opens the editor pre-filled; nothing is sent to Meta until you save. */
export default function TemplateLibraryModal({
  visible,
  onClose,
  onPick,
  existingNames,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (form: ReturnType<typeof libraryToForm>) => void;
  existingNames: string[];
}) {
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('All');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const list = useMemo(() => TEMPLATE_LIBRARY.filter(t => group === 'All' || t.group === group), [group]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Icon name="close" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={s.title}>Template library</Text>
          <View style={s.iconBtn} />
        </View>
        <View style={s.divider} />
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {GROUPS.map(g => (
              <TouchableOpacity key={g} onPress={() => setGroup(g)} style={[s.chip, group === g && s.chipOn]}>
                <Text style={[s.chipText, group === g && { color: '#fff' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.row, { marginBottom: 10 }]}>
            {(['en', 'hi'] as const).map(l => (
              <TouchableOpacity key={l} onPress={() => setLang(l)} style={[s.chip, lang === l && { backgroundColor: '#000' }]}>
                <Text style={[s.chipText, lang === l && { color: '#fff' }]}>{l === 'en' ? 'English' : 'हिन्दी'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {list.map(t => {
            const form = libraryToForm(t, lang);
            const exists = existingNames.includes(form.metaTemplateName);
            const needsFile = t.headerType === 'DOCUMENT';
            const off = exists || needsFile;
            return (
              <View key={t.id} style={s.card}>
                <View style={s.row}>
                  <Text style={s.cardTitle}>{t.title}</Text>
                  <Text style={s.tag}>{t.category}</Text>
                </View>
                <Text style={s.muted}>{t.when}</Text>
                <View style={s.bubble}>
                  {t.headerType === 'TEXT' && !!t.headerText && <Text style={{ fontWeight: '700', fontSize: 12 }}>{t.headerText}</Text>}
                  <Text style={{ fontSize: 12, color: '#000' }}>{fill(form.bodyText, t.samples)}</Text>
                </View>
                <Text style={s.muted}>{t.vars.map((v, i) => `{{${i + 1}}} ${v}`).join(' · ')}</Text>
                <TouchableOpacity
                  disabled={off}
                  onPress={() => onPick(form)}
                  style={[s.useBtn, off && { opacity: 0.4 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                    {exists ? 'Already added' : needsFile ? 'Needs a PDF — use the web dashboard' : 'Use this template'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff', marginRight: 6 },
  chipOn: { backgroundColor: BLUE },
  chipText: { fontSize: 12, fontWeight: '600', color: '#000' },
  card: { borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 12, gap: 6 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  tag: { fontSize: 10, fontWeight: '700', borderWidth: 2, borderColor: '#000', paddingHorizontal: 6, paddingVertical: 1, color: '#000' },
  muted: { color: '#64748b', fontSize: 11 },
  bubble: { backgroundColor: '#DCF8C6', borderWidth: 2, borderColor: '#000', padding: 10, gap: 4 },
  useBtn: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingVertical: 8, alignItems: 'center' },
});
