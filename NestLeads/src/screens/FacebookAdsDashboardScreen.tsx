import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, RefreshControl} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PieChart} from 'react-native-gifted-charts';
import Icon from '../components/Icon';
import {facebookAPI} from '../services/api';
import {parseInsight, statusBadge, PeriodFilterBar, usePeriodFilter, type Insight} from '../lib/metaAdsShared';

const FB_COLOR = '#1877F2';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

export default function FacebookAdsDashboardScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [error, setError] = useState<{message: string; permission: boolean} | null>(null);
  const {period, setPeriod, periodOpts} = usePeriodFilter();

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const res = await facebookAPI.getMetaCampaigns();
      const list = res.data || [];
      setCampaigns(list);
      const results = await Promise.allSettled(
        list.map((c: any) => facebookAPI.getMetaCampaignInsights(c.id, periodOpts as any)),
      );
      const map: Record<string, Insight> = {};
      list.forEach((c: any, i: number) => {
        const r = results[i];
        map[c.id] = r.status === 'fulfilled' ? parseInsight(r.value.data) : parseInsight(null);
      });
      setInsights(map);
    } catch (e: any) {
      setError({message: e.message || 'Failed to load Facebook campaigns', permission: /permission/i.test(e.message || '')});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodOpts]);

  useEffect(() => { load(); }, [load]);

  const totals = campaigns.reduce(
    (acc, c) => {
      const ins = insights[c.id];
      if (ins) {
        acc.spend += ins.spend;
        acc.results += ins.results;
        acc.clicks += ins.clicks;
        acc.impressions += ins.impressions;
      }
      return acc;
    },
    {spend: 0, results: 0, clicks: 0, impressions: 0},
  );
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const statusCounts = campaigns.reduce((acc: Record<string, number>, c: any) => {
    const st = statusBadge(c.status).label;
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([label, value], idx) => ({
    value,
    color: ['#024BAB', '#00C48C', '#FFDE00', '#ef4444', '#94a3b8'][idx % 5],
    label,
  }));

  const topBySpend = [...campaigns]
    .map(c => ({...c, ins: insights[c.id] || parseInsight(null)}))
    .sort((a, b) => b.ins.spend - a.ins.spend)
    .slice(0, 8);
  const maxSpend = Math.max(1, ...topBySpend.map(c => c.ins.spend));

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facebook Dashboard</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={FB_COLOR} /></View>
      ) : error ? (
        <View style={styles.body}>
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={28} color="#ef4444" />
            <Text style={styles.errorTitle}>{error.permission ? 'Ads permission missing' : 'Not connected'}</Text>
            <Text style={styles.errorDesc}>{error.message}</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={() => navigation.navigate('Integrations')}>
              <Text style={styles.errorBtnText}>Go to Integrations</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={FB_COLOR} />}>
          <PeriodFilterBar period={period} setPeriod={setPeriod} />

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>₹{Math.round(totals.spend).toLocaleString('en-IN')}</Text>
              <Text style={styles.kpiLabel}>Spend</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{totals.results.toLocaleString('en-IN')}</Text>
              <Text style={styles.kpiLabel}>Results</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{totals.clicks.toLocaleString('en-IN')}</Text>
              <Text style={styles.kpiLabel}>Clicks · {ctr.toFixed(1)}% CTR</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{totals.impressions.toLocaleString('en-IN')}</Text>
              <Text style={styles.kpiLabel}>Impressions</Text>
            </View>
          </View>

          {pieData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STATUS DISTRIBUTION</Text>
              <View style={styles.pieRow}>
                <PieChart
                  data={pieData}
                  donut
                  radius={70}
                  innerRadius={44}
                  innerCircleColor={'#fff'}
                  innerCircleBorderWidth={2}
                  innerCircleBorderColor={'#000'}
                  strokeWidth={2}
                  strokeColor={'#000'}
                />
                <View style={{flex: 1, gap: 6}}>
                  {pieData.map(d => (
                    <View key={d.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, {backgroundColor: d.color}]} />
                      <Text style={styles.legendLabel}>{d.label}</Text>
                      <Text style={styles.legendValue}>{d.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {topBySpend.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOP CAMPAIGNS BY SPEND</Text>
              {topBySpend.map(c => (
                <View key={c.id} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{c.name}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {width: `${(c.ins.spend / maxSpend) * 100}%`}]} />
                  </View>
                  <Text style={styles.barValue}>₹{Math.round(c.ins.spend).toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  body: {padding: 16, gap: 14},
  errorBox: {borderWidth: 2, borderColor: '#000', padding: 24, alignItems: 'center', gap: 8, ...NB_SHADOW},
  errorTitle: {fontSize: 14, fontWeight: '900', color: '#000'},
  errorDesc: {fontSize: 12, color: '#64748b', textAlign: 'center'},
  errorBtn: {marginTop: 8, borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 10},
  errorBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  kpiCard: {flexBasis: '47%', flexGrow: 1, borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  kpiValue: {fontSize: 18, fontWeight: '900', color: '#000'},
  kpiLabel: {fontSize: 10, fontWeight: '800', color: '#64748b', marginTop: 3, textTransform: 'uppercase'},
  section: {borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  sectionTitle: {fontSize: 11, fontWeight: '900', color: '#000', marginBottom: 12, letterSpacing: 0.5},
  pieRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legendDot: {width: 10, height: 10, borderWidth: 1, borderColor: '#000'},
  legendLabel: {flex: 1, fontSize: 11, color: '#000', fontWeight: '600'},
  legendValue: {fontSize: 11, fontWeight: '900', color: '#000'},
  barRow: {gap: 4, marginBottom: 10},
  barLabel: {fontSize: 11, fontWeight: '700', color: '#000'},
  barTrack: {height: 8, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#000'},
  barFill: {height: '100%', backgroundColor: FB_COLOR},
  barValue: {fontSize: 10, color: '#64748b', fontWeight: '700'},
});
