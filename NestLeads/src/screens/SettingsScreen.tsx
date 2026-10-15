import React, {useMemo, useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  StatusBar, Alert, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {authAPI} from '../services/api';
import {useTheme} from '../contexts/ThemeContext';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

function formatLabel(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(v: any, withTime = false): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) +
    (withTime ? ', ' + d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}) : '');
}

function ProfileInfoRow({label, value, styles}: {label: string; value: string | null | undefined; styles: any}) {
  if (!value) return null;
  return (
    <View style={styles.profileInfoRow}>
      <Text style={styles.profileInfoLabel}>{label}</Text>
      <Text style={styles.profileInfoValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user, logout} = useAuth();
  const {colors} = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
  );
  const [addressLine1, setAddressLine1] = useState(user?.address?.line1 || '');
  const [addressCity, setAddressCity] = useState(user?.address?.city || '');
  const [addressState, setAddressState] = useState(user?.address?.state || '');
  const [addressPincode, setAddressPincode] = useState(user?.address?.pincode || '');
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContact?.name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContact?.phone || '');
  const [panNumber, setPanNumber] = useState(user?.panNumber || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  const isSuperAdmin = user?.role === 'super_admin';
  const canManageStatuses = ['super_admin', 'admin'].includes(user?.role);

  const handlePickPhoto = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.8, includeBase64: false}, res => {
      if (res.assets?.[0]?.uri) {
        setAvatarUri(res.assets[0].uri);
      }
    });
  };

  // Password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {Alert.alert('Error', 'Name is required'); return;}
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        designation: designation.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        address: {
          line1: addressLine1.trim(),
          city: addressCity.trim(),
          state: addressState.trim(),
          pincode: addressPincode.trim(),
        },
        emergencyContact: {
          name: emergencyName.trim(),
          phone: emergencyPhone.trim(),
        },
        panNumber: panNumber.trim(),
      });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSavingProfile(false);}
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {Alert.alert('Error', 'All fields are required'); return;}
    if (newPwd !== confirmPwd) {Alert.alert('Error', 'Passwords do not match'); return;}
    if (newPwd.length < 6) {Alert.alert('Error', 'New password must be at least 6 characters'); return;}
    setSavingPwd(true);
    try {
      await authAPI.changePassword(currentPwd, newPwd);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {Alert.alert('Error', e.message);}
    finally {setSavingPwd(false);}
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Logout', style: 'destructive', onPress: () => logout()},
    ]);
  };

  const initial = (user?.name || user?.email || 'U')[0].toUpperCase();

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={{paddingBottom: insets.bottom + 24}}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={isSuperAdmin ? handlePickPhoto : undefined}
            activeOpacity={isSuperAdmin ? 0.7 : 1}>
            {avatarUri ? (
              <Image source={{uri: avatarUri}} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            {isSuperAdmin && (
              <View style={styles.avatarEditBadge}>
                <Icon name="camera-outline" size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{(user?.role || 'agent').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
            onPress={() => setActiveTab('profile')}>
            <Icon name="person-outline" size={14} color={activeTab === 'profile' ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'password' && styles.tabActive]}
            onPress={() => setActiveTab('password')}>
            <Icon name="lock-closed-outline" size={14} color={activeTab === 'password' ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Password</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.thinDivider} />

        {activeTab === 'profile' && (
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View style={styles.inputDisabled}>
              <Text style={styles.inputDisabledText}>{email}</Text>
            </View>
            <Text style={styles.fieldLabel}>PHONE</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldLabel}>DEPARTMENT</Text>
            <TextInput
              style={styles.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g. Sales"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>DESIGNATION</Text>
            <TextInput
              style={styles.input}
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g. Sales Executive"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1995-06-21"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.groupLabel}>ADDRESS</Text>
            <Text style={styles.fieldLabel}>ADDRESS LINE</Text>
            <TextInput
              style={styles.input}
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="House / street"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.rowFields}>
              <View style={styles.rowFieldHalf}>
                <Text style={styles.fieldLabel}>CITY</Text>
                <TextInput
                  style={styles.input}
                  value={addressCity}
                  onChangeText={setAddressCity}
                  placeholder="City"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.rowFieldHalf}>
                <Text style={styles.fieldLabel}>STATE</Text>
                <TextInput
                  style={styles.input}
                  value={addressState}
                  onChangeText={setAddressState}
                  placeholder="State"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>PINCODE</Text>
            <TextInput
              style={styles.input}
              value={addressPincode}
              onChangeText={setAddressPincode}
              placeholder="Pincode"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
            />

            <Text style={styles.groupLabel}>EMERGENCY CONTACT</Text>
            <Text style={styles.fieldLabel}>CONTACT NAME</Text>
            <TextInput
              style={styles.input}
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="Emergency contact name"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>CONTACT PHONE</Text>
            <TextInput
              style={styles.input}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              placeholder="Emergency contact phone"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>PAN NUMBER</Text>
            <TextInput
              style={styles.input}
              value={panNumber}
              onChangeText={setPanNumber}
              placeholder="ABCDE1234F"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>ACCOUNT DETAILS</Text>
            <ProfileInfoRow label="Role" value={user?.role ? formatLabel(user.role) : null} styles={styles} />
            <ProfileInfoRow label="Employee ID" value={user?.employeeId} styles={styles} />
            <ProfileInfoRow label="Status" value={user?.status ? formatLabel(user.status) : null} styles={styles} />
            <ProfileInfoRow label="Employment Type" value={user?.employmentType ? formatLabel(user.employmentType) : null} styles={styles} />
            <ProfileInfoRow label="Gender" value={user?.gender ? formatLabel(user.gender) : null} styles={styles} />
            <ProfileInfoRow label="Date of Joining" value={formatDate(user?.dateOfJoining)} styles={styles} />
            <ProfileInfoRow label="Last Login" value={formatDate(user?.lastLogin, true)} styles={styles} />
            <ProfileInfoRow label="Member Since" value={formatDate(user?.createdAt)} styles={styles} />
          </View>
        )}

        {activeTab === 'password' && (
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="Enter current password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(v => !v)}>
                <Icon name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder="Enter new password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showNew}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)}>
                <Icon name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                placeholder="Confirm new password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={savingPwd}>
              {savingPwd ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name="lock-closed-outline" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Personalise + Admin nav rows */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.leadStatusesBtn}
            onPress={() => navigation.navigate('Personalise')}>
            <Icon name="color-palette-outline" size={18} color={colors.primary} />
            <Text style={styles.leadStatusesBtnText}>Personalise</Text>
            <Icon name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {canManageStatuses && (
            <>
              <TouchableOpacity
                style={[styles.leadStatusesBtn, {marginTop: 10}]}
                onPress={() => navigation.navigate('LeadStatuses')}>
                <Icon name="pricetag-outline" size={18} color={colors.primary} />
                <Text style={styles.leadStatusesBtnText}>Manage Lead Statuses</Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.leadStatusesBtn, {marginTop: 10}]}
                onPress={() => navigation.navigate('RolesPermissions')}>
                <Icon name="shield-checkmark-outline" size={18} color={colors.primary} />
                <Text style={styles.leadStatusesBtnText}>Roles & Permissions</Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>ABOUT</Text>
          <View style={styles.infoRow}>
            <Icon name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>NestLeads CRM</Text>
            <Text style={styles.infoValue}>v1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="server-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>API Server</Text>
            <Text style={styles.infoValue}>10.0.2.2:3500</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Icon name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: import('../contexts/ThemeContext').ThemeColors) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
    backBtn: {width: 36, height: 36, borderWidth: 2, borderRadius: 8, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
    headerTitle: {fontSize: 18, fontWeight: '600', color: colors.text},
    divider: {height: 2, backgroundColor: colors.border},
    thinDivider: {height: 1, backgroundColor: colors.divider},
    profileCard: {
      margin: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderRadius: 8,
      borderRightWidth: 5,
      borderBottomWidth: 5,
      borderRightColor: colors.shadowColor,
      borderBottomColor: colors.shadowColor, borderColor: colors.border, padding: 14,
    },
    avatarWrap: {position: 'relative'},
    avatar: {width: 56, height: 56, backgroundColor: colors.primary, borderWidth: 2, borderRadius: 8, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
    avatarImg: {width: 56, height: 56, borderWidth: 2, borderRadius: 8, borderColor: colors.border},
    avatarText: {fontSize: 22, fontWeight: '600', color: '#fff'},
    avatarEditBadge: {position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
    profileInfo: {flex: 1, gap: 3},
    profileName: {fontSize: 16, fontWeight: '600', color: colors.text},
    profileEmail: {fontSize: 12, color: colors.textMuted},
    roleBadge: {alignSelf: 'flex-start', backgroundColor: '#FFDE00', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2},
    roleText: {fontSize: 9, fontWeight: '600', color: '#000'},
    tabs: {flexDirection: 'row', marginHorizontal: 16, marginBottom: 0, gap: 0, borderWidth: 2, borderRadius: 8, borderColor: colors.border},
    tab: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10},
    tabActive: {backgroundColor: colors.primary},
    tabText: {fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase'},
    tabTextActive: {color: '#fff'},
    formSection: {paddingHorizontal: 16, paddingTop: 16},
    fieldLabel: {fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12},
    groupLabel: {fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 2},
    rowFields: {flexDirection: 'row', gap: 10},
    rowFieldHalf: {flex: 1},
    profileInfoRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider},
    profileInfoLabel: {width: 130, fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3},
    profileInfoValue: {flex: 1, fontSize: 13, color: colors.text, fontWeight: '500'},
    input: {borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderRightColor: colors.shadowColor, borderBottomColor: colors.shadowColor, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text},
    inputDisabled: {borderWidth: 2, borderRadius: 8, borderColor: colors.borderSoft, backgroundColor: colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 10},
    inputDisabledText: {fontSize: 14, color: colors.placeholder},
    pwdRow: {flexDirection: 'row', alignItems: 'center', gap: 0},
    eyeBtn: {width: 44, height: 44, borderWidth: 2, borderColor: colors.border, borderLeftWidth: 0, alignItems: 'center', justifyContent: 'center'},
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary, borderWidth: 2,
      borderRadius: 8,
      borderRightWidth: 5,
      borderBottomWidth: 5,
      borderRightColor: colors.shadowColor,
      borderBottomColor: colors.shadowColor, borderColor: colors.border,
      paddingVertical: 13, marginTop: 20,
    },
    saveBtnText: {fontSize: 14, fontWeight: '600', color: '#fff'},
    infoSection: {margin: 16, marginTop: 20, backgroundColor: colors.surface, borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderRightColor: colors.shadowColor, borderBottomColor: colors.shadowColor, borderColor: colors.border, padding: 14},
    infoLabel: {fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10},
    infoRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider},
    infoText: {flex: 1, fontSize: 13, color: colors.text, fontWeight: '600'},
    infoValue: {fontSize: 12, color: colors.textMuted},
    leadStatusesBtn: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 2, borderRadius: 8, borderColor: colors.border, padding: 14, ...NB_SHADOW, shadowColor: colors.shadowColor},
    leadStatusesBtnText: {flex: 1, fontSize: 13, fontWeight: '800', color: colors.text},
    logoutSection: {marginHorizontal: 16, marginTop: 8},
    logoutBtn: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 8, borderColor: colors.danger, padding: 14, justifyContent: 'center'},
    logoutText: {fontSize: 14, fontWeight: '600', color: colors.danger},
  });
}

