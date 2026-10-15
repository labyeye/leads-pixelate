import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useTheme, ACCENT_PRESETS, ThemeMode, ThemeColors} from '../contexts/ThemeContext';
import {FontScaleKey, FONT_SCALE_VALUES, FONT_SCALE_LABELS} from '../theme/fontScale';

const FONT_SCALE_KEYS: FontScaleKey[] = ['small', 'default', 'large', 'xlarge'];

export default function PersonaliseScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {mode, setMode, accent, setAccent, colors, fontScaleKey, setFontScaleKeyValue} = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personalise</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: insets.bottom + 24}}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THEME</Text>
          <Text style={styles.sectionHint}>Choose how NestLeads looks on this device.</Text>
          <View style={styles.modeRow}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map(m => {
              const active = mode === m;
              const icon = m === 'light' ? 'sunny-outline' : m === 'dark' ? 'moon-outline' : 'phone-portrait-outline';
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeOption, active && styles.modeOptionActive]}
                  onPress={() => setMode(m)}>
                  <Icon name={icon} size={18} color={active ? '#fff' : colors.textMuted} />
                  <Text style={[styles.modeOptionText, active && styles.modeOptionTextActive]}>
                    {m === 'system' ? 'Auto' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCENT COLOR</Text>
          <Text style={styles.sectionHint}>Pick the color used for buttons, tabs and highlights.</Text>
          <View style={styles.accentRow}>
            {ACCENT_PRESETS.map(preset => {
              const active = accent.toLowerCase() === preset.value.toLowerCase();
              return (
                <TouchableOpacity
                  key={preset.value}
                  onPress={() => setAccent(preset.value)}
                  style={[
                    styles.accentSwatch,
                    {backgroundColor: preset.value},
                    active && styles.accentSwatchActive,
                  ]}>
                  {active && <Icon name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FONT SIZE</Text>
          <Text style={styles.sectionHint}>Adjust text size across the whole app.</Text>
          <View style={styles.fontScaleList}>
            {FONT_SCALE_KEYS.map(key => {
              const active = fontScaleKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.fontScaleOption, active && styles.fontScaleOptionActive]}
                  onPress={() => setFontScaleKeyValue(key)}>
                  <Text
                    style={[
                      styles.fontScaleOptionLabel,
                      {fontSize: 14 * FONT_SCALE_VALUES[key]},
                      active && styles.fontScaleOptionLabelActive,
                    ]}>
                    Aa
                  </Text>
                  <Text style={[styles.fontScaleOptionName, active && styles.fontScaleOptionNameActive]}>
                    {FONT_SCALE_LABELS[key]}
                  </Text>
                  {active && <Icon name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Text style={styles.previewBody}>
              This is how body text will look across NestLeads with the selected font size.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
    backBtn: {width: 36, height: 36, borderWidth: 2, borderRadius: 8, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
    headerTitle: {fontSize: 18, fontWeight: '600', color: colors.text},
    divider: {height: 2, backgroundColor: colors.border},

    section: {
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderRadius: 8,
      borderRightWidth: 5,
      borderBottomWidth: 5,
      borderRightColor: colors.shadowColor,
      borderBottomColor: colors.shadowColor,
      borderColor: colors.border,
      padding: 14,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    sectionHint: {fontSize: 12, color: colors.textMuted, marginBottom: 14},

    modeRow: {flexDirection: 'row', gap: 8},
    modeOption: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderWidth: 2, borderRadius: 8, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    modeOptionActive: {backgroundColor: colors.primary},
    modeOptionText: {fontSize: 13, fontWeight: '700', color: colors.textMuted},
    modeOptionTextActive: {color: '#fff'},

    accentRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
    accentSwatch: {
      width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    accentSwatchActive: {borderWidth: 3, borderColor: colors.text},

    fontScaleList: {gap: 8},
    fontScaleOption: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 12, paddingVertical: 12,
      borderWidth: 2, borderRadius: 8, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    fontScaleOptionActive: {backgroundColor: colors.primarySoft, borderColor: colors.primary},
    fontScaleOptionLabel: {fontWeight: '700', color: colors.textMuted, width: 36},
    fontScaleOptionLabelActive: {color: colors.primary},
    fontScaleOptionName: {flex: 1, fontSize: 14, fontWeight: '600', color: colors.text},
    fontScaleOptionNameActive: {color: colors.primary},

    previewBox: {
      marginTop: 14, padding: 12, borderWidth: 1, borderColor: colors.divider,
      borderRadius: 8, backgroundColor: colors.surfaceMuted,
    },
    previewTitle: {fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5},
    previewBody: {fontSize: 14, color: colors.text, lineHeight: 20},
  });
}
