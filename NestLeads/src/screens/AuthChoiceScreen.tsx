import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import LegalLinks from '../components/LegalLinks';

const authImage = require('../assets/images/AuthChoice.png');

export default function AuthChoiceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const anims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      120,
      anims.map(a =>
        Animated.timing(a, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [anims]);
  const slideUp = (a: Animated.Value) => ({
    opacity: a,
    transform: [
      {
        translateY: a.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
      },
    ],
  });
  const go = (initialMode: 'email' | 'phone') =>
    navigation.navigate('Login', { initialMode });

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Animated.View style={[styles.heroWrap, slideUp(anims[0])]}>
        <Image source={authImage} style={styles.heroImage} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={slideUp(anims[1])}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => go('email')}
        >
          <Icon name="mail-outline" size={20} color="#000" />
          <Text style={styles.primaryText}>Continue with Email</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={slideUp(anims[2])}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.85}
          onPress={() => go('phone')}
        >
          <Icon name="call-outline" size={20} color="#000" />
          <Text style={styles.secondaryText}>Continue with Phone</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[{ marginTop: 20 }, slideUp(anims[3])]}>
        <LegalLinks />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroWrap: { alignItems: 'center', marginBottom: 32 },
  heroImage: { width: '100%', height: 280, borderRadius: 16 },
  placeholder: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { color: '#9CA3AF', fontSize: 14 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ff751f',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#000',
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    paddingVertical: 14,
    marginBottom: 14,
  },
  primaryText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#000',
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    paddingVertical: 14,
  },
  secondaryText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
