// Parses pasted CSV (header row + rows, quoted cells ok) into sanitized lead objects.
// Same rules as web import: only `name` required, phone digits only (7-15), HTML stripped.
const clean = (v: string) =>
  v.replace(/<[^>]*>/g, '').replace(/[<>"'`\\]/g, '').trim().slice(0, 500);

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter(r => r.some(x => x.trim()));
}

export function csvToLeads(text: string): { leads: any[]; error?: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { leads: [], error: 'Need a header row and at least one lead.' };
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
  if (!head.includes('name')) return { leads: [], error: 'Header must include a "name" column.' };
  const leads = rows.slice(1).map(r => {
    const o: any = {};
    head.forEach((h, i) => {
      if (!h) return;
      o[h] = h === 'phone' ? (r[i] || '').replace(/\D/g, '').slice(0, 15) : clean(r[i] || '');
    });
    return o;
  }).filter(l => l.name);
  const bad = leads.filter(l => l.phone && (l.phone.length < 7 || l.phone.length > 15)).length;
  if (bad) return { leads: [], error: `${bad} row(s) have invalid phone numbers.` };
  return { leads };
}
