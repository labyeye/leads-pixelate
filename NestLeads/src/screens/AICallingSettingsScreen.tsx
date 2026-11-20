import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import { aiCallingAPI } from '../services/api';

const BLUE = '#024BAB';
const FIELD_KEYS: [string, string][] = [
  ['', 'Remarks only'],
  ['budget', 'Budget'],
  ['interestedProducts', 'Products'],
  ['requirement', 'Requirement'],
];

/** ElevenLabs AI calling setup: same settings as the web Settings → AI Calling tab. */
export default function AICallingSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [optDraft, setOptDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    aiCallingAPI
      .getSettings()
      .then(r =>
        setSt({
          enabled: false,
          agentId: '',
          callChannel: 'phone',
          overrideFirstMessage: true,
          callDelayMinutes: 1,
          callingHoursStart: '09:00',
          callingHoursEnd: '19:00',
          agentGreeting: '',
          questions: [],
          ...(r.data || {}),
        }),
      )
      .catch(e => Alert.alert('Error', e.message));
  }, []);

  const set = (k: string, v: any) => setSt((p: any) => ({ ...p, [k]: v }));
  const setQ = (i: number, patch: any) =>
    set('questions', st.questions.map((q: any, j: number) => (j === i ? { ...q, ...patch } : q)));

  const save = async () => {
    try {
      setSaving(true);
      await aiCallingAPI.updateSettings(st);
      Alert.alert('Saved', 'AI calling settings updated.');
    } catch (e: any) {
      Alert.alert('Failed to save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      setTesting(true);
      const r = await aiCallingAPI.testConnection(st.elevenLabsApiKey, st.agentId);
      Alert.alert('Connected ✓', r.message || 'ElevenLabs agent connection verified.');
    } catch (e: any) {
      Alert.alert('Connection failed', e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="call-outline" title="AI Calling" onBack={() => navigation.goBack()} />
      {!st ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={BLUE} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>AI calling</Text>
                  <Text style={s.muted}>{st.enabled ? 'Active: new leads get an AI call' : 'Disabled'}</Text>
                </View>
                <Switch value={!!st.enabled} onValueChange={v => set('enabled', v)} trackColor={{ true: BLUE }} />
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>ElevenLabs agent ID</Text>
              <TextInput
                style={s.input}
                value={st.agentId}
                onChangeText={v => set('agentId', v)}
                autoCapitalize="none"
                placeholder={st.envAgentIdSet ? 'Using the server default' : 'agent_…'}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity style={[s.ghostBtn, { marginTop: 8 }]} onPress={test} disabled={testing}>
                {testing ? <ActivityIndicator color={BLUE} /> : <Text style={s.ghostText}>Test connection</Text>}
              </TouchableOpacity>

              <Text style={[s.label, { marginTop: 14 }]}>Call over</Text>
              <View style={s.pills}>
                {[
                  ['phone', 'Phone call'],
                  ['whatsapp', 'WhatsApp call'],
                ].map(([k, l]) => (
                  <TouchableOpacity key={k} style={[s.pill, (st.callChannel || 'phone') === k && s.pillOn]} onPress={() => set('callChannel', k)}>
                    <Text style={[s.pillText, (st.callChannel || 'phone') === k && { color: '#fff' }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {st.callChannel === 'whatsapp' && (
                <>
                  <Text style={[s.label, { marginTop: 10 }]}>WhatsApp phone number ID</Text>
                  <TextInput style={s.input} value={st.whatsappPhoneNumberId || ''} onChangeText={v => set('whatsappPhoneNumberId', v)} autoCapitalize="none" placeholder="Copy from ElevenLabs → WhatsApp" placeholderTextColor="#94a3b8" />
                  <Text style={[s.label, { marginTop: 10 }]}>Call-permission template name</Text>
                  <TextInput style={s.input} value={st.whatsappPermissionTemplateName || ''} onChangeText={v => set('whatsappPermissionTemplateName', v)} autoCapitalize="none" placeholder="lead_call_permission_v1" placeholderTextColor="#94a3b8" />
                  <Text style={[s.label, { marginTop: 10 }]}>Template language</Text>
                  <TextInput style={s.input} value={st.whatsappPermissionTemplateLang || ''} onChangeText={v => set('whatsappPermissionTemplateLang', v)} autoCapitalize="none" placeholder="en" placeholderTextColor="#94a3b8" />
                </>
              )}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Greeting</Text>
              <View style={[s.row, { marginBottom: 8 }]}>
                <Text style={[s.muted, { flex: 1 }]}>
                  Replace the agent's first message with this greeting (needs the "First message" override, not on the ElevenLabs free plan).
                </Text>
                <Switch value={st.overrideFirstMessage !== false} onValueChange={v => set('overrideFirstMessage', v)} trackColor={{ true: BLUE }} />
              </View>
              <TextInput
                style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
                value={st.agentGreeting}
                onChangeText={v => set('agentGreeting', v)}
                multiline
              />
              <Text style={[s.muted, { marginTop: 4 }]}>Placeholders: {'{lead_name}'}, {'{company_name}'}</Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Qualification questions</Text>
              {(st.questions || []).map((q: any, i: number) => (
                <View key={q.id || i} style={s.qBox}>
                  <View style={s.row}>
                    <Text style={[s.label, { flex: 1 }]}>Question {i + 1}</Text>
                    <TouchableOpacity onPress={() => set('questions', st.questions.filter((_: any, j: number) => j !== i))} hitSlop={8}>
                      <Icon name="trash-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[s.input, { minHeight: 50, textAlignVertical: 'top' }]}
                    value={q.questionText}
                    onChangeText={v => setQ(i, { questionText: v })}
                    multiline
                    placeholder="e.g. What is your estimated budget?"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={[s.label, { marginTop: 8 }]}>Save answer to</Text>
                  <View style={s.pills}>
                    {FIELD_KEYS.map(([k, l]) => (
                      <TouchableOpacity key={k || 'none'} style={[s.pill, (q.fieldKey || '') === k && s.pillOn]} onPress={() => setQ(i, { fieldKey: k })}>
                        <Text style={[s.pillText, (q.fieldKey || '') === k && { color: '#fff' }]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[s.row, { marginTop: 8 }]}>
                    <Text style={[s.muted, { flex: 1 }]}>Required</Text>
                    <Switch value={!!q.required} onValueChange={v => setQ(i, { required: v })} trackColor={{ true: BLUE }} />
                  </View>
                  <Text style={[s.label, { marginTop: 8 }]}>Answer options (optional)</Text>
                  <View style={[s.pills, { marginBottom: 6 }]}>
                    {(q.options || []).map((o: string, oi: number) => (
                      <TouchableOpacity key={`${o}-${oi}`} style={s.pill} onPress={() => setQ(i, { options: q.options.filter((_: any, k: number) => k !== oi) })}>
                        <Text style={s.pillText}>{o} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={s.input}
                    value={optDraft[i] || ''}
                    onChangeText={v => setOptDraft(d => ({ ...d, [i]: v }))}
                    onSubmitEditing={() => {
                      const v = (optDraft[i] || '').trim();
                      if (!v) return;
                      setQ(i, { options: [...(q.options || []), v] });
                      setOptDraft(d => ({ ...d, [i]: '' }));
                    }}
                    returnKeyType="done"
                    placeholder="Type an option and press Done"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={() =>
                  set('questions', [
                    ...(st.questions || []),
                    { id: `q${Date.now()}`, questionText: '', fieldKey: '', required: false, options: [] },
                  ])
                }
              >
                <Text style={s.ghostText}>+ Add question</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>When to call</Text>
              <Text style={s.label}>Call after (minutes)</Text>
              <TextInput
                style={s.input}
                keyboardType="number-pad"
                value={String(st.callDelayMinutes ?? '')}
                onChangeText={v => set('callDelayMinutes', Number(v.replace(/\D/g, '')) || 0)}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>From (HH:MM)</Text>
                  <TextInput style={s.input} value={st.callingHoursStart} onChangeText={v => set('callingHoursStart', v)} placeholder="09:00" placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>To (HH:MM)</Text>
                  <TextInput style={s.input} value={st.callingHoursEnd} onChangeText={v => set('callingHoursEnd', v)} placeholder="19:00" placeholderTextColor="#94a3b8" />
                </View>
              </View>
            </View>
          </ScrollView>
          <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save settings</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: { borderWidth: 2, borderColor: '#000', padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { fontSize: 12, color: '#64748b' },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#000', backgroundColor: '#fff' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  pillOn: { backgroundColor: BLUE },
  pillText: { fontSize: 12, fontWeight: '500', color: '#000' },
  qBox: { borderWidth: 1, borderColor: '#cbd5e1', padding: 10, marginBottom: 10 },
  ghostBtn: { borderWidth: 2, borderColor: '#000', borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center' },
  ghostText: { fontWeight: '600', color: BLUE },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000' },
  saveBtn: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
