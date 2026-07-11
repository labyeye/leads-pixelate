const crypto = require("crypto");

// Mirrors the Lead.status values (backend/models/Lead.js) and the frontend's
// statusConstants.ts. Kept as a small standalone list rather than importing
// the transition map in leadController.js so this file has no dependency on
// pipeline logic.
const ALL_STATUSES = [
  "PENDING CONTACT",
  "1",
  "2",
  "3",
  "COMPLETED",
  "DISCUSSION",
  "DISCUSSION 1",
  "DISCUSSION 2",
  "DISCUSSION 3",
  "DISCUSSION COMPLETED",
  "QUOTATION",
  "QUOTATION 1",
  "QUOTATION 2",
  "QUOTATION 3",
  "QUOTATION COMPLETED",
  "VISIT SCHEDULED",
  "VISITED",
  "WON",
  "DROP",
];

// Other features (client conversion, visit-date tracking, win/loss
// reporting) key off these exact values — only their display can never be
// customized per tenant.
const PROTECTED_STATUSES = ["WON", "DROP", "VISIT SCHEDULED"];

const categories = {
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

// The only categories tenants can insert custom stages into — each is a
// linear pipeline with a terminal "COMPLETED"-style stage. `insertBefore`
// is where new stages get spliced in; `after` is the fixed stage whose
// outgoing transition gets rewired to point at the first custom stage.
const EXTENDABLE_CATEGORIES = {
  "New Lead": { insertBefore: "COMPLETED", after: "3" },
  "Discussion/Requirement": {
    insertBefore: "DISCUSSION COMPLETED",
    after: "DISCUSSION 3",
  },
  Quotation: { insertBefore: "QUOTATION COMPLETED", after: "QUOTATION 3" },
};

// Shared preset names — each platform (web tailwind classes, mobile hex
// triples) maps these to its own local palette, so the DB never stores
// platform-specific styling.
const COLOR_PRESET_NAMES = [
  "slate",
  "orange",
  "red",
  "blue",
  "purple",
  "cyan",
  "teal",
  "emerald",
  "pink",
  "zinc",
];

const MAX_CUSTOM_STATUSES = 20;

function sanitizeCustomLeadStatuses(input, existing = []) {
  if (!Array.isArray(input)) return Array.isArray(existing) ? existing : [];

  const existingValues = new Set(
    (existing || []).map((s) => s && s.value).filter(Boolean),
  );
  const clean = [];
  const seenValues = new Set();
  let order = 0;

  for (const raw of input.slice(0, MAX_CUSTOM_STATUSES)) {
    if (!raw || typeof raw !== "object") continue;

    const category = typeof raw.category === "string" ? raw.category : "";
    if (!EXTENDABLE_CATEGORIES[category]) continue;

    const label =
      typeof raw.label === "string" ? raw.label.trim().slice(0, 40) : "";
    if (!label) continue;

    const colorKey = COLOR_PRESET_NAMES.includes(raw.colorKey)
      ? raw.colorKey
      : "slate";

    let value = typeof raw.value === "string" ? raw.value : "";
    const isKnownValue =
      value && (existingValues.has(value) || ALL_STATUSES.includes(value));
    if (!isKnownValue || seenValues.has(value) || ALL_STATUSES.includes(value)) {
      do {
        value = `CUSTOM_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      } while (seenValues.has(value) || ALL_STATUSES.includes(value));
    }
    seenValues.add(value);

    clean.push({ value, category, label, colorKey, order: order++ });
  }

  return clean;
}

function buildCategoriesWithCustom(customStatuses = []) {
  const merged = {};
  for (const [cat, items] of Object.entries(categories)) {
    const info = EXTENDABLE_CATEGORIES[cat];
    if (!info) {
      merged[cat] = [...items];
      continue;
    }
    const extras = customStatuses
      .filter((s) => s.category === cat)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => s.value);
    const idx = items.indexOf(info.insertBefore);
    merged[cat] =
      idx === -1
        ? [...items, ...extras]
        : [...items.slice(0, idx), ...extras, ...items.slice(idx)];
  }
  return merged;
}

function buildAllStatusesWithCustom(customStatuses = []) {
  return Object.values(buildCategoriesWithCustom(customStatuses)).flat();
}

// Base transition graph — see backend/controllers/leadController.js for
// the pre-existing pipeline rules this mirrors. Custom stages are spliced
// into this by buildTransitionMaps() rather than hand-maintained here.
const BASE_VALID_TRANSITIONS = {
  "PENDING CONTACT": ["1", "DISCUSSION", "DROP"],
  1: ["2", "DISCUSSION", "DROP"],
  2: ["3", "DISCUSSION", "DROP"],
  3: ["COMPLETED", "DISCUSSION", "DROP"],
  COMPLETED: ["COMPLETED", "DISCUSSION", "DROP"],
  DISCUSSION: [
    "DISCUSSION 1",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DISCUSSION",
    "DROP",
  ],
  "DISCUSSION 1": [
    "DISCUSSION 1",
    "DISCUSSION 2",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION 2": [
    "DISCUSSION 2",
    "DISCUSSION 3",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION 3": [
    "DISCUSSION 3",
    "DISCUSSION COMPLETED",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "DISCUSSION COMPLETED": [
    "DISCUSSION COMPLETED",
    "DISCUSSION",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  QUOTATION: [
    "QUOTATION 1",
    "VISIT SCHEDULED",
    "DISCUSSION",
    "QUOTATION",
    "DROP",
  ],
  "QUOTATION 1": [
    "QUOTATION 1",
    "QUOTATION 2",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION 2": [
    "QUOTATION 2",
    "QUOTATION 3",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION 3": [
    "QUOTATION 3",
    "QUOTATION COMPLETED",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "QUOTATION COMPLETED": [
    "QUOTATION COMPLETED",
    "QUOTATION",
    "VISIT SCHEDULED",
    "DROP",
  ],
  "VISIT SCHEDULED": ["VISIT SCHEDULED", "VISITED", "DISCUSSION", "DROP"],
  VISITED: ["WON", "DISCUSSION", "DROP"],
  WON: [],
  DROP: ["PENDING CONTACT"],
};

const BASE_MANDATORY_FIELDS = {
  1: ["remarks"],
  2: ["remarks"],
  3: ["remarks"],
  COMPLETED: ["remarks"],
  DISCUSSION: ["remarks"],
  "DISCUSSION 1": ["remarks"],
  "DISCUSSION 2": ["remarks"],
  "DISCUSSION 3": ["remarks"],
  "DISCUSSION COMPLETED": ["remarks"],
  QUOTATION: ["remarks"],
  "QUOTATION 1": ["remarks"],
  "QUOTATION 2": ["remarks"],
  "QUOTATION 3": ["remarks"],
  "QUOTATION COMPLETED": ["remarks"],
  "VISIT SCHEDULED": ["remarks"],
  VISITED: ["remarks"],
  WON: ["remarks"],
  DROP: [],
};

const BASE_REQUIRES_DATE = [
  "1",
  "2",
  "3",
  "COMPLETED",
  "DISCUSSION",
  "DISCUSSION 1",
  "DISCUSSION 2",
  "DISCUSSION 3",
  "DISCUSSION COMPLETED",
  "QUOTATION",
  "QUOTATION 1",
  "QUOTATION 2",
  "QUOTATION 3",
  "QUOTATION COMPLETED",
  "VISIT SCHEDULED",
];

// Per-category shape for how a custom stage transitions: whether it can
// loop back to itself (re-save with same status) and which fixed "jump"
// targets it shares with its sibling fixed stages.
const CUSTOM_TRANSITION_SHAPE = {
  "New Lead": { selfLoop: false, commonTargets: ["DISCUSSION", "DROP"] },
  "Discussion/Requirement": {
    selfLoop: true,
    commonTargets: ["DISCUSSION", "QUOTATION", "VISIT SCHEDULED", "DROP"],
  },
  Quotation: {
    selfLoop: true,
    commonTargets: ["QUOTATION", "VISIT SCHEDULED", "DROP"],
  },
};

function buildTransitionMaps(customStatuses = []) {
  const transitions = {};
  for (const [k, v] of Object.entries(BASE_VALID_TRANSITIONS)) {
    transitions[k] = [...v];
  }
  const mandatory = { ...BASE_MANDATORY_FIELDS };
  const requiresDate = new Set(BASE_REQUIRES_DATE);

  for (const [category, info] of Object.entries(EXTENDABLE_CATEGORIES)) {
    const extras = customStatuses
      .filter((s) => s.category === category)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => s.value);
    if (extras.length === 0) continue;

    const shape = CUSTOM_TRANSITION_SHAPE[category];
    const chain = [info.after, ...extras, info.insertBefore];

    for (let i = 1; i < chain.length - 1; i++) {
      const stage = chain[i];
      const next = chain[i + 1];
      transitions[stage] = shape.selfLoop
        ? [stage, next, ...shape.commonTargets]
        : [next, ...shape.commonTargets];
      mandatory[stage] = ["remarks"];
      requiresDate.add(stage);
    }

    // Rewire the fixed "after" stage to point at the first custom stage
    // instead of jumping straight to the terminal stage.
    transitions[info.after] = transitions[info.after].map((t) =>
      t === info.insertBefore ? extras[0] : t,
    );
  }

  return {
    VALID_TRANSITIONS: transitions,
    MANDATORY_FIELDS: mandatory,
    REQUIRES_DATE: Array.from(requiresDate),
  };
}

function sanitizeLeadStatusLabels(input) {
  if (!input || typeof input !== "object") return {};

  const clean = {};
  for (const status of ALL_STATUSES) {
    if (PROTECTED_STATUSES.includes(status)) continue;
    const entry = input[status];
    if (!entry || typeof entry !== "object") continue;

    const label = typeof entry.label === "string" ? entry.label.trim().slice(0, 40) : "";
    const color = typeof entry.color === "string" ? entry.color.slice(0, 200) : "";
    if (!label && !color) continue;

    clean[status] = {};
    if (label) clean[status].label = label;
    if (color) clean[status].color = color;
  }
  return clean;
}

module.exports = {
  ALL_STATUSES,
  PROTECTED_STATUSES,
  categories,
  EXTENDABLE_CATEGORIES,
  COLOR_PRESET_NAMES,
  sanitizeLeadStatusLabels,
  sanitizeCustomLeadStatuses,
  buildCategoriesWithCustom,
  buildAllStatusesWithCustom,
  buildTransitionMaps,
};
