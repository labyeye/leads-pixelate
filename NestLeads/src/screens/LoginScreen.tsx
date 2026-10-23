import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Passkey } from 'react-native-passkey';
import LottieView from 'lottie-react-native';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { ArrowRight } from 'lucide-react-native';

const loginAnim = require('../assets/lottie/login.json');
const otpAnim = require('../assets/lottie/otp.json');

type Mode = 'email' | 'phone';

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('email');

  // Email + password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // WhatsApp OTP
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVia, setOtpVia] = useState<'whatsapp' | 'email'>('whatsapp');

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // 2FA state
  const [pending2FA, setPending2FA] = useState<string | null>(null);
  const [tfaCode, setTfaCode] = useState('');
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);

    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [mode, pending2FA, entrance]);

  const slideUp = (distance = 24) => ({
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please Enter Email address and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (res.requires2FA) {
        setPending2FA(res.userId || '');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!tfaCode.trim()) {
      Alert.alert('Validation', 'Enter authenticator code');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.verify2FA(pending2FA || '', tfaCode.trim());
      const token = res.token ?? res.data?.token;
      if (!token) throw new Error('Login failed: no token received');
      await loginWithToken(res.data, token);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid authentication code');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!Passkey.isSupported()) {
      setError('Passkeys are not supported on this device.');
      return;
    }
    setError('');
    setPasskeyLoading(true);
    try {
      const optRes = await authAPI.passkeyLoginOptions();
      const opts = optRes.data;
      const result = await Passkey.get({
        rpId: opts.rpId,
        challenge: opts.challenge,
        allowCredentials: opts.allowCredentials,
        userVerification: opts.userVerification,
        timeout: opts.timeout,
      });
      const res = await authAPI.biometricLogin({
        challengeToken: opts.challengeToken,
        id: result.id,
        rawId: result.rawId,
        type: 'public-key',
        response: {
          clientDataJSON: result.response.clientDataJSON,
          authenticatorData: result.response.authenticatorData,
          signature: result.response.signature,
          userHandle: result.response.userHandle ?? null,
        },
      });
      const token = res.token ?? res.data?.token;
      if (!token) throw new Error('Login failed: no token received');
      await loginWithToken(res.data, token);
    } catch (err: any) {
      const cancelled =
        err?.error === 'UserCancelled' || err?.name === 'NotAllowedError';
      setError(
        cancelled
          ? 'Passkey authentication was cancelled.'
          : err.message || 'Passkey login failed. Try another method.',
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const viaEmail = otpVia === 'email';
    if (viaEmail ? !email.trim() : !phone.trim()) {
      Alert.alert(
        'Validation',
        viaEmail ? 'Email is required' : 'Phone number is required',
      );
      return;
    }
    setOtpLoading(true);
    try {
      if (viaEmail) await authAPI.loginSendEmailOtp(email.trim().toLowerCase());
      else await authAPI.loginSendOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message || 'Failed to send OTP. Please try again.',
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Validation', 'Enter the 6-digit OTP');
      return;
    }
    setOtpLoading(true);
    try {
      const res =
        otpVia === 'email'
          ? await authAPI.loginVerifyEmailOtp(
              email.trim().toLowerCase(),
              otp.trim(),
            )
          : await authAPI.loginVerifyOtp(phone.trim(), otp.trim());
      const token = res.token ?? res.data?.token;
      if (!token)
        throw new Error('Login failed: no token received from server');
      await loginWithToken(res.data, token);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid or expired OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const resetPhoneMode = () => {
    setMode('email');
    setOtpSent(false);
    setOtpVia('whatsapp');
    setPhone('');
    setOtp('');
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
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {pending2FA === null && (
          <Animated.View style={slideUp(50)}>
            <LottieView
              key={mode}
              source={mode === 'phone' ? otpAnim : loginAnim}
              autoPlay
              loop
              style={mode === 'phone' ? styles.lottieOtp : styles.lottieLogin}
            />
          </Animated.View>
        )}

        <>
          <Text style={styles.heading}>
            {pending2FA !== null ? 'Two-Factor Authentication' : 'Login'}
          </Text>

          {pending2FA !== null ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Authenticator Code</Text>
                <TextInput
                  style={styles.otpInput}
                  value={tfaCode}
                  onChangeText={t =>
                    setTfaCode(t.replace(/\D/g, '').slice(0, 8))
                  }
                  placeholder="000000"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (loading || tfaCode.length < 6) && { opacity: 0.7 },
                ]}
                onPress={handleVerify2FA}
                disabled={loading || tfaCode.length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.row}>
                    <Icon
                      name="checkmark-circle-outline"
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.submitText}>Verify & Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => {
                  setPending2FA(null);
                  setTfaCode('');
                }}
              >
                <Text style={styles.linkText}>← Back to login</Text>
              </TouchableOpacity>
            </>
          ) : mode === 'phone' ? (
            <>
              {!otpSent ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      {otpVia === 'email' ? 'Email Address' : 'Phone Number'}
                    </Text>
                    <View style={styles.inputBorder}>
                      <Icon
                        name={otpVia === 'email' ? 'mail-outline' : 'call-outline'}
                        size={16}
                        color="#64748b"
                        style={styles.inputIcon}
                      />
                      {otpVia === 'email' ? (
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
                      ) : (
                        <TextInput
                          style={styles.input}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="+91 98765 43210"
                          placeholderTextColor="#94a3b8"
                          keyboardType="phone-pad"
                        />
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.submitBtn, otpLoading && { opacity: 0.7 }]}
                    onPress={handleSendOtp}
                    disabled={otpLoading}
                    activeOpacity={0.85}
                  >
                    {otpLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.row}>
                        <Icon name="arrow-forward" size={16} color="#fff" />
                        <Text style={styles.submitText}>
                          {otpVia === 'email'
                            ? 'Send OTP to Email'
                            : 'Send OTP on WhatsApp'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() =>
                      setOtpVia(v => (v === 'email' ? 'whatsapp' : 'email'))
                    }
                  >
                    <Text style={styles.linkText}>
                      {otpVia === 'email'
                        ? 'Use WhatsApp OTP instead'
                        : 'Use email OTP instead'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      {otpVia === 'email'
                        ? 'Enter OTP (from email)'
                        : 'Enter OTP (from WhatsApp)'}
                    </Text>
                    <TextInput
                      style={styles.otpInput}
                      value={otp}
                      onChangeText={t =>
                        setOtp(t.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      (otpLoading || otp.length < 6) && { opacity: 0.7 },
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading || otp.length < 6}
                    activeOpacity={0.85}
                  >
                    {otpLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.row}>
                        <Icon name="arrow-forward" size={16} color="#fff" />
                        <Text style={styles.submitText}>Verify OTP</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                  >
                    <Text style={styles.linkText}>
                      ← Change {otpVia === 'email' ? 'email' : 'number'} / Resend
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {/blocked/i.test(error) && (
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => {
                    setError('');
                    setMode('phone');
                  }}
                >
                  <Text style={styles.linkText}>Recover with an OTP →</Text>
                </TouchableOpacity>
              )}

              <Animated.View style={slideUp(30)}>
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
                      placeholder="Enter Email Address"
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={v => {
                        setEmail(v);
                        setError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={slideUp(30)}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputBorder}>
                    <Icon
                      name="lock-closed-outline"
                      size={16}
                      color="#64748b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Enter Password"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={v => {
                        setPassword(v);
                        setError('');
                      }}
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPw(v => !v)}
                    >
                      <Icon
                        name={showPw ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#64748b"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={slideUp(20)}>
                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <View style={styles.row}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.submitText}>Signing in...</Text>
                    </View>
                  ) : (
                    <View style={styles.row}>
                      <Text style={styles.submitText}>Sign In</Text>
                      <ArrowRight size={20} color={'#FBFBFB'} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.linkText}>Forgot Password?</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>Or login with</Text>
            <View style={styles.orLine} />
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}
          >
            <Animated.View style={slideUp(20)}>
              <TouchableOpacity
                style={styles.altBtn}
                onPress={() =>
                  mode === 'phone' ? resetPhoneMode() : setMode('phone')
                }
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'phone'
                    ? 'Sign in with email'
                    : 'Sign in with phone OTP'
                }
                activeOpacity={0.85}
              >
                <Icon
                  name={mode === 'phone' ? 'mail-outline' : 'call-outline'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={slideUp(20)}>
              <TouchableOpacity
                style={[styles.altBtn, passkeyLoading && { opacity: 0.7 }]}
                onPress={handlePasskeyLogin}
                disabled={passkeyLoading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with passkey"
                activeOpacity={0.85}
              >
                {passkeyLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="key-outline" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}
          >
            <Text style={[styles.altLabel, { width: 50 }]}>
              {mode === 'phone' ? 'Email' : 'Phone'}
            </Text>
            <Text style={[styles.altLabel, { width: 50 }]}>Passkey</Text>
          </View>
        </>
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
    justifyContent: 'center',
  },
  // Same box + negative top margin as NestSports' login/OTP screens: both animations have
  // generous transparent padding in their canvas, so the art floats above the centred form.
  lottieLogin: { width: '100%', height: 220, marginTop: 5, marginBottom: 6 },
  lottieOtp: { width: '100%', height: 300, marginTop: -204, marginBottom: 24 },
  heading: {
    fontSize: 36,
    fontWeight: '600',
    color: '#000',
    marginBottom: 18,
    textAlign: 'left',
  },
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
  errorText: { fontSize: 13, color: '#EF4444', fontWeight: '600', flex: 1 },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
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
  eyeBtn: {
    borderLeftWidth: 2,
    borderLeftColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  linkBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  linkText: { fontSize: 13, fontWeight: '700', color: '#00000' },
  otpInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
    color: '#000',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  orText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  altBtn: {
    alignSelf: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#024BAB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
});
