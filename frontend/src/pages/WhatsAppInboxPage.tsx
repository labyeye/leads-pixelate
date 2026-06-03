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
  Phone,
  Building2,
  MessageCircle,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Reply {
  _id: string;
  campaignId: string;
  campaignName: string;
  leadName?: string;
  phone: string;
  messageText: string;
  receivedAt: string;
}

export default function WhatsAppInboxPage() {
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Reply | null>(null);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getReplies();
      setReplies(res.data || []);
    } catch {
      toast({ title: "Failed to load inbox", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const filtered = replies.filter(
    (r) =>
      (r.leadName || r.phone).toLowerCase().includes(search.toLowerCase()) ||
      r.messageText.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by phone — show latest message per contact
  const grouped = Object.values(
    filtered.reduce((acc: Record<string, Reply>, r) => {
      if (
        !acc[r.phone] ||
        new Date(r.receivedAt) > new Date(acc[r.phone].receivedAt)
      ) {
        acc[r.phone] = r;
      }
      return acc;
    }, {}),
  ).sort(
    (a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );

  const threadMessages = selected
    ? replies
        .filter((r) => r.phone === selected.phone)
        .sort(
          (a, b) =>
            new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
        )
    : [];

  return (
    <AppLayout title="WhatsApp Inbox">
      <div className="flex h-full overflow-hidden">
        {/* Left — contacts list */}
        <div
          className={cn(
            "flex flex-col border-r-2 border-black bg-white shrink-0",
            selected ? "hidden md:flex w-80" : "flex w-full md:w-80",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-[#25D366]">
            <FontAwesomeIcon icon={faWhatsapp} className="text-white text-xl" />
            <h1 className="text-base font-bold text-white">Inbox</h1>
            <button
              onClick={fetchReplies}
              className="ml-auto text-white/80 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                <FontAwesomeIcon
                  icon={faWhatsapp}
                  className="text-4xl text-gray-200"
                />
                <p className="text-sm text-muted-foreground">No replies yet.</p>
                <p className="text-xs text-muted-foreground">
                  Customer replies will appear here.
                </p>
              </div>
            ) : (
              grouped.map((r) => (
                <button
                  key={r.phone}
                  onClick={() => setSelected(r)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 border-b border-gray-100 text-left transition-colors hover:bg-[#25D366]/5",
                    selected?.phone === r.phone &&
                      "bg-[#25D366]/10 border-l-4 border-l-[#25D366]",
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#25D366]/10 border-2 border-[#25D366]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-[#25D366]">
                      {(r.leadName || r.phone)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {r.leadName || r.phone}
                      </p>
                      <p className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(r.receivedAt), "h:mm a")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {r.messageText}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right — conversation thread */}
        {selected ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-white shrink-0">
              <button
                onClick={() => setSelected(null)}
                className="md:hidden text-muted-foreground hover:text-foreground mr-1"
              >
                ← Back
              </button>
              <div className="w-9 h-9 rounded-full bg-[#25D366]/10 border-2 border-[#25D366]/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#25D366]">
                  {(selected.leadName || selected.phone)[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selected.leadName || selected.phone}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {selected.phone}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 px-2 py-0.5 rounded-full font-medium">
                  {threadMessages.length} message
                  {threadMessages.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ background: "#f0f2f5" }}
            >
              {threadMessages.map((msg) => (
                <div key={msg._id} className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md">
                    <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                      <p className="text-sm text-gray-800">{msg.messageText}</p>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">
                        {format(new Date(msg.receivedAt), "dd MMM, h:mm a")}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      via {msg.campaignName}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply note */}
            <div className="px-4 py-3 border-t-2 border-black bg-white shrink-0">
              <div className="flex items-center gap-2 bg-[#FFF3CD] border border-[#FFCC00] rounded-lg px-3 py-2">
                <FontAwesomeIcon
                  icon={faWhatsapp}
                  className="text-[#25D366] shrink-0"
                />
                <p className="text-xs text-gray-700">
                  To reply, open the lead and use{" "}
                  <strong>Send WhatsApp Message</strong> button. Free text
                  replies work within 24h of last customer message.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5]">
            <div className="text-center">
              <FontAwesomeIcon
                icon={faWhatsapp}
                className="text-7xl text-gray-200 mb-4"
              />
              <p className="text-sm font-medium text-gray-400">
                Select a conversation to view
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
