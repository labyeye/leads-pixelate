import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, RefreshControl} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {facebookAPI, leadsAPI, whatsappAPI, campaignsAPI} from '../services/api';
import {parseInsight, PeriodFilterBar, usePeriodFilter} from '../lib/metaAdsShared';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

export default function CampaignReportsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const {period, setPeriod, periodOpts} = usePeriodFilter();

  const [metaTotals, setMetaTotals] = useState({spend: 0, results: 0, clicks: 0, impressions: 0});
  const [linkedinLeads, setLinkedinLeads] = useState(0);
  const [waSent, setWaSent] = useState(0);
  const [waDelivered, setWaDelivered] = useState(0);
  const [crmRunning, setCrmRunning] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [fbRes, liRes, waRes, crmRes] = await Promise.allSettled([
      facebookAPI.getMetaCampaigns(),
      leadsAPI.getAll({source: 'LinkedIn', limit: '1'}),
      whatsappAPI.getCampaigns(),
      campaignsAPI.getAll(),
    ]);

    if (fbRes.status === 'fulfilled') {
      const list = fbRes.value.data || [];
      const insightsRes = await Promise.allSettled(list.map((c: any) => facebookAPI.getMetaCampaignInsights(c.id, periodOpts as any)));
      const totals = {spend: 0, results: 0, clicks: 0, impressions: 0};
      insightsRes.forEach(r => {
        if (r.status === 'fulfilled') {
          const ins = parseInsight(r.value.data);
          totals.spend += ins.spend; totals.results += ins.results;
          totals.clicks += ins.clicks; totals.impressions += ins.impressions;
        }
      });
      setMetaTotals(totals);
    }
    if (liRes.status === 'fulfilled') {
      setLinkedinLeads((liRes.value as any).count ?? (liRes.value as any).data?.length ?? 0);
    }
    if (waRes.status === 'fulfilled') {
      const campaigns = waRes.value.data || [];
      setWaSent(campaigns.reduce((s: number, c: any) => s + (c.sentCount || 0), 0));
      setWaDelivered(campaigns.reduce((s: number, c: any) => s + (c.deliveredCount || 0), 0));
    }
    if (crmRes.status === 'fulfilled') {
      const campaigns = crmRes.value.data || [];
      setCrmRunning(campaigns.filter((c: any) => c.status === 'RUNNING').length);
    }
    setLoading(false);
    setRefreshing(false);
  }, [periodOpts]);

  useEffect(() => { load(); }, [load]);

  const ctr = metaTotals.impressions > 0 ? (metaTotals.clicks / metaTotals.impressions) * 100 : 0;
  const deliveryRate = waSent > 0 ? Math.round((waDelivered / waSent) * 100) : 0;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Reports & Analytics</Text>
          <Text style={styles.headerSub}>Cross-channel marketing performance</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#024BAB" />}>
          <PeriodFilterBar period={period} setPeriod={setPeriod} />

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={[styles.dot, {backgroundColor: '#1877F2'}]} />
              <Text style={styles.panelTitle}>Meta Ads</Text>
            </View>
            <View style={styles.kpiGrid}>
              <Kpi label="Spend" value={`₹${Math.round(metaTotals.spend).toLocaleString('en-IN')}`} />
              <Kpi label="Results" value={metaTotals.results.toLocaleString('en-IN')} />
              <Kpi label="Clicks" value={`${metaTotals.clicks.toLocaleString('en-IN')} · ${ctr.toFixed(1)}% CTR`} />
              <Kpi label="Impressions" value={metaTotals.impressions.toLocaleString('en-IN')} />
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={[styles.dot, {backgroundColor: '#0A66C2'}]} />
              <Text style={styles.panelTitle}>LinkedIn</Text>
            </View>
            <Kpi label="Leads (All Time)" value={String(linkedinLeads)} full />
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={[styles.dot, {backgroundColor: '#25D366'}]} />
              <Text style={styles.panelTitle}>WhatsApp</Text>
            </View>
            <View style={styles.kpiGrid}>
              <Kpi label="Sent" value={waSent.toLocaleString('en-IN')} />
              <Kpi label="Delivered" value={`${waDelivered.toLocaleString('en-IN')} · ${deliveryRate}%`} />
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={[styles.dot, {backgroundColor: '#FF751F'}]} />
              <Text style={styles.panelTitle}>CRM Campaigns</Text>
            </View>
            <Kpi label="Running" value={String(crmRunning)} full />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Kpi({label, value, full}: {label: string; value: string; full?: boolean}) {
  return (
    <View style={[styles.kpiBox, full && {width: '100%'}]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '600', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  body: {padding: 16, gap: 14},
  panel: {borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  panelHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  dot: {width: 10, height: 10, borderWidth: 1, borderColor: '#000'},
  panelTitle: {fontSize: 13, fontWeight: '600', color: '#000'},
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  kpiBox: {flexBasis: '47%', flexGrow: 1, borderWidth: 2, borderColor: '#e2e8f0', padding: 10},
  kpiValue: {fontSize: 16, fontWeight: '600', color: '#000'},
  kpiLabel: {fontSize: 9, fontWeight: '800', color: '#94a3b8', marginTop: 2, textTransform: 'uppercase'},
});
