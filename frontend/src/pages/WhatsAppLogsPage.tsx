import { AppLayout } from "@/components/layout/AppLayout";
import { whatsappAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  RefreshCw,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Users,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Campaign {
  _id: string;
  name: string;
  status: string;
  templateSnapshot?: { displayName: string; bodyText?: string };
  template?: { displayName: string; bodyText?: string };
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  fromPhoneNumberId?: string;
  createdAt: string;
  sentAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  SENDING: "bg-blue-100 text-blue-700 border-blue-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  PARTIAL: "bg-orange-100 text-orange-700 border-orange-200",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function WhatsAppLogsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getCampaigns();
      setCampaigns(res.data || []);
    } catch {
      toast({ title: "Failed to load logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleDetail = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setLoadingDetail(true);
    try {
      const res = await whatsappAPI.getCampaign(id);
      setDetail(res.data);
    } catch {
      toast({ title: "Failed to load details", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  const filtered = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.template?.displayName || c.templateSnapshot?.displayName || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const totalRead = campaigns.reduce((s, c) => s + c.readCount, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.repliedCount, 0);

  return (
    <AppLayout title="WhatsApp Logs">
      <div className="flex flex-col h-full overflow-hidden">
        {}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-black bg-white shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 border-2 border-[#25D366]/20 flex items-center justify-center">
            <FontAwesomeIcon
              icon={faWhatsapp}
              className="text-[#25D366] text-lg"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold">WhatsApp Logs</h1>
            <p className="text-xs text-muted-foreground">
              All campaigns, delivery & read status
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaigns}
            className="ml-auto gap-1.5 h-8 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 pb-0">
            {[
              {
                label: "Total Sent",
                value: totalSent,
                icon: Send,
                color: "text-blue-600",
                bg: "bg-blue-50 border-blue-200",
              },
              {
                label: "Delivered",
                value: totalDelivered,
                icon: CheckCheck,
                color: "text-green-600",
                bg: "bg-green-50 border-green-200",
              },
              {
                label: "Read",
                value: totalRead,
                icon: Eye,
                color: "text-purple-600",
                bg: "bg-purple-50 border-purple-200",
              },
              {
                label: "Replied",
                value: totalReplied,
                icon: MessageCircle,
                color: "text-orange-600",
                bg: "bg-orange-50 border-orange-200",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  "rounded-xl border-2 border-black p-4 flex items-center gap-3",
                  s.bg,
                )}
              >
                <s.icon className={cn("w-5 h-5 shrink-0", s.color)} />
                <div>
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {}
          <div className="px-6 pt-4 pb-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {}
          <div className="px-6 pb-6 space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FontAwesomeIcon
                  icon={faWhatsapp}
                  className="text-5xl text-gray-200"
                />
                <p className="text-sm text-muted-foreground">
                  No campaigns yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Send messages from Lead details to see logs here.
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const isOpen = expanded === c._id;
                const deliveryPct =
                  c.totalCount > 0
                    ? Math.round((c.deliveredCount / c.totalCount) * 100)
                    : 0;
                const readPct =
                  c.totalCount > 0
                    ? Math.round((c.readCount / c.totalCount) * 100)
                    : 0;

                return (
                  <div
                    key={c._id}
                    className="border-2 border-black rounded-xl overflow-hidden bg-white nb-shadow-sm"
                  >
                    <button
                      onClick={() => toggleDetail(c._id)}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FontAwesomeIcon
                              icon={faWhatsapp}
                              className="text-[#25D366] shrink-0"
                            />
                            <span className="font-bold text-sm">{c.name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                STATUS_COLORS[c.status],
                              )}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.template?.displayName ||
                              c.templateSnapshot?.displayName ||
                              "—"}{" "}
                            ·{" "}
                            {c.sentAt
                              ? format(
                                  new Date(c.sentAt),
                                  "dd MMM yyyy, h:mm a",
                                )
                              : format(new Date(c.createdAt), "dd MMM yyyy")}
                          </p>

                          {}
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            {[
                              {
                                icon: Users,
                                val: c.totalCount,
                                label: "Total",
                                color: "text-gray-600",
                              },
                              {
                                icon: Send,
                                val: c.sentCount,
                                label: "Sent",
                                color: "text-blue-600",
                              },
                              {
                                icon: CheckCheck,
                                val: c.deliveredCount,
                                label: "Delivered",
                                color: "text-green-600",
                              },
                              {
                                icon: Eye,
                                val: c.readCount,
                                label: "Read",
                                color: "text-purple-600",
                              },
                              {
                                icon: XCircle,
                                val: c.failedCount,
                                label: "Failed",
                                color: "text-red-500",
                              },
                              {
                                icon: MessageCircle,
                                val: c.repliedCount,
                                label: "Replies",
                                color: "text-orange-500",
                              },
                            ].map((s) => (
                              <span
                                key={s.label}
                                className={cn(
                                  "flex items-center gap-1 text-xs",
                                  s.color,
                                )}
                              >
                                <s.icon className="w-3 h-3" />
                                <span className="font-bold">{s.val}</span>
                                <span className="text-muted-foreground">
                                  {s.label}
                                </span>
                              </span>
                            ))}
                          </div>

                          {}
                          {c.totalCount > 0 && (
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                              <div
                                className="bg-blue-500 h-full"
                                style={{
                                  width: `${(c.sentCount / c.totalCount) * 100}%`,
                                }}
                              />
                              <div
                                className="bg-green-500 h-full"
                                style={{
                                  width: `${(c.deliveredCount / c.totalCount) * 100}%`,
                                }}
                              />
                              <div
                                className="bg-purple-500 h-full"
                                style={{
                                  width: `${(c.readCount / c.totalCount) * 100}%`,
                                }}
                              />
                              <div
                                className="bg-red-400 h-full"
                                style={{
                                  width: `${(c.failedCount / c.totalCount) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-[#25D366]">
                            {deliveryPct}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            delivered
                          </p>
                          <p className="text-sm font-bold text-purple-600 mt-1">
                            {readPct}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            read
                          </p>
                          <div className="mt-2">
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {}
                    {isOpen && (
                      <div className="border-t-2 border-black bg-gray-50 px-5 py-4">
                        {loadingDetail ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : detail ? (
                          <div className="overflow-x-auto">
                            {(detail.template?.bodyText ||
                              detail.templateSnapshot?.bodyText) && (
                              <div className="mb-4 bg-primary/5 border border-primary/10 rounded-xl p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                  Template Preview
                                </p>
                                <div className="relative bg-white border-2 border-secondary/30 rounded-xl rounded-tl-sm p-3 shadow-sm max-w-md">
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                    {detail.template?.bodyText ||
                                      detail.templateSnapshot?.bodyText}
                                  </p>
                                </div>
                              </div>
                            )}
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-muted-foreground border-b border-gray-200">
                                  <th className="text-left pb-2 pr-4 font-semibold">
                                    Lead
                                  </th>
                                  <th className="text-left pb-2 pr-4 font-semibold">
                                    Phone
                                  </th>
                                  <th className="text-left pb-2 pr-4 font-semibold">
                                    Status
                                  </th>
                                  <th className="text-left pb-2 font-semibold">
                                    Time
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(detail.messages || []).map((msg: any) => (
                                  <tr key={msg._id}>
                                    <td className="py-2 pr-4">
                                      <p className="font-medium text-xs">
                                        {msg.leadName}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {msg.leadCompany}
                                      </p>
                                    </td>
                                    <td className="py-2 pr-4 text-xs font-mono text-muted-foreground">
                                      {msg.phone}
                                    </td>
                                    <td className="py-2 pr-4">
                                      <MsgStatusBadge status={msg.status} />
                                      {msg.failedReason && (
                                        <p className="text-[10px] text-red-500 mt-0.5">
                                          {msg.failedReason}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-2 text-xs text-muted-foreground">
                                      {msg.readAt
                                        ? format(new Date(msg.readAt), "h:mm a")
                                        : msg.deliveredAt
                                          ? format(
                                              new Date(msg.deliveredAt),
                                              "h:mm a",
                                            )
                                          : msg.sentAt
                                            ? format(
                                                new Date(msg.sentAt),
                                                "h:mm a",
                                              )
                                            : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MsgStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700",
    READ: "bg-purple-100 text-purple-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-full",
        map[status] || "bg-gray-100 text-gray-600",
      )}
    >
      {status}
    </span>
  );
}
