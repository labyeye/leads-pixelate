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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import { settingsAPI, usersAPI, whatsappAPI } from '../services/api';
import { mappingFor } from '../components/SendQuotationModal';
import { useAuth } from '../contexts/AuthContext';
import { setContactTagsEnabled } from '../constants/statusConstants';
import { launchImageLibrary } from 'react-native-image-picker';

const BLUE = '#024BAB';

// Same fields as the web Settings → General / Bank / Terms tabs.
const SECTIONS: { title: string; fields: [string, string, any?][] }[] = [
  {
    title: 'Company',
    fields: [
      ['companyName', 'Company name'],
      ['companyGST', 'GST number (GSTIN)', { maxLength: 15, autoCapitalize: 'characters', placeholder: '07AAAAA0000A1Z5' }],
      ['companyPAN', 'PAN number', { maxLength: 10, autoCapitalize: 'characters', placeholder: 'ABCDE1234F' }],
      ['companyState', 'State'],
      ['companyStateCode', 'State code', { keyboardType: 'number-pad', maxLength: 2 }],
      ['companyPhone', 'Phone number', { keyboardType: 'phone-pad' }],
      ['companyEmail', 'Email address', { keyboardType: 'email-address', autoCapitalize: 'none' }],
      ['companyWebsite', 'Website URL', { keyboardType: 'url', autoCapitalize: 'none' }],
      ['companyAddress', 'Company address', { multiline: true }],
    ],
  },
  {
    title: 'Bank details (printed on quotations)',
    fields: [
      ['bankAccountName', 'Account holder name'],
      ['bankAccountNumber', 'Account number', { keyboardType: 'number-pad' }],
      ['bankIFSC', 'IFSC code', { autoCapitalize: 'characters', maxLength: 11 }],
      ['bankName', 'Bank name'],
      ['bankBranch', 'Branch name'],
      ['bankAccountType', 'Account type', { placeholder: 'Current / Savings' }],
    ],
  },
  {
    title: 'Quotation',
    fields: [
      ['quotationTitle', 'Quotation page title'],
      ['quotationFooter', 'Footer message', { multiline: true }],
    ],
  },
];

export default function CompanySettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const [form, setForm] = useState<any>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [docTemplates, setDocTemplates] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);

  useEffect(() => {
    usersAPI
      .getAll()
      .then(r => setPeople((r.data || []).filter((u: any) => u.status !== 'inactive')))
      .catch(() => {});
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([t, st]: any) => {
        setDocTemplates((t.data || []).filter((x: any) => x.status === 'APPROVED' && x.headerType === 'DOCUMENT'));
        setSenders(st.data?.phoneNumbers || []);
      })
      .catch(() => {});
  }, []);

  // Quotation approval: who must OK a quotation before it can go out, and auto-send after.
  const qa = {
    enabled: !!form?.quotationApproval?.enabled,
    minTotal: Number(form?.quotationApproval?.minTotal) || 0,
    approvers: (form?.quotationApproval?.approvers || []).map(String),
    autoSend: {
      enabled: !!form?.quotationApproval?.autoSend?.enabled,
      templateId: form?.quotationApproval?.autoSend?.templateId ? String(form.quotationApproval.autoSend.templateId) : '',
      phoneNumberId: form?.quotationApproval?.autoSend?.phoneNumberId || '',
      variableMapping: form?.quotationApproval?.autoSend?.variableMapping || [],
    },
  };
  const setQA = (patch: any) => set('quotationApproval', { ...qa, ...patch });
  const setAuto = (patch: any) => setQA({ autoSend: { ...qa.autoSend, ...patch } });

  useEffect(() => {
    settingsAPI
      .get()
      .then(r => {
        setForm(r.data || {});
        setTerms(Array.isArray(r.data?.quotationTerms) ? r.data.quotationTerms : []);
      })
      .catch(e => Alert.alert('Error', e.message));
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Same as web: a small JPEG (max 300px) stored as a data URL.
  const pickLogo = () =>
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, maxWidth: 300, maxHeight: 300, quality: 0.8 },
      res => {
        const a = res.assets?.[0];
        if (!a?.base64) return;
        if ((a.fileSize || 0) > 2 * 1024 * 1024) {
          Alert.alert('File too large', 'Logo must be under 2 MB.');
          return;
        }
        set('logoUrl', `data:${a.type || 'image/jpeg'};base64,${a.base64}`);
      },
    );

  const save = async () => {
    try {
      setSaving(true);
      const body: any = { quotationTerms: terms.map(t => t.trim()).filter(Boolean) };
      SECTIONS.forEach(sec => sec.fields.forEach(([k]) => (body[k] = form[k] ?? '')));
      body.contactTagsEnabled = form.contactTagsEnabled !== false;
      body.logoUrl = form.logoUrl || '';
      if (form.quotationApproval) body.quotationApproval = qa;
      await settingsAPI.update(body);
      setContactTagsEnabled(body.contactTagsEnabled);
      Alert.alert('Saved', 'Company settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="business-outline" title="Company Settings" onBack={() => navigation.goBack()} />
      {!form ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={BLUE} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
            {!canEdit && (
              <Text style={s.notice}>View only. Ask your admin to change company settings.</Text>
            )}

            <View style={s.card}>
              <Text style={s.cardTitle}>Company logo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={s.logoBox}>
                  {form.logoUrl ? (
                    <Image source={{ uri: form.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <Icon name="image-outline" size={26} color="#94a3b8" />
                  )}
                </View>
                {canEdit && (
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity style={s.smallBtn} onPress={pickLogo}>
                      <Text style={s.smallBtnText}>{form.logoUrl ? 'Change logo' : 'Upload logo'}</Text>
                    </TouchableOpacity>
                    {!!form.logoUrl && (
                      <TouchableOpacity onPress={() => set('logoUrl', '')}>
                        <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              <Text style={[s.muted, { marginTop: 8 }]}>Printed on quotations and invoices. Max 2 MB.</Text>
            </View>

            {SECTIONS.map(sec => (
              <View key={sec.title} style={s.card}>
                <Text style={s.cardTitle}>{sec.title}</Text>
                {sec.fields.map(([k, label, opts]) => (
                  <View key={k} style={{ marginBottom: 10 }}>
                    <Text style={s.label}>{label}</Text>
                    <TextInput
                      style={[s.input, opts?.multiline && { height: 80, textAlignVertical: 'top' }]}
                      value={form[k] ? String(form[k]) : ''}
                      onChangeText={v => set(k, v)}
                      editable={canEdit}
                      placeholderTextColor="#94a3b8"
                      {...(opts || {})}
                    />
                  </View>
                ))}
              </View>
            ))}

            <View style={s.card}>
              <Text style={s.cardTitle}>Terms & conditions</Text>
              {terms.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <Text style={[s.label, { marginTop: 12 }]}>{i + 1}.</Text>
                  <TextInput
                    style={[s.input, { flex: 1, minHeight: 44 }]}
                    value={t}
                    multiline
                    editable={canEdit}
                    onChangeText={v => setTerms(prev => prev.map((x, j) => (j === i ? v : x)))}
                  />
                  {canEdit && (
                    <TouchableOpacity onPress={() => setTerms(prev => prev.filter((_, j) => j !== i))} hitSlop={8} style={{ marginTop: 12 }}>
                      <Icon name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {canEdit && (
                <TouchableOpacity style={s.addBtn} onPress={() => setTerms(prev => [...prev, ''])}>
                  <Text style={s.addBtnText}>+ Add term</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Quotation approval</Text>
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>Quotations need approval</Text>
                  <Text style={s.muted}>A quotation can't be sent until one approver says yes.</Text>
                </View>
                <Switch value={qa.enabled} onValueChange={v => setQA({ enabled: v })} disabled={!canEdit} trackColor={{ true: BLUE }} />
              </View>
              <View style={{ opacity: qa.enabled ? 1 : 0.5 }}>
                <Text style={[s.label, { marginTop: 10 }]}>Only when total is at least (₹, 0 = all)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="numeric"
                  editable={canEdit}
                  value={qa.minTotal ? String(qa.minTotal) : ''}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  onChangeText={v => setQA({ minTotal: Number(v.replace(/\D/g, '')) || 0 })}
                />
                <Text style={[s.label, { marginTop: 10 }]}>Approvers ({qa.approvers.length}) · any one can approve</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {people.map(u => {
                    const id = String(u._id);
                    const on = qa.approvers.includes(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        disabled={!canEdit}
                        onPress={() =>
                          setQA({ approvers: on ? qa.approvers.filter((a: string) => a !== id) : [...qa.approvers, id] })
                        }
                        style={[s.pill, on && s.pillOn]}
                      >
                        <Text style={[s.pillText, on && { color: '#fff' }]}>{u.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {qa.enabled && qa.approvers.length === 0 && (
                  <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>Pick at least one approver.</Text>
                )}

                <View style={[s.switchRow, { marginTop: 14 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>Auto-send on WhatsApp after approval</Text>
                    <Text style={s.muted}>Needs an approved template with a PDF (document) header.</Text>
                  </View>
                  <Switch value={qa.autoSend.enabled} onValueChange={v => setAuto({ enabled: v })} disabled={!canEdit} trackColor={{ true: BLUE }} />
                </View>
                {qa.autoSend.enabled && (
                  <>
                    <Text style={[s.label, { marginTop: 10 }]}>Template</Text>
                    {docTemplates.length === 0 ? (
                      <Text style={s.muted}>No approved template with a document header yet.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {docTemplates.map(t => (
                          <TouchableOpacity
                            key={t._id}
                            disabled={!canEdit}
                            onPress={() => setAuto({ templateId: t._id, variableMapping: mappingFor(t) })}
                            style={[s.pill, qa.autoSend.templateId === t._id && s.pillOn]}
                          >
                            <Text style={[s.pillText, qa.autoSend.templateId === t._id && { color: '#fff' }]}>
                              {t.displayName || t.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {senders.length > 1 && (
                      <>
                        <Text style={[s.label, { marginTop: 10 }]}>Send from</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {senders.map((p: any) => (
                            <TouchableOpacity
                              key={p.phoneNumberId}
                              disabled={!canEdit}
                              onPress={() => setAuto({ phoneNumberId: p.phoneNumberId })}
                              style={[s.pill, qa.autoSend.phoneNumberId === p.phoneNumberId && s.pillOn]}
                            >
                              <Text style={[s.pillText, qa.autoSend.phoneNumberId === p.phoneNumberId && { color: '#fff' }]}>
                                {p.label || p.displayPhoneNumber || p.phoneNumber || p.phoneNumberId}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                    {qa.autoSend.variableMapping.some((m: any) => m.fieldKey === 'custom') && (
                      <>
                        <Text style={[s.label, { marginTop: 10 }]}>Fixed values for the template</Text>
                        {qa.autoSend.variableMapping
                          .filter((m: any) => m.fieldKey === 'custom')
                          .map((m: any) => (
                            <TextInput
                              key={m.position}
                              style={[s.input, { marginBottom: 6 }]}
                              editable={canEdit}
                              placeholder={`Value for {{${m.position}}}`}
                              placeholderTextColor="#94a3b8"
                              value={m.customValue}
                              onChangeText={v =>
                                setAuto({
                                  variableMapping: qa.autoSend.variableMapping.map((x: any) =>
                                    x.position === m.position ? { ...x, customValue: v } : x,
                                  ),
                                })
                              }
                            />
                          ))}
                      </>
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Leads</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>Ask for contact tag (Hot / Warm / Cold)</Text>
                  <Text style={s.muted}>When off, moving a lead to Discussion won't ask for a tag.</Text>
                </View>
                <Switch
                  value={form.contactTagsEnabled !== false}
                  onValueChange={v => set('contactTagsEnabled', v)}
                  disabled={!canEdit}
                  trackColor={{ true: BLUE }}
                />
              </View>
            </View>
          </ScrollView>

          {canEdit && (
            <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save changes</Text>}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  notice: { borderWidth: 2, borderColor: '#F59E0B', backgroundColor: '#FFF7ED', color: '#92400E', padding: 10, fontSize: 12, marginBottom: 12 },
  card: { borderWidth: 2, borderColor: '#000', padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#000', backgroundColor: '#fff' },
  rowTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
  muted: { fontSize: 12, color: '#64748b', marginTop: 2 },
  logoBox: { width: 84, height: 84, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  smallBtn: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  smallBtnText: { fontWeight: '600', color: BLUE, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  pillOn: { backgroundColor: BLUE },
  pillText: { fontSize: 12, fontWeight: '500', color: '#000' },
  addBtn: { borderWidth: 2, borderColor: '#000', borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center' },
  addBtnText: { fontWeight: '600', color: BLUE },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000' },
  saveBtn: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
