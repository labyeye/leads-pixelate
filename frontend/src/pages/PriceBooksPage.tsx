import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DataTable, Modal, SaveBar, StatusPill, Toolbar, inputCls, labelCls, money } from "@/components/inventory/parts";
import { priceBooksAPI, productsAPI } from "@/services/api";
import { useNotify } from "@/components/ui/Notification";
import { usePermission } from "@/hooks/usePermission";

type Row = { product: string; price: string };
const blank = () => ({ name: "", description: "", status: "Active", items: [{ product: "", price: "" }] as Row[] });

// A price book is a named set of special prices for products (wholesale, festival, one client...).
export default function PriceBooksPage() {
  const { can } = usePermission();
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [b, p] = await Promise.all([priceBooksAPI.getAll(), productsAPI.getAll()]);
      setRows(b.data || []);
      setProducts(p.data || []);
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const openForm = (b?: any) => {
    setEditId(b?._id ?? null);
    setForm(
      b
        ? {
            name: b.name,
            description: b.description || "",
            status: b.status,
            items: b.items.length ? b.items.map((i: any) => ({ product: String(i.product), price: String(i.price) })) : [{ product: "", price: "" }],
          }
        : blank(),
    );
    setOpen(true);
  };

  const setRow = (i: number, patch: Partial<Row>) =>
    setForm((f) => ({ ...f, items: f.items.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));

  // Choosing a product suggests its normal price to start from.
  const pick = (i: number, id: string) => {
    const p = products.find((x) => x._id === id);
    setRow(i, { product: id, ...(p && !form.items[i].price ? { price: String(p.price) } : {}) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error("Name the price book");
    const items = form.items.filter((r) => r.product);
    if (items.some((r) => r.price === "" || Number(r.price) < 0)) return notify.error("Every product needs a price");
    if (new Set(items.map((r) => r.product)).size !== items.length) return notify.error("A product is listed twice");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        status: form.status,
        items: items.map((r) => ({ product: r.product, name: products.find((p) => p._id === r.product)?.name || "", price: Number(r.price) })),
      };
      editId ? await priceBooksAPI.update(editId, payload) : await priceBooksAPI.create(payload);
      notify.success(editId ? "Price book updated" : "Price book created");
      setOpen(false);
      load();
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: any) => {
    if (!window.confirm(`Delete price book "${b.name}"?`)) return;
    try {
      await priceBooksAPI.remove(b._id);
      load();
    } catch (err: any) {
      notify.error("Error", err.message);
    }
  };

  const shown = rows.filter((b) => (b.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout title="Price Books">
      <div className="space-y-4">
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search price books..."
          addLabel="New Price Book"
          onAdd={can("Products", "create") ? () => openForm() : undefined}
        />
        <DataTable
          heads={["Price book", "Description", "Products", "Status", "Actions"]}
          loading={loading}
          empty={shown.length ? null : rows.length ? "No price books match your search." : "No price books yet. Make one for wholesale, festival or special-client prices."}
          footer={`${shown.length} price book${shown.length === 1 ? "" : "s"}`}
        >
          {shown.map((b) => (
            <tr key={b._id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 font-black text-black">{b.name}</td>
              <td className="px-4 py-3 text-gray-600">{b.description || "—"}</td>
              <td className="px-4 py-3">{b.items.length}</td>
              <td className="px-4 py-3">
                <StatusPill status={b.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {can("Products", "update") && (
                  <button aria-label={`Edit ${b.name}`} onClick={() => openForm(b)} className="p-1.5 hover:bg-blue-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {can("Products", "delete") && (
                  <button aria-label={`Delete ${b.name}`} onClick={() => remove(b)} className="p-1.5 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {open && (
        <Modal title={editId ? "Edit Price Book" : "New Price Book"} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="grid sm:grid-cols-[1fr_160px] gap-3">
              <div>
                <label htmlFor="pb-name" className={labelCls}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input id="pb-name" className={inputCls} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wholesale 2026" />
              </div>
              <div>
                <label htmlFor="pb-status" className={labelCls}>Status</label>
                <select id="pb-status" className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pb-desc" className={labelCls}>Description</label>
              <input id="pb-desc" className={inputCls} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <p className={labelCls}>Special prices</p>
              <div className="space-y-2">
                {form.items.map((r, i) => {
                  const normal = products.find((p) => p._id === r.product)?.price;
                  return (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center">
                      <select aria-label={`Product ${i + 1}`} className={inputCls} value={r.product} onChange={(e) => pick(i, e.target.value)}>
                        <option value="">Choose a product</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Price ${i + 1}`}
                        type="number"
                        min="0"
                        step="any"
                        className={inputCls}
                        placeholder="Price ₹"
                        title={normal != null ? `Normal price ${money(normal)}` : undefined}
                        value={r.price}
                        onChange={(e) => setRow(i, { price: e.target.value })}
                      />
                      <button
                        type="button"
                        aria-label={`Remove row ${i + 1}`}
                        disabled={form.items.length === 1}
                        onClick={() => setForm({ ...form, items: form.items.filter((_, k) => k !== i) })}
                        className="p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {normal != null && <p className="col-span-3 -mt-1 text-[11px] text-gray-500">Normal price {money(normal)}</p>}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, items: [...form.items, { product: "", price: "" }] })}
                className="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#024BAB]"
              >
                <Plus className="w-3.5 h-3.5" /> Add product
              </button>
            </div>
            <SaveBar saving={saving} onCancel={() => setOpen(false)} label={editId ? "Save changes" : "Create price book"} />
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
