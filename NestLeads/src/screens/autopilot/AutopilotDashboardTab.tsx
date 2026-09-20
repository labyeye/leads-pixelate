import React, {useCallback, useEffect, useState} from 'react';
import {
  View, Text, ScrollView, RefreshControl, Switch, TouchableOpacity, Image,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import {LineChart} from 'react-native-gifted-charts';
import {aiUsageAPI, autopilotAPI, socialAPI} from '../../services/api';
import {
  COLORS, RANGES, RangeDays, HISTORY, POST_STATUS, UPCOMING,
  chartMax, lineData, sortQueue, statePill, usageColor, usagePct,
} from '../../lib/autopilot';
import {Card, Chip, Kpi, Pill, PrimaryButton, ProgressBar, SectionTitle} from '../../components/autopilot/ui';
import ReviewModal from '../../components/autopilot/ReviewModal';

const CHART_WIDTH = Dimensions.get('window').width - 32 - 28 - 40;

const when = (d: string) =>
  new Date(d).toLocaleString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'});

// Home of Autopilot: what it did, what needs the owner, plan usage and the queue.
export default function AutopilotDashboardTab({
  status,
  reloadStatus,
  onGoSetup,
}: {
  status: any;
  reloadStatus: () => Promise<any>;
  onGoSetup: () => void;
}) {
  const [days, setDays] = useState<RangeDays>(30);
  const [stats, setStats] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [posts, setPosts] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [changing, setChanging] = useState<any | null>(null);
  const [toggling, setToggling] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [st, po] = await Promise.allSettled([autopilotAPI.stats(days), socialAPI.getPosts({source: 'autopilot'})]);
    if (st.status === 'fulfilled') setStats(st.value.data);
    if (po.status === 'fulfilled') setPosts(po.value.data);
  }, [days]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    aiUsageAPI.get().then(r => setUsage(r.data)).catch(() => setUsage(null));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), reloadStatus()]);
    setRefreshing(false);
  };

  if (status.onboarded === false) {
    return (
      <View style={{padding: 16}}>
        <Card>
          <SectionTitle title="Let's set up your Autopilot" sub="Tell us about your brand, scan your profile, add logos and pick when to post." />
          <PrimaryButton label="Start setup" onPress={onGoSetup} />
        </Card>
      </View>
    );
  }

  const ent = status.entitlement;
  const enabled = status.settings.enabled;
  const entitled = ent.state === 'trial' || ent.state === 'paid';
  const pill = statePill(status);
  const t = stats?.totals;
  const meter = usage?.autopilot;
  const pct = meter ? usagePct(meter.used, meter.limit) : 0;

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (on: boolean) => {
    setToggling(true);
    try {
      await autopilotAPI.update({enabled: on});
      await Promise.all([reloadStatus(), load()]);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setToggling(false);
    }
  };

  const runNow = async () => {
    setStarting(true);
    try {
      await autopilotAPI.run();
      Alert.alert('Started', 'Autopilot is creating a post. It shows up in the queue in a minute or two.');
      await reloadStatus();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setStarting(false);
    }
  };

  const queue = sortQueue((posts || []).filter(p => UPCOMING.includes(p.status)));
  const history = (posts || [])
    .filter(p => HISTORY.includes(p.status))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
    .slice(0, 5);

  const renderPost = (p: any) => {
    const st = POST_STATUS[p.status];
    const revising = !!p.autopilotMeta?.revising;
    return (
      <View key={p._id} style={s.post}>
        <View style={{flexDirection: 'row'}}>
          {p.imageUrl ? <Image source={{uri: p.imageUrl}} style={s.thumb} /> : null}
          <View style={{flex: 1, marginLeft: p.imageUrl ? 10 : 0}}>
            <View style={s.postMeta}>
              <Text style={s.postWhen}>{when(p.scheduledAt)}</Text>
              {st ? <Pill text={st.label} bg={st.bg} fg={st.fg} /> : null}
            </View>
            <Text numberOfLines={3} style={s.caption}>{p.caption}</Text>
            {p.status === 'FAILED' && p.failureReason ? <Text style={s.fail}>{p.failureReason}</Text> : null}
          </View>
        </View>
        {p.status === 'PENDING_APPROVAL' &&
          (revising ? (
            <View style={s.revising}>
              <ActivityIndicator size="small" color="#024BAB" />
              <Text style={s.revisingText}>Fixing this post from your feedback…</Text>
            </View>
          ) : (
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.act, {backgroundColor: '#22c55e'}]}
                disabled={busy === p._id}
                onPress={() => act(p._id, () => socialAPI.approvePost(p._id))}>
                <Text style={s.actText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.act, {backgroundColor: '#fff'}]} disabled={busy === p._id} onPress={() => setChanging(p)}>
                <Text style={[s.actText, {color: '#000'}]}>Request changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.act, {backgroundColor: '#fff'}]}
                disabled={busy === p._id}
                onPress={() => act(p._id, () => socialAPI.rejectPost(p._id, 'Rejected from Autopilot'))}>
                <Text style={[s.actText, {color: '#b91c1c'}]}>Reject</Text>
              </TouchableOpacity>
            </View>
          ))}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{padding: 16, paddingBottom: 40}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#024BAB" />}>
        {/* status strip */}
        <Card>
          <View style={s.strip}>
            <Pill text={pill.text} bg={pill.bg} fg={pill.fg} />
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={s.onOff}>{enabled ? 'On' : 'Off'}</Text>
              <Switch
                accessibilityLabel="Autopilot on or off"
                value={enabled}
                disabled={toggling || (ent.state === 'expired' && !enabled)}
                onValueChange={toggle}
              />
            </View>
          </View>
          <Text style={s.stripText}>
            {status.running
              ? 'Creating your next post…'
              : stats?.next
                ? `Next: ${when(stats.next.scheduledAt)} · ${stats.next.status === 'PENDING_APPROVAL' ? 'needs your approval' : 'scheduled'}`
                : enabled
                  ? 'Nothing scheduled yet. New posts are prepared a day ahead.'
                  : 'Turn Autopilot on to start creating posts.'}
          </Text>
          {enabled && entitled ? (
            <View style={{marginTop: 10}}>
              <PrimaryButton label={starting || status.running ? 'Working…' : 'Create a post now'} outline onPress={runNow} disabled={starting || status.running} />
            </View>
          ) : null}
          {status.lastError && !status.running ? (
            <Text style={s.fail}>Last run failed: {status.lastError}. It retries on its own.</Text>
          ) : null}
        </Card>

        {/* numbers */}
        <View style={s.rowBetween}>
          <Text style={s.h2}>Overview</Text>
        </View>
        <View style={s.chips}>
          {RANGES.map(r => (
            <Chip key={r} label={`${r} days`} active={days === r} onPress={() => setDays(r)} />
          ))}
        </View>
        <View style={s.kpis}>
          <Kpi label="Created" value={t?.generated ?? '—'} hint={`last ${days} days`} color={COLORS.generated} />
          <Kpi label="Posted" value={t?.posted ?? '—'} hint="published" color={COLORS.posted} />
          <Kpi label="Needs approval" value={t?.pending ?? '—'} hint={t?.pending ? 'waiting below' : 'all clear'} color={COLORS.pending} highlight={!!t?.pending} />
          <Kpi label="Scheduled" value={t?.scheduled ?? '—'} hint="going out soon" color={COLORS.scheduled} />
          <Kpi label="Rejected" value={t?.rejected ?? '—'} hint={t?.failed ? `${t.failed} failed to post` : 'by you'} color={COLORS.rejected} />
        </View>

        {/* chart */}
        <Card style={{marginTop: 14}}>
          <SectionTitle title="Posts per day" />
          {stats && stats.series.some((x: any) => x.generated || x.posted || x.rejected) ? (
            <>
              <LineChart
                data={lineData(stats.series, 'generated')}
                data2={lineData(stats.series, 'posted')}
                data3={lineData(stats.series, 'rejected')}
                color1={COLORS.generated}
                color2={COLORS.posted}
                color3={COLORS.rejected}
                thickness={2}
                hideDataPoints={stats.series.length > 14}
                dataPointsColor1={COLORS.generated}
                dataPointsColor2={COLORS.posted}
                dataPointsColor3={COLORS.rejected}
                maxValue={chartMax(stats.series)}
                noOfSections={3}
                width={CHART_WIDTH}
                height={150}
                spacing={Math.max(6, CHART_WIDTH / Math.max(1, stats.series.length))}
                initialSpacing={8}
                yAxisTextStyle={{fontSize: 10, color: '#475569'}}
                xAxisLabelTextStyle={{fontSize: 9, color: '#475569'}}
                yAxisThickness={0}
                rulesColor="#e2e8f0"
              />
              <View style={s.legend}>
                <Legend color={COLORS.generated} text="Created" />
                <Legend color={COLORS.posted} text="Posted" />
                <Legend color={COLORS.rejected} text="Rejected" />
              </View>
            </>
          ) : (
            <Text style={s.muted}>{stats ? 'No posts in this period yet.' : 'Loading…'}</Text>
          )}
        </Card>

        {/* usage */}
        <Card>
          <SectionTitle title="Plan usage" />
          {meter ? (
            <>
              <Text style={s.usageBig}>
                {meter.used}
                <Text style={s.usageOf}> / {meter.limit} posts this month</Text>
              </Text>
              <ProgressBar pct={pct} color={usageColor(pct)} />
              <Text style={s.muted}>
                Up to {meter.daysPerWeek} posting day{meter.daysPerWeek === 1 ? '' : 's'} a week on your plan.
              </Text>
            </>
          ) : (
            <Text style={s.muted}>Usage is not available right now.</Text>
          )}
          {stats?.rates?.approvalRate != null ? (
            <Text style={[s.muted, {marginTop: 8}]}>You approve {stats.rates.approvalRate}% of the posts you review.</Text>
          ) : null}
        </Card>

        {/* queue */}
        <Text style={s.h2}>Queue</Text>
        {posts === null ? (
          <ActivityIndicator color="#024BAB" style={{marginVertical: 20}} />
        ) : queue.length ? (
          queue.map(renderPost)
        ) : (
          <Card>
            <Text style={s.muted}>Nothing queued yet. Turn Autopilot on and your next post will appear here.</Text>
          </Card>
        )}
        {history.length > 0 ? (
          <>
            <Text style={[s.h2, {marginTop: 14}]}>Recently published</Text>
            {history.map(renderPost)}
          </>
        ) : null}
      </ScrollView>

      <ReviewModal
        post={changing}
        onClose={() => setChanging(null)}
        onSent={() => {
          setChanging(null);
          load();
        }}
      />
    </>
  );
}

function Legend({color, text}: {color: string; text: string}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 14}}>
      <View style={{width: 10, height: 10, backgroundColor: color, borderWidth: 1, borderColor: '#000', marginRight: 5}} />
      <Text style={{fontSize: 11, color: '#334155'}}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  strip: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  onOff: {fontSize: 13, fontWeight: '800', marginRight: 6, color: '#000'},
  stripText: {fontSize: 13, color: '#334155', marginTop: 8},
  h2: {fontSize: 18, fontWeight: '900', color: '#000', marginBottom: 8, marginTop: 4},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between'},
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  kpis: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  legend: {flexDirection: 'row', marginTop: 8},
  muted: {fontSize: 12, color: '#64748b', marginTop: 6},
  usageBig: {fontSize: 28, fontWeight: '900', color: '#000', marginBottom: 6},
  usageOf: {fontSize: 13, fontWeight: '500', color: '#64748b'},
  post: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 10, marginBottom: 10},
  thumb: {width: 64, height: 80, borderWidth: 1, borderColor: '#000', backgroundColor: '#e2e8f0'},
  postMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4},
  postWhen: {fontSize: 11, color: '#64748b', marginRight: 4},
  caption: {fontSize: 13, color: '#000'},
  fail: {fontSize: 11, color: '#b91c1c', marginTop: 4},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  act: {borderWidth: 2, borderColor: '#000', paddingVertical: 8, paddingHorizontal: 12},
  actText: {fontSize: 12, fontWeight: '800', color: '#fff'},
  revising: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  revisingText: {fontSize: 12, color: '#1d4ed8', marginLeft: 8},
});
