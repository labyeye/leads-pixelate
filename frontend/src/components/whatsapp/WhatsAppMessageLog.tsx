import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Loader2,
  Search,
  RefreshCw,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Percent,
} from "lucide-react";
import { whatsappAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-gray-100 text-gray-700",
  DELIVERED: "bg-green-100 text-green-700",
  READ: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
};
const SOURCE_LABEL: Record<string, string> = {
  chat: "Chat",
  campaign: "Campaign",
  quotation: "Quotation",
  automation: "Automation",
};
const fmt = (d?: string | null) => (d ? format(new Date(d), "dd MMM, hh:mm a") : "—");

export default function WhatsAppMessageLog() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { days, page: String(page), limit: "25" };
      if (status) params.status = status;
      if (source) params.source = source;
      if (query) params.search = query;
      setData(await whatsappAPI.getMessageLogs(params));
    } finally {
      setLoading(false);
    }
  }, [days, page, status, source, query]);

  useEffect(() => {
    load();
  }, [load]);

  const ins = data?.insights;
  const cards = [
    { label: "Messages sent", value: ins?.total ?? 0, sub: `last ${days} days`, icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Delivered", value: ins?.delivered ?? 0, sub: `${ins?.deliveryRate ?? 0}% delivery rate`, icon: CheckCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Read", value: ins?.read ?? 0, sub: `${ins?.readRate ?? 0}% of delivered`, icon: Eye, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Failed", value: ins?.failed ?? 0, sub: `${ins?.failureRate ?? 0}% failure rate`, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Replies received", value: ins?.replies ?? 0, sub: "incoming messages", icon: Percent, color: "text-orange-600", bg: "bg-orange-50" },
  ];
  const daily: any[] = (ins?.daily || []).slice(-14);
  const maxDay = Math.max(1, ...daily.map((d) => d.sent));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={cn("border-2 border-black p-4", c.bg)}>
            <div className="flex items-center gap-2">
              <c.icon className={cn("w-4 h-4", c.color)} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className={cn("text-2xl font-medium mt-1", c.color)}>{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {daily.length > 0 && (
        <div className="border-2 border-black bg-white p-4">
          <p className="text-sm font-medium mb-3">Daily messages (read / delivered / other)</p>
          <div className="flex items-end gap-1.5 h-28">
            {daily.map((d) => {
              const h = (n: number) => `${(n / maxDay) * 100}%`;
              const deliveredOnly = d.delivered - d.read;
              const rest = d.sent - d.delivered;
              return (
                <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date}: ${d.sent} sent, ${d.delivered} delivered, ${d.read} read, ${d.failed} failed`}>
                  <div style={{ height: h(rest) }} className="bg-gray-300" />
                  <div style={{ height: h(deliveredOnly) }} className="bg-green-500" />
                  <div style={{ height: h(d.read) }} className="bg-blue-500" />
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
            <span><i className="inline-block w-2 h-2 bg-blue-500 mr-1" />Read</span>
            <span><i className="inline-block w-2 h-2 bg-green-500 mr-1" />Delivered</span>
            <span><i className="inline-block w-2 h-2 bg-gray-300 mr-1" />Sent / failed</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search phone, name, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setQuery(search);
              }
            }}
            className="pl-9 h-9 w-64 text-sm"
          />
        </div>
        {[
          { v: status, set: setStatus, opts: [["", "All statuses"], ["SENT", "Sent"], ["DELIVERED", "Delivered"], ["READ", "Read"], ["FAILED", "Failed"]] },
          { v: source, set: setSource, opts: [["", "All sources"], ["chat", "Chat"], ["campaign", "Campaign"], ["quotation", "Quotation"], ["automation", "Automation"]] },
          { v: days, set: setDays, opts: [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last year"]] },
        ].map((f, i) => (
          <select
            key={i}
            className="h-9 border-2 border-black bg-white px-2 text-sm"
            value={f.v}
            onChange={(e) => {
              setPage(1);
              f.set(e.target.value);
            }}
          >
            {f.opts.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ))}
        <Button variant="outline" size="sm" onClick={load} className="ml-auto gap-1.5 h-9 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="border-2 border-black bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide">
            <tr>
              {["Recipient", "Message", "Source", "Status", "Sent", "Delivered", "Read"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No messages found.</td></tr>
            ) : (
              data.data.map((r: any) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="font-medium">{r.name || r.phone}</p>
                    {r.name && <p className="text-xs text-muted-foreground">{r.phone}</p>}
                  </td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <p className="truncate">{r.text || r.campaign || "—"}</p>
                    {r.error && <p className="text-xs text-red-600 truncate">{r.error}</p>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {SOURCE_LABEL[r.source] || r.source}
                    {r.campaign && r.text && <span className="block text-xs text-muted-foreground">{r.campaign}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("px-2 py-0.5 text-xs font-medium border border-black", STATUS_STYLE[r.status])}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmt(r.sentAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmt(r.deliveredAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmt(r.readAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data.total} messages · page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
