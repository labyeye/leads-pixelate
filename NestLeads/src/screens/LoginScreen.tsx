import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {authAPI} from '../services/api';

const loginAnim = require('../assets/lottie/login.json');
const otpAnim = require('../assets/lottie/otp.json');

type Mode = 'email' | 'phone';

export default function LoginScreen({navigation}: any) {
  const {login, loginWithToken} = useAuth();
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

  // 2FA state
  const [pending2FA, setPending2FA] = useState<string | null>(null);
  const [tfaCode, setTfaCode] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {setError('Please enter your email and password.'); return;}
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
    if (!tfaCode.trim()) {Alert.alert('Validation', 'Enter authenticator code'); return;}
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

  const handleSendOtp = async () => {
    if (!phone.trim()) {Alert.alert('Validation', 'Phone number is required'); return;}
    setOtpLoading(true);
    try {
      await authAPI.loginSendOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {Alert.alert('Validation', 'Enter the 6-digit OTP from WhatsApp'); return;}
    setOtpLoading(true);
    try {
      const res = await authAPI.loginVerifyOtp(phone.trim(), otp.trim());
      const token = res.token ?? res.data?.token;
      if (!token) throw new Error('Login failed: no token received from server');
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
    setPhone('');
    setOtp('');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={[styles.container, {paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {pending2FA === null && (
          <LottieView
            key={mode}
            source={mode === 'phone' ? otpAnim : loginAnim}
            autoPlay
            loop
            style={mode === 'phone' ? styles.lottieOtp : styles.lottieLogin}
          />
        )}

        <>
          <Text style={styles.heading}>{pending2FA !== null ? 'Two-Factor Authentication' : 'Welcome back'}</Text>

          {pending2FA !== null ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Authenticator Code</Text>
                <TextInput
                  style={styles.otpInput}
                  value={tfaCode}
                  onChangeText={t => setTfaCode(t.replace(/\D/g, '').slice(0, 8))}
                  placeholder="000000"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (loading || tfaCode.length < 6) && {opacity: 0.7}]}
                onPress={handleVerify2FA}
                disabled={loading || tfaCode.length < 6}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <View style={styles.row}>
                    <Icon name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.submitText}>Verify & Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => {setPending2FA(null); setTfaCode('');}}>
                <Text style={styles.linkText}>← Back to login</Text>
              </TouchableOpacity>
            </>
          ) : mode === 'phone' ? (
            <>
              {!otpSent ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <View style={styles.inputBorder}>
                      <Icon name="call-outline" size={16} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+91 98765 43210"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.submitBtn, otpLoading && {opacity: 0.7}]} onPress={handleSendOtp} disabled={otpLoading} activeOpacity={0.85}>
                    {otpLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                      <View style={styles.row}>
                        <Icon name="arrow-forward" size={16} color="#fff" />
                        <Text style={styles.submitText}>Send OTP on WhatsApp</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Enter OTP (from WhatsApp)</Text>
                    <TextInput
                      style={styles.otpInput}
                      value={otp}
                      onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitBtn, (otpLoading || otp.length < 6) && {opacity: 0.7}]}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading || otp.length < 6}
                    activeOpacity={0.85}>
                    {otpLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                      <View style={styles.row}>
                        <Icon name="arrow-forward" size={16} color="#fff" />
                        <Text style={styles.submitText}>Verify OTP</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.linkBtn} onPress={() => {setOtpSent(false); setOtp('');}}>
                    <Text style={styles.linkText}>← Change number / Resend</Text>
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

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputBorder}>
                  <Icon name="mail-outline" size={16} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={v => {setEmail(v); setError('');}}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputBorder}>
                  <Icon name="lock-closed-outline" size={16} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, {flex: 1}]}
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={v => {setPassword(v); setError('');}}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                    <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && {opacity: 0.7}]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}>
                {loading ? (
                  <View style={styles.row}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitText}>Signing in...</Text>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Icon name="log-in-outline" size={16} color="#fff" />
                    <Text style={styles.submitText}>Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.linkText}>Forgot Password?</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>Or login with</Text>
            <View style={styles.orLine} />
          </View>
          <TouchableOpacity
            style={styles.altBtn}
            onPress={() => (mode === 'phone' ? resetPhoneMode() : setMode('phone'))}
            accessibilityRole="button"
            accessibilityLabel={mode === 'phone' ? 'Sign in with email' : 'Sign in with phone OTP'}
            activeOpacity={0.85}>
            <Icon name={mode === 'phone' ? 'mail-outline' : 'call-outline'} size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.altLabel}>{mode === 'phone' ? 'Email' : 'Phone'}</Text>
        </>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#fff'},
  container: {flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#fff', justifyContent: 'center'},
  // Same box + negative top margin as NestSports' login/OTP screens: both animations have
  // generous transparent padding in their canvas, so the art floats above the centred form.
  lottieLogin: {width: '100%', height: 250, marginTop: -74, marginBottom: 24},
  lottieOtp: {width: '100%', height: 300, marginTop: -204, marginBottom: 24},
  heading: {fontSize: 26, fontWeight: '900', color: '#000', marginBottom: 18, textAlign: 'center'},
  errorBox: {flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16},
  errorText: {fontSize: 13, color: '#EF4444', fontWeight: '600', flex: 1},
  fieldGroup: {marginBottom: 16},
  label: {fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#000', marginBottom: 6, letterSpacing: 0.5},
  inputBorder: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#fff'},
  inputIcon: {marginHorizontal: 10},
  input: {flex: 1, paddingVertical: 12, paddingRight: 12, fontSize: 14, color: '#000', fontWeight: '500'},
  eyeBtn: {borderLeftWidth: 2, borderLeftColor: '#000', paddingHorizontal: 12, paddingVertical: 12},
  submitBtn: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  submitText: {fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase'},
  linkBtn: {alignItems: 'center', paddingVertical: 10, marginTop: 4},
  linkText: {fontSize: 13, fontWeight: '700', color: '#024BAB'},
  otpInput: {borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, fontSize: 24, fontWeight: '700', letterSpacing: 10, textAlign: 'center', color: '#000'},
  orRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 12},
  orLine: {flex: 1, height: 1, backgroundColor: '#E2E8F0'},
  orText: {fontSize: 12, fontWeight: '600', color: '#64748b'},
  altBtn: {alignSelf: 'center', width: 50, height: 50, borderRadius: 25, backgroundColor: '#024BAB', alignItems: 'center', justifyContent: 'center'},
  altLabel: {textAlign: 'center', marginTop: 6, fontSize: 12, fontWeight: '600', color: '#64748b'},
});
