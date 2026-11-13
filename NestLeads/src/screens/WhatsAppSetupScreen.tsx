import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';

import { whatsappAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TemplateEditorModal, { EMPTY_TEMPLATE } from '../components/TemplateEditorModal';
import TemplateLibraryModal from '../components/TemplateLibraryModal';
import { ConnectionTab, AnalyticsTab, RepliesTab } from '../components/WhatsAppSetupTabs';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

const TEMPLATE_STATUS_COLORS: Record<string, string> = {
  APPROVED: '#22c55e',
  DRAFT: '#94a3b8',
  PENDING: '#f97316',
  REJECTED: '#EF4444',
};

export default function WhatsAppSetupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const { user } = useAuth();
  const canManage = ['admin', 'super_admin'].includes(user?.role);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tab, setTab] = useState<'connection' | 'templates' | 'analytics' | 'replies'>('connection');
  const [editor, setEditor] = useState<{ form: typeof EMPTY_TEMPLATE; id: string | null } | null>(null);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [statusRes, configRes, tmplRes] = await Promise.allSettled([
        whatsappAPI.getStatus(),
        whatsappAPI.getConfig(),
        whatsappAPI.getTemplates(),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
      if (configRes.status === 'fulfilled') setConfig(configRes.value.data);
      if (tmplRes.status === 'fulfilled')
        setTemplates(tmplRes.value.data || []);
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

  // Meta's decision arrives by webhook; check every 30 s and say so when a template changes.
  const seen = useRef<Record<string, string>>({});
  useEffect(() => {
    const check = async () => {
      try {
        const r = await whatsappAPI.getTemplates();
        for (const t of r.data || []) {
          const before = seen.current[t._id];
          if (before === 'PENDING' && (t.status === 'APPROVED' || t.status === 'REJECTED'))
            Alert.alert(
              t.status === 'APPROVED' ? 'Template approved' : 'Template rejected',
              `"${t.displayName}"${t.status === 'REJECTED' && t.rejectedReason ? `\n\n${t.rejectedReason}` : ''}`,
            );
          seen.current[t._id] = t.status;
        }
        setTemplates(r.data || []);
      } catch {
        /* try again next time */
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const editTemplate = (t: any) =>
    setEditor({
      id: t._id,
      form: {
        ...EMPTY_TEMPLATE,
        displayName: t.displayName,
        name: t.name,
        category: t.category,
        language: t.language,
        headerType: t.headerType || 'NONE',
        headerText: t.headerText || '',
        headerMediaId: t.headerMediaId || '',
        headerMediaName: t.headerMediaName || '',
        headerMediaHandle: t.headerMediaHandle || '',
        exampleValues: t.exampleValues || [],
        bodyText: t.bodyText,
        footerText: t.footerText || '',
        metaTemplateName: t.metaTemplateName || '',
        status: t.status,
        notes: t.notes || '',
      },
    });

  const removeTemplate = (t: any) =>
    Alert.alert('Delete template', `Delete "${t.displayName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await whatsappAPI.deleteTemplate(t._id);
            loadAll(true);
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message || '');
          }
        },
      },
    ]);

  const syncStatus = async () => {
    try {
      const r = await whatsappAPI.syncTemplates();
      Alert.alert('Synced with Meta', r.message || 'Template status updated.');
      loadAll(true);
    } catch (e: any) {
      Alert.alert("Couldn't sync", e?.message || '');
    }
  };

  const isConnected = !!(status?.connected ?? config?.connected);
  const phoneNumbers = config?.phoneNumbers || status?.phoneNumbers || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader icon="settings-outline" title="WhatsApp Setup" onBack={() => navigation.goBack()} />

      <View style={styles.tabBar}>
        {([
          ['connection', 'Connection'],
          ['templates', 'Templates'],
          ['analytics', 'Analytics'],
          ['replies', 'Replies'],
        ] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.tabBtn, tab === k && styles.tabBtnOn]}
            onPress={() => setTab(k)}
          >
            <Text style={[styles.tabText, tab === k && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'connection' ? (
        <ConnectionTab canManage={canManage} />
      ) : tab === 'analytics' ? (
        <AnalyticsTab />
      ) : tab === 'replies' ? (
        <RepliesTab />
      ) : loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#024BAB" />
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={t => t._id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAll(true)}
              tintColor="#024BAB"
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 16, marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>
                Message Templates ({templates.length})
              </Text>
              {canManage && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity style={styles.actBtn} onPress={() => setLibraryOpen(true)}>
                    <Text style={styles.actText}>Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actBtn} onPress={() => setEditor({ form: EMPTY_TEMPLATE, id: null })}>
                    <Text style={styles.actText}>+ New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actBtn} onPress={syncStatus}>
                    <Text style={styles.actText}>Sync status</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          renderItem={({ item: t }) => (
            <View style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <Text style={styles.templateName} numberOfLines={1}>
                  {t.displayName}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    {
                      borderColor:
                        TEMPLATE_STATUS_COLORS[t.status] || '#94a3b8',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: TEMPLATE_STATUS_COLORS[t.status] || '#94a3b8' },
                    ]}
                  >
                    {t.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.templateBody} numberOfLines={3}>
                {t.bodyText}
              </Text>
              <Text style={styles.templateMeta}>
                {t.category} · {t.language}
              </Text>
              {!!t.rejectedReason && t.status !== 'APPROVED' && (
                <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                  {t.status === 'REJECTED' ? 'Rejected' : 'Note'}: {t.rejectedReason}
                </Text>
              )}
              {canManage && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {['DRAFT', 'REJECTED'].includes(t.status) && (
                    <TouchableOpacity style={styles.actBtn} onPress={() => editTemplate(t)}>
                      <Text style={styles.actText}>Edit & send</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actBtn, { borderColor: '#dc2626' }]} onPress={() => removeTemplate(t)}>
                    <Text style={[styles.actText, { color: '#dc2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="document-text-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyText}>No templates yet</Text>
              <Text style={styles.emptySub}>
                Tap Library or + New above to create one
              </Text>
            </View>
          }
        />
      )}
      <TemplateLibraryModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        existingNames={templates.map(t => t.metaTemplateName || t.name)}
        onPick={form => {
          setLibraryOpen(false);
          setEditor({ form: { ...EMPTY_TEMPLATE, ...form }, id: null });
        }}
      />
      {editor && (
        <TemplateEditorModal
          visible
          initial={editor.form}
          editingId={editor.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            loadAll(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actBtn: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 6 },
  actText: { fontSize: 12, fontWeight: '700', color: '#000' },
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
  list: { padding: 16 },
  statusCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    padding: 14,
    ...NB_SHADOW,
  },
  statusCardOn: { backgroundColor: '#ecfdf5' },
  statusCardOff: { backgroundColor: '#fef2f2' },
  statusTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
  statusSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  tabBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tabBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff' },
  tabBtnOn: { backgroundColor: '#025D2F' },
  tabText: { fontSize: 12, fontWeight: '500', color: '#000' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
    marginTop: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 10,
    marginBottom: 6,
  },
  phoneText: { fontSize: 12, fontWeight: '500', color: '#000' },
  templateCard: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    marginBottom: 10,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  templateName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#000' },
  statusPill: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusPillText: { fontSize: 9, fontWeight: '500' },
  templateBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
    marginBottom: 6,
  },
  templateMeta: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  emptyBox: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  emptySub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
