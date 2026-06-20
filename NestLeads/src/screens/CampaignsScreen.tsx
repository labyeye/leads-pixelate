import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {campaignsAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const STATUS_CONFIG: Record<string, {bg: string; text: string; icon: string}> = {
  draft:      {bg: '#e2e8f0', text: '#000', icon: 'create-outline'},
  scheduled:  {bg: '#FFDE00', text: '#000', icon: 'time-outline'},
  running:    {bg: '#024BAB', text: '#fff', icon: 'play-circle-outline'},
  paused:     {bg: '#FF751F', text: '#fff', icon: 'pause-circle-outline'},
  completed:  {bg: '#22c55e', text: '#fff', icon: 'checkmark-circle-outline'},
  cancelled:  {bg: '#ef4444', text: '#fff', icon: 'close-circle-outline'},
  failed:     {bg: '#000',    text: '#fff', icon: 'alert-circle-outline'},
};

export default function CampaignsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await campaignsAPI.getAll();
      setCampaigns(res.data || []);
    } catch (e: any) {Alert.alert('Error', e.message || 'Failed to load campaigns');}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchCampaigns();}, [fetchCampaigns]);

  const handleAction = (campaign: any, action: 'launch' | 'pause' | 'cancel' | 'delete') => {
    const labels: Record<string, string> = {
      launch: 'Launch', pause: 'Pause', cancel: 'Cancel', delete: 'Delete',
    };
    Alert.alert(`${labels[action]} Campaign`, `Are you sure you want to ${action} "${campaign.name}"?`, [
      {text: 'No', style: 'cancel'},
      {
        text: labels[action],
        style: action === 'delete' || action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            if (action === 'delete') await campaignsAPI.delete(campaign._id);
            else if (action === 'launch') await campaignsAPI.launch(campaign._id);
            else if (action === 'pause') await campaignsAPI.pause(campaign._id);
            else if (action === 'cancel') await campaignsAPI.cancel(campaign._id);
            fetchCampaigns();
          } catch (e: any) {Alert.alert('Error', e.message);}
        },
      },
    ]);
  };

  const renderCard = ({item: c}: {item: any}) => {
    const status = (c.status || 'draft').toLowerCase();
    const sc = STATUS_CONFIG[status] || {bg: '#e2e8f0', text: '#000', icon: 'megaphone-outline'};
    const deliveredRate = c.totalCount > 0 ? Math.round((c.deliveredCount / c.totalCount) * 100) : 0;
    const readRate = c.totalCount > 0 ? Math.round((c.readCount / c.totalCount) * 100) : 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.megaphoneBox}>
            <Icon name="megaphone-outline" size={18} color="#024BAB" />
          </View>
          <View style={styles.cardTitle}>
            <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
            {c.templateSnapshot?.displayName ? (
              <Text style={styles.templateName} numberOfLines={1}>
                Template: {c.templateSnapshot.displayName}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, {backgroundColor: sc.bg}]}>
            <Icon name={sc.icon} size={10} color={sc.text} />
            <Text style={[styles.statusText, {color: sc.text}]}>{status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{c.totalCount || 0}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{c.sentCount || 0}</Text>
            <Text style={styles.statLabel}>SENT</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, {color: '#024BAB'}]}>{deliveredRate}%</Text>
            <Text style={styles.statLabel}>DELIVERED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, {color: '#22c55e'}]}>{readRate}%</Text>
            <Text style={styles.statLabel}>READ</Text>
          </View>
        </View>

        {c.totalCount > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {width: `${deliveredRate}%` as any}]} />
          </View>
        )}

        {/* Meta */}
        <View style={styles.cardMeta}>
          {c.createdAt ? (
            <View style={styles.metaItem}>
              <Icon name="calendar-outline" size={11} color="#94a3b8" />
              <Text style={styles.metaText}>
                {new Date(c.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}
              </Text>
            </View>
          ) : null}
          {c.createdBy?.name ? (
            <View style={styles.metaItem}>
              <Icon name="person-outline" size={11} color="#94a3b8" />
              <Text style={styles.metaText}>{c.createdBy.name}</Text>
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {status === 'draft' || status === 'scheduled' ? (
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#024BAB', borderColor: '#000'}]}
              onPress={() => handleAction(c, 'launch')}>
              <Icon name="play" size={12} color="#fff" />
              <Text style={[styles.actionBtnText, {color: '#fff'}]}>Launch</Text>
            </TouchableOpacity>
          ) : null}
          {status === 'running' ? (
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#FFDE00', borderColor: '#000'}]}
              onPress={() => handleAction(c, 'pause')}>
              <Icon name="pause" size={12} color="#000" />
              <Text style={styles.actionBtnText}>Pause</Text>
            </TouchableOpacity>
          ) : null}
          {status === 'paused' ? (
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#024BAB', borderColor: '#000'}]}
              onPress={() => handleAction(c, 'launch')}>
              <Icon name="play" size={12} color="#fff" />
              <Text style={[styles.actionBtnText, {color: '#fff'}]}>Resume</Text>
            </TouchableOpacity>
          ) : null}
          {(status === 'draft' || status === 'running' || status === 'paused') ? (
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: '#ef4444', borderColor: '#000'}]}
              onPress={() => handleAction(c, 'cancel')}>
              <Icon name="stop" size={12} color="#fff" />
              <Text style={[styles.actionBtnText, {color: '#fff'}]}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleAction(c, 'delete')}>
            <Icon name="trash-outline" size={12} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Summary counts
  const counts = campaigns.reduce((acc: Record<string, number>, c) => {
    const s = (c.status || 'draft').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Campaigns</Text>
          <Text style={styles.headerSub}>{campaigns.length} total</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {/* Status summary */}
      <View style={styles.summaryStrip}>
        {(['running', 'scheduled', 'paused', 'completed'] as const).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <View key={s} style={[styles.summaryChip, {backgroundColor: cfg.bg}]}>
              <Icon name={cfg.icon} size={12} color={cfg.text} />
              <Text style={[styles.summaryChipCount, {color: cfg.text}]}>{counts[s] || 0}</Text>
              <Text style={[styles.summaryChipLabel, {color: cfg.text}]}>{s.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={i => i._id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCampaigns(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="megaphone-outline" size={44} color="#e2e8f0" />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <Text style={styles.emptySub}>Create campaigns from the web app</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  summaryStrip: {flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6},
  summaryChip: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderWidth: 2, borderColor: '#000', gap: 3},
  summaryChipCount: {fontSize: 13, fontWeight: '900'},
  summaryChipLabel: {fontSize: 7, fontWeight: '900', textTransform: 'uppercase'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12},
  megaphoneBox: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff'},
  cardTitle: {flex: 1},
  campaignName: {fontSize: 14, fontWeight: '900', color: '#000'},
  templateName: {fontSize: 11, color: '#64748b', marginTop: 2},
  statusBadge: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderWidth: 2, borderColor: '#000', gap: 3},
  statusText: {fontSize: 8, fontWeight: '900'},
  statsRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  statBox: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 16, fontWeight: '900', color: '#000'},
  statLabel: {fontSize: 7, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1},
  statDivider: {width: 1, height: 30, backgroundColor: '#e2e8f0'},
  progressBar: {height: 4, backgroundColor: '#e2e8f0', borderWidth: 0.5, borderColor: '#000', overflow: 'hidden', marginBottom: 8},
  progressFill: {height: '100%', backgroundColor: '#024BAB'},
  cardMeta: {flexDirection: 'row', gap: 12, marginBottom: 10},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 11, color: '#94a3b8'},
  actionRow: {flexDirection: 'row', gap: 6, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 2, borderColor: '#000'},
  actionBtnText: {fontSize: 11, fontWeight: '900', color: '#000'},
  deleteBtn: {backgroundColor: '#fff', marginLeft: 'auto'},
  deleteBtnText: {fontSize: 11, fontWeight: '900', color: '#ef4444'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 8},
  emptyTitle: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptySub: {fontSize: 12, color: '#cbd5e1'},
});
