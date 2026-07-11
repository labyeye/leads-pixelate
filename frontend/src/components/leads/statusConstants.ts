const BASE_CATEGORIES: Record<string, string[]> = {
  "New Lead": ["PENDING CONTACT", "1", "2", "3", "COMPLETED"],
  "Discussion/Requirement": [
    "DISCUSSION",
    "DISCUSSION 1",
    "DISCUSSION 2",
    "DISCUSSION 3",
    "DISCUSSION COMPLETED",
  ],
  Quotation: [
    "QUOTATION",
    "QUOTATION 1",
    "QUOTATION 2",
    "QUOTATION 3",
    "QUOTATION COMPLETED",
  ],
  "Visit Scheduled": ["VISIT SCHEDULED"],
  Visited: ["VISITED"],
  Client: ["WON"],
  Dropped: ["DROP"],
};

// The only categories tenants can insert custom pipeline stages into — each
// is a linear pipeline with a terminal "COMPLETED"-style stage. Mirrors
// backend/utils/leadStatuses.js EXTENDABLE_CATEGORIES.
const EXTENDABLE_CATEGORIES: Record<string, { insertBefore: string }> = {
  "New Lead": { insertBefore: "COMPLETED" },
  "Discussion/Requirement": { insertBefore: "DISCUSSION COMPLETED" },
  Quotation: { insertBefore: "QUOTATION COMPLETED" },
};

export interface CustomLeadStatus {
  value: string;
  category: string;
  label: string;
  colorKey: string;
  order?: number;
}

// `categories`/`ALL_STATUSES` are mutable module bindings (like
// `statusOverrides` below) so every importer sees tenant custom statuses
// as soon as setCustomLeadStatuses() runs, without threading state through
// props everywhere.
export let categories: Record<string, string[]> = { ...BASE_CATEGORIES };

let customStatusMeta: Record<
  string,
  { label: string; colorKey: string; category: string }
> = {};

export function setCustomLeadStatuses(
  list: CustomLeadStatus[] | null | undefined,
) {
  const items = Array.isArray(list) ? list : [];
  const meta: typeof customStatusMeta = {};
  const merged: Record<string, string[]> = {};

  for (const [cat, items0] of Object.entries(BASE_CATEGORIES)) {
    const info = EXTENDABLE_CATEGORIES[cat];
    if (!info) {
      merged[cat] = [...items0];
      continue;
    }
    const extras = items
      .filter((s) => s.category === cat)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const s of extras) {
      meta[s.value] = { label: s.label, colorKey: s.colorKey, category: cat };
    }
    const extraValues = extras.map((s) => s.value);
    const idx = items0.indexOf(info.insertBefore);
    merged[cat] =
      idx === -1
        ? [...items0, ...extraValues]
        : [...items0.slice(0, idx), ...extraValues, ...items0.slice(idx)];
  }

  customStatusMeta = meta;
  categories = merged;
  ALL_STATUSES = Object.values(merged).flat();
}

export function getCustomLeadStatusMeta() {
  return customStatusMeta;
}

export function isCustomLeadStatus(status: string | null | undefined) {
  return !!status && !!customStatusMeta[status];
}

export const getCategoryByStatus = (status: string) => {
  for (const [cat, items] of Object.entries(categories)) {
    if (items.includes(status)) return cat;
  }
  return "New Lead";
};

export const statusColors: Record<string, string> = {
  "PENDING CONTACT":
    "bg-slate-200 text-slate-900 border-slate-400 font-semibold",
  "1": "bg-orange-300 text-slate-900 border-orange-500 font-semibold",
  "2": "bg-orange-300 text-slate-900 border-orange-500 font-semibold",
  "3": "bg-red-300 text-slate-900 border-red-500 font-semibold",
  COMPLETED: "bg-orange-400 text-slate-900 border-orange-600 font-semibold",
  DISCUSSION: "bg-blue-400 text-white border-blue-600 font-semibold",
  "DISCUSSION 1": "bg-blue-300 text-slate-900 border-blue-500 font-semibold",
  "DISCUSSION 2": "bg-blue-200 text-slate-900 border-blue-400 font-semibold",
  "DISCUSSION 3": "bg-blue-100 text-slate-900 border-blue-300 font-semibold",
  "DISCUSSION COMPLETED":
    "bg-blue-500 text-white border-blue-700 font-semibold",
  QUOTATION: "bg-purple-400 text-white border-purple-600 font-semibold",
  "QUOTATION 1": "bg-purple-300 text-slate-900 border-purple-500 font-semibold",
  "QUOTATION 2": "bg-purple-200 text-slate-900 border-purple-400 font-semibold",
  "QUOTATION 3": "bg-purple-100 text-slate-900 border-purple-300 font-semibold",
  "QUOTATION COMPLETED":
    "bg-purple-500 text-white border-purple-700 font-semibold",
  "VISIT SCHEDULED": "bg-cyan-400 text-slate-900 border-cyan-600 font-semibold",
  VISITED: "bg-teal-400 text-slate-900 border-teal-600 font-semibold",
  WON: "bg-emerald-400 text-slate-900 border-emerald-600 font-semibold",
  DROP: "bg-red-500 text-white border-red-700 font-semibold",
  HOT: "bg-red-500 text-white border-red-700 font-semibold",
  WARM: "bg-orange-400 text-slate-900 border-orange-600 font-semibold",
  COLD: "bg-blue-300 text-slate-900 border-blue-500 font-semibold",
};

// ─── Custom label/color overrides ──────────────────────────────────────────
// Tenant-configurable via Settings → Lead Statuses. WON, DROP, and
// VISIT SCHEDULED are excluded — other features (client conversion, visit
// tracking, win/loss reporting) key off those exact values, so only their
// display stays fixed. Everything else can be renamed/recolored per tenant.
// Custom stages (added via Settings → Lead Statuses) always carry their own
// label/color and aren't affected by this — see setCustomLeadStatuses above.

export let ALL_STATUSES: string[] = Object.values(categories).flat();

export const PROTECTED_STATUSES = ["WON", "DROP", "VISIT SCHEDULED"];

export interface StatusOverride {
  label?: string;
  color?: string;
}
export type StatusOverrideMap = Record<string, StatusOverride>;

// name -> tailwind classes (shown to the user) and a lowercase colorKey
// (persisted) so mobile can map the same key to its own hex palette
// without the DB storing platform-specific styling.
export const COLOR_PRESETS: { name: string; classes: string }[] = [
  { name: "Slate", classes: "bg-slate-200 text-slate-900 border-slate-400 font-semibold" },
  { name: "Orange", classes: "bg-orange-300 text-slate-900 border-orange-500 font-semibold" },
  { name: "Red", classes: "bg-red-300 text-slate-900 border-red-500 font-semibold" },
  { name: "Blue", classes: "bg-blue-300 text-slate-900 border-blue-500 font-semibold" },
  { name: "Purple", classes: "bg-purple-300 text-slate-900 border-purple-500 font-semibold" },
  { name: "Cyan", classes: "bg-cyan-300 text-slate-900 border-cyan-500 font-semibold" },
  { name: "Teal", classes: "bg-teal-300 text-slate-900 border-teal-500 font-semibold" },
  { name: "Emerald", classes: "bg-emerald-300 text-slate-900 border-emerald-500 font-semibold" },
  { name: "Pink", classes: "bg-pink-300 text-slate-900 border-pink-500 font-semibold" },
  { name: "Zinc", classes: "bg-zinc-300 text-slate-900 border-zinc-500 font-semibold" },
];

const COLOR_PRESET_BY_KEY: Record<string, string> = Object.fromEntries(
  COLOR_PRESETS.map((p) => [p.name.toLowerCase(), p.classes]),
);

export function colorKeyToClasses(colorKey: string): string {
  return (
    COLOR_PRESET_BY_KEY[colorKey] ||
    "bg-muted text-foreground border-border font-semibold"
  );
}

let statusOverrides: StatusOverrideMap = {};

export function setStatusOverrides(map: StatusOverrideMap | null | undefined) {
  statusOverrides = map || {};
}

export function getStatusOverrides(): StatusOverrideMap {
  return statusOverrides;
}

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return status || "";
  if (customStatusMeta[status]) return customStatusMeta[status].label;
  return statusOverrides[status]?.label?.trim() || status;
}

export function getStatusColorClasses(status: string | null | undefined): string {
  if (!status) return "bg-muted";
  if (customStatusMeta[status]) {
    return colorKeyToClasses(customStatusMeta[status].colorKey);
  }
  return (
    statusOverrides[status]?.color || statusColors[status] || "bg-muted text-foreground border-border"
  );
}

export const sourceColors: Record<string, string> = {
  IndiaMART: "bg-indigo-300 text-slate-900 font-semibold",
  TradeIndia: "bg-green-400 text-slate-900 font-semibold",
  Justdial: "bg-orange-400 text-slate-900 font-semibold",
  Website: "bg-purple-400 text-white font-semibold",
  Manual: "bg-slate-300 text-slate-900 font-semibold",
  Facebook: "bg-blue-500 text-white font-semibold",
  Instagram:
    "bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold",
  Meta: "bg-blue-700 text-white font-semibold",
};
