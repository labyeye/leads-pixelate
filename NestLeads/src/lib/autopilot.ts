// Pure helpers for the Social Autopilot screens (kept free of React so they can be unit tested).

export type RangeDays = 7 | 30 | 90;
export const RANGES: RangeDays[] = [7, 30, 90];

export const COLORS = {
  generated: '#024BAB',
  posted: '#22c55e',
  pending: '#FA731C',
  scheduled: '#8b5cf6',
  rejected: '#FF3366',
  failed: '#64748b',
};

export interface Series {
  date: string; // YYYY-MM-DD (India day)
  generated: number;
  posted: number;
  rejected: number;
}

export interface Totals {
  generated: number;
  posted: number;
  pending: number;
  scheduled: number;
  rejected: number;
  failed: number;
  other: number;
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TIME_SLOTS_MAX = 2;

// Monday first, like the web app; the number is the JS weekday (Sunday = 0) the server uses.
export const WEEKDAYS = [
  {d: 1, label: 'Mon'},
  {d: 2, label: 'Tue'},
  {d: 3, label: 'Wed'},
  {d: 4, label: 'Thu'},
  {d: 5, label: 'Fri'},
  {d: 6, label: 'Sat'},
  {d: 0, label: 'Sun'},
];

export const CONTENT_TYPES: Record<string, string> = {
  product: 'Products & services',
  behind_the_scenes: 'Behind the scenes',
  tips: 'Tips & advice',
  social_proof: 'Customer stories',
  occasion: 'Festivals & occasions',
  announcement: 'News & announcements',
};

export function usagePct(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

// Green until 70%, orange until 90%, red after.
export function usageColor(pct: number): string {
  if (pct >= 90) return COLORS.rejected;
  if (pct >= 70) return COLORS.pending;
  return COLORS.posted;
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

// Points for react-native-gifted-charts LineChart. Only some points carry an x label so a
// 90-day range stays readable.
export function lineData(series: Series[], key: 'generated' | 'posted' | 'rejected') {
  const every = series.length > 45 ? 15 : series.length > 10 ? 7 : 1;
  return series.map((s, i) => ({
    value: s[key],
    label: i % every === 0 || i === series.length - 1 ? shortDate(s.date) : '',
  }));
}

export function chartMax(series: Series[]): number {
  return Math.max(3, ...series.map(s => Math.max(s.generated, s.posted, s.rejected)));
}

// Donut segments (only outcomes that happened).
export function pieData(totals: Totals) {
  return [
    {label: 'Posted', value: totals.posted, color: COLORS.posted},
    {label: 'Waiting for approval', value: totals.pending, color: COLORS.pending},
    {label: 'Scheduled', value: totals.scheduled, color: COLORS.scheduled},
    {label: 'Rejected', value: totals.rejected, color: COLORS.rejected},
    {label: 'Failed', value: totals.failed, color: COLORS.failed},
  ].filter(s => s.value > 0);
}

export const pctOf = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');

export function daysLeft(iso: string, now = Date.now()): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

// The pill at the top of the dashboard.
export function statePill(status: {
  settings: {enabled: boolean};
  entitlement: {state: string; endsAt: string | null};
}): {text: string; bg: string; fg: string} {
  const {enabled} = status.settings;
  const {state, endsAt} = status.entitlement;
  if (!enabled) return {text: 'Paused', bg: '#e2e8f0', fg: '#000'};
  if (state === 'trial' && endsAt) {
    return {text: `Free trial · ${daysLeft(endsAt)} day(s) left`, bg: '#FFDE00', fg: '#000'};
  }
  if (state === 'paid') return {text: 'Live', bg: '#22c55e', fg: '#000'};
  return {text: 'Needs a plan', bg: '#FF3366', fg: '#fff'};
}

export const POST_STATUS: Record<string, {label: string; bg: string; fg: string}> = {
  PENDING_APPROVAL: {label: 'Needs your approval', bg: '#fed7aa', fg: '#92400e'},
  SCHEDULED: {label: 'Scheduled', bg: '#ede9fe', fg: '#5b21b6'},
  APPROVED: {label: 'Approved', bg: '#dbeafe', fg: '#1e40af'},
  POSTING: {label: 'Posting…', bg: '#dbeafe', fg: '#1e40af'},
  POSTED: {label: 'Posted', bg: '#dcfce7', fg: '#166534'},
  PARTIALLY_POSTED: {label: 'Partly posted', bg: '#fef9c3', fg: '#713f12'},
  FAILED: {label: 'Failed', bg: '#fee2e2', fg: '#991b1b'},
};

// Queue order: posts waiting for the owner first, then by publish time.
export function sortQueue<T extends {status: string; scheduledAt: string}>(posts: T[]): T[] {
  return [...posts].sort(
    (a, b) =>
      Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL') ||
      +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
  );
}

export const UPCOMING = ['SCHEDULED', 'APPROVED', 'PENDING_APPROVAL', 'POSTING'];
export const HISTORY = ['POSTED', 'PARTIALLY_POSTED', 'FAILED'];

// Scan progress: which checklist step the server is on (mirrors the web ScanAnimation).
export const SCAN_STEPS = [
  {key: 'profile', label: 'Reading your profile'},
  {key: 'posts', label: 'Studying your recent posts'},
  {key: 'style', label: 'Learning your visual style'},
  {key: 'profile_built', label: 'Building your brand profile'},
];
export function scanStepIndex(status: string, stage: string, hasIntro: boolean): number {
  const steps = hasIntro ? [{key: 'intro', label: ''}, ...SCAN_STEPS] : SCAN_STEPS;
  if (status === 'done') return steps.length;
  return Math.max(0, steps.findIndex(s => s.key === stage));
}

// Posting plan form -> the PUT /autopilot body. Returns an error message instead when invalid.
export function planPayload(
  form: {
    days: number[];
    times: string[];
    contentTypes: string[];
    language: string;
    tone: string;
    notes: string;
    reviewFirst: boolean;
    accountIds: string[];
  },
  maxDays: number,
): {error: string} | {body: Record<string, unknown>} {
  if (form.days.length === 0) return {error: 'Pick at least one posting day.'};
  if (form.days.length > maxDays) {
    return {error: `Your plan allows ${maxDays} posting day${maxDays === 1 ? '' : 's'} a week.`};
  }
  const times = [...new Set(form.times.map(t => t.trim()))].filter(Boolean);
  if (times.length === 0) return {error: 'Add a posting time, like 10:00.'};
  if (times.length > TIME_SLOTS_MAX) return {error: `Up to ${TIME_SLOTS_MAX} posts a day.`};
  const bad = times.find(t => !TIME_RE.test(t));
  if (bad) return {error: `"${bad}" is not a valid time. Use 24-hour HH:MM, like 18:30.`};
  if (form.contentTypes.length === 0) return {error: 'Pick at least one kind of post.'};
  return {
    body: {
      schedule: {days: form.days, times: times.sort()},
      contentTypes: form.contentTypes,
      language: form.language,
      tone: form.tone,
      notes: form.notes,
      reviewFirst: form.reviewFirst,
      accountIds: form.accountIds,
    },
  };
}
