import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import SourceBadge from '../components/SourceBadge';
import UserAvatar from '../components/UserAvatar';
import { PieChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;

const Logo = require('../assets/images/Logo.png');

const PRIMARY = '#024BAB';
const SECONDARY = '#FF751F';

const PIE_COLORS = [
  '#024BAB', '#FF751F', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444',
  '#10b981', '#6366f1',
];

const FUNNEL_ICONS: Record<string, string> = {
  'New Lead': 'flash-outline',
  'Discussion/Requirement': 'chatbubbles-outline',
  Quotation: 'document-text-outline',
  'Visit Scheduled': 'calendar-outline',
  Visited: 'eye-outline',
  Negotiation: 'swap-horizontal-outline',
  Client: 'star-outline',
  Dropped: 'close-circle-outline',
};
const getFunnelIcon = (label: string) =>
  FUNNEL_ICONS[label] || 'funnel-outline';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

type Period = 'all' | 'today' | 'week' | 'month';

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [notifOpen, setNotifOpen] = useState(false);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [sourceFocusedIdx, setSourceFocusedIdx] = useState(0);
  const [activities, setActivities] = useState<
    { type: string; label: string; time: Date }[]
  >([]);

  const fetchAll = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const statsRes = await dashboardAPI.getStats();
      if (statsRes.success) setData(statsRes.data);
      // Load recent leads for notifications
      try {
        const { leadsAPI } = require('../services/api');
        const leadsRes = await leadsAPI.getAll();
        const all = leadsRes.data || [];
        const sorted = [...all].sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        setRecentLeads(sorted.slice(0, 10));
      } catch {
        /* ignore */
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // Record this login session
    setActivities([
      {
        type: 'login',
        label: `Logged in as ${user?.name || 'User'}`,
        time: new Date(),
      },
    ]);
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? 'Good Morning,'
      : hour < 17
      ? 'Good Afternoon,'
      : 'Good Evening,';

  const newLeadsValue = data?.stats
    ? period === 'today'
      ? data.stats.newLeadsToday
      : period === 'week'
      ? data.stats.newLeadsThisWeek
      : period === 'month'
      ? data.stats.leadsThisMonth
      : data.stats.totalLeads ?? 0
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header — NestHR structure, neubrutalism style */}
      <View style={styles.header}>
        <UserAvatar
          name={user?.name}
          avatar={user?.avatar}
          size={50}
          index={0}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerGreeting}>{greeting}</Text>
          <Text style={styles.headerName}>
            {(user?.name || 'User').toUpperCase()}
          </Text>
          <Text style={styles.headerCompany}>NestLeads CRM</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => setNotifOpen(true)}
        >
          <Icon name="notifications" size={28} color="#000" />
          {recentLeads.length > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {recentLeads.length > 9 ? '9+' : recentLeads.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAll(true)}
              tintColor={PRIMARY}
            />
          }
        >
          {/* Period selector */}
          <View style={styles.periodWrap}>
            <View style={styles.periodRow}>
              {(['all', 'today', 'week', 'month'] as Period[]).map((p, i) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.periodBtn,
                    i === 3 && styles.periodBtnLast,
                    period === p && styles.periodBtnActive,
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      period === p && styles.periodBtnTextActive,
                    ]}
                  >
                    {p === 'all'
                      ? 'All'
                      : p === 'today'
                      ? 'Today'
                      : p === 'week'
                      ? 'Week'
                      : 'Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Alert strip */}
          {data?.stats &&
            (data.stats.overdueFollowUps > 0 || data.stats.hotLeads > 0) && (
              <View style={styles.alertStrip}>
                <Icon name="warning-outline" size={14} color={SECONDARY} />
                <Text style={styles.alertText}>Action needed: </Text>
                {data.stats.hotLeads > 0 && (
                  <View style={styles.alertPill}>
                    <Icon name="flame" size={11} color="#fff" />
                    <Text style={styles.alertPillText}>
                      {data.stats.hotLeads} hot
                    </Text>
                  </View>
                )}
                {data.stats.overdueFollowUps > 0 && (
                  <View style={[styles.alertPill, { backgroundColor: '#000' }]}>
                    <Icon name="time-outline" size={11} color="#fff" />
                    <Text style={styles.alertPillText}>
                      {data.stats.overdueFollowUps} overdue
                    </Text>
                  </View>
                )}
              </View>
            )}

          {/* OVERVIEW — 2×3 stat cards */}
          <Text style={styles.sectionLabel}>OVERVIEW</Text>
          <View style={styles.kpiRow}>
            <KpiCard
              title="NEW LEADS"
              value={newLeadsValue}
              icon="flash-outline"
              iconBg={PRIMARY}
              iconColor="#fff"
            />
            <KpiCard
              title="FOLLOW-UPS"
              value={data?.todayFollowUps?.length ?? 0}
              icon="calendar-outline"
              iconBg="#10b981"
              iconColor="#fff"
            />
          </View>
          <View style={[styles.kpiRow, { marginTop: 10 }]}>
            <KpiCard
              title="HOT LEADS"
              value={data?.stats?.hotLeads ?? 0}
              icon="flame-outline"
              iconBg={SECONDARY}
              iconColor="#fff"
              urgent
            />
            <KpiCard
              title="OVERDUE"
              value={data?.stats?.overdueFollowUps ?? 0}
              icon="time-outline"
              iconBg="#ef4444"
              iconColor="#fff"
            />
          </View>
          <View style={[styles.kpiRow, { marginTop: 10 }]}>
            <KpiCard
              title="CONVERTED"
              value={data?.stats?.convertedClients ?? 0}
              icon="checkmark-circle-outline"
              iconBg="#10b981"
              iconColor="#fff"
            />
            <KpiCard
              title="TOTAL LEADS"
              value={data?.stats?.totalLeads ?? 0}
              icon="people-outline"
              iconBg={PRIMARY}
              iconColor="#fff"
            />
          </View>

          {/* THIS MONTH / PERIOD list */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            {period === 'all' ? 'OVERALL' : `THIS ${period.toUpperCase()}`}
          </Text>
          <View style={[styles.section, { padding: 0 }]}>
            <MonthRow
              icon="flash-outline"
              iconBg={PRIMARY}
              label="New Leads"
              value={newLeadsValue}
            />
            <View style={styles.rowDivider} />
            <MonthRow
              icon="calendar-outline"
              iconBg="#10b981"
              label="Follow-ups"
              value={data?.todayFollowUps?.length ?? 0}
            />
            <View style={styles.rowDivider} />
            <MonthRow
              icon="flame-outline"
              iconBg={SECONDARY}
              label="Hot Leads"
              value={data?.stats?.hotLeads ?? 0}
            />
            <View style={styles.rowDivider} />
            <MonthRow
              icon="checkmark-circle-outline"
              iconBg="#10b981"
              label="Clients Won"
              value={data?.stats?.convertedClients ?? 0}
            />
          </View>

          {/* Sales Funnel */}
          {data?.funnelStages?.length > 0 && (
            <View style={[styles.section, { marginTop: 12 }]}>
              <Text style={styles.sectionLabel}>SALES FUNNEL</Text>
              {data.funnelStages.map((stage: any, idx: number) => {
                const max = Math.max(
                  ...data.funnelStages.map((s: any) => s.count),
                  1,
                );
                const pct = Math.max((stage.count / max) * 100, 4);
                const fillColor = idx % 2 === 0 ? PRIMARY : SECONDARY;
                return (
                  <View key={stage.label} style={styles.funnelRow}>
                    <View
                      style={[
                        styles.funnelIconBox,
                        { backgroundColor: fillColor },
                      ]}
                    >
                      <Icon
                        name={getFunnelIcon(stage.label)}
                        size={11}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.funnelLabel} numberOfLines={1}>
                      {stage.label}
                    </Text>
                    <View style={styles.funnelBar}>
                      <View
                        style={[
                          styles.funnelFill,
                          {
                            width: `${pct}%` as any,
                            backgroundColor: fillColor + '44',
                          },
                        ]}
                      />
                      <Text style={styles.funnelCount}>{stage.count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Today's Follow-ups */}
          <View style={[styles.section, { marginTop: 12 }]}>
            <Text style={styles.sectionLabel}>TODAY'S FOLLOW-UPS</Text>
            {data?.todayFollowUps?.length > 0 ? (
              data.todayFollowUps.slice(0, 6).map((lead: any, idx: number) => (
                <TouchableOpacity
                  key={lead._id}
                  style={styles.leadItem}
                  onPress={() =>
                    navigation?.navigate('LeadsStack', {
                      screen: 'LeadDetail',
                      params: { leadId: lead._id },
                    })
                  }
                >
                  <UserAvatar
                    name={lead.assignedTo?.name || lead.name}
                    avatar={lead.assignedTo?.avatar}
                    size={34}
                    index={idx}
                  />
                  <View style={styles.leadInfo}>
                    <Text style={styles.leadName} numberOfLines={1}>
                      {lead.name}
                    </Text>
                    <Text style={styles.leadSub} numberOfLines={1}>
                      {lead.company || lead.phone}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Icon
                  name="checkmark-circle-outline"
                  size={32}
                  color="#22c55e"
                />
                <Text style={styles.emptyTitle}>All clear for today!</Text>
                <Text style={styles.emptySub}>No follow-ups scheduled</Text>
              </View>
            )}
          </View>

          {/* Source Breakdown — Pie Chart */}
          {data?.sourceData?.length > 0 && (() => {
            const total = data.sourceData.reduce((a: number, s: any) => a + (s.value || 0), 0) || 1;
            const pieData = data.sourceData.map((s: any, idx: number) => ({
              value: s.value || 0,
              color: PIE_COLORS[idx % PIE_COLORS.length],
              label: s.name,
            }));
            const safeIdx = Math.min(sourceFocusedIdx, pieData.length - 1);
            const focused = pieData[safeIdx];
            const focusedPct = Math.round((focused.value / total) * 100);
            return (
              <View style={[styles.section, { marginTop: 12 }]}>
                <Text style={styles.sectionLabel}>LEADS BY SOURCE</Text>
                <View style={styles.pieWrapper}>
                  <View style={styles.pieChartBox}>
                    <PieChart
                      data={pieData}
                      donut
                      radius={90}
                      innerRadius={58}
                      innerCircleColor={'#fff'}
                      innerCircleBorderWidth={2}
                      innerCircleBorderColor={'#000'}
                      strokeWidth={2}
                      strokeColor={'#000'}
                      focusOnPress
                      onPress={(_item: any, idx: number) => setSourceFocusedIdx(idx)}
                      centerLabelComponent={() => (
                        <View style={styles.pieCenterLabel}>
                          <Text style={[styles.pieCenterValue, { color: focused.color }]}>
                            {focused.value}
                          </Text>
                          <Text style={styles.pieCenterPct}>{focusedPct}%</Text>
                          <Text style={styles.pieCenterName} numberOfLines={2}>
                            {focused.label}
                          </Text>
                        </View>
                      )}
                    />
                  </View>

                  <View style={styles.pieLegend}>
                    {pieData.map((item: any, idx: number) => {
                      const pct = Math.round((item.value / total) * 100);
                      const isActive = idx === safeIdx;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={[styles.pieLegendRow, isActive && styles.pieLegendRowActive]}
                          onPress={() => setSourceFocusedIdx(idx)}
                          activeOpacity={0.7}>
                          <View style={[styles.pieLegendDot, { backgroundColor: item.color }]} />
                          <Text style={styles.pieLegendLabel} numberOfLines={1}>{item.label}</Text>
                          <Text style={[styles.pieLegendVal, { color: item.color }]}>{item.value}</Text>
                          <Text style={styles.pieLegendPct}>{pct}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Leaderboard */}
          {data?.userPerformance?.length > 0 && (
            <View style={[styles.section, { marginTop: 12 }]}>
              <Text style={styles.sectionLabel}>TEAM LEADERBOARD</Text>
              {data.userPerformance.map((p: any, i: number) => {
                const rate =
                  p.leadsCount > 0
                    ? Math.round((p.conversions / p.leadsCount) * 100)
                    : 0;
                return (
                  <View key={p._id} style={styles.lbRow}>
                    <UserAvatar
                      name={p.name}
                      avatar={p.avatar}
                      size={34}
                      index={i}
                    />
                    <View style={styles.lbInfo}>
                      <Text style={styles.lbName}>{p.name}</Text>
                      <View style={styles.lbBar}>
                        <View
                          style={[
                            styles.lbFill,
                            {
                              width: `${rate}%` as any,
                              backgroundColor:
                                i % 2 === 0 ? PRIMARY : SECONDARY,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.lbRight}>
                      <Text style={styles.lbConv}>{p.conversions}</Text>
                      <Text style={styles.lbLeads}>{p.leadsCount} leads</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Notifications Modal */}
      <Modal
        visible={notifOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifOpen(false)}
      >
        <View style={styles.notifOverlay}>
          <View style={styles.notifSheet}>
            {/* Modal Header */}
            <View style={styles.notifHeader}>
              <View style={styles.notifHeaderLeft}>
                <View style={styles.notifHeaderIcon}>
                  <Icon name="notifications" size={16} color="#fff" />
                </View>
                <Text style={styles.notifHeaderTitle}>Notifications</Text>
              </View>
              <TouchableOpacity
                style={styles.notifCloseBtn}
                onPress={() => setNotifOpen(false)}
              >
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.notifDivider} />

            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            >
              {/* Activity Log */}
              <View style={styles.notifSection}>
                <Text style={styles.notifSectionLabel}>SESSION ACTIVITY</Text>
                {activities.map((act, i) => (
                  <View key={i} style={styles.notifItem}>
                    <View
                      style={[
                        styles.notifItemIcon,
                        {
                          backgroundColor:
                            act.type === 'login' ? PRIMARY : '#ef4444',
                        },
                      ]}
                    >
                      <Icon
                        name={
                          act.type === 'login'
                            ? 'log-in-outline'
                            : 'log-out-outline'
                        }
                        size={14}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.notifItemInfo}>
                      <Text style={styles.notifItemTitle}>{act.label}</Text>
                      <Text style={styles.notifItemTime}>
                        {act.time.toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.notifItemBadge,
                        {
                          backgroundColor:
                            act.type === 'login' ? PRIMARY : '#ef4444',
                        },
                      ]}
                    >
                      <Text style={styles.notifItemBadgeText}>
                        {act.type === 'login' ? 'IN' : 'OUT'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.notifDivider} />

              {/* Recent Leads */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionRow}>
                  <Text style={styles.notifSectionLabel}>RECENT LEADS</Text>
                  <View style={styles.notifCount}>
                    <Text style={styles.notifCountText}>
                      {recentLeads.length}
                    </Text>
                  </View>
                </View>
                {recentLeads.length === 0 ? (
                  <View style={styles.notifEmpty}>
                    <Icon name="people-outline" size={28} color="#e2e8f0" />
                    <Text style={styles.notifEmptyText}>No recent leads</Text>
                  </View>
                ) : (
                  recentLeads.map((l, i) => (
                    <TouchableOpacity
                      key={l._id || i}
                      style={styles.notifItem}
                      onPress={() => {
                        setNotifOpen(false);
                        navigation?.navigate('LeadsStack', {
                          screen: 'LeadDetail',
                          params: { leadId: l._id },
                        });
                      }}
                    >
                      <UserAvatar
                        name={l.assignedTo?.name || l.name}
                        avatar={l.assignedTo?.avatar}
                        size={38}
                        index={i}
                      />
                      <View style={styles.notifItemInfo}>
                        <Text style={styles.notifItemTitle}>
                          {l.name || '—'}
                        </Text>
                        <Text style={styles.notifItemSub} numberOfLines={1}>
                          {l.source ? `via ${l.source}` : ''}
                          {l.company ? ` · ${l.company}` : ''}
                        </Text>
                        {l.createdAt && (
                          <Text style={styles.notifItemTime}>
                            {new Date(l.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                      <View style={styles.notifLeadStatus}>
                        <Text style={styles.notifLeadStatusText}>
                          {(l.status || 'NEW').slice(0, 8)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function KpiCard({ title, value, icon, iconBg, iconColor, urgent }: any) {
  return (
    <View style={[styles.kpiCard, urgent && styles.kpiCardUrgent]}>
      <View style={[styles.kpiIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </View>
  );
}

function MonthRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.monthRow}>
      <View style={[styles.monthRowIcon, { backgroundColor: iconBg + '22' }]}>
        <Icon name={icon} size={16} color={iconBg} />
      </View>
      <Text style={styles.monthRowLabel}>{label}</Text>
      <Text style={styles.monthRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header — NestHR structure with neubrutalism style
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  headerAvatarText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerInfo: { flex: 1 },
  headerGreeting: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  headerName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.3,
  },
  headerCompany: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  bellBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    backgroundColor: PRIMARY,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  bellBadgeText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  // Notification modal
  notifOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  notifSheet: {
    backgroundColor: '#fff',
    borderTopWidth: 3,
    borderTopColor: '#000',
    maxHeight: '88%',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifHeaderIcon: {
    width: 32,
    height: 32,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  notifCloseBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDivider: { height: 2, backgroundColor: '#000' },
  notifSection: { padding: 16 },
  notifSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notifSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  notifCount: {
    backgroundColor: SECONDARY,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  notifCountText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  notifItemIcon: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifItemInitial: { fontSize: 15, fontWeight: '900', color: '#fff' },
  notifItemInfo: { flex: 1 },
  notifItemTitle: { fontSize: 13, fontWeight: '700', color: '#000' },
  notifItemSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  notifItemTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  notifItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
  },
  notifItemBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  notifLeadStatus: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  notifLeadStatusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
  },
  notifEmpty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  notifEmptyText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  divider: { height: 2, backgroundColor: '#000' },

  // Category tabs
  tabsRow: { paddingLeft: 12, paddingRight: 12, paddingVertical: 8, gap: 6 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 34,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    gap: 5,
  },
  tabActive: { backgroundColor: PRIMARY },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tabTextActive: { color: '#fff' },
  tabCount: {
    minWidth: 18,
    height: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: '#fff' },
  tabCountText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  tabCountTextActive: { color: PRIMARY },
  tabDivider: { height: 2, backgroundColor: '#000' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, gap: 0 },

  // Period selector
  periodWrap: { marginBottom: 12 },
  periodRow: { flexDirection: 'row', borderWidth: 2, borderColor: '#000' },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#000',
    alignItems: 'center',
  },
  periodBtnLast: { borderRightWidth: 0 },
  periodBtnActive: { backgroundColor: PRIMARY },
  periodBtnText: { fontSize: 11, fontWeight: '700', color: '#000' },
  periodBtnTextActive: { color: '#fff' },

  // Alert
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: SECONDARY,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 12,
  },
  alertText: { fontSize: 11, fontWeight: '700', color: SECONDARY },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SECONDARY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    borderWidth: 1,
    borderColor: '#000',
  },
  alertPillText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionCount: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  sectionCountText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  // KPI cards — 2 per row
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    ...NB_SHADOW,
  },
  kpiCardUrgent: { backgroundColor: '#fff7ed' },
  kpiIcon: {
    width: 46,
    height: 46,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: { fontSize: 32, fontWeight: '900', color: '#000', lineHeight: 36 },
  kpiTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  // Section box
  section: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    ...NB_SHADOW,
  },

  // This Month rows
  rowDivider: { height: 1, backgroundColor: '#e2e8f0' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  monthRowIcon: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRowLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#000' },
  monthRowValue: { fontSize: 16, fontWeight: '900', color: '#000' },

  // Funnel
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  funnelIconBox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  funnelLabel: { width: 70, fontSize: 11, fontWeight: '700', color: '#000' },
  funnelBar: {
    flex: 1,
    height: 28,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  funnelFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  funnelCount: {
    paddingLeft: 8,
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },

  // Lead items
  leadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  leadAvatar: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  leadInfo: { flex: 1 },
  leadName: { fontSize: 13, fontWeight: '700', color: '#000' },
  leadSub: { fontSize: 11, color: '#64748b' },
  leadRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leadStatus: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    maxWidth: 80,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
  },
  viewMoreText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#000', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Pie chart
  pieWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  pieChartBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pieCenterValue: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  pieCenterPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  pieCenterName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
    maxWidth: 80,
  },
  pieLegend: {
    flex: 1,
    gap: 6,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pieLegendRowActive: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#000',
  },
  pieLegendLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  pieLegendVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  pieLegendPct: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    minWidth: 30,
    textAlign: 'right',
  },

  // Source (legacy bar rows — kept for fallback)
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  sourceInfo: { flex: 1 },
  sourceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceLabel: { fontSize: 12, fontWeight: '700', color: '#000' },
  sourceCount: { fontSize: 12, fontWeight: '900', color: '#000' },
  sourcePct: { fontSize: 10, fontWeight: '500', color: '#64748b' },
  sourceBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  sourceBarFill: { height: '100%' },

  // Leaderboard
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  lbRank: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbRankText: { fontSize: 11, fontWeight: '900' },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 13, fontWeight: '700', color: '#000' },
  lbBar: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderWidth: 0.5,
    borderColor: '#000',
    marginTop: 4,
    overflow: 'hidden',
  },
  lbFill: { height: '100%' },
  lbRight: { alignItems: 'flex-end' },
  lbConv: { fontSize: 14, fontWeight: '900', color: '#000' },
  lbLeads: { fontSize: 10, color: '#64748b' },
});
