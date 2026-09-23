import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { trashAPI } from "@/services/api";
import { useNotify } from "@/components/ui/Notification";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RotateCcw, Trash2 } from "lucide-react";

export default function TrashPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const res = await trashAPI.list();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      notify.error("Failed to load trash", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function act(kind: "restore" | "purge", item: any) {
    if (
      kind === "purge" &&
      !window.confirm(`Permanently delete "${item.title}"? This cannot be undone.`)
    )
      return;
    try {
      await (kind === "restore"
        ? trashAPI.restore(item.type, item._id)
        : trashAPI.purge(item.type, item._id));
      notify.success(
        kind === "restore" ? `${item.label} restored` : `${item.label} permanently deleted`,
        item.title,
      );
      setItems((l) => l.filter((x) => x._id !== item._id));
    } catch (e: any) {
      notify.error("Action failed", e.message);
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout title="Trash">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-xl uppercase tracking-widest mb-1">Trash</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Deleted leads, clients, products, services, quotations and campaigns stay here until you restore them or delete them permanently.
        </p>
        <div className="border-2 border-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-widest">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Item</th>
                <th className="p-3">Deleted</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="p-4 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-muted-foreground">Trash is empty.</td></tr>
              )}
              {items.map((l) => (
                <tr key={`${l.type}-${l._id}`} className="border-t border-border">
                  <td className="p-3 text-xs font-black uppercase">{l.label}</td>
                  <td className="p-3">
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.sub}</div>
                  </td>
                  <td className="p-3">
                    <div>{new Date(l.deletedAt).toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.deletedBy?.name ? `by ${l.deletedBy.name}` : ""}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => act("restore", l)}
                        className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-black uppercase hover:bg-emerald-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      <button
                        onClick={() => act("purge", l)}
                        className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-black uppercase text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete forever
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
