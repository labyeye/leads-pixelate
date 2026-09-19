import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {linkedinAdsAPI, usersAPI, campaignAssignmentAPI} from '../services/api';
import {statusBadge} from '../lib/metaAdsShared';
import CampaignAssignmentList, {type AssignableCampaignRow} from '../components/CampaignAssignmentList';

export default function LinkedInCampaignManagementScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignableCampaignRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, usersRes, assignRes] = await Promise.all([
        linkedinAdsAPI.getConnectedAccounts(),
        usersAPI.getAll().catch(() => ({data: []} as any)),
        campaignAssignmentAPI.getAll('linkedin').catch(() => ({data: []} as any)),
      ]);
      setHasToken(!!connRes.hasToken);
      const accounts = connRes.data || [];
      const results = await Promise.allSettled(accounts.map((a: any) => linkedinAdsAPI.getCampaigns(a.adAccountId)));
      const newRows: AssignableCampaignRow[] = [];
      accounts.forEach((acc: any, i: number) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          (r.value.data || []).forEach((c: any) => {
            newRows.push({
              key: `linkedin:${c.id}`, platform: 'linkedin', name: c.name, subLabel: acc.adAccountName,
              status: statusBadge(c.status),
            });
          });
        }
      });
      setRows(newRows);
      setUsers(usersRes.data || []);
      const assignMap: Record<string, any> = {};
      (assignRes.data || []).forEach((a: any) => { assignMap[`linkedin:${a.campaignId}`] = a; });
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
        platform: 'linkedin', campaignId: row.key.split(':')[1], campaignName: row.name, assignedTo: userId || undefined,
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
        <Text style={styles.headerTitle}>LinkedIn Campaign Management</Text>
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
        emptyTitle={hasToken ? 'No LinkedIn campaigns' : 'LinkedIn not connected'}
        emptyDesc={hasToken ? 'No campaigns found on your connected ad accounts.' : 'Connect LinkedIn from the Lead Sync Setup screen to see campaigns here.'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 14, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
});
