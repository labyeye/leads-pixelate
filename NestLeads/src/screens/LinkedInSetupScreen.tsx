import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  TextInput, Alert, ActivityIndicator, RefreshControl, Linking, AppState, Modal, FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {linkedinAdsAPI, leadsAPI, usersAPI} from '../services/api';

const LI_COLOR = '#0A66C2';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

interface ConnectedAccount {
  adAccountId: string;
  adAccountName: string;
  selectedFormIds: string[];
  allowedStates: string[];
  defaultAssigneeId: string;
  connectedAt: string;
}

export default function LinkedInSetupScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accounts, setAccounts] = useState<{id: string; name: string}[]>([]);
  const [forms, setForms] = useState<{id: string; name: string}[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState<{id: string; name: string} | null>(null);
  const [allForms, setAllForms] = useState(true);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [allowedStates, setAllowedStates] = useState<string[]>([]);
  const [stateInput, setStateInput] = useState('');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [connRes, leadsRes, usersRes] = await Promise.all([
        linkedinAdsAPI.getConnectedAccounts(),
        leadsAPI.getAll({source: 'LinkedIn', limit: '1'}).catch(() => ({data: [] as any[]} as any)),
        usersAPI.getAll().catch(() => ({data: []} as any)),
      ]);
      setHasToken(!!connRes.hasToken);
      setConnectedAccounts(connRes.data || []);
      setLeadCount((leadsRes as any).count ?? (leadsRes as any).data?.length ?? 0);
      setUsers(usersRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load LinkedIn connection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Resume after the user completes OAuth in the system browser.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        load(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [load]);

  const handleLogin = async () => {
    try {
      const res = await linkedinAdsAPI.getAuthUrl();
      await Linking.openURL(res.data.authUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start LinkedIn login');
    }
  };

  const openAddAccount = async () => {
    setShowAddAccount(true);
    setLoadingAccounts(true);
    try {
      const res = await linkedinAdsAPI.getAccounts();
      setAccounts(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load LinkedIn ad accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const pickAdAccount = async (acc: {id: string; name: string}) => {
    setSelectedAdAccount(acc);
    setAccountPickerOpen(false);
    setLoadingForms(true);
    try {
      const res = await linkedinAdsAPI.getForms(acc.id);
      setForms(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load lead forms');
    } finally {
      setLoadingForms(false);
    }
  };

  const toggleForm = (id: string) =>
    setSelectedFormIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addState = () => {
    const v = stateInput.trim();
    if (v && !allowedStates.includes(v)) setAllowedStates([...allowedStates, v]);
    setStateInput('');
  };

  const resetAddForm = () => {
    setShowAddAccount(false);
    setSelectedAdAccount(null);
    setForms([]);
    setAllForms(true);
    setSelectedFormIds(new Set());
    setAllowedStates([]);
    setStateInput('');
    setDefaultAssigneeId('');
  };

  const handleConnect = async () => {
    if (!selectedAdAccount) return;
    setConnecting(true);
    try {
      await linkedinAdsAPI.connectAccount({
        adAccountId: selectedAdAccount.id,
        adAccountName: selectedAdAccount.name,
        selectedFormIds: allForms ? [] : Array.from(selectedFormIds),
        allowedStates,
        defaultAssigneeId,
      });
      resetAddForm();
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to connect account');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (adAccountId: string) => {
    setSyncingId(adAccountId);
    try {
      const res = await linkedinAdsAPI.sync(adAccountId);
      Alert.alert('Synced', res.message || 'LinkedIn leads synced');
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = (adAccountId: string, name: string) => {
    Alert.alert('Disconnect account', `Stop syncing leads from "${name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setDisconnectingId(adAccountId);
          try {
            await linkedinAdsAPI.disconnect(adAccountId);
            load(true);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to disconnect');
          } finally {
            setDisconnectingId(null);
          }
        },
      },
    ]);
  };

  const assigneeName = (id: string) => users.find(u => u._id === id)?.name || 'Auto-assign';

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LinkedIn Campaigns</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={LI_COLOR} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={LI_COLOR} />}>
          {!hasToken ? (
            <View style={styles.connectCard}>
              <View style={[styles.iconBox, {borderColor: LI_COLOR}]}>
                <Text style={[styles.brandGlyph, {color: LI_COLOR}]}>in</Text>
              </View>
              <Text style={styles.connectTitle}>Connect LinkedIn Lead Ads</Text>
              <Text style={styles.connectDesc}>
                Sync leads from your LinkedIn Lead Gen Forms automatically.
              </Text>
              <View style={styles.checklist}>
                <Text style={styles.checklistItem}>• Admin access to a LinkedIn Campaign Manager ad account</Text>
                <Text style={styles.checklistItem}>• At least one Lead Gen Form created</Text>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: LI_COLOR}]} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>Login with LinkedIn</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{leadCount}</Text>
                  <Text style={styles.kpiLabel}>LinkedIn Leads</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{connectedAccounts.length}</Text>
                  <Text style={styles.kpiLabel}>Connected Accounts</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Connected Ad Accounts</Text>
              {connectedAccounts.length === 0 && !showAddAccount ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No accounts connected yet</Text>
                </View>
              ) : (
                connectedAccounts.map(acc => (
                  <View key={acc.adAccountId} style={styles.accountCard}>
                    <View style={{flex: 1}}>
                      <Text style={styles.accountName} numberOfLines={1}>{acc.adAccountName || acc.adAccountId}</Text>
                      <Text style={styles.accountMeta}>
                        {acc.selectedFormIds?.length ? `${acc.selectedFormIds.length} form(s)` : 'All forms'}
                      </Text>
                      {acc.allowedStates?.length ? (
                        <View style={styles.metaRow}>
                          <Icon name="location-outline" size={11} color="#94a3b8" />
                          <Text style={styles.accountMetaSmall}>{acc.allowedStates.join(', ')}</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Icon name="person-add-outline" size={11} color="#94a3b8" />
                        <Text style={styles.accountMetaSmall}>{assigneeName(acc.defaultAssigneeId)}</Text>
                      </View>
                    </View>
                    <View style={{gap: 6}}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        disabled={syncingId === acc.adAccountId}
                        onPress={() => handleSync(acc.adAccountId)}>
                        {syncingId === acc.adAccountId ? (
                          <ActivityIndicator size="small" color={LI_COLOR} />
                        ) : (
                          <Icon name="refresh" size={15} color={LI_COLOR} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconActionBtn, {borderColor: '#ef4444'}]}
                        disabled={disconnectingId === acc.adAccountId}
                        onPress={() => handleDisconnect(acc.adAccountId, acc.adAccountName)}>
                        {disconnectingId === acc.adAccountId ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Icon name="trash-outline" size={15} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {!showAddAccount ? (
                <TouchableOpacity style={styles.addAccountBtn} onPress={openAddAccount}>
                  <Icon name="add" size={16} color={LI_COLOR} />
                  <Text style={[styles.addAccountText, {color: LI_COLOR}]}>Add Account</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addForm}>
                  <Text style={styles.formLabel}>Ad Account</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setAccountPickerOpen(true)} disabled={loadingAccounts}>
                    <Text style={styles.pickerBtnText}>
                      {loadingAccounts ? 'Loading…' : selectedAdAccount?.name || 'Select ad account'}
                    </Text>
                    <Icon name="chevron-down" size={14} color="#000" />
                  </TouchableOpacity>

                  {selectedAdAccount && (
                    <>
                      <Text style={styles.formLabel}>Lead Forms</Text>
                      <View style={styles.toggleRow}>
                        <TouchableOpacity
                          style={[styles.togglePill, allForms && {backgroundColor: LI_COLOR}]}
                          onPress={() => setAllForms(true)}>
                          <Text style={[styles.togglePillText, allForms && {color: '#fff'}]}>All forms</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.togglePill, !allForms && {backgroundColor: LI_COLOR}]}
                          onPress={() => setAllForms(false)}>
                          <Text style={[styles.togglePillText, !allForms && {color: '#fff'}]}>Specific forms</Text>
                        </TouchableOpacity>
                      </View>

                      {!allForms && (
                        loadingForms ? <ActivityIndicator color={LI_COLOR} style={{marginVertical: 8}} /> : (
                          forms.map(f => (
                            <TouchableOpacity key={f.id} style={styles.checkRow} onPress={() => toggleForm(f.id)}>
                              <View style={[styles.checkbox, selectedFormIds.has(f.id) && {backgroundColor: LI_COLOR}]}>
                                {selectedFormIds.has(f.id) && <Icon name="checkmark" size={11} color="#fff" />}
                              </View>
                              <Text style={styles.checkRowText}>{f.name}</Text>
                            </TouchableOpacity>
                          ))
                        )
                      )}

                      <Text style={styles.formLabel}>Location Filter (optional)</Text>
                      <View style={styles.chipInputRow}>
                        <TextInput
                          value={stateInput}
                          onChangeText={setStateInput}
                          onSubmitEditing={addState}
                          placeholder="Type a state and press enter"
                          placeholderTextColor="#94a3b8"
                          style={styles.chipInput}
                        />
                        <TouchableOpacity style={styles.chipAddBtn} onPress={addState}>
                          <Icon name="add" size={16} color="#000" />
                        </TouchableOpacity>
                      </View>
                      {allowedStates.length > 0 && (
                        <View style={styles.chipsWrap}>
                          {allowedStates.map(s => (
                            <TouchableOpacity
                              key={s}
                              style={styles.chip}
                              onPress={() => setAllowedStates(allowedStates.filter(x => x !== s))}>
                              <Text style={styles.chipText}>{s}</Text>
                              <Icon name="close" size={11} color="#000" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <Text style={styles.formLabel}>Default Assignee (optional)</Text>
                      <TouchableOpacity style={styles.pickerBtn} onPress={() => setAssigneePickerOpen(true)}>
                        <Text style={styles.pickerBtnText}>{assigneeName(defaultAssigneeId)}</Text>
                        <Icon name="chevron-down" size={14} color="#000" />
                      </TouchableOpacity>
                    </>
                  )}

                  <View style={styles.formFooter}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetAddForm}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.connectBtn, {backgroundColor: LI_COLOR, opacity: selectedAdAccount && !connecting ? 1 : 0.5}]}
                      disabled={!selectedAdAccount || connecting}
                      onPress={handleConnect}>
                      {connecting ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={styles.connectBtnText}>Connect Account</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Ad account picker */}
      <Modal visible={accountPickerOpen} transparent animationType="slide" onRequestClose={() => setAccountPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAccountPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Ad Account</Text>
            <FlatList
              data={accounts}
              keyExtractor={a => a.id}
              style={{maxHeight: 360}}
              ListEmptyComponent={<Text style={styles.emptyText}>No ad accounts found</Text>}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.sheetRow} onPress={() => pickAdAccount(item)}>
                  <Text style={styles.sheetRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assignee picker */}
      <Modal visible={assigneePickerOpen} transparent animationType="slide" onRequestClose={() => setAssigneePickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAssigneePickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Default Assignee</Text>
            <FlatList
              data={[{_id: '', name: 'Auto-assign'}, ...users]}
              keyExtractor={u => u._id || 'auto'}
              style={{maxHeight: 360}}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => { setDefaultAssigneeId(item._id); setAssigneePickerOpen(false); }}>
                  <Text style={styles.sheetRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  body: {padding: 16, gap: 14},
  connectCard: {borderWidth: 2, borderColor: '#000', padding: 24, alignItems: 'center', gap: 10, ...NB_SHADOW},
  iconBox: {width: 56, height: 56, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  brandGlyph: {fontSize: 22, fontWeight: '900'},
  connectTitle: {fontSize: 16, fontWeight: '900', color: '#000'},
  connectDesc: {fontSize: 12, color: '#64748b', textAlign: 'center'},
  checklist: {alignSelf: 'stretch', gap: 4, marginVertical: 6},
  checklistItem: {fontSize: 11, color: '#64748b'},
  primaryBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#000', paddingHorizontal: 18, paddingVertical: 12, marginTop: 6},
  primaryBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  kpiRow: {flexDirection: 'row', gap: 10},
  kpiCard: {flex: 1, borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  kpiValue: {fontSize: 22, fontWeight: '900', color: '#000'},
  kpiLabel: {fontSize: 10, fontWeight: '800', color: '#64748b', marginTop: 2, textTransform: 'uppercase'},
  sectionTitle: {fontSize: 13, fontWeight: '900', color: '#000', marginTop: 4},
  emptyBox: {borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', padding: 20, alignItems: 'center'},
  emptyText: {fontSize: 12, color: '#94a3b8'},
  accountCard: {flexDirection: 'row', borderWidth: 2, borderColor: '#000', padding: 12, gap: 10, ...NB_SHADOW},
  accountName: {fontSize: 13, fontWeight: '900', color: '#000'},
  accountMeta: {fontSize: 11, color: '#64748b', marginTop: 2},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3},
  accountMetaSmall: {fontSize: 10, color: '#94a3b8'},
  iconActionBtn: {width: 32, height: 32, borderWidth: 2, borderColor: LI_COLOR, alignItems: 'center', justifyContent: 'center'},
  addAccountBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: LI_COLOR, borderStyle: 'dashed', paddingVertical: 12},
  addAccountText: {fontSize: 13, fontWeight: '900'},
  addForm: {borderWidth: 2, borderColor: '#000', padding: 14, gap: 8, ...NB_SHADOW},
  formLabel: {fontSize: 10, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6},
  pickerBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10},
  pickerBtnText: {fontSize: 12, color: '#000', fontWeight: '600'},
  toggleRow: {flexDirection: 'row', gap: 8},
  togglePill: {flex: 1, alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 8},
  togglePillText: {fontSize: 11, fontWeight: '800', color: '#000'},
  checkRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6},
  checkbox: {width: 18, height: 18, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  checkRowText: {fontSize: 12, color: '#000'},
  chipInputRow: {flexDirection: 'row', gap: 8},
  chipInput: {flex: 1, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 12},
  chipAddBtn: {width: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9'},
  chipText: {fontSize: 11, fontWeight: '700', color: '#000'},
  formFooter: {flexDirection: 'row', gap: 10, marginTop: 10},
  cancelBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 11},
  cancelBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  connectBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 11},
  connectBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', maxHeight: '60%', padding: 16},
  sheetTitle: {fontSize: 14, fontWeight: '900', marginBottom: 10, color: '#000'},
  sheetRow: {paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  sheetRowText: {fontSize: 14, color: '#000', fontWeight: '600'},
});
