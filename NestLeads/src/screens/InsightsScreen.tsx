import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import ScreenHeader from '../components/ScreenHeader';
import { dashboardAPI } from '../services/api';
import { SlideIn, CountUp, AnimatedValue } from '../components/motion';

const W = Dimensions.get('window').width;
const BLUE = '#024BAB';
const ORANGE = '#FF751F';
const GREEN = '#00A86B';
const RED = '#EF4444';
const PERIODS = [30, 90, 180, 365];

const inr = (n: number) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
};
const mins = (m: number) =>
  !m ? '—' : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`;

/** Everything the owner needs on one screen: target, funnel, sources, team, losses. Same data as web Insights. */
export default function InsightsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(90);
  const [d, setD] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const [ins, tg] = await Promise.all([
      dashboardAPI.getInsights(days).catch(() => null),
      dashboardAPI.getTargets().catch(() => null),
    ]);
    setD(ins?.data || null);
    setT(tg?.data || null);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const f = d?.funnel;
  const funnel = f
    ? ([
        ['Leads', f.leads],
        ['Contacted', f.contacted],
        ['Discussion', f.discussion],
        ['Visit / Demo', f.visit],
        ['Quotation', f.quotation],
        ['Won', f.won],
      ] as [string, number][])
    : [];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="stats-chart-outline" title="Insights" onBack={() => navigation.goBack()} />

      <View style={s.periods}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p} style={[s.period, days === p && s.periodOn]} onPress={() => setDays(p)}>
            <Text style={[s.periodText, days === p && { color: '#fff' }]}>
              {p === 365 ? '1 year' : `${p} days`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !d ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={BLUE} />
      ) : !d ? (
        <Text style={[s.muted, { textAlign: 'center', marginTop: 60 }]}>
          Couldn't load insights. Pull to retry.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={BLUE} />}
        >
          {/* 1. Target */}
          {t && (
            <Card title="This month's target" sub={`${t.month?.orders || 0} orders · ${t.month?.daysLeft ?? 0} days left`} delay={0}>
              {!t.target && !t.breakEven ? (
                <Text style={s.muted}>Set a monthly target and costs on the web (Insights → Targets) to track it here.</Text>
              ) : (
                <>
                  <Progress label="Won vs target" value={t.month?.won || 0} of={t.target} color={GREEN} />
                  <Progress label="Break-even" value={t.month?.won || 0} of={t.breakEven} color={ORANGE} />
                  <View style={s.kvRow}>
                    <KV k="Pipeline" v={inr(t.pipeline?.value)} />
                    <KV k="Likely" v={inr(t.pipeline?.forecast)} />
                    <KV k="Avg deal" v={inr(t.avgDeal)} />
                  </View>
                  {t.ordersNeeded > 0 && (
                    <Text style={[s.muted, { marginTop: 8 }]}>
                      Needs ~{t.ordersNeeded} more orders → ~{t.leadsNeeded} leads at your current close rate.
                    </Text>
                  )}
                </>
              )}
            </Card>
          )}

          {/* 2. Trend */}
          <Card title="Leads & won over time" sub={`Per ${d.days > 90 ? 'month' : 'week'}`} delay={60}>
            {d.trend?.length ? (
              <>
                <Legend items={[[BLUE, 'Leads'], [GREEN, 'Won']]} />
                <LineChart
                  data={d.trend.map((p: any) => ({ value: p.leads, label: p.label }))}
                  data2={d.trend.map((p: any) => ({ value: p.won }))}
                  color1={BLUE}
                  color2={GREEN}
                  dataPointsColor1={BLUE}
                  dataPointsColor2={GREEN}
                  thickness={2.5}
                  hideDataPoints={d.trend.length > 14}
                  noOfSections={4}
                  width={W - 90}
                  height={150}
                  spacing={(W - 110) / Math.max(1, d.trend.length - 1)}
                  initialSpacing={8}
                  endSpacing={8}
                  yAxisTextStyle={{ fontSize: 10, color: '#475569' }}
                  xAxisLabelTextStyle={{ fontSize: 8, color: '#000', width: 40 }}
                  yAxisThickness={0}
                  xAxisColor="#000"
                  rulesColor="#e2e8f0"
                />
              </>
            ) : (
              <Empty />
            )}
          </Card>

          {/* 3. Funnel */}
          <Card title="Funnel" sub="How many reach each step" delay={120}>
            {funnel.map(([name, n], i) => {
              const top = funnel[0][1] || 1;
              const prev = i ? funnel[i - 1][1] : n;
              return (
                <Bar
                  key={name}
                  label={name}
                  value={n}
                  max={top}
                  color={name === 'Won' ? GREEN : BLUE}
                  right={i === 0 ? '' : `${prev ? Math.round((n / prev) * 100) : 0}% of prev`}
                />
              );
            })}
          </Card>

          {/* 4. Sources */}
          <Card title="Which source brings orders" sub="Leads, won and conversion" delay={180}>
            {d.sources?.length ? (
              <Table
                head={['Source', 'Leads', 'Won', 'Conv.']}
                rows={d.sources.slice(0, 8).map((r: any) => [r.name, r.leads, r.won, `${r.convPct}%`])}
              />
            ) : (
              <Empty />
            )}
          </Card>

          {/* 5. Response speed */}
          {d.response && (
            <Card title="How fast leads are called" sub={`${d.response.worked} of ${d.response.total} leads worked`} delay={240}>
              <View style={s.kvRow}>
                <KV k="Within 1 hour" v={`${d.response.within1hPct}%`} color={d.response.within1hPct >= 50 ? GREEN : RED} />
                <KV k="Median" v={mins(d.response.medianMinutes)} />
                <KV k="Average" v={mins(d.response.avgMinutes)} />
              </View>
              <View style={{ marginTop: 8 }}>
                {(d.response.buckets || []).map((b: any) => (
                  <Bar
                    key={b.name}
                    label={b.name}
                    value={b.count}
                    max={Math.max(1, ...d.response.buckets.map((x: any) => x.count))}
                    color={ORANGE}
                  />
                ))}
              </View>
            </Card>
          )}

          {/* 6. Team */}
          <Card title="Win rate by salesperson" sub="AI Agent = leads it called" delay={300}>
            {d.team?.perAgent?.length ? (
              <Table
                head={['Person', 'Leads', 'Won', 'Win %']}
                rows={d.team.perAgent.map((r: any) => [
                  `${r.isAI ? '🤖 ' : ''}${r.name}`,
                  r.leads,
                  r.won,
                  `${r.winRate}%`,
                ])}
              />
            ) : (
              <Empty />
            )}
          </Card>

          {/* 7. Pipeline */}
          <Card title="Open pipeline by stage" delay={340}>
            {d.pipelineByStage?.length ? (
              d.pipelineByStage.map((r: any) => (
                <Bar
                  key={r.name}
                  label={r.name}
                  value={r.count}
                  max={Math.max(1, ...d.pipelineByStage.map((x: any) => x.count))}
                  color={BLUE}
                  right={r.value ? inr(r.value) : ''}
                />
              ))
            ) : (
              <Empty />
            )}
          </Card>

          {/* 8. Lost */}
          <Card
            title="Why leads are lost"
            sub={d.lost?.count ? `${d.lost.count} lost${d.lost.value ? ` · ${inr(d.lost.value)}` : ''}` : 'No lost leads'}
            delay={380}
          >
            {(d.lost?.reasons || []).map((r: any) => (
              <Bar
                key={r.name}
                label={r.name}
                value={r.count}
                max={Math.max(1, ...d.lost.reasons.map((x: any) => x.count))}
                color={RED}
              />
            ))}
            {d.lost?.competitors?.length > 0 && (
              <Text style={[s.muted, { marginTop: 8 }]}>
                Lost to: {d.lost.competitors.map((c: any) => `${c.name} (${c.count})`).join(', ')}
              </Text>
            )}
          </Card>

          {/* 9. Stuck */}
          <Card title="Stuck leads" sub={`${d.stuck?.count || 0} open with no movement for ${d.stuck?.days || 7}+ days`} delay={420}>
            {(d.stuck?.items || []).slice(0, 6).map((l: any) => (
              <TouchableOpacity
                key={l._id}
                style={s.listRow}
                onPress={() => navigation.navigate('LeadsStack', { screen: 'LeadDetail', params: { leadId: l._id } })}
              >
                <Text style={[s.cell, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>{l.name}</Text>
                <Text style={[s.muted, { maxWidth: 110 }]} numberOfLines={1}>{l.owner}</Text>
                <Text style={[s.cell, { width: 48, textAlign: 'right', color: l.days > 30 ? RED : ORANGE }]}>{l.days} d</Text>
              </TouchableOpacity>
            ))}
            {!d.stuck?.items?.length && <Text style={s.muted}>Nothing stuck. 🎉</Text>}
          </Card>

          {/* 10. Machines / products */}
          {d.machines?.length > 0 && (
            <Card title={d.preset?.terms?.items || 'Machines'} sub="Leads, quotations and won" delay={460}>
              <Table
                head={['Item', 'Leads', 'Quotes', 'Won']}
                rows={d.machines.slice(0, 8).map((r: any) => [r.name, r.leads, r.quotations, r.won])}
              />
            </Card>
          )}

          {/* 11. Sales cycle */}
          {d.cycle && (
            <Card title="Sales cycle" sub={`${d.cycle.won} won in this period`} delay={500}>
              <View style={s.kvRow}>
                <KV k="Avg days to win" v={d.cycle.avgDays ? `${d.cycle.avgDays} d` : '—'} />
                <KV k="Median" v={d.cycle.medianDays ? `${d.cycle.medianDays} d` : '—'} />
              </View>
              {(d.cycle.stages || []).slice(0, 6).map((r: any) => (
                <Bar
                  key={r.name}
                  label={r.name}
                  value={r.avgDays}
                  max={Math.max(1, ...d.cycle.stages.map((x: any) => x.avgDays))}
                  color={ORANGE}
                  right="days"
                />
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Card({ title, sub, children, delay = 0 }: { title: string; sub?: string; children: React.ReactNode; delay?: number }) {
  return (
    <SlideIn delay={delay} style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {!!sub && <Text style={[s.muted, { marginBottom: 10 }]}>{sub}</Text>}
      {!sub && <View style={{ height: 8 }} />}
      {children}
    </SlideIn>
  );
}

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.max((value / (max || 1)) * 100, value ? 2 : 0)}%` as any, backgroundColor: color }]} />
      </View>
      <CountUp value={value} decimals={Number.isInteger(value) ? 0 : 1} style={s.barVal} />
      {!!right && <Text style={s.barRight}>{right}</Text>}
    </View>
  );
}

function Progress({ label, value, of, color }: { label: string; value: number; of: number; color: string }) {
  const pct = of ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.cell}>{label}</Text>
        <Text style={s.cell}>{inr(value)} / {of ? inr(of) : '—'}</Text>
      </View>
      <View style={[s.track, { height: 12, marginTop: 4, borderWidth: 1.5, borderColor: '#000', flex: 0 }]}>
        <View style={[s.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function KV({ k, v, color = '#000' }: { k: string; v: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.muted}>{k}</Text>
      <AnimatedValue value={v} style={[s.kvVal, { color }]} />
    </View>
  );
}

function Table({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <View>
      <View style={[s.listRow, { borderTopWidth: 0, paddingTop: 0 }]}>
        {head.map((h, i) => (
          <Text key={h} style={[s.th, i === 0 ? { flex: 1 } : s.num]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, j) => (
        <View key={j} style={s.listRow}>
          {r.map((c, i) =>
            i === 0 ? (
              <Text key={i} style={[s.cell, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>{c}</Text>
            ) : (
              <AnimatedValue key={i} value={c} style={[s.cell, s.num]} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 8 }}>
      {items.map(([c, l]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, borderWidth: 1.5, borderColor: '#000' }} />
          <Text style={s.cell}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const Empty = () => <Text style={s.muted}>No leads in this period.</Text>;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  periods: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 6 },
  period: { flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 6, alignItems: 'center', backgroundColor: '#fff' },
  periodOn: { backgroundColor: BLUE },
  periodText: { fontSize: 12, fontWeight: '500', color: '#000' },
  card: { borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  muted: { fontSize: 12, color: '#64748b' },
  cell: { fontSize: 13, color: '#000' },
  th: { fontSize: 10, fontWeight: '600', color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' },
  num: { width: 52, textAlign: 'right' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  kvRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  kvVal: { fontSize: 18, fontWeight: '700', color: '#000', marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 96, fontSize: 12, color: '#334155' },
  track: { flex: 1, height: 9, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  fill: { height: '100%' },
  barVal: { width: 44, textAlign: 'right', fontSize: 12, fontWeight: '600', color: '#000' },
  barRight: { width: 62, textAlign: 'right', fontSize: 10, color: '#64748b' },
});
