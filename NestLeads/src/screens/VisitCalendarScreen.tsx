import React, {useState, useEffect, useMemo} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Alert, ScrollView, Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {leadsAPI} from '../services/api';
import {statusColors} from '../constants/statusConstants';
import UserAvatar from '../components/UserAvatar';

const PRIMARY   = '#024BAB';
const SECONDARY = '#FF751F';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function VisitCalendarScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [leads, setLeads]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await leadsAPI.getAll();
        setLeads((res.data || []).filter((l: any) => !!l.visitScheduledDate));
      } catch (e: any) { Alert.alert('Error', e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const year  = current.getFullYear();
  const month = current.getMonth();

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const dateKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const visitMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    leads.forEach(l => {
      const d = l.visitScheduledDate?.slice(0, 10);
      if (d) { if (!map[d]) map[d] = []; map[d].push(l); }
    });
    return map;
  }, [leads]);

  const todayStr      = new Date().toISOString().slice(0, 10);
  const selectedLeads = selectedDate ? (visitMap[selectedDate] || []) : [];
  const totalThisMonth = Object.keys(visitMap).filter(d => d.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).reduce((a, d) => a + visitMap[d].length, 0);

  const goToLead = (leadId: string) =>
    navigation.navigate('LeadsStack', {screen: 'LeadDetail', params: {leadId}});

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Visit Calendar</Text>
          <Text style={styles.headerSub}>{leads.length} visits total</Text>
        </View>
        <View style={styles.headerBadge}>
          <Icon name="business-outline" size={13} color="#fff" />
          <Text style={styles.headerBadgeText}>{totalThisMonth} this month</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <ScrollView contentContainerStyle={{paddingBottom: insets.bottom + 24}}>

          {/* Month navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrent(new Date(year, month - 1, 1))}>
              <Icon name="chevron-back" size={20} color="#000" />
            </TouchableOpacity>
            <View style={styles.monthCenter}>
              <Text style={styles.monthLabel}>{MONTHS[month]}</Text>
              <Text style={styles.yearLabel}>{year}</Text>
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrent(new Date(year, month + 1, 1))}>
              <Icon name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Calendar card */}
          <View style={styles.calCard}>
            <View style={styles.weekRow}>
              {DAYS.map((d, i) => (
                <View key={i} style={styles.dayHeader}>
                  <Text style={[styles.dayHeaderText, (i === 0 || i === 6) && styles.dayHeaderWeekend]}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.calDivider} />
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={styles.dayCell} />;
                const key        = dateKey(day);
                const count      = visitMap[key]?.length || 0;
                const isToday    = key === todayStr;
                const isSelected = key === selectedDate;
                const isFuture   = key > todayStr;
                const isWeekend  = (i % 7 === 0 || i % 7 === 6);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dayCell,
                      isWeekend && !isSelected && styles.dayCellWeekend,
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                      !isFuture && !isToday && !isSelected && styles.dayCellPast,
                    ]}
                    onPress={() => setSelectedDate(isSelected ? null : key)}>
                    <Text style={[
                      styles.dayText,
                      isWeekend && !isSelected && styles.dayTextWeekend,
                      isToday && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                      !isFuture && !isToday && !isSelected && styles.dayTextPast,
                    ]}>
                      {day}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.dot, isSelected && styles.dotSelected, !isFuture && !isToday && !isSelected && styles.dotPast]}>
                        <Text style={styles.dotText}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: PRIMARY}]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: SECONDARY}]} />
              <Text style={styles.legendText}>Has visits</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: '#94a3b8'}]} />
              <Text style={styles.legendText}>Past</Text>
            </View>
          </View>

          {/* Selected day panel */}
          {selectedDate && (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={[styles.panelIconBox, {backgroundColor: SECONDARY}]}>
                  <Icon name="business-outline" size={14} color="#fff" />
                </View>
                <Text style={styles.panelTitle}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long'})}
                </Text>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{selectedLeads.length}</Text>
                </View>
              </View>

              {selectedLeads.length === 0 ? (
                <View style={styles.emptyPanel}>
                  <Icon name="business-outline" size={28} color="#e2e8f0" />
                  <Text style={styles.emptyPanelText}>No visits scheduled</Text>
                </View>
              ) : (
                selectedLeads.map((l: any, idx: number) => {
                  const sc = statusColors[l.status] || {bg: '#e2e8f0', text: '#000'};
                  const visitTime = l.visitScheduledDate
                    ? new Date(l.visitScheduledDate).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})
                    : null;
                  return (
                    <TouchableOpacity key={l._id} style={styles.leadCard} onPress={() => goToLead(l._id)} activeOpacity={0.75}>
                      <View style={[styles.timeBox, {backgroundColor: idx % 2 === 0 ? PRIMARY : SECONDARY}]}>
                        <Icon name="time-outline" size={11} color="#fff" />
                        <Text style={styles.timeText}>{visitTime || '--'}</Text>
                      </View>
                      <View style={styles.leadInfo}>
                        <Text style={styles.leadName} numberOfLines={1}>{l.name}</Text>
                        <Text style={styles.leadSub} numberOfLines={1}>{l.company || l.phone || '—'}</Text>
                        <View style={[styles.statusPill, {backgroundColor: sc.bg}]}>
                          <Text style={[styles.statusPillText, {color: sc.text}]}>{l.status}</Text>
                        </View>
                      </View>
                      <View style={styles.leadActions}>
                        {l.phone && (
                          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#22c55e'}]} onPress={() => Linking.openURL(`tel:${l.phone}`)}>
                            <Icon name="call-outline" size={14} color="#fff" />
                          </TouchableOpacity>
                        )}
                        {l.phone && (
                          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#25D366'}]} onPress={() => Linking.openURL(`whatsapp://send?phone=${l.phone}`)}>
                            <Icon name="logo-whatsapp" size={14} color="#fff" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: PRIMARY}]} onPress={() => goToLead(l._id)}>
                          <Icon name="arrow-forward" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f8fafc'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: '#fff'},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 16, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 10, color: '#64748b'},
  headerBadge: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SECONDARY, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 2, borderColor: '#000'},
  headerBadgeText: {fontSize: 11, fontWeight: '700', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  monthNav: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  navBtn: {width: 40, height: 40, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  monthCenter: {alignItems: 'center'},
  monthLabel: {fontSize: 20, fontWeight: '900', color: '#000'},
  yearLabel: {fontSize: 12, color: '#64748b', fontWeight: '600'},

  calCard: {margin: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', ...NB_SHADOW},
  weekRow: {flexDirection: 'row', paddingVertical: 4},
  dayHeader: {flex: 1, alignItems: 'center', paddingVertical: 8},
  dayHeaderText: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase'},
  dayHeaderWeekend: {color: SECONDARY},
  calDivider: {height: 2, backgroundColor: '#000'},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  dayCell: {width: `${100 / 7}%` as any, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#e2e8f0'},
  dayCellWeekend: {backgroundColor: '#fafafa'},
  dayCellToday: {borderWidth: 2, borderColor: PRIMARY, zIndex: 1},
  dayCellSelected: {backgroundColor: SECONDARY},
  dayCellPast: {opacity: 0.45},
  dayText: {fontSize: 14, fontWeight: '700', color: '#000'},
  dayTextWeekend: {color: '#64748b'},
  dayTextToday: {color: PRIMARY, fontWeight: '900'},
  dayTextSelected: {color: '#fff', fontWeight: '900'},
  dayTextPast: {color: '#94a3b8'},
  dot: {position: 'absolute', bottom: 5, minWidth: 18, height: 18, backgroundColor: SECONDARY, borderWidth: 1, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3},
  dotSelected: {backgroundColor: '#fff'},
  dotPast: {backgroundColor: '#94a3b8'},
  dotText: {fontSize: 9, fontWeight: '900', color: '#fff'},

  legend: {flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 8},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
  legendDot: {width: 12, height: 12, borderWidth: 1, borderColor: '#000'},
  legendText: {fontSize: 11, color: '#64748b', fontWeight: '600'},

  panel: {margin: 12, marginTop: 4, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  panelHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14},
  panelIconBox: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  panelTitle: {flex: 1, fontSize: 13, fontWeight: '900', color: '#000'},
  panelBadge: {backgroundColor: SECONDARY, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  panelBadgeText: {fontSize: 12, fontWeight: '900', color: '#fff'},

  emptyPanel: {alignItems: 'center', paddingVertical: 20, gap: 8},
  emptyPanelText: {fontSize: 13, color: '#64748b', fontWeight: '600'},

  leadCard: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  timeBox: {width: 44, height: 44, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 2},
  timeText: {fontSize: 9, fontWeight: '900', color: '#fff'},
  leadInfo: {flex: 1},
  leadName: {fontSize: 13, fontWeight: '900', color: '#000'},
  leadSub: {fontSize: 11, color: '#64748b', marginTop: 1},
  statusPill: {alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#000', marginTop: 4},
  statusPillText: {fontSize: 9, fontWeight: '900', textTransform: 'uppercase'},
  leadActions: {flexDirection: 'row', gap: 6},
  actionBtn: {width: 32, height: 32, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
});
