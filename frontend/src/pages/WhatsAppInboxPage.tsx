import { AppLayout } from "@/components/layout/AppLayout";
import { whatsappAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  RefreshCw,
  Send,
  UserPlus,
  Check,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Message {
  _id: string;
  direction: "in" | "out";
  text: string;
  status?: "SENT" | "DELIVERED" | "READ" | "FAILED";
  timestamp: string;
}

interface Conversation {
  phone: string;
  name: string;
  leadId: string | null;
  messages: Message[];
  lastMessage: Message;
  lastInboundAt: string | null;
}

const dayLabel = (d: Date) =>
  isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "dd MMMM yyyy");

const listTime = (d: Date) =>
  isToday(d) ? format(d, "h:mm a") : isYesterday(d) ? "Yesterday" : format(d, "dd/MM/yy");

function Ticks({ status }: { status?: Message["status"] }) {
  if (status === "FAILED") return <span className="text-red-500 text-[10px]">failed</span>;
  if (status === "DELIVERED" || status === "READ")
    return (
      <CheckCheck
        className={cn("w-3.5 h-3.5", status === "READ" ? "text-sky-500" : "text-gray-400")}
      />
    );
  return <Check className="w-3.5 h-3.5 text-gray-400" />;
}

export default function WhatsAppInboxPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [senderId, setSenderId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConvos = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await whatsappAPI.getConversations();
        setConvos(res.data || []);
      } catch {
        if (!silent) toast({ title: "Failed to load inbox", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchConvos();
    const t = setInterval(() => fetchConvos(true), 15000);
    whatsappAPI
      .getStatus()
      .then((r) => setSenderId(r.data?.phoneNumbers?.[0]?.phoneNumberId || ""))
      .catch(() => {});
    return () => clearInterval(t);
  }, [fetchConvos]);

  const selected = convos.find((c) => c.phone === selectedPhone) || null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [selected?.messages.length, selectedPhone]);

  const q = search.toLowerCase();
  const filtered = convos.filter(
    (c) =>
      (c.name || c.phone).toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.messages.some((m) => m.text.toLowerCase().includes(q)),
  );

  const windowOpen =
    !!selected?.lastInboundAt &&
    Date.now() - new Date(selected.lastInboundAt).getTime() < 24 * 3600 * 1000;

  const send = async () => {
    const text = draft.trim();
    if (!selected || !text || sending) return;
    setSending(true);
    try {
      await whatsappAPI.replyToConversation({
        phone: selected.phone,
        text,
        phoneNumberId: senderId || undefined,
      });
      setDraft("");
      await fetchConvos(true);
    } catch (e: any) {
      toast({
        title: "Message not sent",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const convert = async () => {
    if (!selected) return;
    setConverting(true);
    try {
      const res = await whatsappAPI.convertToLead({
        phone: selected.phone,
        name: selected.name,
      });
      toast({ title: "Converted to lead" });
      await fetchConvos(true);
      navigate("/leads");
    } catch (e: any) {
      toast({
        title: "Could not convert",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const title = (c: Conversation) => c.name || `+${c.phone}`;

  return (
    <AppLayout title="WhatsApp Inbox">
      <div className="flex h-full overflow-hidden">
        <div
          className={cn(
            "flex flex-col border-r border-gray-200 bg-white shrink-0",
            selected ? "hidden md:flex w-96" : "flex w-full md:w-96",
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f2f5]">
            <FontAwesomeIcon icon={faWhatsapp} className="text-[#25D366] text-xl" />
            <h1 className="text-base font-medium">Chats</h1>
            <button
              onClick={() => fetchConvos()}
              className="ml-auto text-gray-500 hover:text-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <Input
                placeholder="Search or start new chat"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-[#f0f2f5] border-0 rounded-lg"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16 px-6">
                No chats yet. Customer replies will appear here.
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setSelectedPhone(c.phone)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[#f5f6f6]",
                    selectedPhone === c.phone && "bg-[#f0f2f5]",
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 text-lg text-gray-600">
                    {title(c).replace("+", "")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 border-b border-gray-100 pb-3 -mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] truncate">{title(c)}</p>
                      <p className="text-xs text-gray-500 shrink-0">
                        {listTime(new Date(c.lastMessage.timestamp))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {c.lastMessage.direction === "out" && (
                        <Ticks status={c.lastMessage.status} />
                      )}
                      <p className="text-sm text-gray-500 truncate">
                        {c.lastMessage.text}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selected ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] shrink-0">
              <button
                onClick={() => setSelectedPhone(null)}
                className="md:hidden text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 text-gray-600">
                {title(selected).replace("+", "")[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] truncate">{title(selected)}</p>
                <p className="text-xs text-gray-500">+{selected.phone}</p>
              </div>
              <div className="ml-auto">
                {selected.leadId ? (
                  <button
                    onClick={() => navigate("/leads")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    View lead
                  </button>
                ) : (
                  <button
                    onClick={convert}
                    disabled={converting}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#1fb855] disabled:opacity-60"
                  >
                    {converting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    Convert to Lead
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-4 md:px-[8%] py-4 space-y-1"
              style={{ background: "#efeae2" }}
            >
              {selected.messages.map((m, i) => {
                const d = new Date(m.timestamp);
                const prev = selected.messages[i - 1];
                const out = m.direction === "out";
                return (
                  <div key={m._id}>
                    {(!prev || !isSameDay(d, new Date(prev.timestamp))) && (
                      <div className="flex justify-center my-3">
                        <span className="text-xs bg-white/90 text-gray-600 px-3 py-1 rounded-lg shadow-sm">
                          {dayLabel(d)}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm",
                          out ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none",
                        )}
                      >
                        <p className="text-[14.5px] text-gray-900 whitespace-pre-wrap break-words">
                          {m.text}
                          <span className="inline-block w-16" />
                        </p>
                        <div className="flex items-center justify-end gap-1 -mt-4">
                          <span className="text-[11px] text-gray-500">
                            {format(d, "h:mm a")}
                          </span>
                          {out && <Ticks status={m.status} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 py-2.5 bg-[#f0f2f5] shrink-0">
              {windowOpen ? (
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message"
                    className="flex-1 resize-none max-h-32 rounded-lg bg-white px-4 py-2.5 text-sm outline-none"
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim() || sending}
                    className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center disabled:opacity-50 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-2">
                  The 24-hour reply window has closed. Free-text replies are only
                  allowed within 24h of the customer's last message — send a
                  template from the lead instead.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5]">
            <div className="text-center">
              <FontAwesomeIcon icon={faWhatsapp} className="text-7xl text-gray-300 mb-4" />
              <p className="text-lg text-gray-500">WhatsApp Inbox</p>
              <p className="text-sm text-gray-400 mt-1">
                Select a chat to read and reply.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
