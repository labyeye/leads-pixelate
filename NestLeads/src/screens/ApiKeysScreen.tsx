import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, Clipboard,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {apiKeysAPI} from '../services/api';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

export default function ApiKeysScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState('');

  const fetchKeys = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await apiKeysAPI.list();
      setKeys((res.data || []).filter((k: any) => k.active));
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchKeys();}, [fetchKeys]);

  const handleGenerate = async () => {
    if (!name.trim()) {Alert.alert('Error', 'Key name is required'); return;}
    setSaving(true);
    try {
      const res = await apiKeysAPI.generate(name.trim());
      setCreateVisible(false);
      setName('');
      setRevealedKey(res.data.key);
      setRevealedName(res.data.name);
      fetchKeys();
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const handleRevoke = (key: any) => {
    Alert.alert('Revoke Key', `Revoke "${key.name}"? Any website using this key will immediately stop submitting leads.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Revoke', style: 'destructive', onPress: async () => {
        try {await apiKeysAPI.revoke(key.id); fetchKeys();}
        catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const copyKey = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Key copied to clipboard');
  };

  const renderCard = ({item: k}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.keyIcon}>
          <Icon name="key-outline" size={18} color="#024BAB" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.keyName}>{k.name}</Text>
          <Text style={styles.keyPrefix}>{k.keyPrefix}••••••••••••••••</Text>
          <Text style={styles.keyMeta}>Created {new Date(k.createdAt).toLocaleDateString('en-IN')}</Text>
        </View>
        <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(k)}>
          <Icon name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API Keys</Text>
        <Text style={styles.headerSub}>{keys.length} active</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.securityNote}>
        <Icon name="shield-checkmark-outline" size={16} color="#059669" />
        <Text style={styles.securityNoteText}>
          The public endpoint can only create leads — your data stays protected. Keys are stored hashed and cannot be recovered.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={keys}
          keyExtractor={i => i.id}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchKeys(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="key-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>No API keys yet</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setCreateVisible(true)}>
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Generate Key</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create dialog */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {paddingBottom: insets.bottom + 16}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate API Key</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>KEY NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Website Form, Landing Page"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.hintText}>A label to remember where this key is used. Full field configuration is available on the web dashboard.</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleGenerate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.saveBtnText}>Generate Key</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reveal dialog */}
      <Modal visible={!!revealedKey} animationType="fade" transparent onRequestClose={() => setRevealedKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.revealSheet, {marginBottom: insets.bottom + 24}]}>
            <Text style={styles.modalTitle}>New Key — {revealedName}</Text>
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>Copy this key now. It will NOT be shown again.</Text>
            </View>
            <View style={styles.keyBox}>
              <Text style={styles.keyBoxText} numberOfLines={2}>{revealedKey}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={() => revealedKey && copyKey(revealedKey)}>
              <Icon name="copy-outline" size={16} color="#fff" />
              <Text style={styles.copyBtnText}>Copy Key</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setRevealedKey(null)}>
              <Text style={styles.doneBtnText}>I've saved the key</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  addBtn: {
    marginLeft: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000',
    paddingHorizontal: 12, paddingVertical: 7, ...NB_SHADOW,
  },
  addBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  securityNote: {flexDirection: 'row', gap: 8, alignItems: 'flex-start', margin: 12, padding: 10, borderWidth: 2, borderColor: '#10b981', backgroundColor: '#ecfdf5'},
  securityNoteText: {flex: 1, fontSize: 11, color: '#065f46', lineHeight: 15},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, paddingTop: 0, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 10},
  keyIcon: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  cardInfo: {flex: 1},
  keyName: {fontSize: 14, fontWeight: '900', color: '#000'},
  keyPrefix: {fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: 'monospace'},
  keyMeta: {fontSize: 10, color: '#94a3b8', marginTop: 2},
  revokeBtn: {width: 34, height: 34, borderWidth: 2, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 12},
  emptyIcon: {width: 80, height: 80, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', ...NB_SHADOW},
  emptyText: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptyAddBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF751F', borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 10, ...NB_SHADOW},
  emptyAddBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', maxHeight: '90%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  modalTitle: {flex: 1, fontSize: 16, fontWeight: '900', color: '#000'},
  modalClose: {width: 32, height: 32, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  modalDivider: {height: 2, backgroundColor: '#000'},
  modalBody: {padding: 16},
  fieldLabel: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000'},
  hintText: {fontSize: 11, color: '#94a3b8', marginTop: 6},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 2, borderTopColor: '#000'},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  cancelBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  saveBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  revealSheet: {marginHorizontal: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 16, gap: 12, ...NB_SHADOW},
  warnBox: {borderWidth: 2, borderColor: '#f59e0b', backgroundColor: '#fffbeb', padding: 10},
  warnText: {fontSize: 12, fontWeight: '700', color: '#92400e'},
  keyBox: {borderWidth: 2, borderColor: '#000', backgroundColor: '#f8fafc', padding: 10},
  keyBoxText: {fontSize: 11, fontFamily: 'monospace', color: '#000'},
  copyBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, ...NB_SHADOW},
  copyBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  doneBtn: {alignItems: 'center', paddingVertical: 10},
  doneBtnText: {fontSize: 12, fontWeight: '700', color: '#64748b'},
});
