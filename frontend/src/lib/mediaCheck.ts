export type MediaRule = 'feed' | 'reel' | 'cover';
export interface MediaCheck {
  width: number;
  height: number;
  ratio: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
}

const KNOWN: [string, number][] = [
  ['1:1', 1],
  ['4:5', 0.8],
  ['3:4', 0.75],
  ['2:3', 2 / 3],
  ['9:16', 9 / 16],
  ['4:3', 4 / 3],
  ['16:9', 16 / 9],
  ['1.91:1', 1.91],
];

export function ratioLabel(w: number, h: number) {
  const r = w / h;
  const hit = KNOWN.find(([, v]) => Math.abs(r - v) / v < 0.03);
  return hit ? hit[0] : `${r.toFixed(2)}:1`;
}

/**
 * Instagram feed images: aspect 4:5 (0.8) to 1.91:1, at least 320px wide,
 * 1080px wide recommended. Reels: 9:16 (1080×1920) recommended.
 */
export function checkMedia(w: number, h: number, rule: MediaRule): MediaCheck {
  const ratio = ratioLabel(w, h);
  const r = w / h;
  const base = { width: w, height: h, ratio };
  if (rule === 'feed') {
    if (r < 0.79 || r > 1.92)
      return {
        ...base,
        status: 'error',
        message: `${ratio} isn't supported by Instagram feed. Use 4:5, 1:1 or up to 1.91:1.`,
      };
    if (Math.min(w, h) < 320 || w < 320)
      return { ...base, status: 'error', message: 'Too small — Instagram needs at least 320px wide.' };
    if (w < 1080)
      return { ...base, status: 'warn', message: 'Low resolution — 1080px wide is recommended.' };
    return { ...base, status: 'ok', message: 'Instagram ready' };
  }
  if (rule === 'reel') {
    if (r < 0.5 || r > 0.62)
      return { ...base, status: 'warn', message: 'Reels look best at 9:16 (1080×1920).' };
    if (w < 540)
      return { ...base, status: 'warn', message: 'Low resolution — 1080×1920 is recommended.' };
    return { ...base, status: 'ok', message: 'Reel ready' };
  }
  return { ...base, status: 'ok', message: '' };
}
