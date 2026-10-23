import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import PhoneInput from '../components/PhoneInput';
import { authAPI } from '../services/api';
import QuotationNumberingCard from '../components/QuotationNumberingCard';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

const PRIMARY_BLUE = '#024BAB';

function FieldLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 }}>
      <Icon name={icon} size={13} color="#000" />
      <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>{text}</Text>
    </View>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedEmail, setSavedEmail] = useState(user?.email || '');
  const [savedPhone, setSavedPhone] = useState(user?.phone || '');
  const [phoneVerified, setPhoneVerified] = useState(!!user?.phoneVerified);
  // WhatsApp OTP flow for changing email / phone
  const [otpFor, setOtpFor] = useState<null | 'email' | 'phone'>(null);
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(
    user?.avatar || null,
  );

  const isSuperAdmin = user?.role === 'super_admin';
  const canManageStatuses = ['super_admin', 'admin'].includes(user?.role);

  const handlePickPhoto = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, includeBase64: false },
      res => {
        if (res.assets?.[0]?.uri) {
          setAvatarUri(res.assets[0].uri);
        }
      },
    );
  };

  // Password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const digits = (v: string) => (v || '').replace(/\D/g, '');
  const phoneChanged = digits(phone) !== digits(savedPhone);
  const emailChanged = email.trim().toLowerCase() !== savedEmail.toLowerCase();
  const phoneNeedsVerify = phoneChanged || !phoneVerified;

  const startOtp = async (type: 'email' | 'phone') => {
    const value = type === 'email' ? email.trim().toLowerCase() : phone.trim();
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      Alert.alert('Invalid email', 'Enter a valid email address');
      return;
    }
    if (type === 'phone' && digits(value).length < 10) {
      Alert.alert('Invalid number', 'Enter a valid phone number');
      return;
    }
    setOtpBusy(true);
    try {
      await authAPI.sendContactOtp(type, value);
      setOtpSentTo(
        type === 'phone'
          ? 'your new WhatsApp number'
          : 'your registered WhatsApp number',
      );
      setOtpCode('');
      setOtpFor(type);
    } catch (e: any) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmOtp = async () => {
    if (otpCode.trim().length < 4 || !otpFor) return;
    setOtpBusy(true);
    try {
      const res = await authAPI.verifyContactOtp(otpCode.trim());
      if (otpFor === 'email') setSavedEmail(res.data?.email || email.trim().toLowerCase());
      else {
        setSavedPhone(res.data?.phone || phone.trim());
        setPhoneVerified(true);
      }
      await refreshUser();
      setOtpFor(null);
      Alert.alert('Verified', res.message || 'Updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ name: name.trim() });
      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    setSavingPwd(true);
    try {
      await authAPI.changePassword(currentPwd, newPwd);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const initial = (user?.name || user?.email || 'U')[0].toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={isSuperAdmin ? handlePickPhoto : undefined}
            activeOpacity={isSuperAdmin ? 0.7 : 1}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
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
              <Text style={styles.roleText}>
                {(user?.role || 'agent').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Icon
              name="person-outline"
              size={14}
              color={activeTab === 'profile' ? '#fff' : '#64748b'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'profile' && styles.tabTextActive,
              ]}
            >
              Profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'password' && styles.tabActive]}
            onPress={() => setActiveTab('password')}
          >
            <Icon
              name="lock-closed-outline"
              size={14}
              color={activeTab === 'password' ? '#fff' : '#64748b'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'password' && styles.tabTextActive,
              ]}
            >
              Password
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.thinDivider} />

        {activeTab === 'profile' && (
          <View style={styles.formSection}>
            <FieldLabel icon="person-outline" text="FULL NAME" />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#94a3b8"
            />

            <FieldLabel icon="mail-outline" text="EMAIL" />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailChanged && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => startOtp('email')}
                disabled={otpBusy}
              >
                {otpBusy && otpFor === null ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="shield-checkmark-outline" size={15} color="#fff" />
                    <Text style={styles.verifyBtnText}>Verify email with WhatsApp OTP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={{ marginTop: 12 }}>
              <PhoneInput
                label="PHONE (WHATSAPP)"
                labelIcon="call-outline"
                value={phone}
                onChange={setPhone}
              />
            </View>
            <View style={styles.phoneStatusRow}>
              <View
                style={[
                  styles.statusChip,
                  phoneNeedsVerify ? styles.chipWarn : styles.chipOk,
                ]}
              >
                <Icon
                  name={phoneNeedsVerify ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={13}
                  color={phoneNeedsVerify ? '#92400e' : '#166534'}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    { color: phoneNeedsVerify ? '#92400e' : '#166534' },
                  ]}
                >
                  {phoneChanged ? 'Unsaved change' : phoneVerified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>
            {phoneNeedsVerify && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => startOtp('phone')}
                disabled={otpBusy}
              >
                <Icon name="shield-checkmark-outline" size={15} color="#fff" />
                <Text style={styles.verifyBtnText}>Verify number with WhatsApp OTP</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'password' && (
          <View style={styles.formSection}>
            <FieldLabel icon="lock-closed-outline" text="CURRENT PASSWORD" />
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="Enter current password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowCurrent(v => !v)}
              >
                <Icon
                  name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <FieldLabel icon="lock-closed-outline" text="NEW PASSWORD" />
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder="Enter new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showNew}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowNew(v => !v)}
              >
                <Icon
                  name={showNew ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <FieldLabel icon="lock-closed-outline" text="CONFIRM NEW PASSWORD" />
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                placeholder="Confirm new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(v => !v)}
              >
                <Icon
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleChangePassword}
              disabled={savingPwd}
            >
              {savingPwd ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="lock-closed-outline" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Admin: Lead Statuses */}
        {canManageStatuses && (
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.leadStatusesBtn}
              onPress={() => navigation.navigate('LeadStatuses')}
            >
              <Icon name="pricetag-outline" size={18} color="#024BAB" />
              <Text style={styles.leadStatusesBtnText}>
                Manage Lead Statuses
              </Text>
              <Icon name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leadStatusesBtn, { marginTop: 10 }]}
              onPress={() => navigation.navigate('RolesPermissions')}
            >
              <Icon name="shield-checkmark-outline" size={18} color="#024BAB" />
              <Text style={styles.leadStatusesBtnText}>
                Roles & Permissions
              </Text>
              <Icon name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {canManageStatuses && (
          <View style={styles.logoutSection}>
            <QuotationNumberingCard />
          </View>
        )}

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>ABOUT</Text>
          <View style={styles.infoRow}>
            <Icon name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>NestLeads CRM</Text>
            <Text style={styles.infoValue}>v1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="server-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>API Server</Text>
            <Text style={styles.infoValue}>10.0.2.2:3500</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Icon name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={otpFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpFor(null)}
      >
        <View style={styles.otpOverlay}>
          <View style={styles.otpBox}>
            <View style={styles.otpHead}>
              <Icon name="shield-checkmark-outline" size={20} color={PRIMARY_BLUE} />
              <Text style={styles.otpTitle}>
                Verify {otpFor === 'email' ? 'email change' : 'phone number'}
              </Text>
            </View>
            <Text style={styles.otpSub}>
              Enter the 6-digit code we sent on WhatsApp to {otpSentTo}.
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={t => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.verifyBtn, (otpBusy || otpCode.length < 4) && { opacity: 0.5 }]}
              onPress={confirmOtp}
              disabled={otpBusy || otpCode.length < 4}
            >
              {otpBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify & Update</Text>
              )}
            </TouchableOpacity>
            <View style={styles.otpLinks}>
              <TouchableOpacity onPress={() => otpFor && startOtp(otpFor)} disabled={otpBusy}>
                <Text style={styles.otpLink}>Resend code</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOtpFor(null)}>
                <Text style={[styles.otpLink, { color: '#64748b' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  verifyBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  verifyBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  phoneStatusRow: { flexDirection: 'row', marginTop: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderRadius: 6 },
  chipOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  chipWarn: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  otpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  otpBox: { backgroundColor: '#fff', padding: 18, borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderColor: '#000' },
  otpHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpTitle: { fontSize: 17, fontWeight: '800', color: '#000' },
  otpSub: { fontSize: 13, color: '#64748b', fontWeight: '600', marginVertical: 12 },
  otpInput: { borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderColor: '#000', paddingVertical: 12, fontSize: 24, fontWeight: '800', letterSpacing: 10, textAlign: 'center', color: '#000' },
  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  otpLink: { fontSize: 13, fontWeight: '800', color: PRIMARY_BLUE },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  divider: { height: 2, backgroundColor: '#000' },
  thinDivider: { height: 1, backgroundColor: '#e2e8f0' },
  profileCard: {
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  avatarText: { fontSize: 22, fontWeight: '600', color: '#fff' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    backgroundColor: '#024BAB',
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: '600', color: '#000' },
  profileEmail: { fontSize: 12, color: '#64748b' },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFDE00',
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  roleText: { fontSize: 9, fontWeight: '600', color: '#000' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 0,
    gap: 0,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  tabActive: { backgroundColor: '#024BAB' },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  tabTextActive: { color: '#fff' },
  formSection: { paddingHorizontal: 16, paddingTop: 16 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },
  inputDisabled: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputDisabledText: { fontSize: 14, color: '#94a3b8' },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  eyeBtn: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: '#000',
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#024BAB',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingVertical: 13,
    marginTop: 20,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  infoSection: {
    margin: 16,
    marginTop: 20,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 14,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoText: { flex: 1, fontSize: 13, color: '#000', fontWeight: '600' },
  infoValue: { fontSize: 12, color: '#64748b' },
  leadStatusesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#fff',
    padding: 14,
  },
  leadStatusesBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  logoutSection: { marginHorizontal: 16, marginTop: 8 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#EF4444',
    padding: 14,
    justifyContent: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});
