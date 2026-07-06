export const categories: Record<string, string[]> = {
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

export const categoryOrder = [
  'New Lead',
  'Discussion/Requirement',
  'Quotation',
  'Visit Scheduled',
  'Visited',
  'Client',
  'Dropped',
];

export const getCategoryByStatus = (status: string): string => {
  for (const [cat, items] of Object.entries(categories)) {
    if (items.includes(status)) return cat;
  }
  return 'New Lead';
};

export const statusColors: Record<string, {bg: string; text: string; border: string}> = {
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

export const ALL_STATUSES = Object.keys(statusColors);
export const ALL_SOURCES = Object.keys(sourceColors);
