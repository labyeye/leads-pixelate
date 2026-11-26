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
import ScreenHeader from '../components/ScreenHeader';

import { useAuth } from '../contexts/AuthContext';
import PhoneInput from '../components/PhoneInput';
import { authAPI } from '../services/api';
import QuotationNumberingCard from '../components/QuotationNumberingCard';
import PasswordChecklist from '../components/PasswordChecklist';

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

function SectionHead({
  icon,
  title,
  sub,
  open,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sectionHead, open && styles.sectionHeadOpen]}
    >
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={18} color={PRIMARY_BLUE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{sub}</Text>
      </View>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#000" />
    </TouchableOpacity>
  );
}

function LinkRow({
  icon,
  label,
  sub,
  onPress,
  last,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.linkRow, !last && styles.linkRowBorder]}
    >
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={18} color={PRIMARY_BLUE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {!!sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
      <Icon name="chevron-forward" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | null>('profile');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedEmail, setSavedEmail] = useState(user?.email || '');
  const [savedPhone, setSavedPhone] = useState(user?.phone || '');
  const [phoneVerified, setPhoneVerified] = useState(!!user?.phoneVerified);
  const [emailVerified, setEmailVerified] = useState(!!user?.emailVerified);
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
  const emailNeedsVerify = emailChanged || !emailVerified;

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
          : 'your email inbox',
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
      if (otpFor === 'email') {
        setSavedEmail(res.data?.email || email.trim().toLowerCase());
        setEmailVerified(true);
      }
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
      <ScreenHeader icon="settings-outline" title="Account Center" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Instagram-style profile header */}
        <View style={styles.igHeader}>
          <TouchableOpacity
            style={styles.igRing}
            onPress={isSuperAdmin ? handlePickPhoto : undefined}
            activeOpacity={isSuperAdmin ? 0.7 : 1}
          >
            <View style={styles.igRingInner}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.igAvatar} />
              ) : (
                <View style={[styles.igAvatar, styles.igAvatarFallback]}>
                  <Text style={styles.igAvatarText}>{initial}</Text>
                </View>
              )}
            </View>
            {isSuperAdmin && (
              <View style={styles.igCamera}>
                <Icon name="camera-outline" size={13} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.igName}>{user?.name || 'User'}</Text>
          <Text style={styles.igHandle}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{(user?.role || 'agent').replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
          <View style={styles.igActions}>
            <TouchableOpacity style={[styles.igBtn, styles.igBtnPrimary]} onPress={() => setActiveTab('profile')}>
              <Text style={[styles.igBtnText, { color: '#fff' }]}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.igBtn} onPress={() => setActiveTab('password')}>
              <Text style={styles.igBtnText}>Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.groupLabel}>YOUR INFORMATION</Text>
        <SectionHead
          icon="person-outline"
          title="Personal details"
          sub="Name, email & WhatsApp number"
          open={activeTab === 'profile'}
          onPress={() => setActiveTab(activeTab === 'profile' ? null : 'profile')}
        />
        {activeTab === 'profile' && (
          <View style={styles.sectionBody}>
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
            <View style={styles.phoneStatusRow}>
              <View
                style={[
                  styles.statusChip,
                  emailNeedsVerify ? styles.chipWarn : styles.chipOk,
                ]}
              >
                <Icon
                  name={emailNeedsVerify ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={13}
                  color={emailNeedsVerify ? '#92400e' : '#166534'}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    { color: emailNeedsVerify ? '#92400e' : '#166534' },
                  ]}
                >
                  {emailChanged ? 'Unsaved change' : emailVerified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>
            {emailNeedsVerify && (
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
                    <Text style={styles.verifyBtnText}>Verify email with OTP</Text>
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

        <SectionHead
          icon="lock-closed-outline"
          title="Password and security"
          sub="Change your password"
          open={activeTab === 'password'}
          onPress={() => setActiveTab(activeTab === 'password' ? null : 'password')}
        />
        {activeTab === 'password' && (
          <View style={styles.sectionBody}>
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
            {!!newPwd && <PasswordChecklist password={newPwd} />}
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

        {canManageStatuses && (
          <>
            <Text style={styles.groupLabel}>WORKSPACE</Text>
            <View style={styles.groupCard}>
              <LinkRow
                icon="pricetag-outline"
                label="Lead statuses"
                sub="Pipeline stages & colours"
                onPress={() => navigation.navigate('LeadStatuses')}
              />
              <LinkRow
                icon="shield-checkmark-outline"
                label="Roles & permissions"
                sub="Who can see and do what"
                onPress={() => navigation.navigate('RolesPermissions')}
              />
              <LinkRow
                icon="business-outline"
                label="Company settings"
                sub="Company, GST, tags & quick picks"
                onPress={() => navigation.navigate('CompanySettings')}
                last
              />
            </View>
          </>
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
              Enter the 6-digit code we sent to {otpSentTo}.
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
  verifyBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
  phoneStatusRow: { flexDirection: 'row', marginTop: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderRadius: 6 },
  chipOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  chipWarn: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  statusChipText: { fontSize: 11, fontWeight: '500' },
  otpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  otpBox: { backgroundColor: '#fff', padding: 18, borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderColor: '#000' },
  otpHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpTitle: { fontSize: 17, fontWeight: '500', color: '#000' },
  otpSub: { fontSize: 13, color: '#64748b', fontWeight: '500', marginVertical: 12 },
  otpInput: { borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderColor: '#000', paddingVertical: 12, fontSize: 24, fontWeight: '500', letterSpacing: 10, textAlign: 'center', color: '#000' },
  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  otpLink: { fontSize: 13, fontWeight: '500', color: PRIMARY_BLUE },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  igHeader: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 16 },
  igRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: '#FF751F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igRingInner: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: '#fff' },
  igAvatar: { width: 96, height: 96, borderRadius: 48 },
  igAvatarFallback: { backgroundColor: PRIMARY_BLUE, alignItems: 'center', justifyContent: 'center' },
  igAvatarText: { fontSize: 38, fontWeight: '600', color: '#fff' },
  igCamera: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY_BLUE,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igName: { fontSize: 20, fontWeight: '700', color: '#000', marginTop: 12 },
  igHandle: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 8 },
  igActions: { flexDirection: 'row', gap: 8, marginTop: 14, alignSelf: 'stretch' },
  igBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  igBtnPrimary: { backgroundColor: PRIMARY_BLUE },
  igBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  sectionHeadOpen: { backgroundColor: '#eff6ff' },
  sectionIcon: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
    borderRadius: 8,
    backgroundColor: '#e8f0fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  sectionSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  sectionBody: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  groupLabel: {
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#64748b',
  },
  groupCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
    overflow: 'hidden',
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  linkRowBorder: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
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
  headerTitle: { fontSize: 18, fontWeight: '500', color: '#000' },
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
  avatarText: { fontSize: 22, fontWeight: '500', color: '#fff' },
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
  profileName: { fontSize: 16, fontWeight: '500', color: '#000' },
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
  roleText: { fontSize: 9, fontWeight: '500', color: '#000' },
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
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  tabTextActive: { color: '#fff' },
  formSection: { paddingHorizontal: 16, paddingTop: 16 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
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
  saveBtnText: { fontSize: 14, fontWeight: '500', color: '#fff' },
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
    fontWeight: '500',
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
  infoText: { flex: 1, fontSize: 13, color: '#000', fontWeight: '500' },
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
    fontWeight: '500',
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
  logoutText: { fontSize: 14, fontWeight: '500', color: '#EF4444' },
});
