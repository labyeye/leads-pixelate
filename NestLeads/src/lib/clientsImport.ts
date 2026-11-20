import { parseCsv } from './leadsImport';

// Header text -> API field, ignoring case, spaces and punctuation (same as web ImportClientsDialog).
const ALIASES: Record<string, string> = {
  name: 'name', clientname: 'name', client: 'name',
  company: 'company', companyname: 'company',
  email: 'email', emailid: 'email', emailaddress: 'email',
  phone: 'phone', phonenumber: 'phone', mobile: 'phone', mobilenumber: 'phone',
  address: 'address',
  businesstype: 'businessType', type: 'businessType',
  gst: 'gst', gstin: 'gst', gstnumber: 'gst',
  services: 'services',
  projectstatus: 'projectStatus',
  paymentstatus: 'paymentStatus',
};
const REQUIRED = ['name', 'company', 'email', 'phone', 'address', 'businessType'];

export function csvToClients(text: string): { rows: Record<string, string>[]; error?: string } {
  const table = parseCsv(text).filter(r => r.some(c => c.trim()));
  if (table.length < 2) return { rows: [], error: 'Paste a header row and at least one client.' };
  const fields = table[0].map(h => ALIASES[h.toLowerCase().replace(/[^a-z]/g, '')] || '');
  const missing = REQUIRED.filter(f => !fields.includes(f));
  if (missing.length) return { rows: [], error: `Missing column(s): ${missing.join(', ')}` };
  const rows = table.slice(1).map(r => {
    const o: Record<string, string> = {};
    fields.forEach((f, i) => f && (o[f] = (r[i] || '').trim()));
    return o;
  });
  return { rows };
}
