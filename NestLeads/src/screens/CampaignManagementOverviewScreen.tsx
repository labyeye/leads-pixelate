import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {facebookAPI, linkedinAdsAPI, usersAPI, campaignAssignmentAPI} from '../services/api';
import {parseInsight, statusBadge} from '../lib/metaAdsShared';
import CampaignAssignmentList, {type AssignableCampaignRow} from '../components/CampaignAssignmentList';

export default function CampaignManagementOverviewScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignableCampaignRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fbRes, liConnRes, usersRes, fbAssignRes, liAssignRes] = await Promise.all([
        facebookAPI.getMetaCampaigns().catch(() => ({data: []} as any)),
        linkedinAdsAPI.getConnectedAccounts().catch(() => ({data: []} as any)),
        usersAPI.getAll().catch(() => ({data: []} as any)),
        campaignAssignmentAPI.getAll('facebook').catch(() => ({data: []} as any)),
        campaignAssignmentAPI.getAll('linkedin').catch(() => ({data: []} as any)),
      ]);

      const fbList = fbRes.data || [];
      const fbInsights = await Promise.allSettled(fbList.map((c: any) => facebookAPI.getMetaCampaignInsights(c.id)));
      const fbRows: AssignableCampaignRow[] = fbList.map((c: any, i: number) => {
        const r = fbInsights[i];
        const ins = r.status === 'fulfilled' ? parseInsight(r.value.data) : undefined;
        return {
          key: `facebook:${c.id}`, platform: 'facebook', name: c.name, subLabel: c.adAccountName,
          status: statusBadge(c.status), spend: ins?.spend, results: ins?.results,
        };
      });

      const liAccounts = liConnRes.data || [];
      const liCampRes = await Promise.allSettled(liAccounts.map((a: any) => linkedinAdsAPI.getCampaigns(a.adAccountId)));
      const liRows: AssignableCampaignRow[] = [];
      liAccounts.forEach((acc: any, i: number) => {
        const r = liCampRes[i];
        if (r.status === 'fulfilled') {
          (r.value.data || []).forEach((c: any) => {
            liRows.push({key: `linkedin:${c.id}`, platform: 'linkedin', name: c.name, subLabel: acc.adAccountName, status: statusBadge(c.status)});
          });
        }
      });

      setRows([...fbRows, ...liRows]);
      setUsers(usersRes.data || []);
      const assignMap: Record<string, any> = {};
      (fbAssignRes.data || []).forEach((a: any) => { assignMap[`facebook:${a.campaignId}`] = a; });
      (liAssignRes.data || []).forEach((a: any) => { assignMap[`linkedin:${a.campaignId}`] = a; });
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
        platform: row.platform, campaignId: row.key.split(':')[1], campaignName: row.name, assignedTo: userId || undefined,
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
        <Text style={styles.headerTitle}>Campaign Management Overview</Text>
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
        showPlatformColumn
        emptyTitle="No campaigns"
        emptyDesc="Connect Facebook or LinkedIn ad accounts from Integrations to see campaigns here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 13, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
});
