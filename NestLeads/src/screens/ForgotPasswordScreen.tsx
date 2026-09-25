import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {authAPI} from '../services/api';

const Logo = require('../assets/images/Logo.png');
const NB = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

export default function ForgotPasswordScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword(trimmed);
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={[styles.container, {paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        <View style={styles.logoWrap}>
          <Image source={Logo} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.brandName}>NestLeads</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <View style={styles.successBlock}>
              <View style={styles.successIcon}>
                <Icon name="checkmark-circle" size={30} color="#00C48C" />
              </View>
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardSub}>
                If an account with <Text style={styles.bold}>{email.trim()}</Text> exists, you'll receive a
                password reset link shortly. The link expires in 1 hour — check your spam folder if you don't
                see it.
              </Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.submitText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Forgot password?</Text>
              <Text style={styles.cardSub}>
                Enter the email address you registered with and we'll send you a reset link.
              </Text>

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
                    value={email}
                    onChangeText={v => {setEmail(v); setError('');}}
                    placeholder="you@company.com"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && {opacity: 0.7}]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Send Reset Link</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                <Icon name="arrow-back" size={13} color="#024BAB" />
                <Text style={styles.backLinkText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#fff'},
  container: {flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#fff', justifyContent: 'center'},
  logoWrap: {alignItems: 'center', marginBottom: 28},
  logoImg: {width: 64, height: 64, marginBottom: 8},
  brandName: {fontSize: 18, fontWeight: '600', color: '#000'},
  card: {borderWidth: 2, borderColor: '#000', padding: 24, ...NB},
  cardTitle: {fontSize: 22, fontWeight: '600', color: '#000', marginBottom: 8},
  cardSub: {fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 20, lineHeight: 20},
  bold: {fontWeight: '800', color: '#000'},
  errorBox: {flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16},
  errorText: {fontSize: 13, color: '#EF4444', fontWeight: '600', flex: 1},
  fieldGroup: {marginBottom: 16},
  label: {fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#000', marginBottom: 6, letterSpacing: 0.5},
  inputBorder: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#fff'},
  inputIcon: {marginHorizontal: 10},
  input: {flex: 1, paddingVertical: 12, paddingRight: 12, fontSize: 14, color: '#000', fontWeight: '500'},
  submitBtn: {backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4},
  submitText: {fontSize: 14, fontWeight: '600', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5},
  backLink: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 8},
  backLinkText: {fontSize: 13, fontWeight: '700', color: '#024BAB'},
  successBlock: {alignItems: 'center', gap: 4},
  successIcon: {width: 60, height: 60, borderWidth: 2, borderColor: '#00C48C', backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 8},
});
