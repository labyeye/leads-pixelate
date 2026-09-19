import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, LayoutAnimation, Platform, UIManager} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

type SubLink = {label: string; icon: string; screen: string; params?: any};

const PLATFORMS: {key: string; label: string; color: string; glyph: string; links: SubLink[]}[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    glyph: 'f',
    links: [
      {label: 'Dashboard', icon: 'grid-outline', screen: 'FacebookAdsDashboard'},
      {label: 'Ad Campaigns', icon: 'megaphone-outline', screen: 'FacebookAdCampaigns'},
      {label: 'Ad Sets', icon: 'layers-outline', screen: 'FacebookAdSets'},
      {label: 'Ads', icon: 'image-outline', screen: 'FacebookAdsList'},
      {label: 'Campaign Management', icon: 'list-outline', screen: 'FacebookCampaignManagement'},
    ],
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    glyph: 'in',
    links: [
      {label: 'Dashboard', icon: 'grid-outline', screen: 'AdPlatformLocked', params: {platform: 'linkedin', section: 'Dashboard'}},
      {label: 'Ad Campaigns', icon: 'megaphone-outline', screen: 'AdPlatformLocked', params: {platform: 'linkedin', section: 'Ad Campaigns'}},
      {label: 'Ad Sets', icon: 'layers-outline', screen: 'AdPlatformLocked', params: {platform: 'linkedin', section: 'Ad Sets'}},
      {label: 'Ads', icon: 'image-outline', screen: 'AdPlatformLocked', params: {platform: 'linkedin', section: 'Ads'}},
      {label: 'Lead Sync Setup', icon: 'link-outline', screen: 'LinkedInSetup'},
      {label: 'Campaign Management', icon: 'list-outline', screen: 'LinkedInCampaignManagement'},
    ],
  },
  {
    key: 'google',
    label: 'Google Ads',
    color: '#4285F4',
    glyph: 'G',
    links: [
      {label: 'Dashboard', icon: 'grid-outline', screen: 'AdPlatformLocked', params: {platform: 'google', section: 'Dashboard'}},
      {label: 'Ad Campaigns', icon: 'megaphone-outline', screen: 'AdPlatformLocked', params: {platform: 'google', section: 'Ad Campaigns'}},
      {label: 'Ad Groups', icon: 'layers-outline', screen: 'AdPlatformLocked', params: {platform: 'google', section: 'Ad Groups'}},
      {label: 'Ads', icon: 'image-outline', screen: 'AdPlatformLocked', params: {platform: 'google', section: 'Ads'}},
      {label: 'Lead Sync Setup', icon: 'link-outline', screen: 'GoogleAdsSetup'},
    ],
  },
];

export default function AdCampaignsHubScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>('facebook');

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => (prev === key ? null : key));
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ad Campaigns</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + 32}]}>
        <TouchableOpacity style={styles.crossLinkCard} onPress={() => navigation.navigate('CampaignManagementOverview')}>
          <Icon name="list-outline" size={18} color="#024BAB" />
          <View style={{flex: 1}}>
            <Text style={styles.crossLinkTitle}>Campaign Management Overview</Text>
            <Text style={styles.crossLinkSub}>Facebook + LinkedIn campaign ownership</Text>
          </View>
          <Icon name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.crossLinkCard} onPress={() => navigation.navigate('CampaignReports')}>
          <Icon name="stats-chart-outline" size={18} color="#024BAB" />
          <View style={{flex: 1}}>
            <Text style={styles.crossLinkTitle}>Reports & Analytics</Text>
            <Text style={styles.crossLinkSub}>Cross-channel marketing performance</Text>
          </View>
          <Icon name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>

        {PLATFORMS.map(p => {
          const isOpen = expanded === p.key;
          return (
            <View key={p.key} style={styles.platformCard}>
              <TouchableOpacity style={styles.platformHeader} onPress={() => toggle(p.key)}>
                <View style={[styles.glyphBox, {borderColor: p.color}]}>
                  <Text style={[styles.glyphText, {color: p.color}]}>{p.glyph}</Text>
                </View>
                <Text style={styles.platformLabel}>{p.label}</Text>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#000" />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.linksList}>
                  {p.links.map((l, i) => (
                    <TouchableOpacity
                      key={l.label}
                      style={[styles.linkRow, i > 0 && styles.linkRowBorder]}
                      onPress={() => navigation.navigate(l.screen, l.params)}>
                      <Icon name={l.icon} size={16} color={p.color} />
                      <Text style={styles.linkLabel}>{l.label}</Text>
                      <Icon name="chevron-forward" size={14} color="#cbd5e1" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  body: {padding: 16, gap: 12},
  crossLinkCard: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#000', padding: 14, ...NB_SHADOW},
  crossLinkTitle: {fontSize: 13, fontWeight: '900', color: '#000'},
  crossLinkSub: {fontSize: 11, color: '#64748b', marginTop: 1},
  platformCard: {borderWidth: 2, borderColor: '#000', ...NB_SHADOW},
  platformHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14},
  glyphBox: {width: 34, height: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  glyphText: {fontSize: 15, fontWeight: '900'},
  platformLabel: {flex: 1, fontSize: 14, fontWeight: '900', color: '#000'},
  linksList: {borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  linkRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13},
  linkRowBorder: {borderTopWidth: 1, borderTopColor: '#f1f5f9'},
  linkLabel: {flex: 1, fontSize: 13, fontWeight: '600', color: '#000'},
});
