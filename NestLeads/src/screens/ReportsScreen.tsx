import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl, Alert, FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import UserAvatar from '../components/UserAvatar';
import SourceBadge from '../components/SourceBadge';
import {leadsAPI, usersAPI} from '../services/api';
import {statusColors, sourceColors, getCategoryByStatus} from '../constants/statusConstants';

const PRIMARY   = '#024BAB';
const SECONDARY = '#FF751F';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

type Tab = 'overview' | 'sources' | 'team' | 'trends' | 'followups';

const TABS: {key: Tab; label: string; icon: string}[] = [
  {key: 'overview',  label: 'Overview',   icon: 'grid-outline'},
  {key: 'sources',   label: 'Sources',    icon: 'bar-chart-outline'},
  {key: 'team',      label: 'Team',       icon: 'people-outline'},
  {key: 'trends',    label: 'Trends',     icon: 'flash-outline'},
  {key: 'followups', label: 'Follow-ups', icon: 'calendar-outline'},
];

function Bar({pct, color, height = 28}: {pct: number; color: string; height?: number}) {
  return (
    <View style={[styles.barTrack, {height}]}>
      <View style={[styles.barFill, {width: `${Math.max(pct, 2)}%` as any, backgroundColor: color + '55'}]} />
    </View>
  );
}

function KpiCard({title, value, icon, iconBg, sub}: {title: string; value: string | number; icon: string; iconBg: string; sub?: string}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, {backgroundColor: iconBg}]}>
        <Icon name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({title, count}: {title: string; count?: number}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {count !== undefined && (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function ReportsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [leads, setLeads]     = useState<any[]>([]);
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [leadsRes, usersRes] = await Promise.all([leadsAPI.getAll(), usersAPI.getAll()]);
      setLeads(leadsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchAll();}, [fetchAll]);

  /* ─── computed stats ─── */
  const stats = useMemo(() => {
    const total    = leads.length;
    const clients  = leads.filter(l => getCategoryByStatus(l.status) === 'Client').length;
    const dropped  = leads.filter(l => getCategoryByStatus(l.status) === 'Dropped').length;
    const hot      = leads.filter(l => l.contactTag === 'HOT').length;
    const warm     = leads.filter(l => l.contactTag === 'WARM').length;
    const cold     = leads.filter(l => l.contactTag === 'COLD').length;
    const convRate = total > 0 ? Math.round((clients / total) * 100) : 0;

    const today = new Date().toISOString().slice(0, 10);
    const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const thisMonthStart = new Date(); thisMonthStart.setDate(1);

    const todayLeads = leads.filter(l => l.createdAt?.slice(0, 10) === today).length;
    const weekLeads  = leads.filter(l => l.createdAt && new Date(l.createdAt) >= thisWeekStart).length;
    const monthLeads = leads.filter(l => l.createdAt && new Date(l.createdAt) >= thisMonthStart).length;

    // By source
    const bySource: Record<string, number> = {};
    leads.forEach(l => { const s = l.source || 'Manual'; bySource[s] = (bySource[s] || 0) + 1; });
    const sourceSorted = Object.entries(bySource).sort((a, b) => (b[1] as number) - (a[1] as number));

    // By status
    const byStatus: Record<string, number> = {};
    leads.forEach(l => { const s = l.status || 'PENDING CONTACT'; byStatus[s] = (byStatus[s] || 0) + 1; });
    const statusSorted = Object.entries(byStatus).sort((a, b) => (b[1] as number) - (a[1] as number));

    // By category (funnel)
    const byCategory: Record<string, number> = {};
    leads.forEach(l => { const c = getCategoryByStatus(l.status); byCategory[c] = (byCategory[c] || 0) + 1; });

    // Team performance
    const byAgent: Record<string, {name: string; avatar?: string; count: number; clients: number; hot: number}> = {};
    leads.forEach(l => {
      const ag = l.assignedTo;
      if (!ag?._id) return;
      if (!byAgent[ag._id]) byAgent[ag._id] = {name: ag.name || 'Unknown', avatar: ag.avatar, count: 0, clients: 0, hot: 0};
      byAgent[ag._id].count++;
      if (getCategoryByStatus(l.status) === 'Client') byAgent[ag._id].clients++;
      if (l.contactTag === 'HOT') byAgent[ag._id].hot++;
    });
    const agentList = Object.entries(byAgent)
      .map(([id, v]) => ({id, ...v, rate: v.count > 0 ? Math.round((v.clients / v.count) * 100) : 0}))
      .sort((a, b) => b.rate - a.rate);

    // Monthly trend (last 6 months)
    const months: {label: string; count: number; clients: number}[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const y = d.getFullYear(); const m = d.getMonth();
      const label = d.toLocaleString('en-IN', {month: 'short'}) + ' ' + String(y).slice(2);
      const count   = leads.filter(l => { if (!l.createdAt) return false; const ld = new Date(l.createdAt); return ld.getFullYear() === y && ld.getMonth() === m; }).length;
      const clients = leads.filter(l => { if (!l.createdAt) return false; const ld = new Date(l.createdAt); return ld.getFullYear() === y && ld.getMonth() === m && getCategoryByStatus(l.status) === 'Client'; }).length;
      months.push({label, count, clients});
    }

    // Follow-up stats
    const now = new Date();
    const overdue  = leads.filter(l => l.followUpDate && new Date(l.followUpDate) < now && getCategoryByStatus(l.status) !== 'Client' && getCategoryByStatus(l.status) !== 'Dropped').length;
    const upcoming = leads.filter(l => { if (!l.followUpDate) return false; const fd = new Date(l.followUpDate); return fd >= now && fd <= new Date(now.getTime() + 7 * 86400000); }).length;
    const noFollowUp = leads.filter(l => !l.followUpDate && getCategoryByStatus(l.status) !== 'Client' && getCategoryByStatus(l.status) !== 'Dropped').length;

    const overdueLeads  = leads.filter(l => l.followUpDate && new Date(l.followUpDate) < now && getCategoryByStatus(l.status) !== 'Client' && getCategoryByStatus(l.status) !== 'Dropped').sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());
    const upcomingLeads = leads.filter(l => { if (!l.followUpDate) return false; const fd = new Date(l.followUpDate); return fd >= now && fd <= new Date(now.getTime() + 7 * 86400000); }).sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

    return {
      total, clients, dropped, hot, warm, cold, convRate,
      todayLeads, weekLeads, monthLeads,
      sourceSorted, statusSorted, byCategory,
      agentList,
      months,
      overdue, upcoming, noFollowUp, overdueLeads, upcomingLeads,
    };
  }, [leads]);

  const renderTabContent = () => {
    switch (activeTab) {

      /* ─── OVERVIEW ─── */
      case 'overview': {
        const maxMonth = Math.max(...stats.months.map(m => m.count), 1);
        return (
          <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={PRIMARY} />}>
            {/* KPIs */}
            <View style={styles.kpiGrid}>
              <KpiCard title="TOTAL LEADS"   value={stats.total}    icon="people-outline"           iconBg={PRIMARY}   />
              <KpiCard title="CLIENTS WON"   value={stats.clients}  icon="checkmark-circle-outline" iconBg="#22c55e"   />
              <KpiCard title="DROPPED"       value={stats.dropped}  icon="close-circle-outline"     iconBg="#ef4444"   />
              <KpiCard title="CONV. RATE"    value={`${stats.convRate}%`} icon="flash-outline"      iconBg={SECONDARY} />
            </View>

            {/* Acquisition this period */}
            <View style={styles.section}>
              <SectionHeader title="LEAD ACQUISITION" />
              {[
                {label: 'Today',      value: stats.todayLeads,  icon: 'time-outline',     bg: PRIMARY},
                {label: 'This Week',  value: stats.weekLeads,   icon: 'calendar-outline', bg: SECONDARY},
                {label: 'This Month', value: stats.monthLeads,  icon: 'flash-outline',    bg: '#22c55e'},
              ].map(r => (
                <View key={r.label} style={styles.acqRow}>
                  <View style={[styles.acqIcon, {backgroundColor: r.bg}]}>
                    <Icon name={r.icon} size={14} color="#fff" />
                  </View>
                  <Text style={styles.acqLabel}>{r.label}</Text>
                  <Text style={styles.acqValue}>{r.value} leads</Text>
                  <View style={[styles.acqBar, {flex: 1}]}>
                    <View style={[styles.acqBarFill, {width: `${stats.total > 0 ? (r.value / stats.total) * 100 : 0}%` as any, backgroundColor: r.bg + '55'}]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Contact tags */}
            <View style={styles.section}>
              <SectionHeader title="LEAD TEMPERATURE" />
              {[
                {label: 'HOT',  value: stats.hot,  bg: '#ef4444', text: '#fff'},
                {label: 'WARM', value: stats.warm, bg: '#FFDE00', text: '#000'},
                {label: 'COLD', value: stats.cold, bg: PRIMARY,   text: '#fff'},
              ].map(t => {
                const pct = stats.total > 0 ? (t.value / stats.total) * 100 : 0;
                return (
                  <View key={t.label} style={styles.tempRow}>
                    <View style={[styles.tempPill, {backgroundColor: t.bg}]}>
                      <Text style={[styles.tempPillText, {color: t.text}]}>{t.label}</Text>
                    </View>
                    <View style={styles.tempBarWrap}>
                      <View style={[styles.tempBarFill, {width: `${Math.max(pct, 2)}%` as any, backgroundColor: t.bg}]} />
                    </View>
                    <Text style={styles.tempCount}>{t.value}</Text>
                    <Text style={styles.tempPct}>({Math.round(pct)}%)</Text>
                  </View>
                );
              })}
            </View>

            {/* Pipeline funnel */}
            <View style={styles.section}>
              <SectionHeader title="PIPELINE FUNNEL" />
              {[
                {cat: 'New Lead',               icon: 'flash-outline',             color: PRIMARY},
                {cat: 'Discussion/Requirement', icon: 'chatbubbles-outline',       color: SECONDARY},
                {cat: 'Quotation',              icon: 'document-text-outline',     color: PRIMARY},
                {cat: 'Visit Scheduled',        icon: 'calendar-outline',          color: SECONDARY},
                {cat: 'Visited',                icon: 'eye-outline',               color: PRIMARY},
                {cat: 'Negotiation',            icon: 'swap-horizontal-outline',   color: SECONDARY},
                {cat: 'Client',                 icon: 'star-outline',              color: '#22c55e'},
                {cat: 'Dropped',                icon: 'close-circle-outline',      color: '#ef4444'},
              ].map((row, i) => {
                const count = stats.byCategory[row.cat] || 0;
                const pct   = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <View key={row.cat} style={styles.funnelRow}>
                    <View style={[styles.funnelIcon, {backgroundColor: row.color}]}>
                      <Icon name={row.icon} size={12} color="#fff" />
                    </View>
                    <Text style={styles.funnelLabel} numberOfLines={1}>{row.cat}</Text>
                    <View style={styles.funnelBarWrap}>
                      <View style={[styles.funnelBarFill, {width: `${Math.max(pct, 2)}%` as any, backgroundColor: row.color + '55'}]} />
                      <Text style={styles.funnelCount}>{count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
      }

      /* ─── SOURCES ─── */
      case 'sources': {
        const maxS = stats.sourceSorted.length ? (stats.sourceSorted[0][1] as number) : 1;
        const maxSt = stats.statusSorted.length ? (stats.statusSorted[0][1] as number) : 1;
        return (
          <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={PRIMARY} />}>

            <View style={styles.section}>
              <SectionHeader title="LEADS BY SOURCE" count={stats.sourceSorted.length} />
              {stats.sourceSorted.map(([src, count], i) => {
                const c = sourceColors[src as string] || {bg: '#e2e8f0', text: '#000'};
                const pct = ((count as number) / maxS) * 100;
                const pctTotal = stats.total > 0 ? Math.round(((count as number) / stats.total) * 100) : 0;
                return (
                  <View key={src} style={styles.sourceDetailRow}>
                    <View style={styles.sourceDetailLeft}>
                      <SourceBadge source={src as string} size="sm" />
                      <View style={styles.sourceDetailInfo}>
                        <Text style={styles.sourceDetailName}>{src}</Text>
                        <Bar pct={pct} color={i % 2 === 0 ? PRIMARY : SECONDARY} height={14} />
                      </View>
                    </View>
                    <View style={styles.sourceDetailRight}>
                      <Text style={styles.sourceDetailCount}>{String(count)}</Text>
                      <Text style={styles.sourceDetailPct}>{pctTotal}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.section}>
              <SectionHeader title="LEADS BY STATUS" count={stats.statusSorted.length} />
              {stats.statusSorted.map(([st, count], i) => {
                const c = statusColors[st as string] || {bg: '#e2e8f0', text: '#000'};
                const pct = ((count as number) / maxSt) * 100;
                return (
                  <View key={st} style={styles.statusDetailRow}>
                    <View style={[styles.statusBadge, {backgroundColor: c.bg}]}>
                      <Text style={[styles.statusBadgeText, {color: c.text}]} numberOfLines={1}>{st}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Bar pct={pct} color={i % 2 === 0 ? PRIMARY : SECONDARY} height={22} />
                    </View>
                    <Text style={styles.statusCount}>{String(count)}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
      }

      /* ─── TEAM PERFORMANCE ─── */
      case 'team': {
        const maxCount = stats.agentList.length ? stats.agentList[0].count : 1;
        return (
          <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={PRIMARY} />}>

            {stats.agentList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="people-outline" size={48} color="#e2e8f0" />
                <Text style={styles.emptyTitle}>No assigned leads yet</Text>
                <Text style={styles.emptySub}>Assign leads to team members to see their performance</Text>
              </View>
            ) : (
              <>
                {/* Top performer highlight */}
                {stats.agentList[0] && (
                  <View style={[styles.section, {backgroundColor: PRIMARY}]}>
                    <Text style={[styles.sectionLabel, {color: 'rgba(255,255,255,0.7)'}]}>TOP PERFORMER</Text>
                    <View style={styles.topPerformerRow}>
                      <UserAvatar name={stats.agentList[0].name} avatar={stats.agentList[0].avatar} size={52} index={0} />
                      <View style={{flex: 1}}>
                        <Text style={styles.topPerformerName}>{stats.agentList[0].name}</Text>
                        <Text style={styles.topPerformerStat}>{stats.agentList[0].clients} clients · {stats.agentList[0].rate}% conv rate</Text>
                      </View>
                      <View style={styles.trophyBox}>
                        <Icon name="star" size={22} color={SECONDARY} />
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <SectionHeader title="TEAM LEADERBOARD" count={stats.agentList.length} />
                  {stats.agentList.map((ag, i) => {
                    const pct = maxCount > 0 ? (ag.count / maxCount) * 100 : 0;
                    return (
                      <View key={ag.id} style={styles.agentRow}>
                        <View style={[styles.agentRank, {backgroundColor: i === 0 ? PRIMARY : i === 1 ? SECONDARY : '#e2e8f0'}]}>
                          <Text style={[styles.agentRankText, {color: i < 2 ? '#fff' : '#000'}]}>{i + 1}</Text>
                        </View>
                        <UserAvatar name={ag.name} avatar={ag.avatar} size={36} index={i} />
                        <View style={styles.agentInfo}>
                          <Text style={styles.agentName}>{ag.name}</Text>
                          <Bar pct={pct} color={i % 2 === 0 ? PRIMARY : SECONDARY} height={10} />
                        </View>
                        <View style={styles.agentStats}>
                          <Text style={styles.agentLeadsCount}>{ag.count}</Text>
                          <Text style={styles.agentClientsCount}>{ag.clients} won</Text>
                        </View>
                        <View style={[styles.agentRatePill, {backgroundColor: ag.rate >= 30 ? '#22c55e' : ag.rate >= 10 ? SECONDARY : '#e2e8f0'}]}>
                          <Text style={[styles.agentRateText, {color: ag.rate >= 10 ? '#fff' : '#000'}]}>{ag.rate}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Hot leads per agent */}
                <View style={styles.section}>
                  <SectionHeader title="HOT LEADS BY AGENT" />
                  {stats.agentList.filter(a => a.hot > 0).length === 0 ? (
                    <Text style={styles.noDataText}>No hot leads assigned</Text>
                  ) : (
                    stats.agentList.filter(a => a.hot > 0).map((ag, i) => (
                      <View key={ag.id} style={styles.hotRow}>
                        <UserAvatar name={ag.name} avatar={ag.avatar} size={32} index={i} />
                        <Text style={styles.hotAgentName}>{ag.name}</Text>
                        <View style={styles.hotPill}>
                          <Icon name="flame" size={11} color="#fff" />
                          <Text style={styles.hotPillText}>{ag.hot} hot</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        );
      }

      /* ─── TRENDS ─── */
      case 'trends': {
        const maxMonth = Math.max(...stats.months.map(m => m.count), 1);
        const maxClients = Math.max(...stats.months.map(m => m.clients), 1);
        return (
          <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={PRIMARY} />}>

            <View style={styles.section}>
              <SectionHeader title="MONTHLY LEAD TREND (LAST 6 MONTHS)" />
              {stats.months.map((m, i) => (
                <View key={m.label} style={styles.trendRow}>
                  <Text style={styles.trendMonth}>{m.label}</Text>
                  <View style={{flex: 1, gap: 4}}>
                    <View style={styles.trendBarWrap}>
                      <View style={[styles.trendBarFill, {width: `${(m.count / maxMonth) * 100}%` as any, backgroundColor: PRIMARY + '66'}]} />
                      <Text style={styles.trendBarLabel}>{m.count} leads</Text>
                    </View>
                    <View style={styles.trendBarWrap}>
                      <View style={[styles.trendBarFill, {width: `${maxClients > 0 ? (m.clients / maxClients) * 100 : 0}%` as any, backgroundColor: '#22c55e88'}]} />
                      <Text style={styles.trendBarLabel}>{m.clients} won</Text>
                    </View>
                  </View>
                </View>
              ))}
              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, {backgroundColor: PRIMARY}]} /><Text style={styles.legendText}>Total Leads</Text>
                <View style={[styles.legendDot, {backgroundColor: '#22c55e'}]} /><Text style={styles.legendText}>Clients Won</Text>
              </View>
            </View>

            {/* Week-by-week breakdown of latest month */}
            <View style={styles.section}>
              <SectionHeader title="CATEGORY DISTRIBUTION" />
              {[
                {cat: 'New Lead',               color: PRIMARY,    icon: 'flash-outline'},
                {cat: 'Discussion/Requirement', color: SECONDARY,  icon: 'chatbubbles-outline'},
                {cat: 'Quotation',              color: PRIMARY,    icon: 'document-text-outline'},
                {cat: 'Visit Scheduled',        color: SECONDARY,  icon: 'calendar-outline'},
                {cat: 'Visited',                color: PRIMARY,    icon: 'eye-outline'},
                {cat: 'Negotiation',            color: SECONDARY,  icon: 'swap-horizontal-outline'},
                {cat: 'Client',                 color: '#22c55e',  icon: 'star-outline'},
                {cat: 'Dropped',                color: '#ef4444',  icon: 'close-circle-outline'},
              ].map(row => {
                const count = stats.byCategory[row.cat] || 0;
                const pct   = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <View key={row.cat} style={styles.distRow}>
                    <View style={[styles.distIcon, {backgroundColor: row.color}]}>
                      <Icon name={row.icon} size={11} color="#fff" />
                    </View>
                    <Text style={styles.distLabel}>{row.cat}</Text>
                    <View style={styles.distBarWrap}>
                      <View style={[styles.distBarFill, {width: `${Math.max(pct, 1)}%` as any, backgroundColor: row.color + '66'}]} />
                    </View>
                    <Text style={styles.distCount}>{count}</Text>
                    <Text style={styles.distPct}>{Math.round(pct)}%</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
      }

      /* ─── FOLLOW-UPS ─── */
      case 'followups': {
        return (
          <ScrollView contentContainerStyle={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={PRIMARY} />}>
            {/* KPI row */}
            <View style={styles.fuKpiRow}>
              <View style={[styles.fuKpi, {borderColor: '#ef4444'}]}>
                <Icon name="time-outline" size={20} color="#ef4444" />
                <Text style={[styles.fuKpiValue, {color: '#ef4444'}]}>{stats.overdue}</Text>
                <Text style={styles.fuKpiLabel}>OVERDUE</Text>
              </View>
              <View style={[styles.fuKpi, {borderColor: SECONDARY}]}>
                <Icon name="calendar-outline" size={20} color={SECONDARY} />
                <Text style={[styles.fuKpiValue, {color: SECONDARY}]}>{stats.upcoming}</Text>
                <Text style={styles.fuKpiLabel}>NEXT 7 DAYS</Text>
              </View>
              <View style={[styles.fuKpi, {borderColor: '#94a3b8'}]}>
                <Icon name="close-circle-outline" size={20} color="#94a3b8" />
                <Text style={[styles.fuKpiValue, {color: '#94a3b8'}]}>{stats.noFollowUp}</Text>
                <Text style={styles.fuKpiLabel}>NO DATE SET</Text>
              </View>
            </View>

            {/* Overdue leads */}
            {stats.overdueLeads.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="OVERDUE FOLLOW-UPS" count={stats.overdueLeads.length} />
                {stats.overdueLeads.slice(0, 10).map((l, i) => {
                  const daysAgo = Math.floor((Date.now() - new Date(l.followUpDate).getTime()) / 86400000);
                  return (
                    <View key={l._id} style={styles.fuRow}>
                      <UserAvatar name={l.assignedTo?.name || l.name} avatar={l.assignedTo?.avatar} size={36} index={i} />
                      <View style={styles.fuInfo}>
                        <Text style={styles.fuName}>{l.name}</Text>
                        <Text style={styles.fuSub}>{l.phone || l.company || '—'}</Text>
                      </View>
                      <View style={styles.fuOverduePill}>
                        <Text style={styles.fuOverdueText}>{daysAgo}d ago</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Upcoming follow-ups */}
            {stats.upcomingLeads.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="UPCOMING (NEXT 7 DAYS)" count={stats.upcomingLeads.length} />
                {stats.upcomingLeads.slice(0, 10).map((l, i) => {
                  const sc = statusColors[l.status] || {bg: '#e2e8f0', text: '#000'};
                  const dateStr = new Date(l.followUpDate).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
                  return (
                    <View key={l._id} style={styles.fuRow}>
                      <UserAvatar name={l.assignedTo?.name || l.name} avatar={l.assignedTo?.avatar} size={36} index={i} />
                      <View style={styles.fuInfo}>
                        <Text style={styles.fuName}>{l.name}</Text>
                        <View style={[styles.fuStatusPill, {backgroundColor: sc.bg}]}>
                          <Text style={[styles.fuStatusText, {color: sc.text}]}>{l.status}</Text>
                        </View>
                      </View>
                      <View style={styles.fuDatePill}>
                        <Icon name="calendar-outline" size={11} color={PRIMARY} />
                        <Text style={styles.fuDateText}>{dateStr}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {stats.overdueLeads.length === 0 && stats.upcomingLeads.length === 0 && (
              <View style={styles.emptyBox}>
                <Icon name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={styles.emptyTitle}>All clear!</Text>
                <Text style={styles.emptySub}>No overdue or upcoming follow-ups</Text>
              </View>
            )}
          </ScrollView>
        );
      }
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSub}>{leads.length} leads analysed</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => {
          const active = t.key === activeTab;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Icon name={t.icon} size={14} color={active ? '#fff' : '#000'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        renderTabContent()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f8fafc'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: '#fff'},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b', fontWeight: '500'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  tabBar: {backgroundColor: '#fff', maxHeight: 52},
  tabBarContent: {paddingHorizontal: 12, paddingVertical: 8, gap: 6},
  tab: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff'},
  tabActive: {backgroundColor: PRIMARY},
  tabText: {fontSize: 11, fontWeight: '900', color: '#000', textTransform: 'uppercase'},
  tabTextActive: {color: '#fff'},

  tabContent: {padding: 14, gap: 12, paddingBottom: 40},

  // Section
  section: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  sectionHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14},
  sectionLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1},
  sectionBadge: {backgroundColor: SECONDARY, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, borderColor: '#000'},
  sectionBadgeText: {fontSize: 9, fontWeight: '900', color: '#fff'},

  // KPI grid
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  kpiCard: {width: '47%', backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 12, ...NB_SHADOW},
  kpiIcon: {width: 38, height: 38, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 8},
  kpiValue: {fontSize: 28, fontWeight: '900', color: '#000'},
  kpiTitle: {fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 2},
  kpiSub: {fontSize: 10, color: '#94a3b8', marginTop: 2},

  // Acquisition
  acqRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
  acqIcon: {width: 28, height: 28, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  acqLabel: {width: 72, fontSize: 11, fontWeight: '700', color: '#000'},
  acqValue: {width: 60, fontSize: 11, fontWeight: '900', color: '#000'},
  acqBar: {height: 16, borderWidth: 2, borderColor: '#000', overflow: 'hidden', justifyContent: 'center', backgroundColor: '#f8fafc'},
  acqBarFill: {position: 'absolute', top: 0, left: 0, bottom: 0},

  // Temperature
  tempRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  tempPill: {width: 48, paddingVertical: 4, alignItems: 'center', borderWidth: 2, borderColor: '#000'},
  tempPillText: {fontSize: 9, fontWeight: '900'},
  tempBarWrap: {flex: 1, height: 20, borderWidth: 2, borderColor: '#000', overflow: 'hidden', backgroundColor: '#f8fafc'},
  tempBarFill: {position: 'absolute', top: 0, left: 0, bottom: 0, opacity: 0.7},
  tempCount: {fontSize: 13, fontWeight: '900', color: '#000', width: 28, textAlign: 'right'},
  tempPct: {fontSize: 10, color: '#64748b', width: 36},

  // Funnel
  funnelRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7},
  funnelIcon: {width: 24, height: 24, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  funnelLabel: {width: 80, fontSize: 10, fontWeight: '700', color: '#000'},
  funnelBarWrap: {flex: 1, height: 24, borderWidth: 2, borderColor: '#000', overflow: 'hidden', backgroundColor: '#f8fafc', justifyContent: 'center'},
  funnelBarFill: {position: 'absolute', top: 0, left: 0, bottom: 0},
  funnelCount: {paddingLeft: 8, fontSize: 11, fontWeight: '900', color: '#000'},

  // Bar
  barTrack: {flex: 1, borderWidth: 1, borderColor: '#000', backgroundColor: '#f8fafc', overflow: 'hidden'},
  barFill: {position: 'absolute', top: 0, left: 0, bottom: 0},

  // Sources
  sourceDetailRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8},
  sourceDetailLeft: {flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1},
  sourceDetailInfo: {flex: 1, gap: 4},
  sourceDetailName: {fontSize: 12, fontWeight: '700', color: '#000'},
  sourceDetailRight: {alignItems: 'flex-end'},
  sourceDetailCount: {fontSize: 16, fontWeight: '900', color: '#000'},
  sourceDetailPct: {fontSize: 10, color: '#64748b', fontWeight: '600'},

  statusDetailRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  statusBadge: {width: 88, paddingHorizontal: 5, paddingVertical: 4, borderWidth: 1, borderColor: '#000'},
  statusBadgeText: {fontSize: 8, fontWeight: '900', textTransform: 'uppercase'},
  statusCount: {fontSize: 12, fontWeight: '900', color: '#000', width: 24, textAlign: 'right'},

  // Team
  topPerformerRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10},
  topPerformerName: {fontSize: 16, fontWeight: '900', color: '#fff'},
  topPerformerStat: {fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2},
  trophyBox: {width: 44, height: 44, borderWidth: 2, borderColor: SECONDARY, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)'},

  agentRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  agentRank: {width: 24, height: 24, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  agentRankText: {fontSize: 10, fontWeight: '900'},
  agentInfo: {flex: 1, gap: 4},
  agentName: {fontSize: 13, fontWeight: '700', color: '#000'},
  agentStats: {alignItems: 'flex-end'},
  agentLeadsCount: {fontSize: 15, fontWeight: '900', color: '#000'},
  agentClientsCount: {fontSize: 10, color: '#64748b', fontWeight: '600'},
  agentRatePill: {paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: '#000'},
  agentRateText: {fontSize: 11, fontWeight: '900'},

  hotRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  hotAgentName: {flex: 1, fontSize: 13, fontWeight: '700', color: '#000'},
  hotPill: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: '#000'},
  hotPillText: {fontSize: 11, fontWeight: '900', color: '#fff'},
  noDataText: {fontSize: 13, color: '#94a3b8', fontWeight: '600', textAlign: 'center', paddingVertical: 16},

  // Trends
  trendRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  trendMonth: {width: 42, fontSize: 10, fontWeight: '900', color: '#000'},
  trendBarWrap: {height: 20, borderWidth: 1, borderColor: '#000', overflow: 'hidden', backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center'},
  trendBarFill: {position: 'absolute', top: 0, left: 0, bottom: 0},
  trendBarLabel: {paddingLeft: 6, fontSize: 10, fontWeight: '700', color: '#000'},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8},
  legendDot: {width: 12, height: 12, borderWidth: 1, borderColor: '#000'},
  legendText: {fontSize: 11, color: '#64748b', fontWeight: '600', marginRight: 12},
  distRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8},
  distIcon: {width: 22, height: 22, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  distLabel: {width: 82, fontSize: 9, fontWeight: '700', color: '#000', textTransform: 'uppercase'},
  distBarWrap: {flex: 1, height: 18, borderWidth: 1, borderColor: '#000', overflow: 'hidden', backgroundColor: '#f8fafc'},
  distBarFill: {position: 'absolute', top: 0, left: 0, bottom: 0},
  distCount: {width: 24, fontSize: 11, fontWeight: '900', color: '#000', textAlign: 'right'},
  distPct: {width: 30, fontSize: 10, color: '#64748b', textAlign: 'right'},

  // Follow-ups
  fuKpiRow: {flexDirection: 'row', gap: 10},
  fuKpi: {flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 12, alignItems: 'center', gap: 4, ...NB_SHADOW},
  fuKpiValue: {fontSize: 26, fontWeight: '900'},
  fuKpiLabel: {fontSize: 8, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center'},
  fuRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  fuInfo: {flex: 1},
  fuName: {fontSize: 13, fontWeight: '700', color: '#000'},
  fuSub: {fontSize: 11, color: '#64748b', marginTop: 1},
  fuOverduePill: {backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: '#000'},
  fuOverdueText: {fontSize: 10, fontWeight: '900', color: '#fff'},
  fuStatusPill: {alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#000', marginTop: 3},
  fuStatusText: {fontSize: 8, fontWeight: '900', textTransform: 'uppercase'},
  fuDatePill: {flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: '#000', paddingHorizontal: 7, paddingVertical: 4, backgroundColor: '#fff'},
  fuDateText: {fontSize: 11, fontWeight: '700', color: PRIMARY},

  // Empty
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 10},
  emptyTitle: {fontSize: 16, fontWeight: '900', color: '#000'},
  emptySub: {fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 32},
});
