import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';

interface Props {
  title: string;
  /** Ionicon-style name shown in the brand color before the title (like the More screen). */
  icon?: string;
  onBack?: () => void;
  /** Action buttons shown on the right of the top row. */
  right?: React.ReactNode;
}

/** Sub-screen header in the NestHR style: one row (chevron · title · actions) with a 2px black rule. */
export default function ScreenHeader({ title, icon = 'grid-outline', onBack, right }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={s.back}>
            <Icon name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
        ) : null}
        <Icon name={icon} size={20} color="#024BAB" />
        <View style={{ flexShrink: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        </View>
      </View>
      {right ? <View style={s.right}>{right}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  back: { padding: 4, marginRight: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '400', color: '#000' },
  sub: { fontSize: 11, color: '#64748b', marginTop: 1 },
});
