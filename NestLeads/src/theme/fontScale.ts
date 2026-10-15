// Standalone external store (no 'react-native' import) for the app's font
// size preference. Deliberately kept outside ThemeContext/React Context:
// the DM Sans shim (src/shims/react-native.ts) needs to read this value
// too, and that shim stands in for the 'react-native' module itself —
// anything it imports that imports 'react-native' back would create a
// require cycle. This file has zero such dependency, so both ThemeContext
// (for the Settings UI) and the shim (for actually scaling text) can read
// it safely via useSyncExternalStore.
import storage from '../utils/storage';

export type FontScaleKey = 'small' | 'default' | 'large' | 'xlarge';

export const FONT_SCALE_VALUES: Record<FontScaleKey, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  xlarge: 1.3,
};

export const FONT_SCALE_LABELS: Record<FontScaleKey, string> = {
  small: 'Small',
  default: 'Default',
  large: 'Large',
  xlarge: 'Extra Large',
};

const STORAGE_KEY = 'font_scale';

let current: FontScaleKey = 'default';
const listeners = new Set<() => void>();

export function getFontScaleKey(): FontScaleKey {
  return current;
}

export function getFontScale(): number {
  return FONT_SCALE_VALUES[current];
}

export function setFontScaleKey(key: FontScaleKey) {
  current = key;
  listeners.forEach(l => l());
  storage.setItem(STORAGE_KEY, key).catch(() => {});
}

export function subscribeFontScale(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function loadFontScale(): Promise<FontScaleKey> {
  try {
    const saved = await storage.getItem(STORAGE_KEY);
    if (saved && saved in FONT_SCALE_VALUES) {
      current = saved as FontScaleKey;
      listeners.forEach(l => l());
    }
  } catch {}
  return current;
}
