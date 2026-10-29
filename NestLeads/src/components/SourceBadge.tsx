import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Globe } from 'lucide-react-native';
const fbLogo = require('../assets/images/logos/facebook.png');
const imLogo = require('../assets/images/logos/indiamart.png');
const tiLogo = require('../assets/images/logos/tradeindia.webp');
const jdLogo = require('../assets/images/logos/justdial.webp');
const igLogo = require('../assets/images/logos/instagram.webp');
const metaLogo = require('../assets/images/logos/meta.png');

type SourceCfg = { bg: string; border: string; logo?: any; iconName?: string };

const SOURCE_CONFIG: Record<string, SourceCfg> = {
  Facebook: { bg: '#1877F2', border: '#0d65d9', logo: fbLogo },
  Instagram: { bg: '#E1306C', border: '#E1306C', logo: igLogo },
  Meta: { bg: '#0668E1', border: '#0557c2', logo: metaLogo },
  'Google Ads': { bg: '#4285F4', border: '#3367d6', iconName: 'logo-google' },
  IndiaMART: { bg: '#FBFBFB', border: '#ea7d22', logo: imLogo },
  TradeIndia: { bg: '#22C55E', border: '#16a34a', logo: tiLogo },
  Justdial: { bg: '#EF4444', border: '#dc2626', logo: jdLogo },
  Website: { bg: '#FB923C', border: '#000000', iconName: 'globe-outline' },
  Manual: { bg: '#6B7280', border: '#4b5563', iconName: 'person-outline' },
};

const FALLBACK: SourceCfg = {
  bg: '#6B7280',
  border: '#4b5563',
  iconName: 'person-outline',
};

interface Props {
  source?: string;
  size?: 'sm' | 'md';
}

export default function SourceBadge({ source, size = 'md' }: Props) {
  const cfg = SOURCE_CONFIG[source || ''] || FALLBACK;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        isSmall ? styles.sm : styles.md,
      ]}
    >
      {cfg.logo ? (
        <Image
          source={cfg.logo}
          style={isSmall ? styles.logoSm : styles.logoMd}
          resizeMode="contain"
        />
      ) : source === 'Website' ? (
        <Globe size={isSmall ? 9 : 11} color="#fff" strokeWidth={2} />
      ) : cfg.iconName ? (
        <Icon name={cfg.iconName} size={isSmall ? 9 : 11} color="#fff" />
      ) : null}
      <Text style={[styles.text, isSmall ? styles.textSm : styles.textMd]}>
        {source || 'Manual'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 3,
  },
  sm: { paddingHorizontal: 5, paddingVertical: 2 },
  md: { paddingHorizontal: 7, paddingVertical: 3 },
  logoSm: { width: 10, height: 10 },
  logoMd: { width: 13, height: 13 },
  text: {
    color: '#fff',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textSm: { fontSize: 8 },
  textMd: { fontSize: 9 },
});

/** Round source logo (or icon) for charts/legends. */
export function SourceLogo({
  source,
  size = 22,
}: {
  source?: string;
  size?: number;
}) {
  const cfg = SOURCE_CONFIG[source || ''] || FALLBACK;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: '#000',
        backgroundColor: cfg.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {cfg.logo ? (
        <Image
          source={cfg.logo}
          style={{ width: size * 0.6, height: size * 0.6 }}
          resizeMode="contain"
        />
      ) : (
        <Icon
          name={cfg.iconName || 'person-outline'}
          size={size * 0.55}
          color="#fff"
        />
      )}
    </View>
  );
}
