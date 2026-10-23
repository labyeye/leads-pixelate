import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import PhoneInput from '../components/PhoneInput';
import { Passkey } from 'react-native-passkey';

const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

type Section =
  | 'password'
  | 'passkey'
  | 'whatsapp'
  | 'totp'
  | 'backup'
  | 'devices';

export default function AccountSecurityScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState<Section | null>(null);

  const toggle = (k: Section) => setOpen(o => (o === k ? null : k));

  const sections: {
    key: Section;
    icon: string;
    color: string;
    title: string;
    status: string;
    on: boolean;
    body: React.ReactNode;
  }[] = [
    {
      key: 'passkey',
      icon: 'key-outline',
      color: '#FF6B00',
      title: 'Passkey',
      status: 'Sign in with Face ID or fingerprint',
      on: false,
      body: <PasskeyTab />,
    },
    {
      key: 'password',
      icon: 'lock-closed-outline',
      color: '#024BAB',
      title: 'Password',
      status: 'Change your account password',
      on: false,
      body: <PasswordTab />,
    },
    {
      key: 'devices',
      icon: 'phone-portrait-outline',
      color: '#0EA5E9',
      title: 'Signed-in Devices',
      status: 'See where you are logged in',
      on: false,
      body: <DevicesTab />,
    },
    {
      key: 'whatsapp',
      icon: 'logo-whatsapp',
      color: '#00C48C',
      title: 'WhatsApp',
      status: user?.phoneVerified
        ? 'Number verified'
        : 'Verify your number for OTP login',
      on: !!user?.phoneVerified,
      body: <WhatsAppTab user={user} refreshUser={refreshUser} />,
    },
    {
      key: 'totp',
      icon: 'shield-checkmark-outline',
      color: '#7C3AED',
      title: 'Authenticator App',
      status: user?.totpEnabled ? 'Enabled' : 'Two-factor verification codes',
      on: !!user?.totpEnabled,
      body: <TotpTab user={user} refreshUser={refreshUser} />,
    },
    {
      key: 'backup',
      icon: 'document-text-outline',
      color: '#E11D48',
      title: 'Backup Codes',
      status: 'One-time codes if you lose access',
      on: false,
      body: <BackupCodesTab />,
    },
  ];

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
        <Text style={styles.headerTitle}>Account Security</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Choose how you sign in and keep your account protected.
        </Text>
        {sections.map(sec => {
          const isOpen = open === sec.key;
          return (
            <View key={sec.key} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHead}
                activeOpacity={0.8}
                onPress={() => toggle(sec.key)}
              >
                <View style={[styles.iconBox, { backgroundColor: sec.color }]}>
                  <Icon name={sec.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                  <Text
                    style={[
                      styles.sectionStatus,
                      sec.on && { color: '#00A676' },
                    ]}
                    numberOfLines={1}
                  >
                    {sec.status}
                  </Text>
                </View>
                <Icon
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#000"
                />
              </TouchableOpacity>
              {isOpen && <View style={styles.sectionBody}>{sec.body}</View>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PasskeyTab() {
  const [list, setList] = useState<
    { _id: string; name: string; createdAt: string; lastUsedAt: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authAPI.passkeyList();
      setList(res.data || []);
    } catch {
      /* keep empty list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!Passkey.isSupported()) {
      return Alert.alert(
        'Not supported',
        'Passkeys are not supported on this device.',
      );
    }
    setAdding(true);
    try {
      const { data: o } = await authAPI.passkeyRegisterOptions();
      const result = await Passkey.create({
        rp: o.rp,
        user: o.user,
        challenge: o.challenge,
        pubKeyCredParams: o.pubKeyCredParams,
        timeout: o.timeout,
        excludeCredentials: o.excludeCredentials,
        authenticatorSelection: o.authenticatorSelection,
        attestation: o.attestation,
      } as any);
      await authAPI.passkeyRegister({
        challengeToken: o.challengeToken,
        name: Platform.OS === 'ios' ? 'iPhone' : 'Android phone',
        id: result.id,
        rawId: result.rawId,
        type: 'public-key',
        response: {
          clientDataJSON: result.response.clientDataJSON,
          attestationObject: result.response.attestationObject,
        },
        clientExtensionResults: {},
      });
      Alert.alert('Passkey added', 'You can now sign in with your passkey.');
      await load();
    } catch (e: any) {
      const cancelled =
        e?.error === 'UserCancelled' || e?.name === 'NotAllowedError';
      if (!cancelled)
        Alert.alert('Error', e?.message || 'Could not add passkey');
    } finally {
      setAdding(false);
    }
  };

  const remove = (id: string) =>
    Alert.alert('Remove passkey', 'You will no longer be able to use it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.passkeyDelete(id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to remove passkey');
          }
        },
      },
    ]);

  return (
    <View style={styles.panel}>
      <Text style={styles.desc}>
        A passkey lets you sign in to NestLeads with Face ID, Touch ID or your
        screen lock — no password to type or remember.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color="#024BAB" />
      ) : (
        list.map(p => (
          <View key={p._id} style={styles.passkeyRow}>
            <Icon name="key-outline" size={16} color="#FF6B00" />
            <View style={{ flex: 1 }}>
              <Text style={styles.passkeyName}>{p.name}</Text>
              <Text style={styles.passkeyMeta}>
                Added {new Date(p.createdAt).toLocaleDateString()}
                {p.lastUsedAt
                  ? ` · Used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => remove(p._id)} hitSlop={8}>
              <Icon name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
      <TouchableOpacity
        style={[styles.primaryBtn, { opacity: adding ? 0.6 : 1 }]}
        disabled={adding}
        onPress={add}
      >
        {adding ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Add a Passkey</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'Active now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

function DevicesTab() {
  const [list, setList] = useState<
    {
      _id: string;
      deviceName: string;
      platform: string;
      ip: string;
      lastActiveAt: string;
      current: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await authAPI.sessions();
      setList(res.data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (d: { _id: string; deviceName: string }) =>
    Alert.alert(
      'Sign out device',
      `${d.deviceName} will be logged out and must sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.removeSession(d._id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove device');
            }
          },
        },
      ],
    );

  const removeOthers = () =>
    Alert.alert('Sign out other devices', 'Log out everywhere except here?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out all',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.removeOtherSessions();
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed');
          }
        },
      },
    ]);

  if (loading)
    return <ActivityIndicator style={{ margin: 8 }} color="#024BAB" />;

  return (
    <View style={styles.panel}>
      {list.length === 0 && (
        <Text style={styles.desc}>
          No devices to show yet. Devices appear here the next time you sign in.
        </Text>
      )}
      {list.map(d => (
        <View key={d._id} style={styles.passkeyRow}>
          <Icon
            name={d.platform === 'web' ? 'globe-outline' : 'phone-portrait-outline'}
            size={18}
            color="#0EA5E9"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.passkeyName}>
              {d.deviceName}
              {d.current ? '  · This device' : ''}
            </Text>
            <Text style={styles.passkeyMeta}>
              {timeAgo(d.lastActiveAt)}
              {d.ip ? ` · ${d.ip}` : ''}
            </Text>
          </View>
          {!d.current && (
            <TouchableOpacity onPress={() => remove(d)} hitSlop={8}>
              <Icon name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {list.some(d => !d.current) && (
        <TouchableOpacity style={styles.dangerBtn} onPress={removeOthers}>
          <Text style={styles.dangerBtnText}>Sign out all other devices</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BackupCodesTab() {
  const [status, setStatus] = useState<{
    remaining: number;
    generatedAt: string | null;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authAPI.backupCodesStatus();
      setStatus(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!password) return Alert.alert('Password needed', 'Enter your password');
    setBusy(true);
    try {
      const res = await authAPI.generateBackupCodes(password);
      setCodes(res.data.codes);
      setPassword('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate codes');
    } finally {
      setBusy(false);
    }
  };

  const share = () =>
    Share.share({
      message: `NestLeads backup codes (each works once):\n\n${codes?.join('\n')}`,
    }).catch(() => {});

  return (
    <View style={styles.panel}>
      <Text style={styles.desc}>
        Backup codes let you sign in if you lose your phone or can't use your
        other methods. Each code works once. Generating new codes replaces any
        old ones.
      </Text>
      {status && !codes && (
        <Text style={styles.passkeyMeta}>
          {status.generatedAt
            ? `${status.remaining} of 10 codes left · created ${new Date(
                status.generatedAt,
              ).toLocaleDateString()}`
            : 'No backup codes yet'}
        </Text>
      )}
      {codes ? (
        <>
          <View style={styles.codesBox}>
            {codes.map(c => (
              <Text key={c} style={styles.codeText} selectable>
                {c}
              </Text>
            ))}
          </View>
          <Text style={styles.desc}>
            Save these now — they won't be shown again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={share}>
            <Text style={styles.primaryBtnText}>Copy / Save Codes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setCodes(null)}
          >
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.formLabel}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Your account password"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}
            disabled={busy}
            onPress={generate}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {status?.generatedAt ? 'Generate New Codes' : 'Generate Codes'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (next.length < 8)
      return Alert.alert(
        'Too short',
        'New password must be at least 8 characters',
      );
    if (next !== confirm)
      return Alert.alert(
        "Passwords don't match",
        'Confirm the new password correctly',
      );
    setSaving(true);
    try {
      await authAPI.changePassword(current, next);
      Alert.alert('Success', 'Password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.formLabel}>Current Password</Text>
      <TextInput
        style={styles.input}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        placeholder="••••••••"
      />
      <Text style={styles.formLabel}>New Password</Text>
      <TextInput
        style={styles.input}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        placeholder="At least 8 characters"
      />
      <Text style={styles.formLabel}>Confirm New Password</Text>
      <TextInput
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholder="Repeat new password"
      />
      <TouchableOpacity
        style={[styles.primaryBtn, { opacity: saving ? 0.6 : 1 }]}
        disabled={saving}
        onPress={submit}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Change Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function WhatsAppTab({
  user,
  refreshUser,
}: {
  user: any;
  refreshUser: () => Promise<void>;
}) {
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
      await authAPI.updateProfile({ phone });
      setVerified(false);
      setOtpSent(false);
      Alert.alert(
        'Saved',
        'Phone number saved. Verify it to enable WhatsApp updates.',
      );
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
    <View style={styles.panel}>
      <PhoneInput label="WhatsApp Number" value={phone} onChange={setPhone} />
      {verified && (
        <View style={styles.verifiedPill}>
          <Icon name="checkmark-circle" size={13} color="#00C48C" />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.primaryBtn, { opacity: saving ? 0.6 : 1 }]}
        disabled={saving}
        onPress={savePhone}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Save Number</Text>
        )}
      </TouchableOpacity>

      {!verified && phone ? (
        <>
          <TouchableOpacity
            style={[styles.secondaryBtn, { opacity: sendingOtp ? 0.6 : 1 }]}
            disabled={sendingOtp}
            onPress={sendOtp}
          >
            {sendingOtp ? (
              <ActivityIndicator size="small" color="#024BAB" />
            ) : (
              <Text style={styles.secondaryBtnText}>
                Send Verification Code
              </Text>
            )}
          </TouchableOpacity>
          {otpSent && (
            <>
              <Text style={styles.formLabel}>Enter OTP</Text>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                placeholder="6-digit code"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { opacity: verifying ? 0.6 : 1 }]}
                disabled={verifying}
                onPress={verifyOtp}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

function TotpTab({
  user,
  refreshUser,
}: {
  user: any;
  refreshUser: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(!!user?.totpEnabled);
  const [setup, setSetup] = useState<{ qrCode: string; secret: string } | null>(
    null,
  );
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await authAPI.totpSetup();
      setSetup({ qrCode: res.data.qrCode, secret: res.data.secret });
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
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.totpDisable();
            setEnabled(false);
            await refreshUser();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to disable');
          }
        },
      },
    ]);
  };

  if (enabled) {
    return (
      <View style={styles.panel}>
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
    <View style={styles.panel}>
      {!setup ? (
        <>
          <Text style={styles.desc}>
            Add an extra layer of security using an authenticator app (Google
            Authenticator, Authy, etc).
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
            disabled={loading}
            onPress={startSetup}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Set Up Authenticator</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.desc}>
            Scan this QR code with your authenticator app, then enter the
            6-digit code below.
          </Text>
          <Image
            source={{ uri: setup.qrCode }}
            style={styles.qrImage}
            resizeMode="contain"
          />
          <Text style={styles.secretText}>{setup.secret}</Text>
          <Text style={styles.formLabel}>Verification Code</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            keyboardType="number-pad"
            placeholder="6-digit code"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: verifying ? 0.6 : 1 }]}
            disabled={verifying}
            onPress={verify}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify & Enable</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  intro: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  section: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  sectionStatus: { fontSize: 11, color: '#64748b', marginTop: 2 },
  sectionBody: {
    borderTopWidth: 2,
    borderTopColor: '#000',
    padding: 14,
  },
  panel: { gap: 8 },
  passkeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  codesBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 10,
    rowGap: 8,
    backgroundColor: '#FFF8E7',
  },
  codeText: {
    width: '50%',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  passkeyName: { fontSize: 13, fontWeight: '700', color: '#000' },
  passkeyMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
  body: { padding: 16, gap: 14 },
  card: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 16,
    gap: 8,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
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
    fontSize: 13,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#024BAB',
    paddingVertical: 12,
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#024BAB',
    paddingVertical: 12,
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: '#024BAB' },
  dangerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#ef4444',
    paddingVertical: 12,
    marginTop: 10,
  },
  dangerBtnText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: '800', color: '#00C48C' },
  desc: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  qrImage: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    marginVertical: 10,
  },
  secretText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
