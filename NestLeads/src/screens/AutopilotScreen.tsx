import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {autopilotAPI} from '../services/api';
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

// Social Autopilot on mobile: the same three pages as the web app.
export default function AutopilotScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<any>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState('');
  const chosen = useRef(false);

  const reload = useCallback(async () => {
    try {
      const res = await autopilotAPI.get();
      setStatus(res.data);
      setError('');
      // A new tenant starts in Setup, everyone else on the Dashboard.
      if (!chosen.current) {
        chosen.current = true;
        setTab(res.data.onboarded === false ? 'setup' : 'dashboard');
      }
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Could not load Autopilot');
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
    // Status changes on its own (a run finishes, a trial ends); keep it fresh.
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (error && !status) Alert.alert('Autopilot', error);
  }, [error, status]);

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

      {!status || !tab ? (
        <View style={s.center}>
          {error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator size="large" color={PRIMARY} />}
        </View>
      ) : tab === 'dashboard' ? (
        <AutopilotDashboardTab status={status} reloadStatus={reload} onGoSetup={() => setTab('setup')} />
      ) : tab === 'setup' ? (
        <AutopilotSetupTab status={status} reloadStatus={reload} />
      ) : (
        <AutopilotReportTab />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f1f5f9'},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 2, borderBottomColor: '#000'},
  backBtn: {width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#fff'},
  title: {fontSize: 18, fontWeight: '900', color: '#000'},
  tabs: {flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  tab: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: '#000', paddingVertical: 8, backgroundColor: '#fff'},
  tabActive: {backgroundColor: PRIMARY},
  tabText: {fontSize: 12, fontWeight: '800', color: '#000'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20},
  error: {color: '#b91c1c', fontSize: 14, textAlign: 'center'},
});
