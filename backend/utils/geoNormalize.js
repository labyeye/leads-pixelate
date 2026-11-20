// Turns the free-text `state` / `location` on leads and the phone's calling code
// into names that match the map files (India states and world-atlas countries).

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const key = (s) =>
  String(s || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(india|indian|state)\b/g, "")
    .replace(/[^a-zऀ-ॿ]/g, "");

const ALIASES = {
  // short codes
  up: "Uttar Pradesh", mp: "Madhya Pradesh", mh: "Maharashtra", rj: "Rajasthan", gj: "Gujarat",
  ka: "Karnataka", tn: "Tamil Nadu", ts: "Telangana", tg: "Telangana", ap: "Andhra Pradesh",
  wb: "West Bengal", hr: "Haryana", pb: "Punjab", br: "Bihar", jh: "Jharkhand", od: "Odisha",
  or: "Odisha", kl: "Kerala", as: "Assam", cg: "Chhattisgarh", ct: "Chhattisgarh",
  uk: "Uttarakhand", ut: "Uttarakhand", hp: "Himachal Pradesh", jk: "Jammu and Kashmir",
  dl: "Delhi", ga: "Goa", py: "Puducherry", ch: "Chandigarh", ml: "Meghalaya", mn: "Manipur",
  mz: "Mizoram", nl: "Nagaland", tr: "Tripura", sk: "Sikkim", ar: "Arunachal Pradesh",
  // common spellings
  uttarpardesh: "Uttar Pradesh", utterpradesh: "Uttar Pradesh", uttarpradesh: "Uttar Pradesh",
  maharastra: "Maharashtra", maharshtra: "Maharashtra", maharashtra: "Maharashtra",
  gujrat: "Gujarat", rajsthan: "Rajasthan", rajastan: "Rajasthan", karanataka: "Karnataka",
  tamilnadu: "Tamil Nadu", telengana: "Telangana", westbangal: "West Bengal", weastbengal: "West Bengal",
  orissa: "Odisha", odissa: "Odisha", hariyana: "Haryana", harayana: "Haryana",
  chattisgarh: "Chhattisgarh", chhatisgarh: "Chhattisgarh", uttrakhand: "Uttarakhand",
  uttaranchal: "Uttarakhand", jharkkhand: "Jharkhand", madhypradesh: "Madhya Pradesh",
  madhyprdesh: "Madhya Pradesh", andhrapradesh: "Andhra Pradesh", newdelhi: "Delhi",
  ncr: "Delhi", delhincr: "Delhi", jammu: "Jammu and Kashmir", kashmir: "Jammu and Kashmir",
  jammukashmir: "Jammu and Kashmir", pondicherry: "Puducherry", andamannicobar: "Andaman and Nicobar Islands",
  andaman: "Andaman and Nicobar Islands", dadranagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
  damandiu: "Dadra and Nagar Haveli and Daman and Diu",
  // Hindi
  "उत्तरप्रदेश": "Uttar Pradesh", "महाराष्ट्र": "Maharashtra", "राजस्थान": "Rajasthan",
  "बिहार": "Bihar", "मध्यप्रदेश": "Madhya Pradesh", "गुजरात": "Gujarat", "हरियाणा": "Haryana",
  "दिल्ली": "Delhi", "पंजाब": "Punjab", "उत्तराखंड": "Uttarakhand", "झारखंड": "Jharkhand",
};

// Big cities people type in the state box (or only in location).
const CITIES = {
  mumbai: "Maharashtra", pune: "Maharashtra", nagpur: "Maharashtra", nashik: "Maharashtra",
  thane: "Maharashtra", aurangabad: "Maharashtra", solapur: "Maharashtra", kolhapur: "Maharashtra",
  navimumbai: "Maharashtra", delhi: "Delhi", newdelhi: "Delhi", noida: "Uttar Pradesh",
  greaternoida: "Uttar Pradesh", ghaziabad: "Uttar Pradesh", lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh", agra: "Uttar Pradesh", varanasi: "Uttar Pradesh", meerut: "Uttar Pradesh",
  prayagraj: "Uttar Pradesh", allahabad: "Uttar Pradesh", gorakhpur: "Uttar Pradesh",
  bareilly: "Uttar Pradesh", aligarh: "Uttar Pradesh", gurgaon: "Haryana", gurugram: "Haryana",
  faridabad: "Haryana", panipat: "Haryana", rohtak: "Haryana", hisar: "Haryana", karnal: "Haryana",
  bangalore: "Karnataka", bengaluru: "Karnataka", mysore: "Karnataka", mysuru: "Karnataka",
  hubli: "Karnataka", mangalore: "Karnataka", hassan: "Karnataka", belgaum: "Karnataka",
  hyderabad: "Telangana", secunderabad: "Telangana", warangal: "Telangana",
  chennai: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu", tiruppur: "Tamil Nadu",
  salem: "Tamil Nadu", trichy: "Tamil Nadu", ahmedabad: "Gujarat", surat: "Gujarat",
  vadodara: "Gujarat", baroda: "Gujarat", rajkot: "Gujarat", gandhinagar: "Gujarat",
  jamnagar: "Gujarat", bhavnagar: "Gujarat", morbi: "Gujarat", jaipur: "Rajasthan",
  jodhpur: "Rajasthan", udaipur: "Rajasthan", kota: "Rajasthan", ajmer: "Rajasthan",
  bikaner: "Rajasthan", alwar: "Rajasthan", bhilwara: "Rajasthan", indore: "Madhya Pradesh",
  bhopal: "Madhya Pradesh", jabalpur: "Madhya Pradesh", gwalior: "Madhya Pradesh",
  ujjain: "Madhya Pradesh", morena: "Madhya Pradesh", kolkata: "West Bengal", howrah: "West Bengal",
  siliguri: "West Bengal", durgapur: "West Bengal", patna: "Bihar", gaya: "Bihar",
  muzaffarpur: "Bihar", bhagalpur: "Bihar", ara: "Bihar", ranchi: "Jharkhand",
  jamshedpur: "Jharkhand", dhanbad: "Jharkhand", bhubaneswar: "Odisha", cuttack: "Odisha",
  raipur: "Chhattisgarh", bilaspur: "Chhattisgarh", ludhiana: "Punjab", amritsar: "Punjab",
  jalandhar: "Punjab", patiala: "Punjab", mohali: "Punjab", chandigarh: "Chandigarh",
  dehradun: "Uttarakhand", haridwar: "Uttarakhand", haldwani: "Uttarakhand", shimla: "Himachal Pradesh",
  kochi: "Kerala", cochin: "Kerala", ernakulam: "Kerala", trivandrum: "Kerala",
  thiruvananthapuram: "Kerala", kozhikode: "Kerala", calicut: "Kerala", thrissur: "Kerala",
  guwahati: "Assam", visakhapatnam: "Andhra Pradesh", vizag: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh", guntur: "Andhra Pradesh", tirupati: "Andhra Pradesh",
  nellore: "Andhra Pradesh", srinagar: "Jammu and Kashmir", panaji: "Goa", margao: "Goa",
};

const BY_KEY = Object.fromEntries(STATES.map((s) => [key(s), s]));
const ALIAS_KEY = Object.fromEntries(Object.entries(ALIASES).map(([k, v]) => [key(k), v]));
const CITY_KEY = Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [key(k), v]));

function stateOf(state, location) {
  for (const raw of [state, location]) {
    const k = key(raw);
    if (!k) continue;
    if (BY_KEY[k]) return BY_KEY[k];
    if (ALIAS_KEY[k]) return ALIAS_KEY[k];
    if (CITY_KEY[k]) return CITY_KEY[k];
    // "Shardar sahar churu Rajsthan", "Andhra Pradesh India": look for a state inside.
    for (const [sk, name] of Object.entries(BY_KEY)) if (sk.length > 4 && k.includes(sk)) return name;
    for (const [ak, name] of Object.entries(ALIAS_KEY)) if (ak.length > 5 && k.includes(ak)) return name;
  }
  return null;
}

// Calling code → world-atlas country name. Longest code wins.
const CODES = {
  1: "United States of America", 7: "Russia", 20: "Egypt", 27: "South Africa", 30: "Greece",
  31: "Netherlands", 32: "Belgium", 33: "France", 34: "Spain", 36: "Hungary", 39: "Italy",
  40: "Romania", 41: "Switzerland", 43: "Austria", 44: "United Kingdom", 45: "Denmark",
  46: "Sweden", 47: "Norway", 48: "Poland", 49: "Germany", 51: "Peru", 52: "Mexico",
  54: "Argentina", 55: "Brazil", 56: "Chile", 57: "Colombia", 60: "Malaysia", 61: "Australia",
  62: "Indonesia", 63: "Philippines", 64: "New Zealand", 65: "Malaysia", 66: "Thailand",
  81: "Japan", 82: "South Korea", 84: "Vietnam", 86: "China", 90: "Turkey", 91: "India",
  92: "Pakistan", 93: "Afghanistan", 94: "Sri Lanka", 95: "Myanmar", 98: "Iran",
  212: "Morocco", 213: "Algeria", 216: "Tunisia", 218: "Libya", 220: "Gambia", 221: "Senegal",
  225: "Côte d'Ivoire", 233: "Ghana", 234: "Nigeria", 237: "Cameroon", 249: "Sudan",
  250: "Rwanda", 251: "Ethiopia", 252: "Somalia", 254: "Kenya", 255: "Tanzania",
  256: "Uganda", 260: "Zambia", 263: "Zimbabwe", 351: "Portugal", 353: "Ireland",
  358: "Finland", 380: "Ukraine", 880: "Bangladesh", 960: "Maldives", 961: "Lebanon",
  962: "Jordan", 963: "Syria", 964: "Iraq", 965: "Kuwait", 966: "Saudi Arabia", 967: "Yemen",
  968: "Oman", 971: "United Arab Emirates", 972: "Israel", 973: "Bahrain", 974: "Qatar",
  975: "Bhutan", 976: "Mongolia", 977: "Nepal",
};

function countryOf(phone) {
  let p = String(phone || "").replace(/[\s\-()]/g, "");
  if (!p) return null;
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) {
    const d = p.replace(/\D/g, "");
    // Bare 10-digit numbers, or 91 + 10 digits, are Indian.
    if (d.length === 10 || (d.length === 12 && d.startsWith("91")) || (d.length === 11 && d.startsWith("0"))) return "India";
    return null;
  }
  const d = p.slice(1).replace(/\D/g, "");
  for (const len of [3, 2, 1]) {
    const c = CODES[d.slice(0, len)];
    if (c) return c;
  }
  return null;
}

module.exports = { STATES, stateOf, countryOf };
