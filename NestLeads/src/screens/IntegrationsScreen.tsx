import React, {useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

type Integration = {
  key: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  bgColor: string;
  connected: boolean;
};

const INTEGRATIONS: Integration[] = [
  {key: 'indiamart',  label: 'IndiaMart',        desc: 'Auto-import leads from IndiaMart buyer enquiries',  icon: 'storefront-outline',    color: '#FF751F', bgColor: '#fff7ed',  connected: true},
  {key: 'facebook',   label: 'Facebook Leads',    desc: 'Sync leads from Facebook Lead Ads campaigns',       icon: 'logo-facebook',         color: '#1877F2', bgColor: '#eff6ff',  connected: false},
  {key: 'whatsapp',   label: 'WhatsApp Business', desc: 'Connect WhatsApp Business API for messaging',       icon: 'logo-whatsapp',         color: '#25D366', bgColor: '#f0fdf4',  connected: true},
  {key: 'google',     label: 'Google Ads',        desc: 'Import leads from Google Ads lead forms',           icon: 'logo-google',           color: '#EA4335', bgColor: '#fef2f2',  connected: false},
  {key: 'justdial',   label: 'JustDial',          desc: 'Receive leads directly from JustDial listings',     icon: 'call-outline',          color: '#024BAB', bgColor: '#eff6ff',  connected: false},
  {key: 'email',      label: 'Email / SMTP',      desc: 'Send automated emails and follow-ups via SMTP',     icon: 'mail-outline',          color: '#64748b', bgColor: '#f8fafc',  connected: false},
  {key: 'webhook',    label: 'Webhook',           desc: 'Receive leads via custom webhook URL',               icon: 'code-slash-outline',    color: '#7c3aed', bgColor: '#f5f3ff',  connected: false},
  {key: 'sms',        label: 'SMS Gateway',       desc: 'Send SMS alerts and notifications to leads',        icon: 'chatbox-outline',       color: '#22c55e', bgColor: '#f0fdf4',  connected: false},
];

export default function IntegrationsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(INTEGRATIONS.map(i => [i.key, i.connected])),
  );

  const toggle = (key: string, val: boolean) => {
    const intg = INTEGRATIONS.find(i => i.key === key);
    if (!intg) return;
    Alert.alert(
      val ? `Connect ${intg.label}` : `Disconnect ${intg.label}`,
      val
        ? `Enable ${intg.label} integration?`
        : `Disconnect ${intg.label}? This will stop syncing leads.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: val ? 'Connect' : 'Disconnect', onPress: () => setStates(s => ({...s, [key]: val}))},
      ],
    );
  };

  const connected = INTEGRATIONS.filter(i => states[i.key]).length;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Integrations</Text>
          <Text style={styles.headerSub}>{connected} active</Text>
        </View>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 24}]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{connected}</Text>
            <Text style={styles.summaryLabel}>Connected</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{INTEGRATIONS.length - connected}</Text>
            <Text style={styles.summaryLabel}>Available</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{INTEGRATIONS.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ALL INTEGRATIONS</Text>

        {INTEGRATIONS.map(intg => {
          const on = states[intg.key];
          return (
            <View key={intg.key} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, {backgroundColor: intg.bgColor}]}>
                  <Icon name={intg.icon} size={22} color={intg.color} />
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{intg.label}</Text>
                    {on && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>{intg.desc}</Text>
                </View>
              </View>
              <Switch
                value={on}
                onValueChange={v => toggle(intg.key, v)}
                trackColor={{false: '#e2e8f0', true: '#024BAB'}}
                thumbColor={on ? '#fff' : '#fff'}
              />
            </View>
          );
        })}
      </ScrollView>
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
  body: {padding: 12, gap: 10},
  summaryRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  summaryCard: {flex: 1, height: 72, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', ...NB_SHADOW},
  summaryNum: {fontSize: 22, fontWeight: '900', color: '#000'},
  summaryLabel: {fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2},
  sectionLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 4},
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW,
  },
  cardLeft: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1},
  iconBox: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  cardInfo: {flex: 1},
  cardTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3},
  cardTitle: {fontSize: 14, fontWeight: '900', color: '#000'},
  activeBadge: {backgroundColor: '#22c55e', paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#000'},
  activeBadgeText: {fontSize: 8, fontWeight: '900', color: '#fff'},
  cardDesc: {fontSize: 11, color: '#64748b', lineHeight: 15},
});
