export const categories = {
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

export const sourceColors: Record<string, string> = {
  IndiaMART: "bg-indigo-300 text-slate-900 font-semibold",
  TradeIndia: "bg-green-400 text-slate-900 font-semibold",
  Justdial: "bg-orange-400 text-slate-900 font-semibold",
  Website: "bg-purple-400 text-white font-semibold",
  Manual: "bg-slate-300 text-slate-900 font-semibold",
};
