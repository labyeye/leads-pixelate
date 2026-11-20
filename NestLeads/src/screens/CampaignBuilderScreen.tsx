import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { campaignsAPI, whatsappAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const BLUE = '#024BAB';
const ORANGE = '#FF751F';

// Same choices as the web Campaign Builder.
const LEAD_STATUSES: [string, string][] = [
  ['PENDING', 'Pending'],
  ['1-3', '1-3 (Follow-up)'],
  ['QUOTATION', 'Quotation'],
  ['WON', 'Won'],
  ['DROP', 'Drop'],
];
const LEAD_SOURCES = ['IndiaMART', 'TradeIndia', 'Justdial', 'Website', 'Facebook', 'Manual'];
const VARIABLE_FIELDS: [string, string][] = [
  ['name', 'Contact name'],
  ['company', 'Company'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['requirement', 'Requirement'],
  ['budget', 'Budget'],
  ['custom', 'Custom text'],
];

type Mapping = { position: number; fieldKey: string; customValue: string };

/** Create or edit a WhatsApp broadcast campaign (web Campaign Builder on one screen). */
export default function CampaignBuilderScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const editId: string | undefined = route?.params?.campaignId;

  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<'ALL_LEADS' | 'SEGMENT'>('ALL_LEADS');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [audience, setAudience] = useState<{ count: number; preview: any[] } | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phoneNumberId, setPhoneNumberId] = useState('');

  useEffect(() => {
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getConfig()])
      .then(([t, c]: any) => {
        setTemplates((t.data || []).filter((x: any) => !x.status || x.status === 'APPROVED'));
        const nums = c.data?.phoneNumbers || [];
        setNumbers(nums);
        if (nums.length === 1) setPhoneNumberId(nums[0].phoneNumberId);
      })
      .catch(() => {});
    if (editId)
      campaignsAPI
        .getById(editId)
        .then(r => {
          const c = r.data || {};
          setName(c.name || '');
          setDescription(c.description || '');
          setTargetType(c.audience?.targetType || 'ALL_LEADS');
          setStatuses(c.audience?.filters?.leadStatus || []);
          setSources(c.audience?.filters?.leadSource || []);
          setTemplateId(c.whatsapp?.templateId || '');
          setMapping(c.whatsapp?.variableMapping || []);
          setPhoneNumberId(c.whatsapp?.phoneNumberId || '');
        })
        .catch(() => Alert.alert('Failed to load campaign'))
        .finally(() => setLoading(false));
  }, [editId]);

  const refreshAudience = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const r = await campaignsAPI.resolveAudience({
        targetType,
        filters: { leadStatus: statuses, leadSource: sources },
      });
      setAudience(r.data);
    } catch {
      setAudience(null);
    } finally {
      setAudienceLoading(false);
    }
  }, [targetType, statuses, sources]);

  useEffect(() => {
    if (!loading) refreshAudience();
  }, [refreshAudience, loading]);

  const template = templates.find(t => t._id === templateId);
  const pickTemplate = (t: any) => {
    setTemplateId(t._id);
    const n = (String(t.bodyText || '').match(/\{\{(\d+)\}\}/g) || []).length;
    setMapping(Array.from({ length: n }, (_, i) => ({ position: i + 1, fieldKey: i === 0 ? 'name' : 'company', customValue: '' })));
  };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const save = async (launch: boolean) => {
    if (!name.trim()) return Alert.alert('Give the campaign a name');
    if (!templateId) return Alert.alert('Pick a template');
    if (mapping.some(m => m.fieldKey === 'custom' && !m.customValue.trim()))
      return Alert.alert('Fill the custom text for every variable');
    const payload = {
      name: name.trim(),
      description,
      type: 'WHATSAPP',
      audience: { targetType, filters: { leadStatus: statuses, leadSource: sources } },
      whatsapp: { templateId, variableMapping: mapping, phoneNumberId: phoneNumberId || undefined },
    };
    try {
      setSaving(true);
      const r = editId ? await campaignsAPI.update(editId, payload) : await campaignsAPI.create(payload);
      if (launch && isAdmin) await campaignsAPI.launch(r.data._id);
      Alert.alert(launch ? 'Campaign launched' : 'Saved as draft', launch ? 'Messages are being sent.' : undefined);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed to save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const preview = template
    ? String(template.bodyText).replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => {
        const m = mapping[Number(n) - 1];
        if (!m) return `{{${n}}}`;
        return m.fieldKey === 'custom' ? m.customValue || '…' : `[${VARIABLE_FIELDS.find(f => f[0] === m.fieldKey)?.[1]}]`;
      })
    : '';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="megaphone-outline" title={editId ? 'Edit Campaign' : 'New Campaign'} onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={BLUE} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <Text style={s.step}>1 · Details</Text>
              <Text style={s.label}>Campaign name *</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Diwali offer" placeholderTextColor="#94a3b8" />
              <Text style={[s.label, { marginTop: 10 }]}>Description</Text>
              <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline />
            </View>

            <View style={s.card}>
              <Text style={s.step}>2 · Audience</Text>
              <View style={s.pills}>
                {(['ALL_LEADS', 'SEGMENT'] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.pill, targetType === t && s.pillOn]} onPress={() => setTargetType(t)}>
                    <Text style={[s.pillText, targetType === t && { color: '#fff' }]}>{t === 'ALL_LEADS' ? 'All leads' : 'Filter leads'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {targetType === 'SEGMENT' && (
                <>
                  <Text style={[s.label, { marginTop: 10 }]}>Status</Text>
                  <View style={s.pills}>
                    {LEAD_STATUSES.map(([v, l]) => (
                      <TouchableOpacity key={v} style={[s.pill, statuses.includes(v) && s.pillOn]} onPress={() => toggle(statuses, setStatuses, v)}>
                        <Text style={[s.pillText, statuses.includes(v) && { color: '#fff' }]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[s.label, { marginTop: 10 }]}>Source</Text>
                  <View style={s.pills}>
                    {LEAD_SOURCES.map(v => (
                      <TouchableOpacity key={v} style={[s.pill, sources.includes(v) && s.pillOn]} onPress={() => toggle(sources, setSources, v)}>
                        <Text style={[s.pillText, sources.includes(v) && { color: '#fff' }]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={s.audienceBox}>
                {audienceLoading ? (
                  <ActivityIndicator color={BLUE} />
                ) : (
                  <>
                    <Text style={s.audienceNum}>{audience?.count ?? 0}</Text>
                    <Text style={s.muted}>
                      leads will get this message
                      {audience?.preview?.length ? ` · e.g. ${audience.preview.slice(0, 3).map((p: any) => p.name).join(', ')}` : ''}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.step}>3 · Message</Text>
              {templates.length === 0 ? (
                <Text style={s.muted}>No approved WhatsApp templates yet. Create one under WhatsApp Setup.</Text>
              ) : (
                templates.map(t => (
                  <TouchableOpacity key={t._id} style={[s.tpl, templateId === t._id && s.tplOn]} onPress={() => pickTemplate(t)}>
                    <Text style={s.tplName}>{t.displayName || t.name}</Text>
                    <Text style={s.muted} numberOfLines={2}>{t.bodyText}</Text>
                  </TouchableOpacity>
                ))
              )}
              {mapping.map((m, i) => (
                <View key={m.position} style={{ marginTop: 10 }}>
                  <Text style={s.label}>{`Variable {{${m.position}}}`}</Text>
                  <View style={s.pills}>
                    {VARIABLE_FIELDS.map(([k, l]) => (
                      <TouchableOpacity
                        key={k}
                        style={[s.pill, m.fieldKey === k && s.pillOn]}
                        onPress={() => setMapping(list => list.map((x, j) => (j === i ? { ...x, fieldKey: k } : x)))}
                      >
                        <Text style={[s.pillText, m.fieldKey === k && { color: '#fff' }]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {m.fieldKey === 'custom' && (
                    <TextInput
                      style={[s.input, { marginTop: 6 }]}
                      value={m.customValue}
                      onChangeText={v => setMapping(list => list.map((x, j) => (j === i ? { ...x, customValue: v } : x)))}
                      placeholder="Text to use"
                      placeholderTextColor="#94a3b8"
                    />
                  )}
                </View>
              ))}
              {!!preview && (
                <View style={s.bubble}>
                  <Text style={{ fontSize: 13, color: '#000' }}>{preview}</Text>
                </View>
              )}
            </View>

            {numbers.length > 1 && (
              <View style={s.card}>
                <Text style={s.step}>4 · Send from</Text>
                <View style={s.pills}>
                  {numbers.map(n => (
                    <TouchableOpacity key={n.phoneNumberId} style={[s.pill, phoneNumberId === n.phoneNumberId && s.pillOn]} onPress={() => setPhoneNumberId(n.phoneNumberId)}>
                      <Text style={[s.pillText, phoneNumberId === n.phoneNumberId && { color: '#fff' }]}>
                        {n.label || n.businessName || n.phoneNumber || n.phoneNumberId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#fff' }]} onPress={() => save(false)} disabled={saving}>
              <Text style={{ fontWeight: '600', color: '#000' }}>Save draft</Text>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity
                style={[s.btn, { backgroundColor: ORANGE }, saving && { opacity: 0.6 }]}
                onPress={() =>
                  Alert.alert('Launch now?', `Send to ${audience?.count ?? 0} leads.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Launch', onPress: () => save(true) },
                  ])
                }
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '600', color: '#fff' }}>Save & launch</Text>}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: { borderWidth: 2, borderColor: '#000', padding: 14, marginBottom: 12 },
  step: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { fontSize: 12, color: '#64748b' },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#000' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  pillOn: { backgroundColor: BLUE },
  pillText: { fontSize: 12, fontWeight: '500', color: '#000' },
  audienceBox: { marginTop: 12, borderWidth: 2, borderColor: '#000', padding: 10, backgroundColor: '#eff6ff', minHeight: 56, justifyContent: 'center' },
  audienceNum: { fontSize: 22, fontWeight: '700', color: BLUE },
  tpl: { borderWidth: 2, borderColor: '#cbd5e1', padding: 8, marginBottom: 6 },
  tplOn: { borderColor: BLUE, backgroundColor: '#eff6ff' },
  tplName: { fontSize: 13, fontWeight: '700', color: '#000' },
  bubble: { backgroundColor: '#DCF8C6', borderWidth: 2, borderColor: '#000', padding: 10, marginTop: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000' },
  btn: { flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 13, alignItems: 'center' },
});
