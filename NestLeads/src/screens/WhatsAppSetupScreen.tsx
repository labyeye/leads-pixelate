import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {whatsappAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const TEMPLATE_STATUS_COLORS: Record<string, string> = {
  APPROVED: '#22c55e',
  DRAFT: '#94a3b8',
  PENDING: '#f97316',
  REJECTED: '#EF4444',
};

export default function WhatsAppSetupScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [statusRes, configRes, tmplRes] = await Promise.allSettled([
        whatsappAPI.getStatus(),
        whatsappAPI.getConfig(),
        whatsappAPI.getTemplates(),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
      if (configRes.status === 'fulfilled') setConfig(configRes.value.data);
      if (tmplRes.status === 'fulfilled') setTemplates(tmplRes.value.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {loadAll();}, [loadAll]);

  const isConnected = !!(status?.connected ?? config?.connected);
  const phoneNumbers = config?.phoneNumbers || status?.phoneNumbers || [];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp Setup</Text>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={t => t._id}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#024BAB" />}
          ListHeaderComponent={
            <View style={{gap: 16, marginBottom: 8}}>
              {/* Connection status */}
              <View style={[styles.statusCard, isConnected ? styles.statusCardOn : styles.statusCardOff]}>
                <Icon name={isConnected ? 'checkmark-circle' : 'close-circle'} size={22} color={isConnected ? '#22c55e' : '#EF4444'} />
                <View style={{flex: 1}}>
                  <Text style={styles.statusTitle}>{isConnected ? 'Connected' : 'Not Connected'}</Text>
                  <Text style={styles.statusSub}>
                    {isConnected ? 'WhatsApp Business API is active' : 'Connect WhatsApp Business API on the web dashboard'}
                  </Text>
                </View>
              </View>

              {/* Phone numbers */}
              {phoneNumbers.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Phone Numbers</Text>
                  {phoneNumbers.map((p: any, i: number) => (
                    <View key={p.id || i} style={styles.phoneRow}>
                      <Icon name="call-outline" size={14} color="#024BAB" />
                      <Text style={styles.phoneText}>{p.displayPhoneNumber || p.phoneNumber || p.number}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionTitle}>Message Templates ({templates.length})</Text>
            </View>
          }
          renderItem={({item: t}) => (
            <View style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <Text style={styles.templateName} numberOfLines={1}>{t.displayName}</Text>
                <View style={[styles.statusPill, {borderColor: TEMPLATE_STATUS_COLORS[t.status] || '#94a3b8'}]}>
                  <Text style={[styles.statusPillText, {color: TEMPLATE_STATUS_COLORS[t.status] || '#94a3b8'}]}>{t.status}</Text>
                </View>
              </View>
              <Text style={styles.templateBody} numberOfLines={3}>{t.bodyText}</Text>
              <Text style={styles.templateMeta}>{t.category} · {t.language}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="document-text-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyText}>No templates yet</Text>
              <Text style={styles.emptySub}>Create and manage templates from the web dashboard</Text>
            </View>
          }
        />
      )}
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
  list: {padding: 16},
  statusCard: {flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  statusCardOn: {backgroundColor: '#ecfdf5'},
  statusCardOff: {backgroundColor: '#fef2f2'},
  statusTitle: {fontSize: 14, fontWeight: '900', color: '#000'},
  statusSub: {fontSize: 11, color: '#64748b', marginTop: 2},
  sectionTitle: {fontSize: 13, fontWeight: '900', color: '#000', marginBottom: 8, marginTop: 4},
  phoneRow: {flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#000', padding: 10, marginBottom: 6},
  phoneText: {fontSize: 12, fontWeight: '700', color: '#000'},
  templateCard: {borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 10, ...NB_SHADOW},
  templateHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  templateName: {flex: 1, fontSize: 13, fontWeight: '900', color: '#000'},
  statusPill: {borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2},
  statusPillText: {fontSize: 9, fontWeight: '900'},
  templateBody: {fontSize: 12, color: '#334155', lineHeight: 16, marginBottom: 6},
  templateMeta: {fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700'},
  emptyBox: {alignItems: 'center', paddingTop: 40, gap: 8},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptySub: {fontSize: 11, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 24},
});
