import React, {useMemo, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet} from 'react-native';

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  adAccountName: string;
  adAccountId?: string;
  currency: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  campaign_id: string;
  campaignName?: string;
  adAccountName?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: {age_min?: number; age_max?: number};
  optimization_goal?: string;
  billing_event?: string;
  created_time: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  adset_id: string;
  campaign_id: string;
  campaignName?: string;
  adSetName?: string;
  adAccountName?: string;
  creative?: {
    title?: string;
    body?: string;
    image_url?: string;
    call_to_action_type?: string;
    link_url?: string;
  };
  created_time: string;
}

export interface Insight {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number;
}

export type Period = 'today' | 'week' | 'month' | 'custom';
export type DeliveryFilter = 'all' | 'active' | 'paused' | 'archived' | 'deleted';

// ponytail: hex colors instead of web's Tailwind classes — same palette, RN has no className.
export const META_STATUS: Record<string, {bg: string; text: string; label: string}> = {
  ACTIVE: {bg: '#A3E635', text: '#000', label: 'Active'},
  PAUSED: {bg: '#FFDE00', text: '#000', label: 'Paused'},
  DELETED: {bg: '#EF4444', text: '#fff', label: 'Deleted'},
  ARCHIVED: {bg: '#e2e8f0', text: '#334155', label: 'Archived'},
  IN_PROCESS: {bg: '#dbeafe', text: '#1d4ed8', label: 'In Review'},
  WITH_ISSUES: {bg: '#fee2e2', text: '#b91c1c', label: 'Issues'},
  CAMPAIGN_PAUSED: {bg: '#FFDE00', text: '#000', label: 'Paused'},
  ADSET_PAUSED: {bg: '#FFDE00', text: '#000', label: 'Paused'},
  PENDING_REVIEW: {bg: '#dbeafe', text: '#1d4ed8', label: 'In Review'},
  DISAPPROVED: {bg: '#fee2e2', text: '#b91c1c', label: 'Disapproved'},
};

export const META_OBJECTIVES: Record<string, string> = {
  OUTCOME_AWARENESS: 'Brand Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_APP_PROMOTION: 'App Promotion',
  OUTCOME_SALES: 'Sales',
};

export const OPTIMIZATION_GOALS: Record<string, string> = {
  LINK_CLICKS: 'Link Clicks',
  IMPRESSIONS: 'Impressions',
  REACH: 'Reach',
  LANDING_PAGE_VIEWS: 'Landing Page Views',
  LEAD_GENERATION: 'Lead Generation',
  OFFSITE_CONVERSIONS: 'Conversions',
};

export const BILLING_EVENTS: Record<string, string> = {
  IMPRESSIONS: 'Impressions',
  LINK_CLICKS: 'Link Clicks',
};

export const CTA_OPTIONS: Record<string, string> = {
  LEARN_MORE: 'Learn More',
  SHOP_NOW: 'Shop Now',
  SIGN_UP: 'Sign Up',
  GET_QUOTE: 'Get Quote',
  CONTACT_US: 'Contact Us',
  BOOK_NOW: 'Book Now',
  DOWNLOAD: 'Download',
};

export function parseInsight(raw: any): Insight {
  if (!raw) return {spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, results: 0};
  const results = Array.isArray(raw.actions)
    ? raw.actions.reduce((s: number, a: any) => s + (+a.value || 0), 0)
    : 0;
  return {
    spend: +raw.spend || 0,
    impressions: +raw.impressions || 0,
    clicks: +raw.clicks || 0,
    ctr: +raw.ctr || 0,
    cpc: +raw.cpc || 0,
    results,
  };
}

export function statusBadge(rawStatus: string) {
  return META_STATUS[rawStatus] || {bg: '#e2e8f0', text: '#334155', label: rawStatus};
}

export function matchesDeliveryFilter(rawStatus: string, filter: DeliveryFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return rawStatus === 'ACTIVE';
  if (filter === 'paused') return ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(rawStatus);
  if (filter === 'archived') return rawStatus === 'ARCHIVED';
  if (filter === 'deleted') return rawStatus === 'DELETED';
  return true;
}

// Minor-unit (paise) budgets, exactly like web: ÷100 to display, ×100 to write.
export const paiseToRupees = (v?: string | number) => (v ? Math.round(Number(v)) / 100 : 0);
export const rupeesToPaise = (v: number) => Math.round(v * 100);

export function StatusBadge({status}: {status: string}) {
  const b = statusBadge(status);
  return (
    <View style={[sharedStyles.badge, {backgroundColor: b.bg}]}>
      <Text style={[sharedStyles.badgeText, {color: b.text}]}>{b.label}</Text>
    </View>
  );
}

export function DeliveryToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      style={[sharedStyles.toggleTrack, {backgroundColor: active ? '#00C48C' : '#cbd5e1', opacity: disabled ? 0.5 : 1}]}>
      <View style={[sharedStyles.toggleThumb, active ? {left: 17} : {left: 2}]} />
    </TouchableOpacity>
  );
}

export function usePeriodFilter() {
  const [period, setPeriod] = useState<Period>('month');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');

  const periodOpts = useMemo(() => {
    if (period === 'custom') {
      if (customSince && customUntil) return {since: customSince, until: customUntil};
      return {datePreset: 'last_30d'};
    }
    const presetMap: Record<Exclude<Period, 'custom'>, string> = {
      today: 'today',
      week: 'this_week',
      month: 'this_month',
    };
    return {datePreset: presetMap[period]};
  }, [period, customSince, customUntil]);

  return {period, setPeriod, customSince, setCustomSince, customUntil, setCustomUntil, periodOpts};
}

const PERIODS: {id: Period; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'week', label: 'Week'},
  {id: 'month', label: 'Month'},
  {id: 'custom', label: 'Custom'},
];

export function PeriodFilterBar({
  period,
  setPeriod,
}: Pick<ReturnType<typeof usePeriodFilter>, 'period' | 'setPeriod'>) {
  return (
    <View style={sharedStyles.filterRow}>
      {PERIODS.map((p, i) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => setPeriod(p.id)}
          style={[
            sharedStyles.filterChip,
            i > 0 && sharedStyles.filterChipBorder,
            period === p.id && {backgroundColor: '#024BAB'},
          ]}>
          <Text style={[sharedStyles.filterChipText, period === p.id && {color: '#fff'}]}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const DELIVERY_FILTERS: {id: DeliveryFilter; label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'active', label: 'Active'},
  {id: 'paused', label: 'Paused'},
  {id: 'archived', label: 'Archived'},
  {id: 'deleted', label: 'Deleted'},
];

export function DeliveryFilterBar({
  value,
  onChange,
  search,
  onSearchChange,
}: {
  value: DeliveryFilter;
  onChange: (v: DeliveryFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <View style={{gap: 8}}>
      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search..."
        placeholderTextColor="#94a3b8"
        style={sharedStyles.searchInput}
      />
      <View style={sharedStyles.filterRow}>
        {DELIVERY_FILTERS.map((f, i) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => onChange(f.id)}
            style={[
              sharedStyles.filterChip,
              i > 0 && sharedStyles.filterChipBorder,
              value === f.id && {backgroundColor: '#024BAB'},
            ]}>
            <Text style={[sharedStyles.filterChipText, value === f.id && {color: '#fff'}]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  badge: {paddingHorizontal: 7, paddingVertical: 3, borderWidth: 2, borderColor: '#000', alignSelf: 'flex-start'},
  badgeText: {fontSize: 9, fontWeight: '600'},
  toggleTrack: {width: 36, height: 20, borderWidth: 2, borderColor: '#000'},
  toggleThumb: {position: 'absolute', top: 1, width: 14, height: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#000'},
  filterRow: {flexDirection: 'row', borderWidth: 2, borderColor: '#000', alignSelf: 'flex-start', overflow: 'hidden'},
  filterChip: {paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff'},
  filterChipBorder: {borderLeftWidth: 2, borderLeftColor: '#000'},
  filterChipText: {fontSize: 11, fontWeight: '600', color: '#000'},
  searchInput: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 12},
});
