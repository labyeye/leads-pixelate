import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DataTable, Modal, SaveBar, StatusPill, Toolbar, fmtDate, inputCls, labelCls, money } from "@/components/inventory/parts";
import { clientsAPI, invoicesAPI, productsAPI, purchaseOrdersAPI, salesOrdersAPI, settingsAPI } from "@/services/api";
import { downloadTradeDocPDF } from "@/lib/tradeDocPDF";
import { useNotify } from "@/components/ui/Notification";
import { usePermission } from "@/hooks/usePermission";

// Sales orders, purchase orders and invoices are the same screen: a client, line items, totals, a status.
const KINDS = {
  sales_order: {
    title: "Sales Orders",
    one: "Sales order",
    api: salesOrdersAPI,
    perm: "Quotations",
    statuses: ["Draft", "Confirmed", "Fulfilled", "Cancelled"],
    dateLabel: "Expected delivery",
    empty: "No sales orders yet. Create one when a client confirms a quotation.",
  },
  purchase_order: {
    title: "Purchase Orders",
    one: "Purchase order",
    api: purchaseOrdersAPI,
    perm: "Products",
    statuses: ["Draft", "Issued", "Received", "Cancelled"],
    dateLabel: "Expected delivery",
    empty: "No purchase orders yet.",
  },
  invoice: {
    title: "Invoices",
    one: "Invoice",
    api: invoicesAPI,
    perm: "Quotations",
    statuses: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"],
    dateLabel: "Due date",
    empty: "No invoices yet. Create one to bill a client.",
  },
} as const;

export type TradeKind = keyof typeof KINDS;

const blankItem = { name: "", hsnCode: "", quantity: "1", rate: "" };
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({
  partyName: "",
  reference: "",
  date: today(),
  dueDate: "",
  status: "Draft",
  discount: "0",
  taxPercent: "18",
  notes: "",
  items: [{ ...blankItem }],
});

export default function TradeDocumentsPage({ kind }: { kind: TradeKind }) {
  const cfg = KINDS[kind];
  const { can } = usePermission();
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setRows((await cfg.api.getAll()).data || []);
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setSearch("");
    setStatusFilter("all");
    setOpen(false);
    load();
  }, [kind]);

  // Suggestions for the client and item fields; typing anything else still works.
  useEffect(() => {
    clientsAPI
      .getAll()
      .then((r) => setClients(r.data || []))
      .catch(() => {});
    settingsAPI
      .get()
      .then((r: any) => setSettings(r.data))
      .catch(() => {});
    productsAPI
      .getAll()
      .then((r) => setProducts(r.data || []))
      .catch(() => {});
  }, []);

  const openForm = (d?: any) => {
    setEditId(d?._id ?? null);
    setForm(
      d
        ? {
            partyName: d.partyName,
            reference: d.reference || "",
            date: (d.date || today()).slice(0, 10),
            dueDate: d.dueDate ? d.dueDate.slice(0, 10) : "",
            status: d.status,
            discount: String(d.discount ?? 0),
            taxPercent: String(d.taxPercent ?? 18),
            notes: d.notes || "",
            items: d.items.map((i: any) => ({ name: i.name, hsnCode: i.hsnCode || "", quantity: String(i.quantity), rate: String(i.rate) })),
          }
        : blank(),
    );
    setOpen(true);
  };

  const setItem = (i: number, patch: Partial<typeof blankItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }));

  // Picking a product name from the list fills its price and HSN.
  const pickProduct = (i: number, name: string) => {
    const p = products.find((x) => x.name === name);
    setItem(i, p ? { name, rate: String(p.price), hsnCode: p.hsnCode || "" } : { name });
  };

  const totals = useMemo(() => {
    const sub = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0);
    const taxable = Math.max(0, sub - (Number(form.discount) || 0));
    const tax = (taxable * (Number(form.taxPercent) || 0)) / 100;
    return { sub, tax, total: taxable + tax };
  }, [form.items, form.discount, form.taxPercent]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partyName.trim()) return notify.error("Add who this is for");
    const items = form.items.filter((i) => i.name.trim());
    if (!items.length) return notify.error("Add at least one item");
    if (items.some((i) => !(Number(i.quantity) > 0) || i.rate === "" || Number(i.rate) < 0)) {
      return notify.error("Check the items", "Each item needs a quantity above 0 and a rate.");
    }
    setSaving(true);
    try {
      const payload = {
        partyName: form.partyName.trim(),
        reference: form.reference.trim(),
        date: form.date,
        dueDate: form.dueDate || null,
        status: form.status,
        discount: Number(form.discount) || 0,
        taxPercent: Number(form.taxPercent) || 0,
        notes: form.notes,
        items: items.map((i) => ({ name: i.name.trim(), hsnCode: i.hsnCode, quantity: Number(i.quantity), rate: Number(i.rate) })),
      };
      editId ? await cfg.api.update(editId, payload) : await cfg.api.create(payload);
      notify.success(`${cfg.one} ${editId ? "updated" : "created"}`);
      setOpen(false);
      load();
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // The PDF uses the company's own logo and details from Settings, and the client's address and GST.
  const pdf = async (d: any) => {
    setPdfId(d._id);
    try {
      const client = clients.find((c) => c.company === d.partyName || c.name === d.partyName);
      await downloadTradeDocPDF(kind, d, settings, client);
    } catch {
      notify.error("PDF Error", "Could not generate the PDF.");
    } finally {
      setPdfId(null);
    }
  };

  const remove = async (d: any) => {
    if (!window.confirm(`Delete ${cfg.one.toLowerCase()} ${d.number}?`)) return;
    try {
      await cfg.api.remove(d._id);
      load();
    } catch (err: any) {
      notify.error("Error", err.message);
    }
  };

  const q = search.toLowerCase();
  const shown = rows.filter(
    (d) =>
      (statusFilter === "all" || d.status === statusFilter) &&
      [d.number, d.partyName, d.reference].some((x) => (x || "").toLowerCase().includes(q)),
  );
  const shownTotal = shown.reduce((s, d) => s + (d.status === "Cancelled" ? 0 : d.total), 0);
  const field = (k: "partyName" | "reference" | "date" | "dueDate" | "notes" | "discount" | "taxPercent" | "status") =>
    (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AppLayout title={cfg.title}>
      <div className="space-y-4">
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder={`Search ${cfg.title.toLowerCase()}...`}
          addLabel={`New ${cfg.one}`}
          onAdd={can(cfg.perm, "create") ? () => openForm() : undefined}
        >
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 border-2 border-black px-3 text-xs font-black uppercase tracking-widest bg-white outline-none cursor-pointer"
          >
            <option value="all">All statuses</option>
            {cfg.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Toolbar>

        <DataTable
          heads={["Number", "Client", "Date", cfg.dateLabel, "Total", "Status", "Actions"]}
          loading={loading}
          empty={shown.length ? null : rows.length ? "Nothing matches your filters." : cfg.empty}
          footer={`${shown.length} ${cfg.title.toLowerCase()} · ${money(shownTotal)} total (cancelled not counted)`}
        >
          {shown.map((d) => (
            <tr key={d._id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 font-black text-black whitespace-nowrap">{d.number}</td>
              <td className="px-4 py-3">
                {d.partyName}
                {d.reference && <span className="block text-xs text-gray-500">Ref: {d.reference}</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDate(d.date)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDate(d.dueDate)}</td>
              <td className="px-4 py-3 font-black whitespace-nowrap">{money(d.total)}</td>
              <td className="px-4 py-3">
                <StatusPill status={d.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button aria-label={`Download PDF ${d.number}`} onClick={() => pdf(d)} disabled={pdfId === d._id} className="p-1.5 hover:bg-blue-50">
                  {pdfId === d._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                {can(cfg.perm, "update") && (
                  <button aria-label={`Edit ${d.number}`} onClick={() => openForm(d)} className="p-1.5 hover:bg-blue-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {can(cfg.perm, "delete") && (
                  <button aria-label={`Delete ${d.number}`} onClick={() => remove(d)} className="p-1.5 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {open && (
        <Modal title={editId ? `Edit ${cfg.one}` : `New ${cfg.one}`} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="p-5 space-y-4">
            <datalist id="td-clients">
              {[...new Set(clients.flatMap((c) => [c.company, c.name]).filter(Boolean))].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="td-products">
              {products.map((p) => (
                <option key={p._id} value={p.name} />
              ))}
            </datalist>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="td-party" className={labelCls}>
                  Client <span className="text-red-500">*</span>
                </label>
                <input id="td-party" list="td-clients" className={inputCls} value={form.partyName} onChange={field("partyName")} maxLength={120} />
              </div>
              <div>
                <label htmlFor="td-ref" className={labelCls}>Reference (optional)</label>
                <input id="td-ref" className={inputCls} value={form.reference} onChange={field("reference")} maxLength={60} placeholder="Quotation or PO number" />
              </div>
              <div>
                <label htmlFor="td-date" className={labelCls}>Date</label>
                <input id="td-date" type="date" className={inputCls} value={form.date} onChange={field("date")} />
              </div>
              <div>
                <label htmlFor="td-due" className={labelCls}>{cfg.dateLabel}</label>
                <input id="td-due" type="date" className={inputCls} value={form.dueDate} onChange={field("dueDate")} />
              </div>
            </div>

            <div>
              <p className={labelCls}>Items</p>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_70px_90px_auto] sm:grid-cols-[minmax(0,1fr)_100px_70px_100px_auto] gap-2 items-center">
                    <input
                      aria-label={`Item ${i + 1} name`}
                      list="td-products"
                      className={inputCls}
                      placeholder="Item or service"
                      value={it.name}
                      onChange={(e) => pickProduct(i, e.target.value)}
                    />
                    <input
                      aria-label={`Item ${i + 1} HSN`}
                      className={`${inputCls} hidden sm:block`}
                      placeholder="HSN/SAC"
                      value={it.hsnCode}
                      onChange={(e) => setItem(i, { hsnCode: e.target.value })}
                    />
                    <input
                      aria-label={`Item ${i + 1} quantity`}
                      type="number"
                      min="0"
                      step="any"
                      className={inputCls}
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                    />
                    <input
                      aria-label={`Item ${i + 1} rate`}
                      type="number"
                      min="0"
                      step="any"
                      className={inputCls}
                      placeholder="Rate ₹"
                      value={it.rate}
                      onChange={(e) => setItem(i, { rate: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={`Remove item ${i + 1}`}
                      disabled={form.items.length === 1}
                      onClick={() => setForm({ ...form, items: form.items.filter((_, k) => k !== i) })}
                      className="p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, items: [...form.items, { ...blankItem }] })}
                className="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#024BAB]"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            <div className="grid sm:grid-cols-[1fr_1fr_1fr] gap-3">
              <div>
                <label htmlFor="td-disc" className={labelCls}>Discount (₹)</label>
                <input id="td-disc" type="number" min="0" className={inputCls} value={form.discount} onChange={field("discount")} />
              </div>
              <div>
                <label htmlFor="td-tax" className={labelCls}>GST %</label>
                <input id="td-tax" type="number" min="0" max="100" className={inputCls} value={form.taxPercent} onChange={field("taxPercent")} />
              </div>
              <div>
                <label htmlFor="td-status" className={labelCls}>Status</label>
                <select id="td-status" className={inputCls} value={form.status} onChange={field("status")}>
                  {cfg.statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <dl className="border-2 border-black bg-gray-50 p-3 text-sm space-y-1 sm:ml-auto sm:max-w-xs">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(totals.sub)}</dd></div>
              <div className="flex justify-between"><dt>GST</dt><dd>{money(totals.tax)}</dd></div>
              <div className="flex justify-between font-black border-t border-black pt-1"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
            </dl>

            <div>
              <label htmlFor="td-notes" className={labelCls}>Notes</label>
              <textarea id="td-notes" rows={2} className={inputCls} value={form.notes} onChange={field("notes")} maxLength={1000} />
            </div>
            <SaveBar saving={saving} onCancel={() => setOpen(false)} label={editId ? "Save changes" : `Create ${cfg.one.toLowerCase()}`} />
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
