import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { funnelsAPI, usersAPI, whatsappAPI } from '../services/api';
import { ALL_STATUSES } from '../constants/statusConstants';

const BLUE = '#024BAB';
const SOURCES = ['IndiaMART', 'TradeIndia', 'Justdial', 'Website', 'Manual', 'Facebook', 'Instagram', 'Meta', 'Google Ads', 'LinkedIn'];
const FIELDS = [
  ['name', 'Name'],
  ['company', 'Company'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['requirement', 'Requirement'],
  ['budget', 'Budget'],
  ['custom', 'Custom'],
] as const;
const PERF_FIELDS = [
  ['name', 'Team member'],
  ['perf_period', 'Period'],
  ['perf_new', 'New leads'],
  ['perf_won', 'Won'],
  ['perf_dropped', 'Dropped'],
  ['perf_pending', 'Pending contact'],
  ['perf_active', 'Open leads'],
  ['perf_followups', 'Follow-ups due'],
  ['perf_winrate', 'Win rate'],
  ['custom', 'Custom'],
] as const;
const ROLES = [
  ['admin', 'Admins'],
  ['sales_executive', 'Sales executives'],
  ['service_manager', 'Service managers'],
  ['accountant', 'Accountants'],
] as const;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UNIT_MIN = { minutes: 1, hours: 60, days: 1440 } as const;
type Unit = keyof typeof UNIT_MIN;

interface Step {
  delayValue: string;
  delayUnit: Unit;
  templateId: string;
  variableMapping: { position: number; fieldKey: string; customValue: string }[];
  onlyIfStatus: string;
}
interface Draft {
  id?: string;
  name: string;
  audience: 'leads' | 'staff';
  event: 'lead_created' | 'status_changed' | 'schedule' | 'manual';
  status: string;
  staffTarget: 'all' | 'roles' | 'selected';
  staffRoles: string[];
  staffUserIds: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: string;
  minute: string;
  weekday: number;
  dayOfMonth: string;
  sources: string[];
  steps: Step[];
  stopStatuses: string[];
  enabled: boolean;
}

const pretty = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const toDelay = (m: number): Pick<Step, 'delayValue' | 'delayUnit'> =>
  m && m % 1440 === 0
    ? { delayValue: String(m / 1440), delayUnit: 'days' }
    : m && m % 60 === 0
      ? { delayValue: String(m / 60), delayUnit: 'hours' }
      : { delayValue: String(m), delayUnit: 'minutes' };
const delayText = (m: number) =>
  m === 0 ? 'right away' : m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? '' : 's'}` : m % 60 === 0 ? `${m / 60} hr` : `${m} min`;
const blankStep = (): Step => ({ delayValue: '0', delayUnit: 'minutes', templateId: '', variableMapping: [], onlyIfStatus: '' });
const blankDraft = (): Draft => ({
  name: '',
  audience: 'leads',
  event: 'lead_created',
  status: '',
  staffTarget: 'all',
  staffRoles: [],
  staffUserIds: [],
  frequency: 'daily',
  hour: '9',
  minute: '0',
  weekday: 1,
  dayOfMonth: '1',
  sources: [],
  steps: [blankStep()],
  stopStatuses: ['WON', 'DROP'],
  enabled: false,
});

const pad2 = (n: any) => String(n).padStart(2, '0');
const whenText = (f: any) => {
  const e = f.trigger.event;
  if (e === 'manual') return 'you tap Send now';
  if (e === 'schedule') {
    const sc = f.schedule || {};
    const at = `${pad2(sc.hour ?? 9)}:${pad2(sc.minute ?? 0)}`;
    return sc.frequency === 'weekly'
      ? `every ${WEEKDAYS[sc.weekday ?? 1]} at ${at}`
      : sc.frequency === 'monthly'
        ? `day ${sc.dayOfMonth ?? 1} of every month at ${at}`
        : `every day at ${at}`;
  }
  return e === 'lead_created' ? 'a new lead arrives' : f.trigger.status ? `a lead moves to ${pretty(f.trigger.status)}` : "a lead's status changes";
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FunnelsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [funnels, setFunnels] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<{ cards: any; recent: any[] } | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [activity, setActivity] = useState<{ name: string; rows: any[] | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([funnelsAPI.list(), funnelsAPI.overview().catch(() => null)]);
      setFunnels(r.data || []);
      if (o) setOverview(o.data);
    } catch (e: any) {
      Alert.alert("Couldn't load funnels", e?.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    whatsappAPI
      .getTemplates()
      .then(r => setTemplates((r.data || []).filter((t: any) => t.status === 'APPROVED')))
      .catch(() => {});
    usersAPI
      .getAll()
      .then(r => setTeam((r.data || []).filter((u: any) => u.status !== 'inactive')))
      .catch(() => {});
  }, [load, isAdmin]);

  const tpl = (id: string) => templates.find(t => t._id === id);

  const edit = (f: any) =>
    setDraft({
      id: f._id,
      name: f.name,
      audience: f.audience || 'leads',
      event: f.trigger.event,
      status: f.trigger.status || '',
      staffTarget: f.staff?.target || 'all',
      staffRoles: f.staff?.roles || [],
      staffUserIds: (f.staff?.userIds || []).map(String),
      frequency: f.schedule?.frequency || 'daily',
      hour: String(f.schedule?.hour ?? 9),
      minute: String(f.schedule?.minute ?? 0),
      weekday: f.schedule?.weekday ?? 1,
      dayOfMonth: String(f.schedule?.dayOfMonth ?? 1),
      sources: f.trigger.sources || [],
      stopStatuses: f.stopStatuses || [],
      enabled: f.enabled,
      steps: f.steps.map((st: any) => ({
        ...toDelay(st.delayMinutes),
        templateId: String(st.templateId),
        variableMapping: (st.variableMapping || []).map((v: any) => ({
          position: v.position,
          fieldKey: v.fieldKey,
          customValue: v.customValue || '',
        })),
        onlyIfStatus: st.onlyIfStatus || '',
      })),
    });

  const patchStep = (i: number, patch: Partial<Step>) =>
    setDraft(d => d && { ...d, steps: d.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) });

  const pickTemplate = (i: number, id: string) => {
    const t = tpl(id);
    patchStep(i, {
      templateId: id,
      variableMapping: Array.from({ length: t?.variableCount || 0 }, (_, k) => ({
        position: k + 1,
        fieldKey: k === 0 ? 'name' : draft?.audience === 'staff' ? 'perf_new' : 'custom',
        customValue: '',
      })),
    });
  };

  const valid =
    !!draft &&
    !!draft.name.trim() &&
    draft.steps.every(st => st.templateId) &&
    (draft.audience !== 'staff' || draft.staffTarget !== 'roles' || draft.staffRoles.length > 0) &&
    (draft.audience !== 'staff' || draft.staffTarget !== 'selected' || draft.staffUserIds.length > 0);

  const save = async () => {
    if (!draft) return;
    const body = {
      name: draft.name,
      enabled: draft.enabled,
      audience: draft.audience,
      staff: { target: draft.staffTarget, roles: draft.staffRoles, userIds: draft.staffUserIds },
      schedule: {
        frequency: draft.frequency,
        hour: Number(draft.hour) || 0,
        minute: Number(draft.minute) || 0,
        weekday: draft.weekday,
        dayOfMonth: Number(draft.dayOfMonth) || 1,
      },
      trigger: { event: draft.event, status: draft.status, sources: draft.sources },
      stopStatuses: draft.stopStatuses,
      steps: draft.steps.map(st => ({
        delayMinutes: Math.round((Number(st.delayValue) || 0) * UNIT_MIN[st.delayUnit]),
        templateId: st.templateId,
        variableMapping: st.variableMapping,
        onlyIfStatus: st.onlyIfStatus,
      })),
    };
    setSaving(true);
    try {
      if (draft.id) await funnelsAPI.update(draft.id, body);
      else await funnelsAPI.create(body);
      setDraft(null);
      load();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (f: any, enabled: boolean) => {
    setFunnels(list => list.map(x => (x._id === f._id ? { ...x, enabled } : x)));
    try {
      await funnelsAPI.update(f._id, {
        name: f.name,
        enabled,
        audience: f.audience,
        staff: f.staff,
        schedule: f.schedule,
        trigger: f.trigger,
        stopStatuses: f.stopStatuses,
        steps: f.steps,
      });
    } catch (e: any) {
      Alert.alert("Couldn't change it", e?.message || '');
      load();
    }
  };

  const remove = (f: any) =>
    Alert.alert('Delete funnel', `Delete "${f.name}"? Messages still waiting will be cancelled.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await funnelsAPI.remove(f._id);
            load();
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message || '');
          }
        },
      },
    ]);

  const sendNow = (f: any) =>
    Alert.alert('Send now', `Send "${f.name}" to the team now?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            const r = await funnelsAPI.run(f._id);
            Alert.alert('Queued', `Going out to ${r.data.people} team member(s) within a minute.`);
            load();
          } catch (e: any) {
            Alert.alert("Couldn't send", e?.message || '');
          }
        },
      },
    ]);

  const openActivity = async (f: any) => {
    setActivity({ name: f.name, rows: null });
    try {
      const r = await funnelsAPI.jobs(f._id);
      setActivity({ name: f.name, rows: r.data || [] });
    } catch {
      setActivity({ name: f.name, rows: [] });
    }
  };

  const Header = (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.title}>Auto Funnels</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={() => setDraft(blankDraft())} style={[s.iconBtn, { backgroundColor: BLUE }]}>
            <Icon name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn} />
        )}
      </View>
      <View style={s.divider} />
    </>
  );

  if (!isAdmin) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {Header}
        <View style={s.center}>
          <Icon name="lock-closed-outline" size={28} color="#94a3b8" />
          <Text style={s.muted}>Admins only</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {Header}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={BLUE} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <Text style={s.intro}>
            Send WhatsApp templates to leads when something happens, or to your team on a schedule (like a performance report).
          </Text>
          {overview && (
            <View style={s.cards}>
              {[
                ['Funnels', `${overview.cards.active}/${overview.cards.funnels}`, 'active / total', false],
                ['Sent today', overview.cards.sentToday, `${overview.cards.sent} in total`, false],
                ['Delivery', `${overview.cards.deliveryRate}%`, `${overview.cards.failed} failed`, overview.cards.failed > 0],
                ['Waiting', overview.cards.waiting, 'queued', false],
                ['To team', overview.cards.toStaff, 'staff messages', false],
                ['To leads', overview.cards.toLeads, 'lead messages', false],
              ].map(([label, value, hint, bad]) => (
                <View key={label as string} style={s.sumCard}>
                  <Text style={s.statLabel}>{label}</Text>
                  <Text style={[s.sumVal, !!bad && { color: '#dc2626' }]}>{value}</Text>
                  <Text style={s.muted}>{hint}</Text>
                </View>
              ))}
            </View>
          )}
          {funnels.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No funnels yet</Text>
              <Text style={s.muted}>
                Example: when a new lead arrives send a welcome template, and a reminder after 1 day if they are still Pending Contact. Tap + to start.
              </Text>
            </View>
          )}
          {funnels.map(f => (
            <View key={f._id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{f.name}</Text>
                  <Text style={s.muted}>
                    {f.audience === 'staff' ? 'Team' : 'Leads'} · Starts when {whenText(f)}
                    {f.audience === 'staff'
                      ? ` · ${f.staff?.target === 'roles' ? (f.staff.roles || []).map(pretty).join(', ') : f.staff?.target === 'selected' ? `${f.staff.userIds?.length || 0} selected` : 'everyone'}`
                      : f.trigger.sources?.length
                        ? ` · only ${f.trigger.sources.join(', ')}`
                        : ''}
                  </Text>
                </View>
                <Switch value={f.enabled} onValueChange={v => toggle(f, v)} />
              </View>
              {f.steps.map((st: any, i: number) => (
                <Text key={st._id || i} style={s.stepLine}>
                  {i + 1}. {tpl(String(st.templateId))?.displayName || 'Template'} · {i === 0 && st.delayMinutes === 0 ? 'right away' : `after ${delayText(st.delayMinutes)}`}
                  {st.onlyIfStatus ? ` · if still ${pretty(st.onlyIfStatus)}` : ''}
                </Text>
              ))}
              <View style={s.stats}>
                {[
                  ['Started', f.stats?.enrolled || 0],
                  ['Sent', f.stats?.sent || 0],
                  ['Failed', f.stats?.failed || 0],
                  ['Waiting', f.queued || 0],
                ].map(([label, n]) => (
                  <View key={label as string} style={s.stat}>
                    <Text style={[s.statVal, label === 'Failed' && Number(n) > 0 && { color: '#dc2626' }]}>{n}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={s.actions}>
                {f.audience === 'staff' && (
                  <TouchableOpacity style={s.btn} onPress={() => sendNow(f)}>
                    <Text style={s.btnText}>Send now</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.btn} onPress={() => openActivity(f)}>
                  <Text style={s.btnText}>Activity</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btn} onPress={() => edit(f)}>
                  <Text style={s.btnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { borderColor: '#dc2626' }]} onPress={() => remove(f)}>
                  <Text style={[s.btnText, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {overview && (
            <View style={[s.card, { marginTop: 4 }]}>
              <Text style={s.cardTitle}>Recent messages</Text>
              {overview.recent.length === 0 && <Text style={s.muted}>Nothing has been sent yet.</Text>}
              {overview.recent.map(j => (
                <View key={j._id} style={s.tRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#000' }} numberOfLines={1}>
                      {j.recipient} · {j.audience === 'staff' ? 'Team' : 'Lead'}
                    </Text>
                    <Text style={s.muted} numberOfLines={1}>
                      {j.funnelName || 'Deleted funnel'} · msg {j.stepIndex + 1}
                      {j.phone ? ` · ${j.phone}` : ''}
                    </Text>
                    {j.status === 'failed' && !!j.note && (
                      <Text style={{ color: '#dc2626', fontSize: 11 }} numberOfLines={2}>
                        {j.note}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[s.jobStatus, { width: 62 }, j.status === 'sent' && { backgroundColor: '#bbf7d0' }, j.status === 'failed' && { backgroundColor: '#fecaca' }]}>
                      {j.status}
                    </Text>
                    <Text style={s.muted}>
                      {new Date(j.sentAt || j.runAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* editor */}
      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <View style={[s.container, { paddingTop: insets.top }]}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setDraft(null)} style={s.iconBtn}>
              <Icon name="close" size={18} color="#000" />
            </TouchableOpacity>
            <Text style={s.title}>{draft?.id ? 'Edit funnel' : 'New funnel'}</Text>
            <TouchableOpacity
              onPress={save}
              disabled={!valid || saving}
              style={[s.saveBtn, (!valid || saving) && { opacity: 0.4 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{saving ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.divider} />
          {draft && (
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={v => setDraft({ ...draft, name: v })}
                placeholder="e.g. New lead welcome"
                placeholderTextColor="#94a3b8"
                maxLength={80}
                style={s.input}
              />

              <Text style={s.section}>Who gets the messages?</Text>
              <View style={s.chips}>
                {([['leads', 'Leads'], ['staff', 'My team']] as const).map(([v, label]) => (
                  <Chip
                    key={v}
                    label={label}
                    on={draft.audience === v}
                    onPress={() =>
                      draft.audience !== v &&
                      setDraft({
                        ...draft,
                        audience: v,
                        event: v === 'staff' ? 'schedule' : 'lead_created',
                        steps: draft.steps.map(st => ({ ...st, templateId: '', variableMapping: [], onlyIfStatus: '' })),
                      })
                    }
                  />
                ))}
              </View>
              {draft.audience === 'staff' && (
                <Text style={s.label}>Each member gets their own numbers filled into the template. They need a phone number on their profile.</Text>
              )}

              <Text style={s.section}>1 · When does it start?</Text>
              {draft.audience === 'staff' ? (
                <>
                  <View style={s.chips}>
                    <Chip label="On a schedule" on={draft.event === 'schedule'} onPress={() => setDraft({ ...draft, event: 'schedule' })} />
                    <Chip label="Only when I tap Send now" on={draft.event === 'manual'} onPress={() => setDraft({ ...draft, event: 'manual' })} />
                  </View>
                  {draft.event === 'schedule' && (
                    <>
                      <Text style={s.label}>How often (also sets the period of the numbers)</Text>
                      <View style={s.chips}>
                        <Chip label="Daily · today" on={draft.frequency === 'daily'} onPress={() => setDraft({ ...draft, frequency: 'daily' })} />
                        <Chip label="Weekly · last 7 days" on={draft.frequency === 'weekly'} onPress={() => setDraft({ ...draft, frequency: 'weekly' })} />
                        <Chip label="Monthly · month so far" on={draft.frequency === 'monthly'} onPress={() => setDraft({ ...draft, frequency: 'monthly' })} />
                      </View>
                      {draft.frequency === 'weekly' && (
                        <>
                          <Text style={s.label}>On</Text>
                          <View style={s.chips}>
                            {WEEKDAYS.map((d, i) => (
                              <Chip key={d} label={d.slice(0, 3)} on={draft.weekday === i} onPress={() => setDraft({ ...draft, weekday: i })} />
                            ))}
                          </View>
                        </>
                      )}
                      {draft.frequency === 'monthly' && (
                        <>
                          <Text style={s.label}>Day of the month (1-28)</Text>
                          <TextInput
                            value={draft.dayOfMonth}
                            onChangeText={v => setDraft({ ...draft, dayOfMonth: v.replace(/\D/g, '').slice(0, 2) })}
                            keyboardType="number-pad"
                            style={[s.input, { width: 80 }]}
                          />
                        </>
                      )}
                      <Text style={s.label}>At (24-hour, hour : minute)</Text>
                      <View style={s.row}>
                        <TextInput
                          value={draft.hour}
                          onChangeText={v => setDraft({ ...draft, hour: v.replace(/\D/g, '').slice(0, 2) })}
                          keyboardType="number-pad"
                          style={[s.input, { width: 70 }]}
                        />
                        <Text style={s.cardTitle}>:</Text>
                        <TextInput
                          value={draft.minute}
                          onChangeText={v => setDraft({ ...draft, minute: v.replace(/\D/g, '').slice(0, 2) })}
                          keyboardType="number-pad"
                          style={[s.input, { width: 70 }]}
                        />
                        <View style={{ flex: 1 }} />
                      </View>
                    </>
                  )}
                  <Text style={s.label}>Send to</Text>
                  <View style={s.chips}>
                    <Chip label="Everyone" on={draft.staffTarget === 'all'} onPress={() => setDraft({ ...draft, staffTarget: 'all' })} />
                    <Chip label="By role" on={draft.staffTarget === 'roles'} onPress={() => setDraft({ ...draft, staffTarget: 'roles' })} />
                    <Chip label="Pick people" on={draft.staffTarget === 'selected'} onPress={() => setDraft({ ...draft, staffTarget: 'selected' })} />
                  </View>
                  {draft.staffTarget === 'roles' && (
                    <View style={[s.chips, { marginTop: 6 }]}>
                      {ROLES.map(([r, label]) => (
                        <Chip
                          key={r}
                          label={label}
                          on={draft.staffRoles.includes(r)}
                          onPress={() =>
                            setDraft({ ...draft, staffRoles: draft.staffRoles.includes(r) ? draft.staffRoles.filter(x => x !== r) : [...draft.staffRoles, r] })
                          }
                        />
                      ))}
                    </View>
                  )}
                  {draft.staffTarget === 'selected' && (
                    <View style={[s.chips, { marginTop: 6 }]}>
                      {team.map(u => (
                        <Chip
                          key={u._id}
                          label={u.phone ? u.name : `${u.name} (no phone)`}
                          on={draft.staffUserIds.includes(u._id)}
                          onPress={() =>
                            setDraft({
                              ...draft,
                              staffUserIds: draft.staffUserIds.includes(u._id) ? draft.staffUserIds.filter(x => x !== u._id) : [...draft.staffUserIds, u._id],
                            })
                          }
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : (
              <>
              <View style={s.chips}>
                <Chip label="A new lead arrives" on={draft.event === 'lead_created'} onPress={() => setDraft({ ...draft, event: 'lead_created', status: '' })} />
                <Chip label="A lead's status changes" on={draft.event === 'status_changed'} onPress={() => setDraft({ ...draft, event: 'status_changed' })} />
              </View>
              {draft.event === 'status_changed' && (
                <>
                  <Text style={s.label}>…to which status?</Text>
                  <View style={s.chips}>
                    <Chip label="Any status" on={draft.status === ''} onPress={() => setDraft({ ...draft, status: '' })} />
                    {ALL_STATUSES.map(st => (
                      <Chip key={st} label={pretty(st)} on={draft.status === st} onPress={() => setDraft({ ...draft, status: st })} />
                    ))}
                  </View>
                </>
              )}
              <Text style={s.label}>Only these sources (none = all)</Text>
              <View style={s.chips}>
                {SOURCES.map(src => (
                  <Chip
                    key={src}
                    label={src}
                    on={draft.sources.includes(src)}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        sources: draft.sources.includes(src) ? draft.sources.filter(x => x !== src) : [...draft.sources, src],
                      })
                    }
                  />
                ))}
              </View>
              </>
              )}

              <Text style={s.section}>2 · What gets sent?</Text>
              {templates.length === 0 && <Text style={{ color: '#dc2626', fontSize: 12 }}>No approved WhatsApp templates yet. Create one in WhatsApp Setup first.</Text>}
              {draft.steps.map((st, i) => (
                <View key={i} style={s.stepBox}>
                  <View style={s.row}>
                    <Text style={s.cardTitle}>Message {i + 1}</Text>
                    {draft.steps.length > 1 && (
                      <TouchableOpacity onPress={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}>
                        <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={s.label}>Send after {i === 0 ? 'it starts' : 'the previous message'}</Text>
                  <View style={s.row}>
                    <TextInput
                      value={st.delayValue}
                      onChangeText={v => patchStep(i, { delayValue: v.replace(/\D/g, '') })}
                      keyboardType="number-pad"
                      style={[s.input, { width: 70, marginRight: 8 }]}
                    />
                    <View style={[s.chips, { flex: 1 }]}>
                      {(['minutes', 'hours', 'days'] as Unit[]).map(u => (
                        <Chip key={u} label={u} on={st.delayUnit === u} onPress={() => patchStep(i, { delayUnit: u })} />
                      ))}
                    </View>
                  </View>
                  <Text style={s.label}>Template</Text>
                  {templates.map(t => (
                    <TouchableOpacity key={t._id} onPress={() => pickTemplate(i, t._id)} style={[s.tplRow, st.templateId === t._id && s.tplRowOn]}>
                      <Text style={{ fontWeight: '700', color: '#000', fontSize: 13 }}>{t.displayName}</Text>
                      <Text numberOfLines={2} style={s.muted}>
                        {t.bodyText}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {st.variableMapping.map((v, k) => (
                    <View key={v.position} style={{ marginTop: 6 }}>
                      <Text style={s.label}>{`{{${v.position}}} is`}</Text>
                      <View style={s.chips}>
                        {(draft.audience === 'staff' ? PERF_FIELDS : FIELDS).map(([key, label]) => (
                          <Chip
                            key={key}
                            label={label}
                            on={v.fieldKey === key}
                            onPress={() =>
                              patchStep(i, { variableMapping: st.variableMapping.map((m, j) => (j === k ? { ...m, fieldKey: key } : m)) })
                            }
                          />
                        ))}
                      </View>
                      {v.fieldKey === 'custom' && (
                        <TextInput
                          value={v.customValue}
                          onChangeText={t =>
                            patchStep(i, { variableMapping: st.variableMapping.map((m, j) => (j === k ? { ...m, customValue: t } : m)) })
                          }
                          placeholder="Text to send"
                          placeholderTextColor="#94a3b8"
                          style={[s.input, { marginTop: 6 }]}
                        />
                      )}
                    </View>
                  ))}
                  {i > 0 && draft.audience === 'leads' && (
                    <>
                      <Text style={s.label}>Only if the lead is still…</Text>
                      <View style={s.chips}>
                        <Chip label="In any status" on={st.onlyIfStatus === ''} onPress={() => patchStep(i, { onlyIfStatus: '' })} />
                        {ALL_STATUSES.map(x => (
                          <Chip key={x} label={pretty(x)} on={st.onlyIfStatus === x} onPress={() => patchStep(i, { onlyIfStatus: x })} />
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ))}
              {draft.steps.length < 8 && (
                <TouchableOpacity
                  style={[s.btn, { alignSelf: 'flex-start', marginTop: 8 }]}
                  onPress={() => setDraft({ ...draft, steps: [...draft.steps, { ...blankStep(), delayValue: '1', delayUnit: 'days' }] })}
                >
                  <Text style={s.btnText}>+ Add another message</Text>
                </TouchableOpacity>
              )}

              {draft.audience === 'leads' && (
              <>
              <Text style={s.section}>3 · When should it stop?</Text>
              <View style={s.chips}>
                {[
                  ['WON', 'Lead becomes a client'],
                  ['DROP', 'Lead is dropped'],
                ].map(([st, label]) => (
                  <Chip
                    key={st}
                    label={label}
                    on={draft.stopStatuses.includes(st)}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        stopStatuses: draft.stopStatuses.includes(st) ? draft.stopStatuses.filter(x => x !== st) : [...draft.stopStatuses, st],
                      })
                    }
                  />
                ))}
              </View>
              </>
              )}

              <View style={[s.row, { marginTop: 18 }]}>
                <Text style={s.cardTitle}>Turn this funnel on</Text>
                <Switch value={draft.enabled} onValueChange={v => setDraft({ ...draft, enabled: v })} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* activity */}
      <Modal visible={!!activity} animationType="slide" onRequestClose={() => setActivity(null)}>
        <View style={[s.container, { paddingTop: insets.top }]}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setActivity(null)} style={s.iconBtn}>
              <Icon name="close" size={18} color="#000" />
            </TouchableOpacity>
            <Text style={s.title} numberOfLines={1}>
              {activity?.name}
            </Text>
            <View style={s.iconBtn} />
          </View>
          <View style={s.divider} />
          {!activity?.rows ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={BLUE} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 14 }}>
              {activity.rows.length === 0 && <Text style={s.muted}>Nothing has run yet.</Text>}
              {activity.rows.map(j => (
                <View key={j._id} style={s.job}>
                  <Text style={[s.jobStatus, j.status === 'sent' && { backgroundColor: '#bbf7d0' }, j.status === 'failed' && { backgroundColor: '#fecaca' }, j.status === 'pending' && { backgroundColor: '#fef3c7' }]}>
                    {j.status}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#000' }} numberOfLines={1}>
                      {j.recipient} · message {j.stepIndex + 1}
                    </Text>
                    {!!j.note && (
                      <Text style={s.muted} numberOfLines={2}>
                        {j.note}
                      </Text>
                    )}
                  </View>
                  <Text style={s.muted}>
                    {new Date(j.sentAt || j.runAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#000', flex: 1, textAlign: 'center' },
  divider: { height: 2, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: '#64748b', fontSize: 12 },
  intro: { color: '#475569', fontSize: 12, marginBottom: 12 },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#94a3b8', padding: 20, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  card: { borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 12, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepLine: { fontSize: 12, color: '#000' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '700', color: '#000' },
  statLabel: { fontSize: 9, textTransform: 'uppercase', color: '#64748b' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  saveBtn: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingHorizontal: 14, paddingVertical: 7 },
  section: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: '#000', marginTop: 20, marginBottom: 6 },
  label: { fontSize: 11, color: '#64748b', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipOn: { backgroundColor: BLUE },
  chipText: { fontSize: 12, fontWeight: '600', color: '#000' },
  stepBox: { borderWidth: 2, borderColor: '#000', padding: 10, marginTop: 8, backgroundColor: '#f8fafc' },
  tplRow: { borderWidth: 2, borderColor: '#cbd5e1', padding: 8, marginBottom: 6, backgroundColor: '#fff' },
  tplRowOn: { borderColor: BLUE, backgroundColor: '#eff6ff' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  sumCard: { width: '31%', flexGrow: 1, borderWidth: 2, borderColor: '#000', padding: 8 },
  sumVal: { fontSize: 20, fontWeight: '800', color: '#000' },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  job: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  jobStatus: { width: 70, textAlign: 'center', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', borderWidth: 2, borderColor: '#000', paddingVertical: 2, backgroundColor: '#f1f5f9', color: '#000', overflow: 'hidden' },
});
