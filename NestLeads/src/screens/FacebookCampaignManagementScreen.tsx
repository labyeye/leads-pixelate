import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {facebookAPI, usersAPI, campaignAssignmentAPI} from '../services/api';
import {parseInsight, statusBadge} from '../lib/metaAdsShared';
import CampaignAssignmentList, {type AssignableCampaignRow} from '../components/CampaignAssignmentList';

export default function FacebookCampaignManagementScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignableCampaignRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, usersRes, assignRes] = await Promise.all([
        facebookAPI.getMetaCampaigns(),
        usersAPI.getAll().catch(() => ({data: []} as any)),
        campaignAssignmentAPI.getAll('facebook').catch(() => ({data: []} as any)),
      ]);
      const list = campRes.data || [];
      const results = await Promise.allSettled(list.map((c: any) => facebookAPI.getMetaCampaignInsights(c.id)));
      const newRows: AssignableCampaignRow[] = list.map((c: any, i: number) => {
        const r = results[i];
        const ins = r.status === 'fulfilled' ? parseInsight(r.value.data) : undefined;
        return {
          key: `facebook:${c.id}`, platform: 'facebook', name: c.name, subLabel: c.adAccountName,
          status: statusBadge(c.status), spend: ins?.spend, results: ins?.results,
        };
      });
      setRows(newRows);
      setUsers(usersRes.data || []);
      const assignMap: Record<string, any> = {};
      (assignRes.data || []).forEach((a: any) => { assignMap[`facebook:${a.campaignId}`] = a; });
      setAssignments(assignMap);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (row: AssignableCampaignRow, userId: string) => {
    setSavingKey(row.key);
    try {
      await campaignAssignmentAPI.upsert({
        platform: 'facebook', campaignId: row.key.split(':')[1], campaignName: row.name, assignedTo: userId || undefined,
      });
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to assign');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facebook Campaign Management</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <CampaignAssignmentList
        rows={rows}
        loading={loading}
        users={users}
        assignments={assignments}
        savingKey={savingKey}
        onAssign={handleAssign}
        emptyTitle="No Facebook campaigns"
        emptyDesc="Connect a Facebook ad account from Integrations to see campaigns here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 15, fontWeight: '600', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
});
