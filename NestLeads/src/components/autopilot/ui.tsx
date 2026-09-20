import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

export const PRIMARY = '#024BAB';
export const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: {width: 3, height: 3},
  elevation: 3,
};

export function Card({children, style}: {children: React.ReactNode; style?: any}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({title, sub}: {title: string; sub?: string}) {
  return (
    <View style={{marginBottom: 8}}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

export function Pill({text, bg, fg}: {text: string; bg: string; fg: string}) {
  return (
    <View style={[s.pill, {backgroundColor: bg}]}>
      <Text style={[s.pillText, {color: fg}]}>{text}</Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{selected: active, disabled: !!disabled}}
      style={[s.chip, active && s.chipActive, disabled && {opacity: 0.4}]}>
      <Text style={[s.chipText, active && {color: '#fff'}]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Kpi({
  label,
  value,
  hint,
  color,
  highlight,
}: {
  label: string;
  value: number | string;
  hint?: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={[s.kpi, highlight && {borderColor: '#FA731C', borderWidth: 3}]}>
      <View style={s.kpiTop}>
        <View style={[s.kpiDot, {backgroundColor: color}]} />
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
      <Text style={s.kpiValue}>{value}</Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

export function ProgressBar({pct, color}: {pct: number; color: string}) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, {width: `${pct}%`, backgroundColor: color}]} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  outline,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  outline?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[s.btn, outline ? s.btnOutline : s.btnSolid, disabled && {opacity: 0.5}]}>
      <Text style={[s.btnText, outline && {color: '#000'}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 14,
    ...NB_SHADOW,
  },
  sectionTitle: {fontSize: 16, fontWeight: '800', color: '#000'},
  sectionSub: {fontSize: 12, color: '#475569', marginTop: 2},
  pill: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 4},
  pillText: {fontSize: 11, fontWeight: '800'},
  chip: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {backgroundColor: PRIMARY},
  chipText: {fontSize: 12, fontWeight: '800', color: '#000'},
  kpi: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    ...NB_SHADOW,
  },
  kpiTop: {flexDirection: 'row', alignItems: 'center'},
  kpiDot: {width: 10, height: 10, borderWidth: 1, borderColor: '#000', marginRight: 6},
  kpiLabel: {fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#475569'},
  kpiValue: {fontSize: 28, fontWeight: '900', color: '#000', marginTop: 4},
  kpiHint: {fontSize: 11, color: '#64748b'},
  barTrack: {height: 12, borderWidth: 2, borderColor: '#000', backgroundColor: '#e2e8f0'},
  barFill: {height: '100%'},
  btn: {paddingVertical: 11, paddingHorizontal: 16, borderWidth: 2, borderColor: '#000', alignItems: 'center'},
  btnSolid: {backgroundColor: PRIMARY},
  btnOutline: {backgroundColor: '#fff'},
  btnText: {fontSize: 13, fontWeight: '800', color: '#fff'},
});
