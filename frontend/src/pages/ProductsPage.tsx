import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Package,
  CheckCircle2,
  Archive,
  ImageIcon,
  X,
  Upload,
  Download,
  IndianRupee,
} from "lucide-react";
import { useState, useEffect } from "react";
import { productsAPI, uploadAPI } from "@/services/api";
import { ImportProductsDialog, PRODUCT_HEADERS } from "@/components/products/ImportProductsDialog";
import { downloadXLSX } from "@/lib/tableExport";
import { useNotify } from "@/components/ui/Notification";
import { usePermission } from "@/hooks/usePermission";

const PHOTO_MAX_MB = 5;
const MAX_PHOTOS = 5;
const UNITS = ["pcs", "kg", "box", "meter", "liter", "set", "hour"];

const DEFAULT_CATEGORIES = [
  "Machines",
  "Services",
  "Raw Materials",
  "Spare Parts",
];

const NEW_CATEGORY = "__new__";

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
  photos: [] as string[],
  sku: "",
  unit: "pcs",
  stockQuantity: "",
  taxRate: "18",
};

export default function ProductsPage() {
  const { can } = usePermission();
  const notify = useNotify();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...initialForm });
  const [customCat, setCustomCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await productsAPI.getAll();
      setProducts(res.data || []);
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...initialForm });
    setCustomCat(false);
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditId(item._id);
    setCustomCat(false);
    setForm({
      name: item.name || "",
      category: item.category || "Machines",
      price: item.price?.toString() || "",
      hsnCode: item.hsnCode || "",
      status: item.status || "Active",
      description: item.description || "",
      photos: item.photos?.length
        ? item.photos
        : item.photoUrl
          ? [item.photoUrl]
          : [],
      sku: item.sku || "",
      unit: item.unit || "pcs",
      stockQuantity: item.stockQuantity?.toString() || "",
      taxRate: item.taxRate?.toString() ?? "18",
    });
    setModalOpen(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = "";
    if (!chosen.length) return;
    const room = MAX_PHOTOS - form.photos.length;
    if (chosen.length > room) {
      notify.error(
        "Too Many Photos",
        `You can add ${room} more (max ${MAX_PHOTOS} per product).`,
      );
    }
    const files = chosen.slice(0, room);
    const tooBig = files.filter((f) => f.size > PHOTO_MAX_MB * 1024 * 1024);
    if (tooBig.length) {
      notify.error(
        "Photo Too Large",
        `${tooBig.map((f) => f.name).join(", ")} over ${PHOTO_MAX_MB}MB, skipped.`,
      );
    }
    try {
      setUploadingPhoto(true);
      const urls: string[] = [];
      for (const f of files.filter(
        (f) => f.size <= PHOTO_MAX_MB * 1024 * 1024,
      )) {
        urls.push((await uploadAPI.upload(f)).url);
      }
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, ...urls].slice(0, MAX_PHOTOS),
      }));
    } catch (err: any) {
      notify.error("Photo Upload Failed", err.message);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm({ ...initialForm });
    setCustomCat(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify.error("Product Name is required");
      return;
    }
    if (!form.category.trim()) {
      notify.error(
        "Category is required",
        "Pick one or type a new category name.",
      );
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      notify.error("Invalid Price", "Price must be greater than 0.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        category: form.category.trim(),
        photoUrl: form.photos[0] || "",
        price: Number(form.price),
        stockQuantity:
          form.stockQuantity === "" ? 0 : Number(form.stockQuantity),
        taxRate: form.taxRate === "" ? 0 : Number(form.taxRate),
      };
      if (editId) {
        await productsAPI.update(editId, payload);
        notify.success("Product Updated", `"${form.name}" has been updated.`);
      } else {
        await productsAPI.create(payload);
        notify.success(
          "Product Added",
          `"${form.name}" has been added to the catalog.`,
        );
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      notify.error("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      setDeletingId(id);
      await productsAPI.delete(id);
      notify.success("Product Deleted", "The product has been removed.");
      fetchProducts();
    } catch (err: any) {
      notify.error("Delete Failed", err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Built-in categories plus any custom one already used on a product.
  const CATEGORIES = [
    ...DEFAULT_CATEGORIES,
    ...Array.from(
      new Set(products.map((p) => p.category).filter(Boolean)),
    ).filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  const filtered = products.filter((p) => {
    const matchSearch =
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  // Image URL is always exported (never optional), same columns as the import template.
  const exportProducts = () =>
    downloadXLSX(
      "products.xlsx",
      PRODUCT_HEADERS,
      filtered.map((p) => [
        p.name || "",
        p.category || "",
        p.price ?? 0,
        p.unit || "pcs",
        p.stockQuantity ?? 0,
        p.taxRate ?? 18,
        p.hsnCode || "",
        p.sku || "",
        p.status || "Active",
        p.description || "",
        (p.photos?.length ? p.photos : p.photoUrl ? [p.photoUrl] : []).join(", "),
      ]),
      "Products",
    );

  const totalActive = products.filter((p) => p.status === "Active").length;
  // Stock on hand valued at the selling price (products have no cost price); inactive items excluded.
  const inventoryValue = products
    .filter((p) => p.status !== "Inactive")
    .reduce((t, p) => t + (p.price || 0) * (p.stockQuantity || 0), 0);
  const totalInactive = products.filter((p) => p.status === "Inactive").length;

  return (
    <AppLayout title="Products">
      <div className="space-y-4">
        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            title="Total Products"
            value={loading ? "—" : products.length}
            icon={Package}
            bg="bg-[#024BAB]"
          />
          <KpiCard
            title="Active"
            value={loading ? "—" : totalActive}
            icon={CheckCircle2}
            bg="bg-[#00C48C]"
          />
          <KpiCard
            title="Inactive"
            value={loading ? "—" : totalInactive}
            icon={Archive}
            bg="bg-gray-300"
          />
          <KpiCard
            title="Inventory Value"
            value={loading ? "—" : `₹${inventoryValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            icon={IndianRupee}
            bg="bg-[#FFDE00]"
          />
        </div>

        {}
        <div className="flex flex-wrap items-center gap-2">
          {}
          <div className="flex items-center gap-2 border-2 border-black px-3 h-10 bg-white flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full font-medium placeholder:text-gray-400"
            />
          </div>

          {}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-10 border-2 border-black px-3 text-xs font-black uppercase tracking-widest bg-white outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              onClick={exportProducts}
              disabled={filtered.length === 0}
              className="flex items-center justify-center gap-1.5 h-10 px-4 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            {can("Products", "create") && (
              <>
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex items-center justify-center gap-1.5 h-10 px-4 bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-black"
                >
                  <Upload className="w-3.5 h-3.5" /> Import
                </button>
                <button
                  onClick={openAdd}
                  className="flex items-center justify-center gap-1.5 h-10 px-4 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
              </>
            )}
          </div>
        </div>

        {}
        <div className="border-2 border-black bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#024BAB] text-white">
                  {[
                    "#",
                    "Photo",
                    "Product Name",
                    "SKU",
                    "Category",
                    "Price",
                    "Stock",
                    "HSN/SAC",
                    "Description",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      title={
                        h === "HSN/SAC"
                          ? "HSN code for goods, SAC code for services — used for GST billing"
                          : undefined
                      }
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
                    <td colSpan={10} className="text-center py-16">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#024BAB]" />
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-2">
                        Loading...
                      </p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16">
                      <Package className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                      <p className="text-sm font-black uppercase tracking-widest text-gray-400">
                        {search
                          ? "No products match your search"
                          : "No products yet"}
                      </p>
                      {!search && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                            Products you add here can be attached to quotations
                            and sales orders.
                          </p>
                          {can("Products", "create") && (
                            <button
                              onClick={openAdd}
                              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Your First
                              Product
                            </button>
                          )}
                        </>
                      )}
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

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="w-10 h-10 border-2 border-black bg-gray-50 flex items-center justify-center overflow-hidden">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-gray-300" />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-black text-black whitespace-nowrap">
                        {item.name}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-600">
                        {item.sku || (
                          <span className="text-gray-300 italic">—</span>
                        )}
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

                      <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-black">
                        {item.stockQuantity ?? 0} {item.unit || "pcs"}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.hsnCode ? (
                          <span className="text-[10px] font-black font-mono tracking-wider bg-gray-100 border border-gray-300 px-2 py-1 text-gray-700">
                            {item.hsnCode}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic text-xs">
                            —
                          </span>
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
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white hover:bg-[#024BAB] hover:text-white transition-colors hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {can("Products", "delete") && (
                            <button
                              onClick={() => handleDelete(item._id)}
                              disabled={deletingId === item._id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-white text-red-600 hover:bg-red-600 hover:text-white transition-colors hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
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
            <div className="border-t-2 border-black px-4 py-2 bg-gray-50 text-black text-[10px] font-black uppercase tracking-widest flex justify-between">
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

      {}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border-2 border-black w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            {}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-[#024BAB]">
              <p className="text-sm font-black uppercase tracking-widest text-white">
                {editId ? "Edit Product" : "Add New Product"}
              </p>
              <button
                onClick={closeModal}
                className="text-white hover:text-orange-300 font-black text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                  Photos ({form.photos.length}/{MAX_PHOTOS})
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {form.photos.map((url, i) => (
                    <div
                      key={url}
                      className="relative w-16 h-16 border-2 border-black bg-gray-50 overflow-hidden"
                    >
                      <img
                        src={url}
                        alt={`Product ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            photos: form.photos.filter((_, k) => k !== i),
                          })
                        }
                        className="absolute top-0 right-0 p-0.5 bg-white border-l-2 border-b-2 border-black text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] font-black uppercase text-center">
                          Main
                        </span>
                      )}
                    </div>
                  ))}
                  {form.photos.length < MAX_PHOTOS && (
                    <label className="w-16 h-16 border-2 border-dashed border-black bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                      {uploadingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        disabled={uploadingPhoto}
                        onChange={handlePhotoChange}
                      />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Up to {MAX_PHOTOS} photos · PNG, JPG, WebP or GIF · max{" "}
                  {PHOTO_MAX_MB}MB each · first photo shows in the table
                </p>
              </div>

              {}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Offset Printing Machine"
                    maxLength={120}
                    required
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    SKU / Product Code{" "}
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="e.g. OPM-2024-01"
                    maxLength={40}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={customCat ? NEW_CATEGORY : form.category}
                    onChange={(e) => {
                      const isNew = e.target.value === NEW_CATEGORY;
                      setCustomCat(isNew);
                      setForm({
                        ...form,
                        category: isNew ? "" : e.target.value,
                      });
                    }}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ Add new category…</option>
                  </select>
                  {customCat && (
                    <input
                      autoFocus
                      maxLength={40}
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      placeholder="New category name"
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white mt-2"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99999999"
                    step="any"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="0"
                    required
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
              </div>
              {}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white cursor-pointer"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="9999999"
                    step="any"
                    value={form.stockQuantity}
                    onChange={(e) =>
                      setForm({ ...form, stockQuantity: e.target.value })
                    }
                    placeholder="0"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm({ ...form, taxRate: e.target.value })
                    }
                    placeholder="18"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-1">
                    HSN / SAC Code{" "}
                    <span className="text-gray-400 font-medium normal-case">
                      (for GST)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.hsnCode}
                    onChange={(e) =>
                      setForm({ ...form, hsnCode: e.target.value })
                    }
                    placeholder="e.g. 998315"
                    maxLength={10}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  />
                </div>
              </div>

              {}

              {}
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
                          : "bg-white text-black hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {}
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
                  maxLength={500}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none focus:border-[#024BAB] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all resize-none"
                />
                <p className="text-[10px] text-gray-500 text-right mt-0.5">
                  {form.description.length}/500
                </p>
              </div>

              {}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest border-2 border-black bg-white hover:bg-gray-100 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest border-2 border-black bg-[#FA731C] text-white hover:bg-[#e8661a] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editId ? "Update" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchProducts} />
    </AppLayout>
  );
}
