import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

type Platform = 'linkedin' | 'google';

const PLATFORM_META: Record<Platform, {label: string; color: string; setupScreen: string; setupLabel: string}> = {
  linkedin: {label: 'LinkedIn', color: '#0A66C2', setupScreen: 'LinkedInSetup', setupLabel: 'LinkedIn Lead Sync Setup'},
  google: {label: 'Google Ads', color: '#4285F4', setupScreen: 'GoogleAdsSetup', setupLabel: 'Google Ads Lead Sync Setup'},
};

// One reusable screen for every locked LinkedIn/Google Ads sub-page
// (Dashboard/Ad Campaigns/Ad Sets/Ad Groups/Ads) — these platforms' ad
// management APIs aren't available without extra API approval/scopes the
// app doesn't have yet, only Lead Sync is live. Mirrors web's
// LinkedInAdsPlaceholderPage / GoogleAdsPlaceholderPage.
export default function AdPlatformLockedScreen({navigation, route}: any) {
  const insets = useSafeAreaInsets();
  const {platform, section}: {platform: Platform; section: string} = route.params;
  const meta = PLATFORM_META[platform];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{meta.label} {section}</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconBox, {borderColor: meta.color}]}>
              <Text style={[styles.brandGlyph, {color: meta.color}]}>{platform === 'linkedin' ? 'in' : 'G'}</Text>
            </View>
            <View style={styles.lockBadge}>
              <Icon name="lock-closed-outline" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.title}>Not available yet</Text>
          <Text style={styles.desc}>
            {meta.label} campaign management ({section}) requires {meta.label}'s advertising API approval /
            additional scopes this app doesn't have yet. Right now only Lead Sync is connected — spend, campaign,
            ad set and ad data will show up here once that access is enabled.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, {borderColor: meta.color}]}
            onPress={() => navigation.navigate(meta.setupScreen)}>
            <Text style={[styles.ctaBtnText, {color: meta.color}]}>Go to {meta.setupLabel} →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 16, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  body: {flex: 1, padding: 20, justifyContent: 'center'},
  card: {borderWidth: 2, borderColor: '#000', padding: 28, alignItems: 'center', gap: 12, ...NB_SHADOW},
  iconWrap: {position: 'relative'},
  iconBox: {width: 60, height: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  brandGlyph: {fontSize: 24, fontWeight: '900'},
  lockBadge: {position: 'absolute', bottom: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 16, fontWeight: '900', color: '#000'},
  desc: {fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18},
  ctaBtn: {borderWidth: 2, paddingHorizontal: 18, paddingVertical: 12, marginTop: 6},
  ctaBtnText: {fontSize: 13, fontWeight: '900'},
});
