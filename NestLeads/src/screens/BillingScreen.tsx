import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';

import { billingAPI } from '../services/api';
import { CountText } from '../components/motion';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

type BillingState = {
  key: 'trial' | 'trial_ended' | 'active' | 'expiring' | 'expired' | 'cancelled';
  label: string;
  color: string;
  note: string;
  daysLeft: number | null;
  needsPayment: boolean;
};

const EXPIRING_DAYS = 7;

// One answer to "where does this account stand?": drives the badge, the line under it and the Renew button.
function billingState(plan: string, status: string, periodEnd?: string): BillingState {
  const end = periodEnd ? new Date(periodEnd).getTime() : null;
  const daysLeft = end === null ? null : Math.ceil((end - Date.now()) / 86400000);
  const ended = end !== null && end < Date.now();
  const dayText = (n: number) => (n === 1 ? '1 day' : `${n} days`);

  if (plan === 'trial') {
    return ended
      ? { key: 'trial_ended', label: 'Trial ended', color: '#DC2626', note: `Trial ended on ${formatDate(periodEnd)}. Choose a plan to continue.`, daysLeft, needsPayment: true }
      : { key: 'trial', label: 'Trial', color: '#8B5CF6', note: daysLeft !== null ? `${dayText(Math.max(daysLeft, 0))} left in your free trial` : 'Free trial — pick a plan to activate', daysLeft, needsPayment: false };
  }
  if (ended || status === 'past_due')
    return { key: 'expired', label: 'Expired', color: '#DC2626', note: periodEnd ? `Expired on ${formatDate(periodEnd)}. Renew to restore access.` : 'Payment is due. Renew to restore access.', daysLeft, needsPayment: true };
  if (status === 'cancelled')
    return { key: 'cancelled', label: 'Cancelled', color: '#64748b', note: `Cancelled — access ends ${formatDate(periodEnd)}`, daysLeft, needsPayment: true };
  if (daysLeft !== null && daysLeft <= EXPIRING_DAYS)
    return { key: 'expiring', label: 'Expiring soon', color: '#FA731C', note: `Expires in ${dayText(Math.max(daysLeft, 0))} (${formatDate(periodEnd)})`, daysLeft, needsPayment: true };
  return { key: 'active', label: 'Active', color: '#1FA85A', note: periodEnd ? `Renews on ${formatDate(periodEnd)}${daysLeft !== null ? ` · ${dayText(daysLeft)} left` : ''}` : 'Active', daysLeft, needsPayment: false };
}

export default function BillingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [plans, setPlans] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [subRes, plansRes, invRes] = await Promise.allSettled([
        billingAPI.getSubscription(),
        billingAPI.getPlans(),
        billingAPI.getInvoices(),
      ]);
      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value.data.subscription);
        setTenant(subRes.value.data.tenant);
      }
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const currentPlanId = subscription?.plan || tenant?.plan || 'trial';
  const periodEnd = subscription?.currentPeriodEnd || tenant?.planExpiresAt;
  const planLimits = plans?.[currentPlanId] || {};
  const maxLeads = planLimits?.limits?.leadsPerMonth ?? 100;
  const maxMembers = planLimits?.limits?.teamMembers ?? 2;
  const status = subscription?.status || tenant?.status || 'trial';
  const state = billingState(currentPlanId, status, periodEnd);

  // Three plans on sale (Social Autopilot is included); business / enterprise only for tenants already on them.
  const planIds = ['starter', 'growth', 'professional'];

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billing</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#024BAB" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader icon="wallet-outline" title="Billing" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAll(true)}
            tintColor="#024BAB"
          />
        }
      >
        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.planCardTop}>
            <View style={styles.crownBox}>
              <Icon name="ribbon-outline" size={20} color="#024BAB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{capitalise(currentPlanId)} Plan</Text>
              <Text style={styles.planSub}>{state.note}</Text>
            </View>
            <View style={[styles.stateBadge, { backgroundColor: state.color }]}>
              <Text style={styles.stateBadgeText}>{state.label}</Text>
            </View>
          </View>
        </View>

        {/* Usage stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Icon name="flag-outline" size={18} color="#024BAB" />
            <CountText style={styles.statValue}>
              {maxLeads >= 999999 ? '∞' : maxLeads.toLocaleString()}
            </CountText>
            <Text style={styles.statLabel}>Leads / month</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="people-outline" size={18} color="#FF751F" />
            <CountText style={styles.statValue}>
              {maxMembers >= 999 ? '∞' : maxMembers}
            </CountText>
            <Text style={styles.statLabel}>Team members</Text>
          </View>
        </View>

        {/* Plans */}
        <Text style={styles.sectionTitle}>
          {currentPlanId === 'trial' ? 'Choose a Plan' : 'Available Plans'}
        </Text>
        {planIds.map(planId => {
          const apiPlan = plans?.[planId];
          const isCurrent = planId === currentPlanId;
          const isCustom = planId === 'enterprise';
          const priceRaw = apiPlan?.priceMonthly;
          const priceDisplay = isCustom
            ? 'Custom'
            : priceRaw != null
              ? `${formatAmount(priceRaw)}/mo`
              : '—';
          return (
            <View
              key={planId}
              style={[styles.planRow, isCurrent && styles.planRowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planRowName}>{capitalise(planId)}</Text>
                <Text style={styles.planRowPrice}>{priceDisplay}</Text>
              </View>
              {isCurrent && (
                <View style={[styles.activeBadge, { backgroundColor: state.color }]}>
                  <Icon name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.activeBadgeText}>{state.label}</Text>
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.webHint}>
          To renew or change your plan, please contact your account manager or
          support.
        </Text>

        {/* Invoices */}
        <Text style={styles.sectionTitle}>Invoice History</Text>
        {invoices.length === 0 ? (
          <View style={styles.emptyInvoices}>
            <Text style={styles.emptyInvoicesText}>No invoices yet.</Text>
          </View>
        ) : (
          invoices.map(inv => (
            <View key={inv._id} style={styles.invoiceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceNum}>{inv.invoiceNumber}</Text>
                <Text style={styles.invoiceDate}>
                  {formatDate(inv.paidAt)} · {capitalise(inv.plan || '')} Plan
                </Text>
              </View>
              <CountText style={styles.invoiceAmount}>
                {formatAmount(inv.amount)}
              </CountText>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '500', color: '#000' },
  divider: { height: 2, backgroundColor: '#000' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 16 },
  planCard: {
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 16,
  },
  planCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crownBox: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { fontSize: 15, fontWeight: '500', color: '#fff' },
  planSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
  },
  stateBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '500', color: '#000' },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginTop: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    gap: 10,
  },
  planRowActive: { borderColor: '#024BAB', borderWidth: 3 },
  planRowName: { fontSize: 13, fontWeight: '500', color: '#000' },
  planRowPrice: { fontSize: 12, color: '#64748b', marginTop: 2 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  upgradeBtn: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  upgradeBtnText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  webHint: { fontSize: 11, color: '#94a3b8', lineHeight: 15 },
  emptyInvoices: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptyInvoicesText: { fontSize: 12, color: '#94a3b8' },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
  },
  invoiceNum: { fontSize: 12, fontWeight: '500', color: '#000' },
  invoiceDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
  invoiceAmount: { fontSize: 14, fontWeight: '500', color: '#000' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 14,
    alignItems: 'flex-start',
    gap: 6,
  },
});
