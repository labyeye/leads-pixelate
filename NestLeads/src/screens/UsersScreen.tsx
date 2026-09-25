import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert, ScrollView, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';
import Icon from '../components/Icon';
import {usersAPI, rolesAPI, uploadFile} from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import PhoneInput from '../components/PhoneInput';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const ROLE_CONFIG: Record<string, {bg: string; text: string; label: string}> = {
  super_admin:     {bg: '#024BAB', text: '#fff', label: 'Super Admin'},
  admin:           {bg: '#000',    text: '#fff', label: 'Admin'},
  sales_executive: {bg: '#FF751F', text: '#fff', label: 'Sales Executive'},
  service_manager: {bg: '#e2e8f0', text: '#000', label: 'Service Manager'},
  accountant:      {bg: '#e2e8f0', text: '#000', label: 'Accountant'},
};
const ROLES = ['sales_executive', 'service_manager', 'accountant', 'admin', 'super_admin'];

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const GENDERS = ['male', 'female', 'other'];
const DOC_TYPES = ['resume', 'id_proof', 'address_proof', 'offer_letter', 'other'];

const BLANK = {
  name: '', email: '', phone: '', roleId: '', role: 'sales_executive', password: '', avatarUri: '',
  department: '', designation: '', dateOfJoining: '', dateOfBirth: '', gender: '', employmentType: '',
  addressLine1: '', addressCity: '', addressState: '', addressPincode: '',
  emergencyName: '', emergencyPhone: '', panNumber: '',
  bankAccountName: '', bankAccountNumber: '', bankIfsc: '', bankName: '',
};

type Tab = 'basic' | 'employment' | 'documents';

export default function UsersScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user: me} = useAuth();
  const isSuperAdmin = me?.role === 'super_admin';
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [tab, setTab] = useState<Tab>('basic');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fetchUsers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        usersAPI.getAll(),
        rolesAPI.getAll().catch(() => ({data: []} as any)),
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setLoading(false); setRefreshing(false);}
  }, []);

  useEffect(() => {fetchUsers();}, [fetchUsers]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(s) ||
           (u.email || '').toLowerCase().includes(s) ||
           (u.role || '').toLowerCase().includes(s);
  });

  const openAdd = () => {setEditing(null); setForm(BLANK); setTab('basic'); setModalVisible(true);};

  const openEdit = async (u: any) => {
    setEditing(u);
    setForm({
      name: u.name || '', email: u.email || '', phone: u.phone || '', roleId: u.roleId || '', role: u.role || 'sales_executive',
      password: '', avatarUri: u.avatar || u.avatarUri || '',
      department: u.department || '', designation: u.designation || '',
      dateOfJoining: u.dateOfJoining?.slice(0, 10) || '', dateOfBirth: u.dateOfBirth?.slice(0, 10) || '',
      gender: u.gender || '', employmentType: u.employmentType || '',
      addressLine1: u.address?.line1 || '', addressCity: u.address?.city || '',
      addressState: u.address?.state || '', addressPincode: u.address?.pincode || '',
      emergencyName: u.emergencyContact?.name || '', emergencyPhone: u.emergencyContact?.phone || '',
      panNumber: u.panNumber || '',
      bankAccountName: '', bankAccountNumber: '', bankIfsc: '', bankName: '',
    });
    setTab('basic');
    setModalVisible(true);
    // Bank details are select:false on the list endpoint — fetch full record.
    try {
      const full = await usersAPI.getById(u._id);
      const b = full.data?.bankDetails;
      if (b) {
        setForm(f => ({...f, bankAccountName: b.accountName || '', bankAccountNumber: b.accountNumber || '', bankIfsc: b.ifsc || '', bankName: b.bankName || ''}));
      }
      setEditing(full.data || u);
    } catch {}
  };

  const handlePickPhoto = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.8}, res => {
      if (res.assets?.[0]?.uri) {
        setForm(f => ({...f, avatarUri: res.assets![0].uri!}));
      }
    });
  };

  const buildPayload = () => {
    const payload: any = {
      name: form.name.trim(), phone: form.phone.trim(), role: form.role,
      department: form.department, designation: form.designation,
      dateOfJoining: form.dateOfJoining || undefined, dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined, employmentType: form.employmentType || undefined,
      address: {line1: form.addressLine1, city: form.addressCity, state: form.addressState, pincode: form.addressPincode},
      emergencyContact: {name: form.emergencyName, phone: form.emergencyPhone},
      panNumber: form.panNumber,
      bankDetails: {
        accountName: form.bankAccountName, accountNumber: form.bankAccountNumber,
        ifsc: form.bankIfsc, bankName: form.bankName,
      },
    };
    if (form.roleId) payload.roleId = form.roleId;
    return payload;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {Alert.alert('Error', 'Name is required'); return;}
    if (!editing && !form.email.trim()) {Alert.alert('Error', 'Email is required'); return;}
    if (!editing && !form.password.trim()) {Alert.alert('Error', 'Password is required'); return;}
    setSaving(true);
    try {
      const payload = buildPayload();
      if (!editing) {payload.email = form.email.trim(); payload.password = form.password;}
      else if (form.password) payload.password = form.password;
      if (editing) await usersAPI.update(editing._id, payload);
      else await usersAPI.create(payload);
      setModalVisible(false);
      fetchUsers();
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSaving(false);}
  };

  const handleDelete = (u: any) => {
    if (u._id === me?._id || u.id === me?._id) {Alert.alert('Error', 'Cannot delete your own account'); return;}
    if (u.role === 'super_admin' && !isSuperAdmin) {Alert.alert('Error', 'Only a super admin can delete another super admin'); return;}
    Alert.alert('Delete User', `Delete "${u.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {await usersAPI.delete(u._id); fetchUsers();}
        catch (e: any) {Alert.alert('Error', e.message);}
      }},
    ]);
  };

  const toggleStatus = async (u: any) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await usersAPI.update(u._id, {status: newStatus});
      fetchUsers();
    } catch (e: any) {Alert.alert('Error', e.message);}
  };

  const handleUploadDoc = (docType: string) => {
    launchImageLibrary({mediaType: 'photo', quality: 0.8}, async res => {
      const asset = res.assets?.[0];
      if (!asset?.uri || !editing) return;
      setUploadingDoc(true);
      try {
        const url = await uploadFile(asset.uri, asset.fileName || `${docType}.jpg`, asset.type || 'image/jpeg');
        const saved = await usersAPI.addDocument(editing._id, {name: asset.fileName || docType, type: docType, url});
        setEditing(saved.data);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Upload failed');
      } finally {
        setUploadingDoc(false);
      }
    });
  };

  const handleRemoveDoc = (docId: string) => {
    if (!editing) return;
    Alert.alert('Remove document', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const res = await usersAPI.removeDocument(editing._id, docId);
          setEditing(res.data);
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const roleCounts = ROLES.reduce((acc: Record<string, number>, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  const selectedRoleLabel = () => {
    if (form.role === 'super_admin') return 'Super Admin';
    const r = roles.find((x: any) => x._id === form.roleId);
    return r?.name || ROLE_CONFIG[form.role]?.label || form.role;
  };

  const renderUser = ({item: u}: {item: any}) => {
    const rc = ROLE_CONFIG[u.role] || {bg: '#e2e8f0', text: '#000', label: u.role};
    const isActive = u.status !== 'inactive';
    const initial = (u.name || u.email || 'U')[0].toUpperCase();
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {u.avatar || u.avatarUri ? (
            <Image source={{uri: u.avatar || u.avatarUri}} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatar, {backgroundColor: rc.bg}]}>
              <Text style={[styles.avatarText, {color: rc.text}]}>{initial}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.userName}>{u.name || 'Unnamed'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
            {u.designation ? <Text style={styles.userPhone}>{u.designation}{u.department ? ` · ${u.department}` : ''}</Text> : null}
            {u.phone || u.gender ? <Text style={styles.userPhone}>{[u.phone, u.gender && u.gender[0].toUpperCase() + u.gender.slice(1)].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.roleBadge, {backgroundColor: rc.bg, borderColor: '#000'}]}>
              <Text style={[styles.roleText, {color: rc.text}]}>{rc.label}</Text>
            </View>
            <View style={[styles.statusDot, {backgroundColor: isActive ? '#22c55e' : '#ef4444'}]} />
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(u)}>
            <Icon name="pencil-outline" size={13} color="#024BAB" />
            <Text style={[styles.actionText, {color: '#024BAB'}]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleStatus(u)}>
            <Icon name={isActive ? 'pause-circle-outline' : 'play-circle-outline'} size={13} color="#64748b" />
            <Text style={[styles.actionText, {color: '#64748b'}]}>{isActive ? 'Deactivate' : 'Activate'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(u)}>
            <Icon name="trash-outline" size={13} color="#ef4444" />
            <Text style={[styles.actionText, {color: '#ef4444'}]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSub}>{users.length} total</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Icon name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <View style={styles.roleStripWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleStrip}>
          {ROLES.map(r => {
            const cfg = ROLE_CONFIG[r];
            return (
              <View key={r} style={[styles.roleChip, {backgroundColor: cfg.bg}]}>
                <Text style={[styles.roleChipCount, {color: cfg.text}]}>{roleCounts[r] || 0}</Text>
                <Text style={[styles.roleChipLabel, {color: cfg.text}]} numberOfLines={1}>{cfg.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.thinDivider} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={14} color="#94a3b8" style={{marginRight: 6}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Icon name="close" size={14} color="#94a3b8" /></TouchableOpacity>}
        </View>
      </View>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#024BAB" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id || i.id}
          renderItem={renderUser}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchUsers(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="people-outline" size={44} color="#e2e8f0" />
              <Text style={styles.emptyTitle}>No users found</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit User' : 'Add User'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            <View style={styles.tabRow}>
              {(['basic', 'employment', ...(editing ? ['documents'] as Tab[] : [])] as Tab[]).map(t => (
                <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
                  <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                    {t === 'basic' ? 'Basic' : t === 'employment' ? 'Employment' : 'Documents'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {tab === 'basic' && (
                <>
                  <View style={styles.photoPickerRow}>
                    <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto}>
                      {form.avatarUri ? (
                        <Image source={{uri: form.avatarUri}} style={styles.photoPreview} />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Icon name="camera-outline" size={22} color="#64748b" />
                          <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {form.avatarUri ? (
                      <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setForm(f => ({...f, avatarUri: ''}))}>
                        <Icon name="trash-outline" size={14} color="#ef4444" />
                        <Text style={styles.photoRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={styles.fieldLabel}>NAME *</Text>
                  <TextInput style={styles.fieldInput} value={form.name} onChangeText={v => setForm(f => ({...f, name: v}))} placeholder="Full name" placeholderTextColor="#94a3b8" />

                  {!editing && (
                    <>
                      <Text style={styles.fieldLabel}>EMAIL *</Text>
                      <TextInput style={styles.fieldInput} value={form.email} onChangeText={v => setForm(f => ({...f, email: v}))} placeholder="email@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
                    </>
                  )}

                  <View style={{marginTop: 12, marginBottom: 4}}>
                    <PhoneInput label="Phone" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} />
                  </View>

                  <Text style={styles.fieldLabel}>{editing ? 'NEW PASSWORD (leave blank to keep)' : 'PASSWORD *'}</Text>
                  <View style={styles.pwdRow}>
                    <TextInput style={[styles.fieldInput, {flex: 1, marginBottom: 0}]} value={form.password} onChangeText={v => setForm(f => ({...f, password: v}))} placeholder="••••••••" placeholderTextColor="#94a3b8" secureTextEntry={!showPwd} />
                    <TouchableOpacity style={styles.pwdToggle} onPress={() => setShowPwd(p => !p)}>
                      <Icon name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={16} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>ROLE *</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setRolePickerOpen(true)}>
                    <Text style={styles.pickerBtnText}>{selectedRoleLabel()}</Text>
                    <Icon name="chevron-down" size={14} color="#000" />
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>DEPARTMENT</Text>
                  <TextInput style={styles.fieldInput} value={form.department} onChangeText={v => setForm(f => ({...f, department: v}))} placeholder="e.g. Sales" placeholderTextColor="#94a3b8" />

                  <Text style={styles.fieldLabel}>DESIGNATION</Text>
                  <TextInput style={styles.fieldInput} value={form.designation} onChangeText={v => setForm(f => ({...f, designation: v}))} placeholder="e.g. Sales Executive" placeholderTextColor="#94a3b8" />
                </>
              )}

              {tab === 'employment' && (
                <>
                  <View style={styles.dateRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.fieldLabel}>DATE OF JOINING</Text>
                      <TextInput style={styles.fieldInput} value={form.dateOfJoining} onChangeText={v => setForm(f => ({...f, dateOfJoining: v}))} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
                      <TextInput style={styles.fieldInput} value={form.dateOfBirth} onChangeText={v => setForm(f => ({...f, dateOfBirth: v}))} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>GENDER</Text>
                  <View style={styles.chipRow}>
                    {GENDERS.map(g => (
                      <TouchableOpacity key={g} style={[styles.chip, form.gender === g && styles.chipActive]} onPress={() => setForm(f => ({...f, gender: g}))}>
                        <Text style={[styles.chipText, form.gender === g && styles.chipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>EMPLOYMENT TYPE</Text>
                  <View style={styles.chipRow}>
                    {EMPLOYMENT_TYPES.map(t => (
                      <TouchableOpacity key={t} style={[styles.chip, form.employmentType === t && styles.chipActive]} onPress={() => setForm(f => ({...f, employmentType: t}))}>
                        <Text style={[styles.chipText, form.employmentType === t && styles.chipTextActive]}>{t.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>ADDRESS</Text>
                  <TextInput style={styles.fieldInput} value={form.addressLine1} onChangeText={v => setForm(f => ({...f, addressLine1: v}))} placeholder="Address line" placeholderTextColor="#94a3b8" />
                  <View style={styles.dateRow}>
                    <TextInput style={[styles.fieldInput, {flex: 1}]} value={form.addressCity} onChangeText={v => setForm(f => ({...f, addressCity: v}))} placeholder="City" placeholderTextColor="#94a3b8" />
                    <TextInput style={[styles.fieldInput, {flex: 1}]} value={form.addressState} onChangeText={v => setForm(f => ({...f, addressState: v}))} placeholder="State" placeholderTextColor="#94a3b8" />
                  </View>
                  <TextInput style={styles.fieldInput} value={form.addressPincode} onChangeText={v => setForm(f => ({...f, addressPincode: v}))} placeholder="Pincode" placeholderTextColor="#94a3b8" keyboardType="number-pad" />

                  <View style={{marginTop: 8}}>
                    <PhoneInput label="Emergency Contact Phone" value={form.emergencyPhone} onChange={v => setForm(f => ({...f, emergencyPhone: v}))} />
                  </View>
                  <Text style={styles.fieldLabel}>EMERGENCY CONTACT NAME</Text>
                  <TextInput style={styles.fieldInput} value={form.emergencyName} onChangeText={v => setForm(f => ({...f, emergencyName: v}))} placeholder="Contact name" placeholderTextColor="#94a3b8" />

                  <Text style={styles.fieldLabel}>PAN NUMBER</Text>
                  <TextInput style={styles.fieldInput} value={form.panNumber} onChangeText={v => setForm(f => ({...f, panNumber: v.toUpperCase()}))} placeholder="ABCDE1234F" placeholderTextColor="#94a3b8" autoCapitalize="characters" />

                  <Text style={[styles.fieldLabel, {marginTop: 16}]}>BANK DETAILS</Text>
                  <TextInput style={styles.fieldInput} value={form.bankAccountName} onChangeText={v => setForm(f => ({...f, bankAccountName: v}))} placeholder="Account holder name" placeholderTextColor="#94a3b8" />
                  <TextInput style={styles.fieldInput} value={form.bankAccountNumber} onChangeText={v => setForm(f => ({...f, bankAccountNumber: v}))} placeholder="Account number" placeholderTextColor="#94a3b8" keyboardType="number-pad" />
                  <View style={styles.dateRow}>
                    <TextInput style={[styles.fieldInput, {flex: 1}]} value={form.bankIfsc} onChangeText={v => setForm(f => ({...f, bankIfsc: v.toUpperCase()}))} placeholder="IFSC" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
                    <TextInput style={[styles.fieldInput, {flex: 1}]} value={form.bankName} onChangeText={v => setForm(f => ({...f, bankName: v}))} placeholder="Bank name" placeholderTextColor="#94a3b8" />
                  </View>
                </>
              )}

              {tab === 'documents' && editing && (
                <>
                  {(editing.documents || []).map((d: any) => (
                    <View key={d._id} style={styles.docRow}>
                      <Icon name="document-text-outline" size={16} color="#024BAB" />
                      <View style={{flex: 1}}>
                        <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                        <Text style={styles.docType}>{d.type.replace('_', ' ')}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveDoc(d._id)}>
                        <Icon name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {(!editing.documents || editing.documents.length === 0) && (
                    <Text style={styles.emptyDocsText}>No documents uploaded yet</Text>
                  )}
                  <Text style={[styles.fieldLabel, {marginTop: 14}]}>UPLOAD DOCUMENT</Text>
                  <View style={styles.chipRow}>
                    {DOC_TYPES.map(t => (
                      <TouchableOpacity key={t} style={styles.chip} disabled={uploadingDoc} onPress={() => handleUploadDoc(t)}>
                        {uploadingDoc ? <ActivityIndicator size="small" color="#024BAB" /> : <Text style={styles.chipText}>{t.replace('_', ' ')}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.docHint}>Tap a document type to pick an image to upload as that document.</Text>
                </>
              )}
            </ScrollView>
            <View style={styles.divider} />
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Create User'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rolePickerOpen} transparent animationType="fade" onRequestClose={() => setRolePickerOpen(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setRolePickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <FlatList
              data={[...roles, ...(isSuperAdmin ? [{_id: '__super_admin__', name: 'Super Admin'}] : [])]}
              keyExtractor={(r: any) => r._id}
              style={{maxHeight: 360}}
              renderItem={({item: r}: any) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    if (r._id === '__super_admin__') setForm(f => ({...f, role: 'super_admin', roleId: ''}));
                    else setForm(f => ({...f, roleId: r._id, role: r.tier || f.role}));
                    setRolePickerOpen(false);
                  }}>
                  <Text style={styles.pickerRowText}>{r.name}</Text>
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
  headerTitle: {fontSize: 20, fontWeight: '600', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  addBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 8, ...NB_SHADOW},
  addBtnText: {fontSize: 12, fontWeight: '600', color: '#fff'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},
  roleStripWrap: {height: 80},
  roleStrip: {paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center'},
  roleChip: {paddingHorizontal: 10, height: 64, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', minWidth: 90},
  roleChipCount: {fontSize: 18, fontWeight: '600'},
  roleChipLabel: {fontSize: 7, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center', marginTop: 3, maxWidth: 72},
  searchRow: {paddingHorizontal: 12, paddingVertical: 10},
  searchBox: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', paddingHorizontal: 10},
  searchInput: {flex: 1, paddingVertical: 9, fontSize: 13, color: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},
  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  cardRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  avatar: {width: 40, height: 40, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  avatarImg: {width: 40, height: 40, borderWidth: 2, borderColor: '#000'},
  avatarText: {fontSize: 16, fontWeight: '600'},
  photoPickerRow: {alignItems: 'center', paddingVertical: 8, gap: 8},
  photoPickerBtn: {borderWidth: 2, borderColor: '#000', borderStyle: 'dashed'},
  photoPreview: {width: 80, height: 80},
  photoPlaceholder: {width: 80, height: 80, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#f8fafc'},
  photoPlaceholderText: {fontSize: 10, fontWeight: '700', color: '#64748b'},
  photoRemoveBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  photoRemoveText: {fontSize: 12, fontWeight: '700', color: '#ef4444'},
  cardInfo: {flex: 1},
  userName: {fontSize: 14, fontWeight: '600', color: '#000'},
  userEmail: {fontSize: 11, color: '#64748b', marginTop: 1},
  userPhone: {fontSize: 11, color: '#94a3b8'},
  cardRight: {alignItems: 'flex-end', gap: 4},
  roleBadge: {paddingHorizontal: 7, paddingVertical: 3, borderWidth: 2},
  roleText: {fontSize: 9, fontWeight: '600', textTransform: 'uppercase'},
  statusDot: {width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#000'},
  cardActions: {flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  actionText: {fontSize: 12, fontWeight: '700'},
  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 8},
  emptyTitle: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalBox: {backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: '#000', maxHeight: '92%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16},
  modalTitle: {fontSize: 18, fontWeight: '600', color: '#000'},
  tabRow: {flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000'},
  tabBtn: {flex: 1, alignItems: 'center', paddingVertical: 10},
  tabBtnActive: {borderBottomWidth: 3, borderBottomColor: '#024BAB', marginBottom: -2},
  tabBtnText: {fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase'},
  tabBtnTextActive: {color: '#024BAB'},
  modalBody: {padding: 16, gap: 4},
  fieldLabel: {fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 12},
  fieldInput: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000', backgroundColor: '#fff', marginBottom: 4},
  pwdRow: {flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4},
  pwdToggle: {width: 44, height: 44, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  pickerBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4},
  pickerBtnText: {fontSize: 13, color: '#000', fontWeight: '600'},
  dateRow: {flexDirection: 'row', gap: 10},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4},
  chip: {paddingHorizontal: 10, paddingVertical: 7, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff'},
  chipActive: {backgroundColor: '#024BAB'},
  chipText: {fontSize: 11, fontWeight: '700', color: '#000', textTransform: 'capitalize'},
  chipTextActive: {color: '#fff'},
  docRow: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#000', padding: 10, marginBottom: 8},
  docName: {fontSize: 12, fontWeight: '700', color: '#000'},
  docType: {fontSize: 10, color: '#94a3b8', textTransform: 'capitalize'},
  emptyDocsText: {fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 20},
  docHint: {fontSize: 10, color: '#94a3b8', marginTop: 8},
  modalFooter: {flexDirection: 'row', gap: 10, padding: 16},
  cancelBtn: {flex: 1, borderWidth: 2, borderColor: '#000', paddingVertical: 12, alignItems: 'center'},
  cancelBtnText: {fontSize: 13, fontWeight: '600', color: '#000'},
  saveBtn: {flex: 2, backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, alignItems: 'center', ...NB_SHADOW},
  saveBtnText: {fontSize: 13, fontWeight: '600', color: '#fff'},
  pickerOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  pickerSheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', maxHeight: '60%'},
  pickerRow: {paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  pickerRowText: {fontSize: 14, color: '#000', fontWeight: '600'},
});
