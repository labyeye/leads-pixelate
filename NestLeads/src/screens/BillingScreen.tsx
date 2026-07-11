import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar,
  ScrollView, RefreshControl, Alert, Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {billingAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};
const WEB_BILLING_URL = 'https://leads.pixelatenest.com/billing';

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
}
function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function BillingScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [plans, setPlans] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
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
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {loadAll();}, [loadAll]);

  const currentPlanId = subscription?.plan || tenant?.plan || 'trial';
  const periodEnd = subscription?.currentPeriodEnd || tenant?.planExpiresAt;
  const planLimits = plans?.[currentPlanId] || {};
  const maxLeads = planLimits?.limits?.leadsPerMonth ?? 100;
  const maxMembers = planLimits?.limits?.teamMembers ?? 2;
  const status = subscription?.status || tenant?.status || 'trial';

  const planIds = ['starter', 'growth', 'professional', 'business', 'enterprise'];

  const openWebBilling = () => {
    Linking.openURL(WEB_BILLING_URL).catch(() =>
      Alert.alert('Error', 'Could not open billing page'),
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billing</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[styles.scroll, {paddingBottom: insets.bottom + 32}]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#024BAB" />}
      >
        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.planCardTop}>
            <View style={styles.crownBox}>
              <Icon name="ribbon-outline" size={20} color="#024BAB" />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.planName}>{capitalise(currentPlanId)} Plan — {capitalise(status)}</Text>
              <Text style={styles.planSub}>
                {periodEnd ? `Next billing: ${formatDate(periodEnd)}` : 'Free trial — upgrade to activate'}
              </Text>
            </View>
          </View>
        </View>

        {/* Usage stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Icon name="flag-outline" size={18} color="#024BAB" />
            <Text style={styles.statValue}>{maxLeads >= 999999 ? '∞' : maxLeads.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Leads / month</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="people-outline" size={18} color="#FF751F" />
            <Text style={styles.statValue}>{maxMembers >= 999 ? '∞' : maxMembers}</Text>
            <Text style={styles.statLabel}>Team members</Text>
          </View>
        </View>

        {/* Plans */}
        <Text style={styles.sectionTitle}>{currentPlanId === 'trial' ? 'Choose a Plan' : 'Available Plans'}</Text>
        {planIds.map(planId => {
          const apiPlan = plans?.[planId];
          const isCurrent = planId === currentPlanId;
          const isCustom = planId === 'enterprise';
          const priceRaw = apiPlan?.priceMonthly;
          const priceDisplay = isCustom ? 'Custom' : priceRaw != null ? `₹${(priceRaw / 100).toLocaleString('en-IN')}/mo` : '—';
          return (
            <View key={planId} style={[styles.planRow, isCurrent && styles.planRowActive]}>
              <View style={{flex: 1}}>
                <Text style={styles.planRowName}>{capitalise(planId)}</Text>
                <Text style={styles.planRowPrice}>{priceDisplay}</Text>
              </View>
              {isCurrent ? (
                <View style={styles.activeBadge}>
                  <Icon name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.upgradeBtn} onPress={openWebBilling}>
                  <Text style={styles.upgradeBtnText}>{isCustom ? 'Contact Sales' : 'Upgrade'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <Text style={styles.webHint}>
          Plan upgrades and payment are completed securely via Razorpay on the web dashboard. Tap "Upgrade" to open it in your browser.
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
              <View style={{flex: 1}}>
                <Text style={styles.invoiceNum}>{inv.invoiceNumber}</Text>
                <Text style={styles.invoiceDate}>{formatDate(inv.paidAt)} · {capitalise(inv.plan || '')} Plan</Text>
              </View>
              <Text style={styles.invoiceAmount}>{formatAmount(inv.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scroll: {padding: 16, gap: 16},
  planCard: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', padding: 16, ...NB_SHADOW},
  planCardTop: {flexDirection: 'row', alignItems: 'center', gap: 12},
  crownBox: {width: 40, height: 40, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  planName: {fontSize: 15, fontWeight: '900', color: '#fff'},
  planSub: {fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2},
  statsRow: {flexDirection: 'row', gap: 12},
  statCard: {flex: 1, borderWidth: 2, borderColor: '#000', padding: 14, alignItems: 'flex-start', gap: 6, ...NB_SHADOW},
  statValue: {fontSize: 20, fontWeight: '900', color: '#000'},
  statLabel: {fontSize: 10, color: '#64748b', fontWeight: '700', textTransform: 'uppercase'},
  sectionTitle: {fontSize: 15, fontWeight: '900', color: '#000', marginTop: 4},
  planRow: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', padding: 12, gap: 10},
  planRowActive: {borderColor: '#024BAB', borderWidth: 3},
  planRowName: {fontSize: 13, fontWeight: '900', color: '#000'},
  planRowPrice: {fontSize: 12, color: '#64748b', marginTop: 2},
  activeBadge: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 6},
  activeBadgeText: {fontSize: 11, fontWeight: '900', color: '#fff'},
  upgradeBtn: {backgroundColor: '#000', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 7},
  upgradeBtnText: {fontSize: 11, fontWeight: '900', color: '#fff'},
  webHint: {fontSize: 11, color: '#94a3b8', lineHeight: 15},
  emptyInvoices: {borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', padding: 24, alignItems: 'center'},
  emptyInvoicesText: {fontSize: 12, color: '#94a3b8'},
  invoiceRow: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', padding: 12},
  invoiceNum: {fontSize: 12, fontWeight: '800', color: '#000'},
  invoiceDate: {fontSize: 11, color: '#64748b', marginTop: 2},
  invoiceAmount: {fontSize: 14, fontWeight: '900', color: '#000'},
});
