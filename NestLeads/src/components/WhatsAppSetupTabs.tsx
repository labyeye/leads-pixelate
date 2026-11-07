import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from './Icon';
import { whatsappAPI } from '../services/api';

const WEBHOOK_URL = 'https://leads-backend.pixelatenest.com/api/whatsapp/webhook';
const when = (d?: string) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

function Btn({ label, onPress, color = '#fff', text = '#000', busy, disabled }: any) {
  return (
    <TouchableOpacity
      style={[s.btn, { backgroundColor: color }, (busy || disabled) && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator size="small" color={text} /> : <Text style={[s.btnText, { color: text }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ─── Connection: status, numbers, connect / disconnect, automatic messages ───
export function ConnectionTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [token, setToken] = useState('');
  const [waba, setWaba] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({ phoneNumberId: '', label: '', businessName: '', phoneNumber: '' });
  const [rows, setRows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [st, au, tp] = await Promise.allSettled([
        whatsappAPI.getStatus(),
        whatsappAPI.getAutomations(),
        whatsappAPI.getTemplates(),
      ]);
      if (st.status === 'fulfilled') setStatus(st.value.data);
      if (au.status === 'fulfilled') setRows(au.value.data || []);
      if (tp.status === 'fulfilled') setTemplates((tp.value.data || []).filter((x: any) => x.status === 'APPROVED'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) Alert.alert(ok);
      return r;
    } catch (e: any) {
      Alert.alert('Failed', e?.message || '');
    } finally {
      setBusy('');
    }
  };

  const connect = async () => {
    if (!token.trim() || !waba.trim()) return Alert.alert('Access Token and WABA ID are both required');
    const r = await run('connect', () => whatsappAPI.setup({ accessToken: token.trim(), wabaId: waba.trim() }));
    if (r) {
      if (r.data?.warning) Alert.alert('Connected with a warning', r.data.warning);
      else {
        await whatsappAPI.syncTemplates().catch(() => null);
        Alert.alert('WhatsApp connected', `${r.data?.added ?? 0} number(s) added, templates synced.`);
      }
      setToken('');
      setWaba('');
      load();
    }
  };

  const addPhone = async () => {
    if (!add.phoneNumberId.trim()) return Alert.alert('Phone Number ID is required');
    const r = await run('add', () => whatsappAPI.addPhoneNumber(add), 'Phone number added');
    if (r) {
      setAdd({ phoneNumberId: '', label: '', businessName: '', phoneNumber: '' });
      setShowAdd(false);
      load();
    }
  };

  const confirm = (title: string, msg: string, fn: () => void) =>
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: fn },
    ]);

  const saveAuto = () =>
    run(
      'auto',
      () =>
        whatsappAPI.saveAutomations(
          Object.fromEntries(rows.map(r => [r.id, { enabled: r.enabled, templateId: r.templateId }])),
        ),
      'Automatic messages saved',
    );

  const patch = (id: string, p: object) => setRows(r => r.map(x => (x.id === id ? { ...x, ...p } : x)));
  const nextTemplate = (r: any) => {
    const ids = ['', ...templates.map(t => t._id)];
    patch(r.id, { templateId: ids[(ids.indexOf(r.templateId || '') + 1) % ids.length] });
  };
  const tname = (id: string) => templates.find(t => t._id === id)?.displayName || 'Plain text (24-hour window only)';

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#024BAB" />
      </View>
    );

  const connected = !!status?.connected;
  const numbers: any[] = status?.phoneNumbers || [];

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <View style={[s.card, { backgroundColor: connected ? '#f0fdf4' : '#fef2f2' }]}>
        <Icon name={connected ? 'checkmark-circle' : 'close-circle'} size={22} color={connected ? '#22c55e' : '#EF4444'} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{connected ? 'Connected' : 'Not connected'}</Text>
          <Text style={s.sub}>
            {connected ? 'Messages go from your own WhatsApp Business number.' : 'Add your Meta access token and WABA ID below.'}
          </Text>
        </View>
      </View>

      <Text style={s.section}>Phone numbers ({numbers.length})</Text>
      {numbers.map((p: any, i: number) => (
        <View key={p.phoneNumberId || i} style={s.row}>
          <Icon name="call-outline" size={16} color="#024BAB" />
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>
              {p.label || p.businessName || p.displayPhoneNumber || p.phoneNumber}
            </Text>
            <Text style={s.sub} numberOfLines={1}>
              {p.displayPhoneNumber || p.phoneNumber || ''} · ID {p.phoneNumberId}
            </Text>
          </View>
          {canManage && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() =>
                confirm('Remove number', 'Remove this number?', () =>
                  run('rm' + p.phoneNumberId, () => whatsappAPI.removePhoneNumber(p.phoneNumberId)).then(load),
                )
              }
            >
              <Icon name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {numbers.length === 0 && <Text style={s.sub}>No numbers yet.</Text>}

      {canManage && (
        <>
          <View style={s.btnRow}>
            {connected && (
              <Btn
                label="Fetch numbers"
                busy={busy === 'fetch'}
                onPress={() =>
                  run('fetch', () => whatsappAPI.syncPhoneNumbers()).then(r => {
                    if (r) Alert.alert(r.data.added ? `${r.data.added} new number(s) added` : 'No new numbers found');
                    load();
                  })
                }
              />
            )}
            <Btn label={showAdd ? 'Cancel' : '+ Add number'} onPress={() => setShowAdd(v => !v)} />
          </View>
          {showAdd && (
            <View style={s.form}>
              {([
                ['phoneNumberId', 'Phone Number ID *'],
                ['label', 'Label'],
                ['businessName', 'Business name'],
                ['phoneNumber', 'Phone number'],
              ] as const).map(([k, ph]) => (
                <TextInput
                  key={k}
                  style={s.input}
                  placeholder={ph}
                  placeholderTextColor="#94a3b8"
                  value={(add as any)[k]}
                  onChangeText={v => setAdd(a => ({ ...a, [k]: v }))}
                  autoCapitalize="none"
                />
              ))}
              <Btn label="Save number" color="#FF751F" text="#fff" busy={busy === 'add'} onPress={addPhone} />
            </View>
          )}

          <Text style={s.section}>{connected ? 'Reconnect with a new token' : 'Connect WhatsApp'}</Text>
          <View style={s.form}>
            <TextInput
              style={s.input}
              placeholder="Permanent access token"
              placeholderTextColor="#94a3b8"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={s.input}
              placeholder="WhatsApp Business Account (WABA) ID"
              placeholderTextColor="#94a3b8"
              value={waba}
              onChangeText={setWaba}
              autoCapitalize="none"
              keyboardType="number-pad"
            />
            <Btn label="Connect" color="#25D366" text="#fff" busy={busy === 'connect'} onPress={connect} />
          </View>

          <Text style={s.section}>Webhook URL</Text>
          <Text style={s.mono} selectable>
            {WEBHOOK_URL}
          </Text>
          <Text style={s.sub}>Paste this in Meta, WhatsApp, Configuration, Callback URL (long-press to copy).</Text>
        </>
      )}

      <Text style={s.section}>Automatic messages</Text>
      <Text style={s.sub}>
        Sent from your own number. Pick an approved template so the message reaches anyone; plain text only reaches
        people who messaged you in the last 24 hours.
      </Text>
      {rows.map(r => (
        <View key={r.id} style={s.autoRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch
              value={!!r.enabled}
              disabled={!canManage}
              onValueChange={v => patch(r.id, { enabled: v })}
              trackColor={{ true: '#25D366', false: '#d1d5db' }}
            />
            <Text style={[s.title, { flex: 1 }]}>{r.label}</Text>
          </View>
          <TouchableOpacity disabled={!canManage} style={s.pick} onPress={() => nextTemplate(r)}>
            <Text style={s.pickText} numberOfLines={1}>
              {tname(r.templateId)}
            </Text>
            <Icon name="swap-horizontal" size={14} color="#64748b" />
          </TouchableOpacity>
          {!!r.vars?.length && (
            <Text style={s.sub}>{r.vars.map((v: string, i: number) => `{{${i + 1}}} ${v}`).join(' · ')}</Text>
          )}
        </View>
      ))}
      {canManage && rows.length > 0 && (
        <Btn label="Save automatic messages" color="#FF751F" text="#fff" busy={busy === 'auto'} onPress={saveAuto} />
      )}

      {canManage && connected && (
        <View style={{ marginTop: 20 }}>
          <Btn
            label="Disconnect WhatsApp"
            color="#fff"
            text="#dc2626"
            busy={busy === 'dc'}
            onPress={() =>
              confirm('Disconnect WhatsApp', 'Campaigns and automatic messages will stop.', () =>
                run('dc', () => whatsappAPI.disconnect(), 'WhatsApp disconnected').then(load),
              )
            }
          />
        </View>
      )}
    </ScrollView>
  );
}

// ─── Analytics: campaign delivery funnel, tap one for per-lead status ───
export function AnalyticsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async (r = false) => {
    try {
      if (r) setRefreshing(true);
      const res = await whatsappAPI.getCampaigns();
      setList(res.data || []);
    } catch (e: any) {
      Alert.alert("Couldn't load campaigns", e?.message || '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    try {
      setDetail((await whatsappAPI.getCampaign(id)).data);
    } catch {
      /* keep summary */
    }
  };

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#024BAB" />
      </View>
    );

  return (
    <ScrollView
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#024BAB" />}
    >
      {list.length === 0 && <Text style={s.empty}>No campaigns yet.</Text>}
      {list.map(c => {
        const pct = c.totalCount > 0 ? Math.round((c.deliveredCount / c.totalCount) * 100) : 0;
        return (
          <View key={c._id} style={s.camp}>
            <TouchableOpacity onPress={() => toggle(c._id)} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={s.badge}>{c.status}</Text>
              </View>
              <Text style={s.sub}>
                {(c.templateSnapshot || c.template)?.displayName || 'Template'} · {when(c.sentAt || c.createdAt)}
              </Text>
              <View style={s.stats}>
                {[
                  ['Total', c.totalCount, '#4b5563'],
                  ['Sent', c.sentCount, '#2563eb'],
                  ['Delivered', c.deliveredCount, '#16a34a'],
                  ['Read', c.readCount, '#9333ea'],
                  ['Failed', c.failedCount, '#ef4444'],
                  ['Replies', c.repliedCount, '#f97316'],
                ].map(([l, v, col]: any) => (
                  <View key={l} style={s.stat}>
                    <Text style={[s.statNum, { color: col }]}>{v ?? 0}</Text>
                    <Text style={s.statLbl}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={s.bar}>
                <View style={{ width: `${pct}%`, backgroundColor: '#16a34a', height: '100%' }} />
              </View>
              <Text style={s.sub}>{pct}% delivered</Text>
            </TouchableOpacity>

            {openId === c._id && (
              <View style={s.detail}>
                {!detail ? (
                  <ActivityIndicator color="#024BAB" />
                ) : (
                  <>
                    {(detail.messages || []).map((m: any) => (
                      <View key={m._id} style={s.msgRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.title} numberOfLines={1}>
                            {m.leadName || m.phone}
                          </Text>
                          <Text style={s.sub} numberOfLines={1}>
                            {m.leadCompany ? `${m.leadCompany} · ` : ''}
                            {m.phone}
                          </Text>
                          {!!m.errorMessage && (
                            <Text style={[s.sub, { color: '#ef4444' }]} numberOfLines={2}>
                              {m.errorMessage}
                            </Text>
                          )}
                        </View>
                        <Text style={s.badge}>{m.status}</Text>
                      </View>
                    ))}
                    {(detail.failedCount || 0) > 0 && (
                      <Btn
                        label="Resend failed"
                        onPress={() =>
                          whatsappAPI
                            .resendCampaign(c._id)
                            .then(r => Alert.alert(`Resending ${r.data?.resending ?? 0} message(s)`))
                            .catch((e: any) => Alert.alert('Failed', e?.message || ''))
                        }
                      />
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Replies: what leads answered to campaigns ───
export function RepliesTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = false) => {
    try {
      if (r) setRefreshing(true);
      setList((await whatsappAPI.getReplies()).data || []);
    } catch (e: any) {
      Alert.alert("Couldn't load replies", e?.message || '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#024BAB" />
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#024BAB" />}
    >
      {list.length === 0 && <Text style={s.empty}>No replies yet. They appear when leads answer your campaigns.</Text>}
      {list.map(r => (
        <View key={r._id} style={s.camp}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>
              {r.leadName || r.phone}
            </Text>
            <Text style={s.sub}>{when(r.receivedAt)}</Text>
          </View>
          <Text style={s.sub}>
            {r.phone} · Campaign: {r.campaignName}
          </Text>
          <View style={s.bubble}>
            <Text style={{ fontSize: 14, color: '#111' }}>{r.messageText}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const b = { borderWidth: 2, borderColor: '#000', borderRadius: 8 } as const;
const s = StyleSheet.create({
  pad: { padding: 12, gap: 10, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, ...b },
  title: { fontSize: 14, fontWeight: '500', color: '#000' },
  sub: { fontSize: 12, color: '#64748b' },
  section: { fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, ...b },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRightWidth: 4, borderBottomWidth: 4, ...b },
  btnText: { fontSize: 13, fontWeight: '500' },
  form: { gap: 8 },
  input: { padding: 10, fontSize: 14, color: '#000', ...b },
  mono: { fontSize: 12, color: '#000', padding: 10, backgroundColor: '#f8fafc', ...b },
  autoRow: { gap: 6, padding: 10, ...b },
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', ...b },
  pickText: { flex: 1, fontSize: 13, color: '#000' },
  empty: { textAlign: 'center', color: '#64748b', paddingTop: 40, paddingHorizontal: 20 },
  camp: { padding: 12, gap: 4, borderRightWidth: 4, borderBottomWidth: 4, ...b },
  badge: { fontSize: 10, fontWeight: '600', color: '#000', borderWidth: 1, borderColor: '#000', paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 16, fontWeight: '600' },
  statLbl: { fontSize: 10, color: '#64748b' },
  bar: { height: 6, borderWidth: 1, borderColor: '#000', backgroundColor: '#f1f5f9', marginTop: 8 },
  detail: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubble: { marginTop: 6, padding: 10, backgroundColor: '#dcfce7', borderRadius: 8 },
});
