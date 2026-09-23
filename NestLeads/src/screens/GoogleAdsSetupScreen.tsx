import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  TextInput, Alert, ActivityIndicator, RefreshControl, Linking, AppState, Modal, FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {googleAdsAPI, leadsAPI, usersAPI} from '../services/api';
import AssigneePicker, {describeAssignment} from '../components/AssigneePicker';

const GA_COLOR = '#4285F4';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

interface ConnectedAccount {
  customerId: string;
  customerName: string;
  selectedCampaignIds: string[];
  allowedStates: string[];
  defaultAssigneeId: string;
  assigneeIds?: string[];
  assignBatchSize?: number;
  connectedAt: string;
}

export default function GoogleAdsSetupScreen({navigation}: any) {
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
  const [accounts, setAccounts] = useState<{id: string; name: string; error?: string}[]>([]);
  const [campaigns, setCampaigns] = useState<{id: string; name: string; status: string}[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{id: string; name: string} | null>(null);
  const [allCampaigns, setAllCampaigns] = useState(true);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [allowedStates, setAllowedStates] = useState<string[]>([]);
  const [stateInput, setStateInput] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignBatchSize, setAssignBatchSize] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [connRes, leadsRes, usersRes] = await Promise.all([
        googleAdsAPI.getConnectedAccounts(),
        leadsAPI.getAll({source: 'Google Ads', limit: '1'}).catch(() => ({data: [] as any[]} as any)),
        usersAPI.getAll().catch(() => ({data: []} as any)),
      ]);
      setHasToken(!!connRes.hasToken);
      setConnectedAccounts(connRes.data || []);
      setLeadCount((leadsRes as any).count ?? (leadsRes as any).data?.length ?? 0);
      setUsers(usersRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load Google Ads connection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const res = await googleAdsAPI.getAuthUrl();
      await Linking.openURL(res.data.authUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start Google login');
    }
  };

  const openAddAccount = async () => {
    setShowAddAccount(true);
    setLoadingAccounts(true);
    try {
      const res = await googleAdsAPI.getAccounts();
      setAccounts(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load Google Ads accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const pickAccount = async (acc: {id: string; name: string}) => {
    setSelectedAccount(acc);
    setAccountPickerOpen(false);
    setLoadingCampaigns(true);
    try {
      const res = await googleAdsAPI.getCampaigns(acc.id);
      setCampaigns(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const toggleCampaign = (id: string) =>
    setSelectedCampaignIds(prev => {
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
    setSelectedAccount(null);
    setCampaigns([]);
    setAllCampaigns(true);
    setSelectedCampaignIds(new Set());
    setAllowedStates([]);
    setStateInput('');
    setAssigneeIds([]);
    setAssignBatchSize(1);
  };

  const handleConnect = async () => {
    if (!selectedAccount) return;
    setConnecting(true);
    try {
      await googleAdsAPI.connectAccount(
        selectedAccount.id,
        selectedAccount.name,
        allCampaigns ? [] : Array.from(selectedCampaignIds),
        allowedStates,
        '',
        '',
        {assigneeIds, assignBatchSize},
      );
      resetAddForm();
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to connect account');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (customerId: string) => {
    setSyncingId(customerId);
    try {
      const res = await googleAdsAPI.sync(customerId);
      Alert.alert('Synced', res.message || 'Google Ads leads synced');
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = (customerId: string, name: string) => {
    Alert.alert('Disconnect account', `Stop syncing leads from "${name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setDisconnectingId(customerId);
          try {
            await googleAdsAPI.disconnect(customerId);
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


  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Ads Campaigns</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.backBtn}>
          <Icon name="refresh" size={16} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={GA_COLOR} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={GA_COLOR} />}>
          {!hasToken ? (
            <View style={styles.connectCard}>
              <View style={[styles.iconBox, {borderColor: GA_COLOR}]}>
                <Text style={[styles.brandGlyph, {color: GA_COLOR}]}>G</Text>
              </View>
              <Text style={styles.connectTitle}>Connect Google Ads</Text>
              <Text style={styles.connectDesc}>
                Sync leads from your Google Ads Lead Form campaigns automatically.
              </Text>
              <View style={styles.checklist}>
                <Text style={styles.checklistItem}>• Admin access to a Google Ads account</Text>
                <Text style={styles.checklistItem}>• At least one Lead Form campaign created</Text>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: GA_COLOR}]} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>Connect with Google</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{leadCount}</Text>
                  <Text style={styles.kpiLabel}>Google Ads Leads</Text>
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
                  <View key={acc.customerId} style={styles.accountCard}>
                    <View style={{flex: 1}}>
                      <Text style={styles.accountName} numberOfLines={1}>{acc.customerName || acc.customerId}</Text>
                      <Text style={styles.accountMeta}>
                        {acc.selectedCampaignIds?.length ? `${acc.selectedCampaignIds.length} campaign(s)` : 'All campaigns'}
                      </Text>
                      {acc.allowedStates?.length ? (
                        <View style={styles.metaRow}>
                          <Icon name="location-outline" size={11} color="#94a3b8" />
                          <Text style={styles.accountMetaSmall}>{acc.allowedStates.join(', ')}</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Icon name="person-add-outline" size={11} color="#94a3b8" />
                        <Text style={styles.accountMetaSmall}>{describeAssignment(acc, users)}</Text>
                      </View>
                    </View>
                    <View style={{gap: 6}}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        disabled={syncingId === acc.customerId}
                        onPress={() => handleSync(acc.customerId)}>
                        {syncingId === acc.customerId ? (
                          <ActivityIndicator size="small" color={GA_COLOR} />
                        ) : (
                          <Icon name="refresh" size={15} color={GA_COLOR} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconActionBtn, {borderColor: '#ef4444'}]}
                        disabled={disconnectingId === acc.customerId}
                        onPress={() => handleDisconnect(acc.customerId, acc.customerName)}>
                        {disconnectingId === acc.customerId ? (
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
                  <Icon name="add" size={16} color={GA_COLOR} />
                  <Text style={[styles.addAccountText, {color: GA_COLOR}]}>Add Account</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addForm}>
                  <Text style={styles.formLabel}>Ad Account</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setAccountPickerOpen(true)} disabled={loadingAccounts}>
                    <Text style={styles.pickerBtnText}>
                      {loadingAccounts ? 'Loading…' : selectedAccount?.name || 'Select ad account'}
                    </Text>
                    <Icon name="chevron-down" size={14} color="#000" />
                  </TouchableOpacity>

                  {selectedAccount && (
                    <>
                      <Text style={styles.formLabel}>Campaigns</Text>
                      <View style={styles.toggleRow}>
                        <TouchableOpacity
                          style={[styles.togglePill, allCampaigns && {backgroundColor: GA_COLOR}]}
                          onPress={() => setAllCampaigns(true)}>
                          <Text style={[styles.togglePillText, allCampaigns && {color: '#fff'}]}>All campaigns</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.togglePill, !allCampaigns && {backgroundColor: GA_COLOR}]}
                          onPress={() => setAllCampaigns(false)}>
                          <Text style={[styles.togglePillText, !allCampaigns && {color: '#fff'}]}>Specific campaigns</Text>
                        </TouchableOpacity>
                      </View>

                      {!allCampaigns && (
                        loadingCampaigns ? <ActivityIndicator color={GA_COLOR} style={{marginVertical: 8}} /> : (
                          campaigns.map(c => (
                            <TouchableOpacity key={c.id} style={styles.checkRow} onPress={() => toggleCampaign(c.id)}>
                              <View style={[styles.checkbox, selectedCampaignIds.has(c.id) && {backgroundColor: GA_COLOR}]}>
                                {selectedCampaignIds.has(c.id) && <Icon name="checkmark" size={11} color="#fff" />}
                              </View>
                              <View style={{flex: 1}}>
                                <Text style={styles.checkRowText}>{c.name}</Text>
                                <Text style={styles.checkRowSub}>{c.status}</Text>
                              </View>
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

                      <Text style={styles.formLabel}>Assign Leads To</Text>
                      <AssigneePicker users={users} assigneeIds={assigneeIds} onAssigneeIdsChange={setAssigneeIds} batchSize={assignBatchSize} onBatchSizeChange={setAssignBatchSize} />
                    </>
                  )}

                  <View style={styles.formFooter}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetAddForm}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.connectBtn, {backgroundColor: GA_COLOR, opacity: selectedAccount && !connecting ? 1 : 0.5}]}
                      disabled={!selectedAccount || connecting}
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

      <Modal visible={accountPickerOpen} transparent animationType="slide" onRequestClose={() => setAccountPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAccountPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Ad Account</Text>
            <FlatList
              data={accounts}
              keyExtractor={a => a.id}
              style={{maxHeight: 360}}
              ListEmptyComponent={<Text style={styles.emptyText}>No accounts found</Text>}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.sheetRow} onPress={() => pickAccount(item)}>
                  <Text style={styles.sheetRowText}>{item.name}</Text>
                  {item.error ? <Text style={styles.sheetRowError}>{item.error}</Text> : null}
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
  brandGlyph: {fontSize: 26, fontWeight: '900'},
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
  iconActionBtn: {width: 32, height: 32, borderWidth: 2, borderColor: GA_COLOR, alignItems: 'center', justifyContent: 'center'},
  addAccountBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: GA_COLOR, borderStyle: 'dashed', paddingVertical: 12},
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
  checkRowSub: {fontSize: 10, color: '#94a3b8'},
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
  sheetRowError: {fontSize: 10, color: '#ef4444', marginTop: 2},
});
