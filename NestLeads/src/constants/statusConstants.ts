const BASE_CATEGORIES: Record<string, string[]> = {
  'New Lead': ['PENDING CONTACT', '1', '2', '3', 'COMPLETED'],
  'Discussion/Requirement': [
    'DISCUSSION',
    'DISCUSSION 1',
    'DISCUSSION 2',
    'DISCUSSION 3',
    'DISCUSSION COMPLETED',
  ],
  Quotation: [
    'QUOTATION',
    'QUOTATION 1',
    'QUOTATION 2',
    'QUOTATION 3',
    'QUOTATION COMPLETED',
  ],
  'Visit Scheduled': ['VISIT SCHEDULED'],
  Visited: ['VISITED'],
  Client: ['WON'],
  Dropped: ['DROP'],
};

// Mirrors backend/utils/leadStatuses.js EXTENDABLE_CATEGORIES and the web's
// statusConstants.ts — the only categories tenants can insert custom stages
// into.
const EXTENDABLE_CATEGORIES: Record<string, {insertBefore: string}> = {
  'New Lead': {insertBefore: 'COMPLETED'},
  'Discussion/Requirement': {insertBefore: 'DISCUSSION COMPLETED'},
  Quotation: {insertBefore: 'QUOTATION COMPLETED'},
};

export const categoryOrder = [
  'New Lead',
  'Discussion/Requirement',
  'Quotation',
  'Visit Scheduled',
  'Visited',
  'Client',
  'Dropped',
];

export interface CustomLeadStatus {
  value: string;
  category: string;
  label: string;
  colorKey: string;
  order?: number;
}

type StatusColor = {bg: string; text: string; border: string};

// Mutable module bindings (mirrors the web version) so every screen that
// already imported `categories`/`ALL_STATUSES` picks up tenant custom
// statuses as soon as setCustomLeadStatuses() runs after login/settings
// fetch — no prop drilling needed.
export let categories: Record<string, string[]> = {...BASE_CATEGORIES};
export let ALL_STATUSES: string[] = Object.values(categories).flat();

let customStatusMeta: Record<
  string,
  {label: string; colorKey: string; category: string}
> = {};
let statusOverrides: Record<string, {label?: string; color?: string}> = {};

export function setCustomLeadStatuses(
  list: CustomLeadStatus[] | null | undefined,
) {
  const items = Array.isArray(list) ? list : [];
  const meta: typeof customStatusMeta = {};
  const merged: Record<string, string[]> = {};

  for (const [cat, base] of Object.entries(BASE_CATEGORIES)) {
    const info = EXTENDABLE_CATEGORIES[cat];
    if (!info) {
      merged[cat] = [...base];
      continue;
    }
    const extras = items
      .filter(s => s.category === cat)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const s of extras) {
      meta[s.value] = {label: s.label, colorKey: s.colorKey, category: cat};
    }
    const extraValues = extras.map(s => s.value);
    const idx = base.indexOf(info.insertBefore);
    merged[cat] =
      idx === -1
        ? [...base, ...extraValues]
        : [...base.slice(0, idx), ...extraValues, ...base.slice(idx)];
  }

  customStatusMeta = meta;
  categories = merged;
  ALL_STATUSES = Object.values(merged).flat();
}

export function setStatusOverrides(
  map: Record<string, {label?: string; color?: string}> | null | undefined,
) {
  statusOverrides = map || {};
}

export function isCustomLeadStatus(status: string | null | undefined) {
  return !!status && !!customStatusMeta[status];
}

export function getCustomLeadStatusMeta() {
  return customStatusMeta;
}

export const getCategoryByStatus = (status: string): string => {
  for (const [cat, items] of Object.entries(categories)) {
    if (items.includes(status)) return cat;
  }
  return 'New Lead';
};

export const statusColors: Record<string, StatusColor> = {
  'PENDING CONTACT': {bg: '#e2e8f0', text: '#0f172a', border: '#94a3b8'},
  '1': {bg: '#fdba74', text: '#0f172a', border: '#f97316'},
  '2': {bg: '#fdba74', text: '#0f172a', border: '#f97316'},
  '3': {bg: '#fca5a5', text: '#0f172a', border: '#ef4444'},
  COMPLETED: {bg: '#fb923c', text: '#0f172a', border: '#ea580c'},
  DISCUSSION: {bg: '#60a5fa', text: '#fff', border: '#2563eb'},
  'DISCUSSION 1': {bg: '#93c5fd', text: '#0f172a', border: '#3b82f6'},
  'DISCUSSION 2': {bg: '#bfdbfe', text: '#0f172a', border: '#60a5fa'},
  'DISCUSSION 3': {bg: '#dbeafe', text: '#0f172a', border: '#93c5fd'},
  'DISCUSSION COMPLETED': {bg: '#3b82f6', text: '#fff', border: '#1d4ed8'},
  QUOTATION: {bg: '#c084fc', text: '#fff', border: '#9333ea'},
  'QUOTATION 1': {bg: '#d8b4fe', text: '#0f172a', border: '#a855f7'},
  'QUOTATION 2': {bg: '#ede9fe', text: '#0f172a', border: '#c084fc'},
  'QUOTATION 3': {bg: '#f3e8ff', text: '#0f172a', border: '#d8b4fe'},
  'QUOTATION COMPLETED': {bg: '#a855f7', text: '#fff', border: '#7e22ce'},
  'VISIT SCHEDULED': {bg: '#22d3ee', text: '#0f172a', border: '#0891b2'},
  VISITED: {bg: '#2dd4bf', text: '#0f172a', border: '#0d9488'},
  WON: {bg: '#34d399', text: '#0f172a', border: '#059669'},
  DROP: {bg: '#ef4444', text: '#fff', border: '#b91c1c'},
};

// name -> hex triple. Keys (lowercase) mirror the web's COLOR_PRESETS names
// so a colorKey picked in Settings on either platform renders consistently
// on both, without the DB storing platform-specific styling.
export const COLOR_PRESETS: {name: string; colors: StatusColor}[] = [
  {name: 'slate', colors: {bg: '#e2e8f0', text: '#0f172a', border: '#94a3b8'}},
  {name: 'orange', colors: {bg: '#fdba74', text: '#0f172a', border: '#f97316'}},
  {name: 'red', colors: {bg: '#fca5a5', text: '#0f172a', border: '#ef4444'}},
  {name: 'blue', colors: {bg: '#93c5fd', text: '#0f172a', border: '#3b82f6'}},
  {name: 'purple', colors: {bg: '#d8b4fe', text: '#0f172a', border: '#a855f7'}},
  {name: 'cyan', colors: {bg: '#67e8f9', text: '#0f172a', border: '#0891b2'}},
  {name: 'teal', colors: {bg: '#5eead4', text: '#0f172a', border: '#0d9488'}},
  {name: 'emerald', colors: {bg: '#6ee7b7', text: '#0f172a', border: '#059669'}},
  {name: 'pink', colors: {bg: '#f9a8d4', text: '#0f172a', border: '#db2777'}},
  {name: 'zinc', colors: {bg: '#d4d4d8', text: '#0f172a', border: '#71717a'}},
];

const COLOR_PRESET_BY_KEY: Record<string, StatusColor> = Object.fromEntries(
  COLOR_PRESETS.map(p => [p.name, p.colors]),
);

const FALLBACK_COLOR: StatusColor = {bg: '#e2e8f0', text: '#0f172a', border: '#94a3b8'};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return status || '';
  if (customStatusMeta[status]) return customStatusMeta[status].label;
  return statusOverrides[status]?.label?.trim() || status;
}

export function getStatusColor(status: string | null | undefined): StatusColor {
  if (!status) return FALLBACK_COLOR;
  if (customStatusMeta[status]) {
    return COLOR_PRESET_BY_KEY[customStatusMeta[status].colorKey] || FALLBACK_COLOR;
  }
  // Note: base-status recolor overrides (Settings → Lead Statuses) are
  // stored as web Tailwind classes and aren't renderable on mobile — only
  // the label override applies here. Custom stages above use colorKey
  // (platform-neutral) so they render correctly on both.
  return statusColors[status] || FALLBACK_COLOR;
}

export const sourceColors: Record<string, {bg: string; text: string}> = {
  IndiaMART: {bg: '#a5b4fc', text: '#1e1b4b'},
  TradeIndia: {bg: '#86efac', text: '#14532d'},
  Justdial: {bg: '#fdba74', text: '#7c2d12'},
  Website: {bg: '#c084fc', text: '#fff'},
  Manual: {bg: '#cbd5e1', text: '#0f172a'},
  Facebook: {bg: '#3b82f6', text: '#fff'},
  Instagram: {bg: '#ec4899', text: '#fff'},
  Meta: {bg: '#1d4ed8', text: '#fff'},
  'Google Ads': {bg: '#4285F4', text: '#fff'},
};

export const ALL_SOURCES = Object.keys(sourceColors);
