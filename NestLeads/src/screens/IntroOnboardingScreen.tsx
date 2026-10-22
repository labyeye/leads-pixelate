import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@nestleads/onboarding-complete';

const slides = [
  {
    number: '01',
    title: 'Turn conversations into leads',
    body: 'Capture, organise and follow every opportunity from one focused workspace built for your sales team.',
    color: '#EAF2FF',
  },
  {
    number: '02',
    title: 'Keep your pipeline moving',
    body: 'Track lead stages, tasks, follow-ups and quotations so nothing valuable gets lost between conversations.',
    color: '#FFF1E8',
  },
  {
    number: '03',
    title: 'Grow with useful insights',
    body: 'See what is working across your team and campaigns with reports that help you act with confidence.',
    color: '#E9F9F3',
  },
];

export default function IntroOnboardingScreen({ navigation }: any) {
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(value => {
        if (value === 'true') navigation.replace('Login');
      })
      .catch(error => {
        console.warn('Unable to read NestLeads onboarding state', error);
      });
  }, [navigation]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      console.warn('Unable to save NestLeads onboarding state', error);
    }
    navigation.replace('Login');
  };

  const next = () => {
    if (current === slides.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (current + 1), animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Nest<Text style={styles.logoAccent}>Leads</Text>
        </Text>
        <TouchableOpacity onPress={finish} accessibilityRole="button">
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.slides}
      >
        {slides.map(slide => (
          <View style={styles.slide} key={slide.number}>
            <View style={[styles.illustration, { backgroundColor: slide.color }]}>
              <Text style={styles.slideNumber}>{slide.number}</Text>
              <View style={styles.illustrationCard}>
                <View style={styles.illustrationLineLong} />
                <View style={styles.illustrationLineShort} />
                <View style={styles.illustrationRow}>
                  <View style={styles.illustrationDot} />
                  <View style={styles.illustrationLineMedium} />
                </View>
              </View>
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <View
              key={slide.number}
              style={[styles.dot, index === current && styles.activeDot]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={next} accessibilityRole="button">
          <Text style={styles.buttonText}>
            {current === slides.length - 1 ? 'Get started' : 'Next'}
          </Text>
          <Text style={styles.buttonArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  logo: { fontSize: 26, fontWeight: '800', color: '#0A4EAD' },
  logoAccent: { color: '#FA731C' },
  skip: { fontWeight: '700', color: '#64748B', fontSize: 14 },
  slides: { flex: 1 },
  slide: { width, paddingHorizontal: 24, paddingTop: 28 },
  illustration: {
    height: 300,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
  },
  slideNumber: {
    position: 'absolute',
    top: 20,
    left: 22,
    fontWeight: '800',
    color: '#0A4EAD',
    fontSize: 16,
  },
  illustrationCard: {
    width: '68%',
    height: 145,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  illustrationLineLong: { width: '75%', height: 12, borderRadius: 6, backgroundColor: '#0A4EAD' },
  illustrationLineShort: { width: '48%', height: 8, borderRadius: 4, backgroundColor: '#B9C8DC' },
  illustrationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  illustrationDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FA731C' },
  illustrationLineMedium: { width: '55%', height: 8, borderRadius: 4, backgroundColor: '#B9C8DC' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  body: { fontSize: 16, lineHeight: 25, color: '#64748B' },
  footer: { padding: 24, gap: 24 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D6DEE8' },
  activeDot: { width: 28, backgroundColor: '#0A4EAD' },
  button: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: '#0A4EAD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: { fontWeight: '800', color: '#fff', fontSize: 16 },
  buttonArrow: { color: '#fff', fontSize: 22 },
});
