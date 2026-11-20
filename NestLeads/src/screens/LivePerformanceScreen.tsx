import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import { CountUp } from '../components/motion';

const inr = (n: number) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
};
const mins = (m: number) =>
  !m ? '—' : m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(1)}d`;

// Calendar presets: exact from/to, and the month the money card should show.
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This month' },
  { key: 'last', label: 'Last month' },
];
function presetRange(key: string) {
  const now = new Date();
  if (key === 'today') {
    const f = new Date(now);
    f.setHours(0, 0, 0, 0);
    return { from: f, to: now, month: undefined as string | undefined };
  }
  const y = now.getFullYear();
  const m = now.getMonth() - (key === 'last' ? 1 : 0);
  const from = new Date(y, m, 1);
  const to = key === 'last' ? new Date(y, m + 1, 0, 23, 59, 59) : now;
  const mk = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
  return { from, to, month: key === 'last' ? mk : undefined };
}

type Tone = 'green' | 'amber' | 'red';
const TONE: Record<Tone, { hex: string; bg: string; label: string }> = {
  green: { hex: '#16a34a', bg: '#dcfce7', label: 'On target' },
  amber: { hex: '#f59e0b', bg: '#fef3c7', label: 'Behind' },
  red: { hex: '#dc2626', bg: '#fee2e2', label: 'Off pace' },
};
const toneFor = (pct: number, amber: number): Tone =>
  pct >= 100 ? 'green' : pct >= amber ? 'amber' : 'red';

const WINDOWS = [
  { min: 60, label: '1 hour' },
  { min: 240, label: '4 hours' },
  { min: 480, label: '8 hours' },
  { min: 1440, label: '24 hours' },
  { min: 10080, label: '7 days' },
];

const COLS = [
  { key: 'done', label: 'Calls', target: 'calls' },
  { key: 'conversations', label: 'Convo', target: 'conversations' },
  { key: 'quotations', label: 'Quote', target: 'quotations' },
  { key: 'visits', label: 'Visit', target: 'visits' },
] as const;

function ago(iso: string, nowIso: string) {
  const s = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LivePerformanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [windowMin, setWindowMin] = useState(60);
  const [preset, setPreset] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [money, setMoney] = useState<any>(null);
  const [speed, setSpeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const pr = preset ? presetRange(preset) : null;
      const range = pr
        ? { from: pr.from.toISOString(), to: pr.to.toISOString() }
        : { from: new Date(Date.now() - windowMin * 60000).toISOString(), to: new Date().toISOString() };
      const r = await dashboardAPI.getLive(windowMin, pr ? range : undefined);
      if (r.success) {
        setData(r.data);
        setError('');
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't load live data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowMin, preset]);

  // Money and speed change slowly: load them when the filter changes, not on every 15s refresh.
  useEffect(() => {
    if (!isAdmin) return;
    const pr = preset ? presetRange(preset) : null;
    const range = pr
      ? { from: pr.from.toISOString(), to: pr.to.toISOString() }
      : { from: new Date(Date.now() - windowMin * 60000).toISOString(), to: new Date().toISOString() };
    dashboardAPI.getTargets(pr?.month).then(r => r?.success && setMoney(r.data)).catch(() => {});
    dashboardAPI.getInsights(30, range).then(r => r?.success && setSpeed(r.data?.response)).catch(() => {});
  }, [windowMin, preset, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load, isAdmin]);

  const view = useMemo(() => {
    if (!data) return null;
    const t = data.targets;
    const expected = (c: (typeof COLS)[number]) => {
      const tg = c.target === 'calls' ? { count: t.calls, perMinutes: t.perMinutes } : t[c.target];
      return (tg.count * data.windowMin) / tg.perMinutes;
    };
    const perAgentCalls = expected(COLS[0]);
    const groups: Record<Tone, any[]> = { green: [], amber: [], red: [] };
    const humans = data.team.filter((r: any) => !r.isAI);
    humans.forEach((r: any) => {
      const pct = perAgentCalls > 0 ? (r.done / perAgentCalls) * 100 : 0;
      groups[toneFor(pct, t.amberPct)].push(r);
    });
    return { expected, groups, agents: Math.max(humans.length, 1) };
  }, [data]);

  const Header = (
    <>
      <ScreenHeader
        icon="stats-chart-outline"
        title="Live Performance"
        onBack={() => navigation.goBack()}
        right={
            <TouchableOpacity onPress={load} hitSlop={8} style={{ padding: 4 }}>
              <Icon name="refresh" size={22} color="#000" />
            </TouchableOpacity>
        }
      />
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

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {WINDOWS.map(w => {
            const on = !preset && windowMin === w.min;
            return (
              <TouchableOpacity
                key={w.min}
                onPress={() => {
                  setPreset(null);
                  setWindowMin(w.min);
                }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipText, on && { color: '#fff' }]}>{w.label}</Text>
              </TouchableOpacity>
            );
          })}
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPreset(p.key)}
              style={[s.chip, preset === p.key && s.chipOn, { borderStyle: 'dashed' }]}
            >
              <Text style={[s.chipText, preset === p.key && { color: '#fff' }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!error && <Text style={s.error}>{error}</Text>}

        {loading || !data || !view ? (
          <ActivityIndicator style={{ marginTop: 60 }} color="#024BAB" />
        ) : (
          <>
            {/* three status boxes */}
            {(['green', 'amber', 'red'] as Tone[]).map(tone => (
              <View key={tone} style={[s.toneCard, { backgroundColor: TONE[tone].bg }]}>
                <View style={[s.toneCount, { backgroundColor: TONE[tone].hex }]}>
                  <CountUp value={view.groups[tone].length} style={s.toneCountText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.toneLabel}>{TONE[tone].label}</Text>
                  <Text style={s.toneNames} numberOfLines={2}>
                    {view.groups[tone].length
                      ? view.groups[tone].map((r: any) => `${r.name} · ${r.done}`).join(',  ')
                      : 'Nobody here'}
                  </Text>
                </View>
              </View>
            ))}

            {/* performance table */}
            <View style={s.box}>
              <Text style={s.boxTitle}>Team performance (done / target)</Text>
              <View style={[s.tr, s.th]}>
                <Text style={[s.td, s.nameCol, s.thText]}>Agent</Text>
                {COLS.map(c => (
                  <Text key={c.key} style={[s.td, s.thText]}>
                    {c.label}
                  </Text>
                ))}
              </View>
              {data.team.map((r: any) => (
                <View key={r._id} style={s.tr}>
                  <Text style={[s.td, s.nameCol]} numberOfLines={1}>
                    {r.isAI ? `🤖 ${r.name}` : r.name}
                  </Text>
                  {COLS.map(c => {
                    const exp = r.isAI ? 0 : view.expected(c);
                    const done = r[c.key];
                    const tone = exp > 0 ? toneFor((done / exp) * 100, data.targets.amberPct) : null;
                    return (
                      <Text
                        key={c.key}
                        style={[
                          s.td,
                          s.num,
                          tone && { color: TONE[tone].hex, backgroundColor: TONE[tone].bg },
                        ]}
                      >
                        {exp > 0 ? `${done}/${Math.round(exp * 10) / 10}` : done}
                      </Text>
                    );
                  })}
                </View>
              ))}
              <View style={[s.tr, s.total]}>
                <Text style={[s.td, s.nameCol, { fontWeight: '700' }]}>Team</Text>
                {COLS.map(c => {
                  const exp = view.expected(c) * view.agents;
                  const done = c.key === 'done' ? data.totals.done : data.totals[c.key];
                  const tone = exp > 0 ? toneFor((done / exp) * 100, data.targets.amberPct) : null;
                  return (
                    <Text key={c.key} style={[s.td, s.num, { fontWeight: '700' }, tone && { color: TONE[tone].hex }]}>
                      {exp > 0 ? `${done}/${Math.round(exp)}` : done}
                    </Text>
                  );
                })}
              </View>
              <Text style={s.hint}>
                Convo = lead moved out of New Lead · Quote = moved to Quotation · Visit = Visit Scheduled. 🤖 AI Agent: calls it made (no target). Targets are set on the web.
              </Text>
            </View>

            {/* counters */}
            <View style={s.stats}>
              <Stat label="New leads" value={data.totals.newLeads} />
              <Stat label="Lead updates" value={data.totals.statusChanges} />
              <Stat label="Pending worked" value={data.totals.pendingWorked} sub={`${data.totals.pendingNow} still pending`} />
            </View>

            {/* Sales vs target */}
            {money && (
              <View style={s.box}>
                <Text style={s.boxTitle}>Sales vs target · {money.month?.label}</Text>
                <View style={{ padding: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <CountUp value={money.month?.won || 0} prefix="₹" locale style={s.bigMoney} />
                    <Text style={s.muted}>of {money.target ? inr(money.target) : 'no target set'}</Text>
                  </View>
                  <View style={s.meter}>
                    <View
                      style={[
                        s.meterFill,
                        {
                          width: `${money.target ? Math.min(100, ((money.month?.won || 0) / money.target) * 100) : 0}%` as any,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[s.muted, { marginTop: 6 }]}>
                    {money.month?.orders || 0} orders ·{' '}
                    {money.month?.isCurrent
                      ? `${money.month?.daysLeft} days left`
                      : money.target && (money.month?.won || 0) >= money.target
                        ? 'target met ✓'
                        : money.target
                          ? `short of target by ${inr(money.target - (money.month?.won || 0))}`
                          : 'month closed'}
                  </Text>
                </View>
                <Text style={[s.boxTitle, { borderTopWidth: 2, borderTopColor: '#000' }]}>Who is bringing the business</Text>
                {money.byAgent?.length ? (
                  money.byAgent.map((a: any, i: number) => {
                    const top = Math.max(1, ...money.byAgent.map((x: any) => x.value || 0));
                    return (
                      <View key={`${a.name}-${i}`} style={s.barRow}>
                        <Text style={s.barName} numberOfLines={1}>
                          {a.isAI ? `🤖 ${a.name}` : a.name}
                        </Text>
                        <View style={s.track}>
                          <View style={[s.fill, { width: `${Math.max(((a.value || 0) / top) * 100, 2)}%` as any, backgroundColor: '#00A86B' }]} />
                        </View>
                        <Text style={s.barVal}>{inr(a.value)}</Text>
                        <Text style={s.barSub}>{a.orders} ord</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[s.muted, { padding: 10 }]}>No orders won in this month yet.</Text>
                )}
              </View>
            )}

            {/* Assigned vs worked */}
            {data.agentRange?.length > 0 && (
              <View style={s.box}>
                <Text style={s.boxTitle}>Assigned vs worked (leads received in range)</Text>
                {data.agentRange.map((a: any, i: number) => (
                  <View key={`${a.name}-${i}`} style={s.barRow}>
                    <Text style={s.barName} numberOfLines={1}>
                      {a.isAI ? `🤖 ${a.name}` : a.name}
                    </Text>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${Math.max(a.pct || 0, a.worked ? 2 : 0)}%` as any, backgroundColor: '#024BAB' }]} />
                    </View>
                    <Text style={s.barVal}>
                      {a.worked}/{a.assigned}
                    </Text>
                    <Text style={[s.barSub, { color: a.pct >= 80 ? '#16a34a' : a.pct >= 50 ? '#f59e0b' : '#dc2626' }]}>{a.pct}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Response speed */}
            {speed && (
              <View style={s.box}>
                <Text style={s.boxTitle}>How fast new leads are called</Text>
                <View style={[s.stats, { padding: 10, marginBottom: 0 }]}>
                  <Stat label="Within 1 hour" value={speed.within1hPct} suffix="%" />
                  <Stat label="Median" text={mins(speed.medianMinutes)} />
                  <Stat label="Worked" value={speed.worked} sub={`of ${speed.total}`} />
                </View>
                {(speed.perAgent || []).map((a: any, i: number) => (
                  <View key={`${a.name}-${i}`} style={s.barRow}>
                    <Text style={s.barName} numberOfLines={1}>
                      {a.isAI ? `🤖 ${a.name}` : a.name}
                    </Text>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${Math.max(a.within1hPct || 0, 2)}%` as any, backgroundColor: '#FF751F' }]} />
                    </View>
                    <Text style={s.barVal}>{a.within1hPct}%</Text>
                    <Text style={s.barSub}>{mins(a.medianMinutes)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* updates */}
            <View style={s.box}>
              <Text style={s.boxTitle}>
                Updates · {preset ? PRESETS.find(p => p.key === preset)?.label : `last ${WINDOWS.find(w => w.min === windowMin)?.label}`}
              </Text>
              {data.updates.length === 0 ? (
                <Text style={s.muted}>No lead updates in this window.</Text>
              ) : (
                data.updates.slice(0, 25).map((u: any, i: number) => (
                  <View key={`${u.leadId}-${u.at}-${i}`} style={s.upd}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.updText} numberOfLines={2}>
                        {u.description}
                      </Text>
                      <Text style={s.updBy}>by {u.by}</Text>
                    </View>
                    <Text style={s.updAgo}>{ago(u.at, data.now)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, sub, suffix, text }: { label: string; value?: number; sub?: string; suffix?: string; text?: string }) {
  return (
    <View style={s.stat}>
      {text !== undefined ? (
        <Text style={s.statVal}>{text}</Text>
      ) : (
        <CountUp value={value || 0} suffix={suffix} locale style={s.statVal} />
      )}
      <Text style={s.statLabel}>{label}</Text>
      {!!sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  divider: { height: 2, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  error: { color: '#dc2626', marginBottom: 8, fontSize: 12 },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#024BAB' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#000' },
  toneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 10 },
  toneCount: { width: 42, height: 42, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  toneCountText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  toneLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#000' },
  toneNames: { fontSize: 12, color: '#334155', marginTop: 2 },
  box: { borderWidth: 2, borderColor: '#000', marginTop: 4, marginBottom: 12 },
  boxTitle: { fontSize: 13, fontWeight: '700', color: '#000', padding: 10, backgroundColor: '#f1f5f9', borderBottomWidth: 2, borderBottomColor: '#000' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' },
  th: { backgroundColor: '#fff', borderBottomWidth: 2, borderBottomColor: '#000' },
  thText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: '#64748b' },
  td: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, fontSize: 12, textAlign: 'center', color: '#000' },
  nameCol: { flex: 1.6, textAlign: 'left', paddingLeft: 10, fontWeight: '600' },
  num: { fontWeight: '600' },
  total: { backgroundColor: '#f1f5f9', borderTopWidth: 2, borderTopColor: '#000' },
  hint: { fontSize: 10, color: '#64748b', padding: 10 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, borderWidth: 2, borderColor: '#000', padding: 10 },
  statVal: { fontSize: 20, fontWeight: '700', color: '#000' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', color: '#64748b' },
  statSub: { fontSize: 10, color: '#64748b' },
  bigMoney: { fontSize: 24, fontWeight: '700', color: '#000' },
  meter: { height: 12, borderWidth: 1.5, borderColor: '#000', backgroundColor: '#f1f5f9', marginTop: 6 },
  meterFill: { height: '100%', backgroundColor: '#00A86B' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  barName: { width: 96, fontSize: 12, fontWeight: '600', color: '#000' },
  track: { flex: 1, height: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  fill: { height: '100%' },
  barVal: { width: 56, textAlign: 'right', fontSize: 12, fontWeight: '600', color: '#000' },
  barSub: { width: 40, textAlign: 'right', fontSize: 10, color: '#64748b' },
  upd: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  updText: { fontSize: 12, color: '#000' },
  updBy: { fontSize: 11, color: '#64748b' },
  updAgo: { fontSize: 10, color: '#64748b' },
});
