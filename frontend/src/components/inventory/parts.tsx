import { Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Small pieces shared by the Inventory pages (vendors, price books, orders, invoices),
// styled like the Products page.

export const inputCls =
  "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white focus:border-[#024BAB]";
export const labelCls = "block text-[10px] font-black uppercase tracking-widest text-black mb-1";

export const money = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS_COLOR: Record<string, string> = {
  Active: "bg-green-100 text-green-800 border-green-300",
  Inactive: "bg-gray-100 text-gray-700 border-gray-300",
  Draft: "bg-gray-100 text-gray-700 border-gray-300",
  Sent: "bg-blue-100 text-blue-800 border-blue-300",
  Issued: "bg-blue-100 text-blue-800 border-blue-300",
  Confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  Paid: "bg-green-100 text-green-800 border-green-300",
  Fulfilled: "bg-green-100 text-green-800 border-green-300",
  Received: "bg-green-100 text-green-800 border-green-300",
  Overdue: "bg-red-100 text-red-800 border-red-300",
  Cancelled: "bg-red-100 text-red-800 border-red-300",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-black uppercase tracking-wide px-2 py-1 border whitespace-nowrap",
        STATUS_COLOR[status] || "bg-gray-100 text-gray-700 border-gray-300",
      )}
    >
      {status}
    </span>
  );
}

export function Toolbar({
  search,
  onSearch,
  placeholder,
  addLabel,
  onAdd,
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  addLabel?: string;
  onAdd?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 border-2 border-black px-3 h-10 bg-white flex-1 min-w-[180px] max-w-xs">
        <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <input
          type="text"
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full font-medium placeholder:text-gray-400"
        />
      </div>
      {children}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-1.5 h-10 px-4 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all w-full sm:w-auto sm:ml-auto"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export function DataTable({
  heads,
  loading,
  empty,
  children,
  footer,
}: {
  heads: string[];
  loading: boolean;
  empty: string | null; // message when there are no rows, null when there are rows
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <div className="border-2 border-black bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#024BAB] text-white">
              {heads.map((h) => (
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
                <td colSpan={heads.length} className="text-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin inline text-gray-500" />
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={heads.length} className="text-center py-10 text-sm text-gray-500 font-medium">
                  {empty}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t-2 border-black px-4 py-2 bg-gray-50 text-black text-[10px] font-black uppercase tracking-widest">
          {footer}
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label={title}>
      <div className={cn("bg-white border-2 border-black w-full max-h-[92vh] overflow-y-auto", wide ? "max-w-3xl" : "max-w-md")}>
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-[#024BAB] sticky top-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-white hover:text-orange-300 font-black text-lg leading-none">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SaveBar({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 h-10 border-2 border-black font-black uppercase text-xs tracking-widest bg-white hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex-1 h-10 bg-[#024BAB] text-white font-black uppercase text-xs tracking-widest border-2 border-black disabled:opacity-60 flex items-center justify-center gap-1.5"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
