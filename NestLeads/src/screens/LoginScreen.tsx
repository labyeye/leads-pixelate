import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';

const Logo = require('../assets/images/Logo.png');
const imLogo = require('../assets/images/logos/indiamart.png');
const fbLogo = require('../assets/images/logos/facebook.png');
const tiLogo = require('../assets/images/logos/tradeindia.webp');

const NB = {shadowColor:'#000',shadowOpacity:1,shadowRadius:0,shadowOffset:{width:4,height:4},elevation:4};

const PLATFORMS = [
  {label: 'IndiaMART', logo: imLogo},
  {label: 'Facebook Ads', logo: fbLogo},
  {label: 'TradeIndia', logo: tiLogo},
];

export default function LoginScreen() {
  const {login} = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {setError('Please enter your email and password.'); return;}
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <ScrollView
        contentContainerStyle={[styles.container, {paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Brand strip with real logo */}
        <View style={styles.brandStrip}>
          <Image source={Logo} style={styles.logoImg} resizeMode="contain"/>
          <View>
            <Text style={styles.brandName}>NestLeads</Text>
            <Text style={styles.brandSub}>Every lead. One place.</Text>
          </View>
        </View>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Sign in to your workspace</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={16} color="#EF4444"/>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputBorder}>
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
            <TextInput
              style={[styles.input, {flex: 1}]}
              placeholder="Your password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={v => {setPassword(v); setError('');}}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b"/>
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
              <ActivityIndicator size="small" color="#fff"/>
              <Text style={styles.submitText}>Signing in...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Platform badges with real logos */}
        <View style={styles.platformRow}>
          {PLATFORMS.map(p => (
            <View key={p.label} style={styles.platformPill}>
              <Image source={p.logo} style={styles.platformLogo} resizeMode="contain"/>
              <Text style={styles.platformPillText}>{p.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#fff'},
  container: {flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#fff'},
  brandStrip: {flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24},
  logoImg: {width: 56, height: 56},
  brandName: {fontSize: 22, fontWeight: '900', color: '#000'},
  brandSub: {fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2},
  divider: {height: 2, backgroundColor: '#000', marginBottom: 28},
  heading: {fontSize: 28, fontWeight: '900', color: '#000', marginBottom: 4},
  subheading: {fontSize: 14, color: '#64748b', marginBottom: 24, fontWeight: '500'},
  errorBox: {flexDirection:'row',alignItems:'center',gap:8,borderWidth:2,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.08)',paddingHorizontal:12,paddingVertical:10,marginBottom:16},
  errorText: {fontSize:13,color:'#EF4444',fontWeight:'600',flex:1},
  fieldGroup: {marginBottom: 16},
  label: {fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 6},
  inputBorder: {flexDirection:'row',alignItems:'center',borderWidth:2,borderColor:'#000',backgroundColor:'#fff'},
  input: {paddingHorizontal:12,paddingVertical:12,fontSize:14,color:'#000',fontWeight:'500'},
  eyeBtn: {borderLeftWidth:2,borderLeftColor:'#000',paddingHorizontal:12,paddingVertical:12},
  submitBtn: {backgroundColor:'#FF751F',borderWidth:2,borderColor:'#000',paddingVertical:14,alignItems:'center',marginTop:8,marginBottom:28,...NB},
  row: {flexDirection:'row',alignItems:'center',gap:8},
  submitText: {fontSize:15,fontWeight:'900',color:'#fff',letterSpacing:0.3},
  platformRow: {flexDirection:'row',flexWrap:'wrap',gap:8},
  platformPill: {flexDirection:'row',alignItems:'center',gap:6,borderWidth:2,borderColor:'#000',paddingHorizontal:10,paddingVertical:6,backgroundColor:'#fff'},
  platformLogo: {width:14,height:14},
  platformPillText: {fontSize:11,fontWeight:'700',color:'#000'},
});
