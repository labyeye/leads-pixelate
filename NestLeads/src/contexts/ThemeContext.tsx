import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import storage from '../utils/storage';
import {
  FontScaleKey,
  getFontScaleKey,
  loadFontScale,
  setFontScaleKey as setFontScaleKeyStore,
} from '../theme/fontScale';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AccentPreset {
  name: string;
  value: string;
}

// Each accent has a slightly deeper shade for pressed/active states, same
// idea as the fixed '#024BAB' blue the app used everywhere before this.
export const ACCENT_PRESETS: AccentPreset[] = [
  {name: 'Blue', value: '#024BAB'},
  {name: 'Violet', value: '#7C3AED'},
  {name: 'Green', value: '#16A34A'},
  {name: 'Orange', value: '#EA580C'},
  {name: 'Pink', value: '#DB2777'},
  {name: 'Red', value: '#DC2626'},
  {name: 'Teal', value: '#0D9488'},
  {name: 'Indigo', value: '#4338CA'},
];

const DEFAULT_ACCENT = ACCENT_PRESETS[0].value;

export interface ThemeColors {
  // Surfaces
  background: string;
  surface: string;
  surfaceMuted: string;
  // Text
  text: string;
  textMuted: string;
  textInverse: string;
  // Structure
  border: string;
  borderSoft: string;
  shadowColor: string;
  divider: string;
  placeholder: string;
  // Brand / accent
  primary: string;
  primarySoft: string;
  // Semantic (fixed across themes on purpose — these carry meaning)
  success: string;
  danger: string;
  warning: string;
  // Warning tint used as a card/strip background (e.g. "action needed"
  // banners) — flips light-pale/dark-text in light mode to dark-muted/
  // light-text in dark mode so text drawn in `text`/`textMuted` stays
  // readable on top of it either way.
  warningSoft: string;
  // Chrome
  statusBarStyle: 'light-content' | 'dark-content';
}

function buildColors(isDark: boolean, accent: string): ThemeColors {
  return isDark
    ? {
        background: '#0B0F17',
        surface: '#121826',
        surfaceMuted: '#1A2133',
        text: '#F1F5F9',
        textMuted: '#94A3B8',
        textInverse: '#0B0F17',
        border: '#F1F5F9',
        borderSoft: '#2A3344',
        shadowColor: '#F1F5F9',
        divider: '#2A3344',
        placeholder: '#64748B',
        primary: accent,
        primarySoft: accent + '33',
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        warningSoft: '#2A1D0F',
        statusBarStyle: 'light-content',
      }
    : {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        surfaceMuted: '#F8FAFC',
        text: '#000000',
        textMuted: '#64748B',
        textInverse: '#FFFFFF',
        border: '#000000',
        borderSoft: '#E2E8F0',
        shadowColor: '#0A0A0A',
        divider: '#E2E8F0',
        placeholder: '#94A3B8',
        primary: accent,
        primarySoft: accent + '1A',
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        warningSoft: '#FFF7ED',
        statusBarStyle: 'dark-content',
      };
}

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  accent: string;
  setAccent: (hex: string) => void;
  isDark: boolean;
  colors: ThemeColors;
  fontScaleKey: FontScaleKey;
  setFontScaleKeyValue: (k: FontScaleKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = 'theme_mode';
const ACCENT_KEY = 'theme_accent';

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [fontScaleKey, setFontScaleKeyState] = useState<FontScaleKey>(getFontScaleKey());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedAccent, savedFontScale] = await Promise.all([
          storage.getItem(MODE_KEY),
          storage.getItem(ACCENT_KEY),
          loadFontScale(),
        ]);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode);
        }
        if (savedAccent) setAccentState(savedAccent);
        setFontScaleKeyState(savedFontScale);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setFontScaleKeyValue = useCallback((k: FontScaleKey) => {
    setFontScaleKeyState(k);
    setFontScaleKeyStore(k);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    storage.setItem(ACCENT_KEY, hex).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = useMemo(() => buildColors(isDark, accent), [isDark, accent]);

  const value = useMemo(
    () => ({mode, setMode, accent, setAccent, isDark, colors, fontScaleKey, setFontScaleKeyValue}),
    [mode, setMode, accent, setAccent, isDark, colors, fontScaleKey, setFontScaleKeyValue],
  );

  // Render immediately with defaults even before storage finishes loading —
  // avoids a flash of unstyled/blocking UI; theme just settles a beat later.
  void loaded;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
