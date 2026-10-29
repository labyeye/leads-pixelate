import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Passkey } from 'react-native-passkey';
import Icon from '../components/Icon';
import { authAPI } from '../services/api';
import LottieView from 'lottie-react-native';
import forgot from '../assets/lottie/forgot.json';
import PasswordChecklist from '../components/PasswordChecklist';
import { passwordOk } from '../utils/passwordRules';

type Method = 'email' | 'whatsapp' | 'totp' | 'backup' | 'passkey';
type Step = 'email' | 'methods' | 'emailSent' | 'form' | 'done';

const METHOD_INFO: Record<
  Method,
  { icon: string; title: string; sub: string }
> = {
  email: {
    icon: 'mail-outline',
    title: 'Email link',
    sub: 'We email you a reset link',
  },
  whatsapp: {
    icon: 'logo-whatsapp',
    title: 'WhatsApp OTP',
    sub: 'Get a code on your verified number',
  },
  totp: {
    icon: 'shield-checkmark-outline',
    title: 'Authenticator app',
    sub: 'Use your 6-digit app code',
  },
  backup: {
    icon: 'document-text-outline',
    title: 'Backup code',
    sub: 'Use one of your saved codes',
  },
  passkey: {
    icon: 'key-outline',
    title: 'Passkey',
    sub: 'Verify with Face ID or fingerprint',
  },
};

export default function ForgotPasswordScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [methods, setMethods] = useState<Method[]>([]);
  const [method, setMethod] = useState<Method>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmed = email.trim().toLowerCase();
  const fail = (e: any, fallback: string) =>
    setError(e?.message || fallback);

  const loadMethods = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotMethods(trimmed);
      setMethods(res.data.methods as Method[]);
      setStep('methods');
    } catch (e: any) {
      fail(e, 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pick = async (m: Method) => {
    setError('');
    setCode('');
    setPassword('');
    setCodeSent(false);
    setMethod(m);
    if (m === 'email') {
      setLoading(true);
      try {
        await authAPI.forgotPassword(trimmed);
        setStep('emailSent');
      } catch (e: any) {
        fail(e, 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (m === 'whatsapp') {
      setLoading(true);
      try {
        await authAPI.forgotSendWhatsapp(trimmed);
        setCodeSent(true);
      } catch (e: any) {
        fail(e, 'Could not send the code');
      } finally {
        setLoading(false);
      }
    }
    setStep('form');
  };

  const submit = async () => {
    if (
      !passwordOk(password)
    ) {
      setError('New password needs 8+ characters with a letter and a number');
      return;
    }
    if (method !== 'passkey' && !code.trim()) {
      setError('Enter the code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (method === 'whatsapp') {
        await authAPI.resetWithWhatsapp(trimmed, code.trim(), password);
      } else if (method === 'totp') {
        await authAPI.resetWithTotp(trimmed, code.trim(), password);
      } else if (method === 'backup') {
        await authAPI.resetWithBackupCode(trimmed, code.trim(), password);
      } else {
        if (!Passkey.isSupported())
          throw new Error('Passkeys are not supported on this device.');
        const { data: o } = await authAPI.resetPasskeyOptions();
        const r = await Passkey.get({
          rpId: o.rpId,
          challenge: o.challenge,
          allowCredentials: o.allowCredentials,
          userVerification: o.userVerification,
          timeout: o.timeout,
        });
        await authAPI.resetWithPasskey({
          challengeToken: o.challengeToken,
          password,
          id: r.id,
          rawId: r.rawId,
          type: 'public-key',
          response: {
            clientDataJSON: r.response.clientDataJSON,
            authenticatorData: r.response.authenticatorData,
            signature: r.response.signature,
            userHandle: r.response.userHandle ?? null,
          },
          clientExtensionResults: {},
        });
      }
      setStep('done');
    } catch (e: any) {
      const cancelled =
        e?.error === 'UserCancelled' || e?.name === 'NotAllowedError';
      setError(
        cancelled
          ? 'Passkey verification was cancelled.'
          : e?.message || 'Could not reset password',
      );
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    setError('');
    if (step === 'form') setStep('methods');
    else if (step === 'methods') setStep('email');
    else navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LottieView
          source={forgot}
          autoPlay
          loop
          style={styles.lottieError}
        />
        <Text style={styles.cardTitle}>Forgot password?</Text>
        <View style={styles.card}>
          {(step === 'emailSent' || step === 'done') && (
            <View style={styles.successBlock}>
              <View style={styles.successIcon}>
                <Icon name="checkmark-circle" size={30} color="#00C48C" />
              </View>
              <Text style={styles.cardTitle}>
                {step === 'done' ? 'Password reset' : 'Check your email'}
              </Text>
              <Text style={styles.cardSub}>
                {step === 'done'
                  ? 'Your password was changed and every device was signed out. Log in with your new password.'
                  : `If an account with ${email.trim()} exists, you'll receive a reset link shortly. It expires in 1 hour — check spam if you don't see it.`}
              </Text>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.submitText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          {step !== 'emailSent' && step !== 'done' && (
            <>
              {!!error && (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {step === 'email' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputBorder}>
                      <Icon
                        name="mail-outline"
                        size={16}
                        color="#64748b"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={v => {
                          setEmail(v);
                          setError('');
                        }}
                        placeholder="Enter your email"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={loadMethods}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={loadMethods}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {step === 'methods' && (
                <>
                  <Text style={styles.cardSub}>
                    Choose how you want to verify it's you.
                  </Text>
                  {methods.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodRow, loading && { opacity: 0.6 }]}
                      disabled={loading}
                      onPress={() => pick(m)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.methodIcon}>
                        <Icon
                          name={METHOD_INFO[m].icon}
                          size={18}
                          color="#024BAB"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodTitle}>
                          {METHOD_INFO[m].title}
                        </Text>
                        <Text style={styles.methodSub}>
                          {METHOD_INFO[m].sub}
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={16} color="#000" />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {step === 'form' && (
                <>
                  <Text style={styles.cardSub}>
                    {method === 'whatsapp'
                      ? codeSent
                        ? 'We sent a 6-digit code to your WhatsApp.'
                        : 'Could not send a code. Go back and try again.'
                      : method === 'totp'
                        ? 'Enter the 6-digit code from your authenticator app.'
                        : method === 'backup'
                          ? 'Enter one of your backup codes. It will stop working after this.'
                          : 'Choose a new password, then confirm with your passkey.'}
                  </Text>
                  {method !== 'passkey' && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {method === 'backup' ? 'Backup Code' : 'Code'}
                      </Text>
                      <View style={styles.inputBorder}>
                        <TextInput
                          style={[styles.input, { paddingLeft: 12 }]}
                          value={code}
                          onChangeText={v => {
                            setCode(v);
                            setError('');
                          }}
                          placeholder={
                            method === 'backup' ? 'XXXXX-XXXXX' : '6-digit code'
                          }
                          placeholderTextColor="#94a3b8"
                          keyboardType={
                            method === 'backup' ? 'default' : 'number-pad'
                          }
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                      </View>
                    </View>
                  )}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputBorder}>
                      <TextInput
                        style={[styles.input, { paddingLeft: 12 }]}
                        value={password}
                        onChangeText={v => {
                          setPassword(v);
                          setError('');
                        }}
                        placeholder="Create a strong password"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                    {!!password && <PasswordChecklist password={password} />}
                  </View>
                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={submit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>
                        {method === 'passkey'
                          ? 'Verify & Reset'
                          : 'Reset Password'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.backLink} onPress={back}>
                <Icon name="arrow-back" size={13} color="#024BAB" />
                <Text style={styles.backLinkText}>
                  {step === 'email' ? 'Back to Sign In' : 'Back'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  lottieError: { width: '100%', height: 240, alignSelf: 'center' },
  card: {
    marginTop: 24,
  },
  cardTitle: {
    fontSize: 36,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
    marginTop: 26,
  },
  cardSub: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 20,
    lineHeight: 20,
  },
  bold: { fontWeight: '500', color: '#000' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#EF4444', fontWeight: '500', flex: 1 },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  inputIcon: { marginHorizontal: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#ff751f',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  backLinkText: { fontSize: 13, fontWeight: '500', color: '#024BAB' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 12,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
  methodSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  successBlock: { alignItems: 'center', gap: 4 },
  successIcon: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#00C48C',
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
