import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert, ActivityIndicator, Image} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {authAPI} from '../services/api';
import PhoneInput from '../components/PhoneInput';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

type Tab = 'password' | 'whatsapp' | 'totp';

export default function AccountSecurityScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user, refreshUser} = useAuth();
  const [tab, setTab] = useState<Tab>('password');

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Security</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.tabRow}>
        {(['password', 'whatsapp', 'totp'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'password' ? 'Password' : t === 'whatsapp' ? 'WhatsApp' : 'Authenticator'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}>
        {tab === 'password' && <PasswordTab />}
        {tab === 'whatsapp' && <WhatsAppTab user={user} refreshUser={refreshUser} />}
        {tab === 'totp' && <TotpTab user={user} refreshUser={refreshUser} />}
      </ScrollView>
    </View>
  );
}

function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (next.length < 8) return Alert.alert('Too short', 'New password must be at least 8 characters');
    if (next !== confirm) return Alert.alert("Passwords don't match", 'Confirm the new password correctly');
    setSaving(true);
    try {
      await authAPI.changePassword(current, next);
      Alert.alert('Success', 'Password changed');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.formLabel}>Current Password</Text>
      <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" />
      <Text style={styles.formLabel}>New Password</Text>
      <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry placeholder="At least 8 characters" />
      <Text style={styles.formLabel}>Confirm New Password</Text>
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat new password" />
      <TouchableOpacity style={[styles.primaryBtn, {opacity: saving ? 0.6 : 1}]} disabled={saving} onPress={submit}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Change Password</Text>}
      </TouchableOpacity>
    </View>
  );
}

function WhatsAppTab({user, refreshUser}: {user: any; refreshUser: () => Promise<void>}) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [verified, setVerified] = useState(!!user?.phoneVerified);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const savePhone = async () => {
    setSaving(true);
    try {
      await authAPI.updateProfile({phone});
      setVerified(false);
      setOtpSent(false);
      Alert.alert('Saved', 'Phone number saved. Verify it to enable WhatsApp updates.');
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save phone');
    } finally {
      setSaving(false);
    }
  };

  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      await authAPI.sendPhoneOtp();
      setOtpSent(true);
      Alert.alert('OTP sent', 'Check WhatsApp for your verification code');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setVerifying(true);
    try {
      await authAPI.verifyPhoneOtp(otp.trim());
      setVerified(true);
      setOtp('');
      Alert.alert('Verified', 'WhatsApp number verified');
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invalid OTP');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.card}>
      <PhoneInput label="WhatsApp Number" value={phone} onChange={setPhone} />
      {verified && (
        <View style={styles.verifiedPill}>
          <Icon name="checkmark-circle" size={13} color="#00C48C" />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      )}
      <TouchableOpacity style={[styles.primaryBtn, {opacity: saving ? 0.6 : 1}]} disabled={saving} onPress={savePhone}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save Number</Text>}
      </TouchableOpacity>

      {!verified && phone ? (
        <>
          <TouchableOpacity style={[styles.secondaryBtn, {opacity: sendingOtp ? 0.6 : 1}]} disabled={sendingOtp} onPress={sendOtp}>
            {sendingOtp ? <ActivityIndicator size="small" color="#024BAB" /> : <Text style={styles.secondaryBtnText}>Send Verification Code</Text>}
          </TouchableOpacity>
          {otpSent && (
            <>
              <Text style={styles.formLabel}>Enter OTP</Text>
              <TextInput style={styles.input} value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="6-digit code" />
              <TouchableOpacity style={[styles.primaryBtn, {opacity: verifying ? 0.6 : 1}]} disabled={verifying} onPress={verifyOtp}>
                {verifying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
              </TouchableOpacity>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

function TotpTab({user, refreshUser}: {user: any; refreshUser: () => Promise<void>}) {
  const [enabled, setEnabled] = useState(!!user?.totpEnabled);
  const [setup, setSetup] = useState<{qrCode: string; secret: string} | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await authAPI.totpSetup();
      setSetup({qrCode: res.data.qrCode, secret: res.data.secret});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!token.trim()) return;
    setVerifying(true);
    try {
      await authAPI.totpVerifySetup(token.trim());
      setEnabled(true);
      setSetup(null);
      setToken('');
      Alert.alert('Enabled', 'Authenticator app 2FA is now active');
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  const disable = () => {
    Alert.alert('Disable 2FA', 'Turn off authenticator app verification?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Disable', style: 'destructive',
        onPress: async () => {
          try { await authAPI.totpDisable(); setEnabled(false); await refreshUser(); }
          catch (e: any) { Alert.alert('Error', e.message || 'Failed to disable'); }
        },
      },
    ]);
  };

  if (enabled) {
    return (
      <View style={styles.card}>
        <View style={styles.verifiedPill}>
          <Icon name="checkmark-circle" size={13} color="#00C48C" />
          <Text style={styles.verifiedText}>Authenticator app enabled</Text>
        </View>
        <TouchableOpacity style={styles.dangerBtn} onPress={disable}>
          <Text style={styles.dangerBtnText}>Disable 2FA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {!setup ? (
        <>
          <Text style={styles.desc}>
            Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc).
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, {opacity: loading ? 0.6 : 1}]} disabled={loading} onPress={startSetup}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Set Up Authenticator</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.desc}>Scan this QR code with your authenticator app, then enter the 6-digit code below.</Text>
          <Image source={{uri: setup.qrCode}} style={styles.qrImage} resizeMode="contain" />
          <Text style={styles.secretText}>{setup.secret}</Text>
          <Text style={styles.formLabel}>Verification Code</Text>
          <TextInput style={styles.input} value={token} onChangeText={setToken} keyboardType="number-pad" placeholder="6-digit code" />
          <TouchableOpacity style={[styles.primaryBtn, {opacity: verifying ? 0.6 : 1}]} disabled={verifying} onPress={verify}>
            {verifying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Verify & Enable</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  tabRow: {flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000'},
  tab: {flex: 1, alignItems: 'center', paddingVertical: 12},
  tabActive: {borderBottomWidth: 3, borderBottomColor: '#024BAB', marginBottom: -2},
  tabText: {fontSize: 11, fontWeight: '800', color: '#94a3b8'},
  tabTextActive: {color: '#024BAB'},
  body: {padding: 16},
  card: {borderWidth: 2, borderColor: '#000', padding: 16, gap: 8, ...NB_SHADOW},
  formLabel: {fontSize: 10, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8},
  input: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13},
  primaryBtn: {alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#024BAB', paddingVertical: 12, marginTop: 12},
  primaryBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
  secondaryBtn: {alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#024BAB', paddingVertical: 12, marginTop: 10},
  secondaryBtnText: {fontSize: 12, fontWeight: '900', color: '#024BAB'},
  dangerBtn: {alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ef4444', paddingVertical: 12, marginTop: 10},
  dangerBtnText: {fontSize: 12, fontWeight: '900', color: '#ef4444'},
  verifiedPill: {flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 4},
  verifiedText: {fontSize: 11, fontWeight: '800', color: '#00C48C'},
  desc: {fontSize: 12, color: '#64748b', lineHeight: 18},
  qrImage: {width: 180, height: 180, alignSelf: 'center', borderWidth: 2, borderColor: '#000', marginVertical: 10},
  secretText: {fontSize: 11, color: '#64748b', textAlign: 'center', fontFamily: 'monospace'},
});
