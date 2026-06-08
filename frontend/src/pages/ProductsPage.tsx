import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { productsAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/usePermission";

const CATEGORIES = [
  "Machines",
  "Services",
  "Raw Materials",
  "Spare Parts",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Machines: "bg-blue-100 text-blue-800 border-blue-300",
  Services: "bg-purple-100 text-purple-800 border-purple-300",
  "Raw Materials": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Spare Parts": "bg-gray-100 text-gray-700 border-gray-300",
};

const initialForm = {
  name: "",
  category: "Machines",
  price: "",
  hsnCode: "",
  status: "Active",
  description: "",
};

export default function ProductsPage() {
  const { can } = usePermission();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await productsAPI.getAll();
      setProducts(res.data || []);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...initialForm });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditId(item._id);
    setForm({
      name: item.name || "",
      category: item.category || "Machines",
      price: item.price?.toString() || "",
      hsnCode: item.hsnCode || "",
      status: item.status || "Active",
      description: item.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm({ ...initialForm });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      toast({
        title: "Validation Error",
        description: "Name and price are required.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form, price: Number(form.price) };
      if (editId) {
        await productsAPI.update(editId, payload);
        toast({ title: "Product updated" });
      } else {
        await productsAPI.create(payload);
        toast({ title: "Product added" });
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      setDeletingId(id);
      await productsAPI.delete(id);
      toast({ title: "Product deleted" });
      fetchProducts();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const totalActive = products.filter((p) => p.status === "Active").length;
  const totalInactive = products.filter((p) => p.status === "Inactive").length;

  return (
    <AppLayout title="Products">
      <div className="space-y-4">
        {/* ── KPI row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Products",
              value: products.length,
              color: "bg-white",
            },
            { label: "Active", value: totalActive, color: "bg-green-50" },
            { label: "Inactive", value: totalInactive, color: "bg-red-50" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={cn(
                "border-2 border-black p-4 shadow-[3px_3px_0px_#000]",
                color,
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {label}
              </p>
              <p className="text-3xl font-black text-black mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 border-2 border-black px-3 h-10 bg-white flex-1 min-w-[180px] max-w-xs shadow-[2px_2px_0px_#000]">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full font-medium placeholder:text-gray-400"
            />
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-10 border-2 border-black px-3 text-xs font-black uppercase tracking-widest bg-white outline-none shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {can("Products", "create") && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 h-10 px-4 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all ml-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_#000]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#024BAB] text-white">
                  {[
                    "#",
                    "Product Name",
                    "Category",
                    "Price",
                    "HSN/SAC",
                    "Description",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-white/10 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-2">
                        Loading...
                      </p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <Package className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                      <p className="text-sm font-black uppercase tracking-widest text-gray-400">
                        No products found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => (
                    <tr
                      key={item._id}
                      className={cn(
                        "border-b-2 border-black last:border-b-0 transition-colors",
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/60",
                      )}
                    >
                      <td className="px-4 py-3 text-xs font-black text-gray-400 w-10">
                        {i + 1}
                      </td>

                      <td className="px-4 py-3 font-black text-black whitespace-nowrap">
                        {item.name}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-wide px-2 py-1 border",
                            CATEGORY_COLORS[item.category] ||
                              "bg-gray-100 text-gray-700 border-gray-300",
                          )}
                        >
                          {item.category}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-black text-black whitespace-nowrap">
                        ₹{(item.price || 0).toLocaleString("en-IN")}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.hsnCode ? (
                          <span className="text-[10px] font-black font-mono tracking-wider bg-gray-100 border border-gray-300 px-2 py-1 text-gray-700">
                            {item.hsnCode}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px]">
                        {item.description ? (
                          <span className="line-clamp-2">
                            {item.description}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-wide px-2 py-1 border-2",
                            item.status === "Active"
                              ? "bg-green-100 text-green-800 border-green-400"
                              : "bg-red-100 text-red-800 border-red-400",
                          )}
                        >
                          {item.status || "Active"}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {can("Products", "update") && (
                            <button
                              onClick={() => openEdit(item)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white hover:bg-[#024BAB] hover:text-white transition-colors shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {can("Products", "delete") && (
                            <button
                              onClick={() => handleDelete(item._id)}
                              disabled={deletingId === item._id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white text-red-600 hover:bg-red-600 hover:text-white transition-colors shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
                            >
                              {deletingId === item._id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="border-t-2 border-black px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest flex justify-between">
              <span>
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              </span>
              <span>
                {totalActive} active · {totalInactive} inactive
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-md mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-[#024BAB]">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">
                {editId ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-orange-300 font-black text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Offset Printing Machine"
                  required
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] shadow-[2px_2px_0px_#000] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                />
              </div>

              {/* Category + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white shadow-[2px_2px_0px_#000] cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="0"
                    required
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] shadow-[2px_2px_0px_#000] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
              </div>

              {/* HSN / SAC Code */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  HSN / SAC Code{" "}
                  <span className="text-gray-400 font-medium normal-case">
                    (for GST invoicing)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.hsnCode}
                  onChange={(e) =>
                    setForm({ ...form, hsnCode: e.target.value })
                  }
                  placeholder="e.g. 998315"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] shadow-[2px_2px_0px_#000] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  {["Active", "Inactive"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={cn(
                        "flex-1 py-2 text-xs font-black uppercase tracking-widest border-2 border-black transition-all",
                        form.status === s
                          ? s === "Active"
                            ? "bg-green-500 text-white shadow-none translate-x-[2px] translate-y-[2px]"
                            : "bg-red-500 text-white shadow-none translate-x-[2px] translate-y-[2px]"
                          : "bg-white text-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Description{" "}
                  <span className="text-gray-400 font-medium normal-case">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Brief description of the product..."
                  rows={3}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] shadow-[2px_2px_0px_#000] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest border-2 border-black bg-white hover:bg-gray-100 shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest border-2 border-black bg-[#FA731C] text-white hover:bg-[#e8661a] shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editId ? "Update" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
