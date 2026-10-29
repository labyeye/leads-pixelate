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
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';

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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await dashboardAPI.getLive(windowMin);
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
  }, [windowMin]);

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
    data.team.forEach((r: any) => {
      const pct = perAgentCalls > 0 ? (r.done / perAgentCalls) * 100 : 0;
      groups[toneFor(pct, t.amberPct)].push(r);
    });
    return { expected, groups, agents: Math.max(data.team.length, 1) };
  }, [data]);

  const Header = (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Live Performance</Text>
        <TouchableOpacity onPress={load} style={s.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
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
          {WINDOWS.map(w => (
            <TouchableOpacity
              key={w.min}
              onPress={() => setWindowMin(w.min)}
              style={[s.chip, windowMin === w.min && s.chipOn]}
            >
              <Text style={[s.chipText, windowMin === w.min && { color: '#fff' }]}>{w.label}</Text>
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
                  <Text style={s.toneCountText}>{view.groups[tone].length}</Text>
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
                    {r.name}
                  </Text>
                  {COLS.map(c => {
                    const exp = view.expected(c);
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
                Convo = lead moved out of New Lead · Quote = moved to Quotation · Visit = Visit Scheduled. Targets are set on the web.
              </Text>
            </View>

            {/* counters */}
            <View style={s.stats}>
              <Stat label="New leads" value={data.totals.newLeads} />
              <Stat label="Lead updates" value={data.totals.statusChanges} />
              <Stat label="Pending worked" value={data.totals.pendingWorked} sub={`${data.totals.pendingNow} still pending`} />
            </View>

            {/* updates */}
            <View style={s.box}>
              <Text style={s.boxTitle}>Updates in the last {WINDOWS.find(w => w.min === windowMin)?.label}</Text>
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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
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
  upd: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  updText: { fontSize: 12, color: '#000' },
  updBy: { fontSize: 11, color: '#64748b' },
  updAgo: { fontSize: 10, color: '#64748b' },
});
