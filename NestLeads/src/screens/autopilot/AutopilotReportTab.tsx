import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, ScrollView, RefreshControl, ActivityIndicator, Dimensions, StyleSheet} from 'react-native';
import {LineChart, PieChart} from 'react-native-gifted-charts';
import {autopilotAPI} from '../../services/api';
import {COLORS, RANGES, RangeDays, Selection, chartMax, lineData, pctOf, pieData} from '../../lib/autopilot';
import {Card, Chip, ProgressBar, SectionTitle} from '../../components/autopilot/ui';

const CHART_WIDTH = Dimensions.get('window').width - 32 - 28 - 40;
const PLATFORM: Record<string, string> = {instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn'};

function Tile({label, value, hint}: {label: string; value: string | number; hint?: string}) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      {hint ? <Text style={s.tileHint}>{hint}</Text> : null}
    </View>
  );
}

// How Autopilot performed over a period: output, outcomes, review loop, platforms and topics.
export default function AutopilotReportTab({overview, selection}: {overview: any; selection: Selection}) {
  const campaignId = selection && selection !== 'all' ? selection : undefined;
  const scope = campaignId ? overview.campaigns.find((c: any) => c.id === campaignId)?.name : 'All campaigns';
  const [days, setDays] = useState<RangeDays>(30);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await autopilotAPI.stats(days, campaignId);
      setStats(res.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load the report');
    }
  }, [days, campaignId]);

  useEffect(() => {
    setStats(null);
    load();
  }, [load]);

  const t = stats?.totals;
  const r = stats?.rates;
  const slices = t ? pieData(t) : [];
  const maxPlatform = Math.max(1, ...(stats?.platforms || []).map((p: any) => p.count));

  return (
    <ScrollView
      contentContainerStyle={{padding: 16, paddingBottom: 40}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#024BAB"
        />
      }>
      <Text style={s.scope}>{scope}</Text>
      <View style={s.chips}>
        {RANGES.map(d => (
          <Chip key={d} label={`${d} days`} active={days === d} onPress={() => setDays(d)} />
        ))}
      </View>

      {!stats ? (
        error ? (
          <Text style={s.error}>{error}</Text>
        ) : (
          <ActivityIndicator color="#024BAB" style={{marginVertical: 30}} />
        )
      ) : (
        <>
          <View style={s.tiles}>
            <Tile label="Posts created" value={t.generated} />
            <Tile label="Posted" value={t.posted} hint={`${pctOf(t.posted, t.generated)} of created`} />
            <Tile label="Rejected" value={t.rejected} hint={`${pctOf(t.rejected, t.generated)} of created`} />
            <Tile label="Failed to post" value={t.failed} hint={t.failed ? 'check Connected Accounts' : 'none'} />
          </View>

          {!campaignId && stats.byCampaign?.length ? (
            <Card style={{marginTop: 14}}>
              <SectionTitle title="By campaign" />
              {stats.byCampaign.map((c: any) => (
                <View key={c.campaignId} style={s.cmpRow}>
                  <Text style={[s.legendText, {flex: 1, fontWeight: '800', color: '#000'}]} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.cmpNum}>{c.generated} made</Text>
                  <Text style={s.cmpNum}>{c.posted} posted</Text>
                  <Text style={s.cmpNum}>{pctOf(c.posted, c.generated)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Card style={{marginTop: 14}}>
            <SectionTitle title="Activity" />
            {stats.series.some((x: any) => x.generated || x.posted || x.rejected) ? (
              <LineChart
                data={lineData(stats.series, 'generated')}
                data2={lineData(stats.series, 'posted')}
                data3={lineData(stats.series, 'rejected')}
                color1={COLORS.generated}
                color2={COLORS.posted}
                color3={COLORS.rejected}
                thickness={2}
                hideDataPoints={stats.series.length > 14}
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
            ) : (
              <Text style={s.muted}>No posts in this period yet.</Text>
            )}
          </Card>

          <Card>
            <SectionTitle title="Where the posts ended up" />
            {slices.length ? (
              <View style={s.donutRow}>
                <PieChart
                  data={slices.map(x => ({value: x.value, color: x.color}))}
                  donut
                  radius={62}
                  innerRadius={38}
                  innerCircleColor="#fff"
                  strokeWidth={2}
                  strokeColor="#000"
                />
                <View style={{flex: 1, marginLeft: 16}}>
                  {slices.map(x => (
                    <View key={x.label} style={s.legendRow}>
                      <View style={[s.dot, {backgroundColor: x.color}]} />
                      <Text style={s.legendText}>{x.label}</Text>
                      <Text style={s.legendValue}>{x.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={s.muted}>Nothing to show yet.</Text>
            )}
          </Card>

          <Card>
            <SectionTitle title="Review loop" />
            <View style={s.tiles}>
              <Tile label="Approval rate" value={r.approvalRate == null ? '—' : `${r.approvalRate}%`} hint="of posts you reviewed" />
              <Tile label="Time to approve" value={r.avgApprovalHours == null ? '—' : `${r.avgApprovalHours} h`} hint="average" />
              <Tile label="Posts you changed" value={r.revisedPosts} hint={`${pctOf(r.revisedPosts, t.generated)} of created`} />
              <Tile label="Change requests" value={r.revisions} hint="fixed and regenerated" />
            </View>
          </Card>

          <Card>
            <SectionTitle title="By platform" />
            {stats.platforms.length ? (
              stats.platforms.map((p: any) => (
                <View key={p.platform} style={{marginBottom: 10}}>
                  <View style={s.legendRow}>
                    <Text style={[s.legendText, {flex: 1}]}>{PLATFORM[p.platform] ?? p.platform}</Text>
                    <Text style={s.legendValue}>{p.count}</Text>
                  </View>
                  <ProgressBar pct={(p.count / maxPlatform) * 100} color={COLORS.generated} />
                </View>
              ))
            ) : (
              <Text style={s.muted}>No posts yet.</Text>
            )}
          </Card>

          <Card>
            <SectionTitle title="Topics Autopilot covered" />
            {stats.topics.length ? (
              stats.topics.map((x: any, i: number) => (
                <Text key={x.topic} style={s.topic}>
                  {i + 1}. {x.topic} <Text style={s.muted}>· {x.count}</Text>
                </Text>
              ))
            ) : (
              <Text style={s.muted}>Topics show up once posts are created.</Text>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scope: {fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 6},
  cmpRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  cmpNum: {fontSize: 12, color: '#334155', marginLeft: 10, minWidth: 54, textAlign: 'right'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6},
  tiles: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  tile: {flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 12},
  tileLabel: {fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#475569'},
  tileValue: {fontSize: 24, fontWeight: '600', color: '#000', marginTop: 2},
  tileHint: {fontSize: 11, color: '#64748b'},
  muted: {fontSize: 12, color: '#64748b'},
  error: {fontSize: 13, color: '#b91c1c', marginTop: 12},
  donutRow: {flexDirection: 'row', alignItems: 'center'},
  legendRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  dot: {width: 10, height: 10, borderWidth: 1, borderColor: '#000', marginRight: 6},
  legendText: {fontSize: 12, color: '#334155'},
  legendValue: {fontSize: 12, fontWeight: '800', color: '#000', marginLeft: 'auto'},
  topic: {fontSize: 13, color: '#000', marginBottom: 4},
});
