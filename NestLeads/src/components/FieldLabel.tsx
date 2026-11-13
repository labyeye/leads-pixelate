import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import Icon from './Icon';

const RULES: [RegExp, string][] = [
  [/e-?mail/, 'mail-outline'],
  [/phone|mobile|contact number|whatsapp/, 'call-outline'],
  [/password|code|otp|security/, 'lock-closed-outline'],
  [/api key|key name|^key/, 'key-outline'],
  [/company|business|client|buyer|customer/, 'business-outline'],
  [/address|location|city|state|country|pin|zip|pincode/, 'location-outline'],
  [/budget|price|amount|discount|total|cost|₹|rs\b|value/, 'cash-outline'],
  [/gst|pan\b|aadhar|aadhaar|hsn|sac|sku|tax|reference/, 'receipt-outline'],
  [/date|time|follow|visit|from|\bto\b|timeline|schedule|when|at \(|how often|\bon\b|day of/, 'calendar-outline'],
  [/status|priority|stage/, 'flag-outline'],
  [/role|tier|permission/, 'shield-checkmark-outline'],
  [/department|designation|employment|job/, 'briefcase-outline'],
  [/progress/, 'trending-up-outline'],
  [/stock|qty|quantity|unit|items?\b/, 'layers-outline'],
  [/product|service|template|interested|header|body|footer/, 'cube-outline'],
  [/assign|team|member|send to|account/, 'people-outline'],
  [/source|language|website|platform/, 'globe-outline'],
  [/category|type|tag|label/, 'pricetag-outline'],
  [/image|video|photo|media/, 'image-outline'],
  [/description|notes?|remarks?|subject|message|requirement|reply|replies/, 'create-outline'],
  [/name|owner|gender|emergency|requested by/, 'person-outline'],
];

function textOf(children: React.ReactNode): string {
  if (children == null || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (React.isValidElement(children)) return textOf((children.props as any)?.children);
  return '';
}

export function iconForLabel(label: string): string {
  const t = label.toLowerCase();
  for (const [re, icon] of RULES) if (re.test(t)) return icon;
  return 'create-outline';
}

interface Props {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  icon?: string;
}

/** Form input title with a small leading icon picked from the label text (override with `icon`). */
export default function FieldLabel({ children, style, numberOfLines, icon }: Props) {
  const flat: any = StyleSheet.flatten(style) || {};
  const { margin, marginBottom, marginTop, marginVertical, marginTop: _mt, ...textStyle } = flat;
  const color = flat.color || '#64748b';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        margin,
        marginBottom,
        marginTop,
        marginVertical,
      }}
    >
      <Icon name={icon || iconForLabel(textOf(children))} size={(flat.fontSize || 12) + 2} color={color} />
      <Text style={[textStyle, { marginBottom: 0 }]} numberOfLines={numberOfLines}>
        {children}
      </Text>
    </View>
  );
}
