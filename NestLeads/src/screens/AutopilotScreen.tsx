import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Alert, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import NewCampaignModal from '../components/autopilot/NewCampaignModal';
import {Chip} from '../components/autopilot/ui';
import {autopilotAPI} from '../services/api';
import {Selection, pickCampaign} from '../lib/autopilot';
import AutopilotDashboardTab from './autopilot/AutopilotDashboardTab';
import AutopilotSetupTab from './autopilot/AutopilotSetupTab';
import AutopilotReportTab from './autopilot/AutopilotReportTab';

const PRIMARY = '#024BAB';
type Tab = 'dashboard' | 'setup' | 'report';
const TABS: {id: Tab; label: string; icon: string}[] = [
  {id: 'dashboard', label: 'Dashboard', icon: 'grid-outline'},
  {id: 'setup', label: 'Setup', icon: 'settings-outline'},
  {id: 'report', label: 'Report', icon: 'stats-chart-outline'},
];

// Social Autopilot on mobile: the same three pages as the web app, for one campaign or all of them.
export default function AutopilotScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<any>(null);
  const [status, setStatus] = useState<any>(null); // the selected campaign's full state
  const [tab, setTab] = useState<Tab | null>(null);
  const [wanted, setWanted] = useState<Selection>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  const selection: Selection = overview ? pickCampaign(overview.campaigns, wanted, tab !== 'setup') : null;
  const campaignId = selection && selection !== 'all' ? selection : null;

  const reloadOverview = useCallback(async () => {
    try {
      const res = await autopilotAPI.overview();
      setOverview(res.data);
      setError('');
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Could not load Autopilot');
      return null;
    }
  }, []);

  const reloadStatus = useCallback(async () => {
    if (!campaignId) return null;
    try {
      const res = await autopilotAPI.campaign(campaignId).get();
      setStatus(res.data);
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Could not load the campaign');
      return null;
    }
  }, [campaignId]);

  useEffect(() => {
    reloadOverview();
    // Status changes on its own (a run finishes, a trial ends); keep it fresh.
    const t = setInterval(reloadOverview, 15_000);
    return () => clearInterval(t);
  }, [reloadOverview]);

  useEffect(() => {
    setStatus(null); // another campaign: don't show the previous one's data
    if (!campaignId) return;
    reloadStatus();
    const t = setInterval(reloadStatus, 15_000);
    return () => clearInterval(t);
  }, [campaignId, reloadStatus]);

  // A campaign that is not set up yet starts in Setup, everything else on the Dashboard.
  useEffect(() => {
    if (started.current || !overview) return;
    if (!overview.campaigns.length || selection === 'all') {
      started.current = true;
      setTab('dashboard');
    } else if (status) {
      started.current = true;
      setTab(status.onboarded === false ? 'setup' : 'dashboard');
    }
  }, [overview, selection, status]);

  useEffect(() => {
    if (error && !overview) Alert.alert('Autopilot', error);
  }, [error, overview]);

  const campaigns: any[] = overview?.campaigns ?? [];
  const canAdd = overview && campaigns.length < overview.limits.campaigns;
  const onCreated = async (id: string) => {
    setNewOpen(false);
    await reloadOverview();
    setWanted(id);
    setTab('setup');
  };

  return (
    <View style={[s.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Back">
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.title}>Social Autopilot</Text>
      </View>
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{selected: tab === t.id}}
            onPress={() => setTab(t.id)}
            style={[s.tab, tab === t.id && s.tabActive]}>
            <Icon name={t.icon} size={15} color={tab === t.id ? '#fff' : '#000'} />
            <Text style={[s.tabText, tab === t.id && {color: '#fff'}]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {overview ? (
        <View style={s.campaignBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 8}}>
            {tab !== 'setup' && campaigns.length > 1 ? (
              <Chip label="All campaigns" active={selection === 'all'} onPress={() => setWanted('all')} />
            ) : null}
            {campaigns.map(c => (
              <Chip
                key={c.id}
                label={c.enabled ? c.name : `${c.name} · paused`}
                active={selection === c.id}
                onPress={() => setWanted(c.id)}
              />
            ))}
            {canAdd ? <Chip label="+ New campaign" active={false} onPress={() => setNewOpen(true)} /> : null}
          </ScrollView>
        </View>
      ) : null}

      {!overview || !tab ? (
        <View style={s.center}>
          {error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator size="large" color={PRIMARY} />}
        </View>
      ) : tab === 'dashboard' ? (
        <AutopilotDashboardTab
          overview={overview}
          selection={selection}
          status={status}
          reloadOverview={reloadOverview}
          reloadStatus={reloadStatus}
          onGoSetup={() => setTab('setup')}
          onSelect={setWanted}
          onNew={() => setNewOpen(true)}
        />
      ) : tab === 'setup' ? (
        campaignId && status ? (
          <AutopilotSetupTab
            key={campaignId}
            overview={overview}
            status={status}
            reloadStatus={reloadStatus}
            reloadOverview={reloadOverview}
            onDeleted={() => {
              setWanted(null);
              setTab('dashboard');
            }}
          />
        ) : campaigns.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>Create your first campaign</Text>
            <Text style={s.emptyText}>
              Each campaign has its own accounts, brand, logos, schedule, references and competitors.
            </Text>
            <TouchableOpacity style={s.createBtn} onPress={() => setNewOpen(true)}>
              <Text style={s.createText}>New campaign</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        )
      ) : (
        <AutopilotReportTab overview={overview} selection={selection} />
      )}

      <NewCampaignModal
        visible={newOpen}
        limit={overview?.limits.campaigns}
        onClose={() => setNewOpen(false)}
        onCreated={onCreated}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f1f5f9'},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 2, borderBottomColor: '#000'},
  backBtn: {width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#fff'},
  title: {fontSize: 18, fontWeight: '900', color: '#000'},
  tabs: {flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, gap: 8},
  tab: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: '#000', paddingVertical: 8, backgroundColor: '#fff'},
  tabActive: {backgroundColor: PRIMARY},
  tabText: {fontSize: 12, fontWeight: '800', color: '#000'},
  campaignBar: {backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20},
  error: {color: '#b91c1c', fontSize: 14, textAlign: 'center'},
  emptyTitle: {fontSize: 18, fontWeight: '900', color: '#000', marginBottom: 6},
  emptyText: {fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 14},
  createBtn: {backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', paddingVertical: 11, paddingHorizontal: 18},
  createText: {color: '#fff', fontWeight: '800', fontSize: 13},
});
