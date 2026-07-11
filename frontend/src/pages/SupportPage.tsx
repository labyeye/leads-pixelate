import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supportAPI } from "@/services/api";
import { LifeBuoy, Plus, Clock, MessageSquare } from "lucide-react";

interface Reply {
  message: string;
  from: "hrms" | "crm";
  senderName: string;
  createdAt: string;
}

interface SupportTicket {
  _id: string;
  ticketId: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  replies: Reply[];
  createdAt: string;
}

const STATUS_STYLES: Record<SupportTicket["status"], string> = {
  open: "bg-amber-100 border-amber-400 text-amber-800",
  in_progress: "bg-[#024BAB]/10 border-[#024BAB] text-[#024BAB]",
  resolved: "bg-emerald-100 border-emerald-500 text-emerald-800",
  closed: "bg-zinc-100 border-zinc-400 text-zinc-600",
};

const PRIORITY_STYLES: Record<SupportTicket["priority"], string> = {
  low: "bg-zinc-100 border-zinc-300 text-zinc-600",
  medium: "bg-blue-50 border-blue-300 text-blue-700",
  high: "bg-orange-50 border-orange-400 text-orange-700",
  critical: "bg-red-50 border-red-400 text-red-700",
};

export default function SupportPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("medium");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => supportAPI.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      supportAPI.create({ subject: subject.trim(), description: description.trim(), priority }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket raised — our team will get back to you shortly.");
      setShowCreate(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
    },
    onError: (err: any) => toast.error(err.message || "Failed to raise ticket"),
  });

  const tickets: SupportTicket[] = data?.data || [];

  return (
    <AppLayout title="Support">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-black">Support</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Raise a ticket and our support team will respond here.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#024BAB] text-white border-2 border-black nb-shadow hover:bg-[#013a87] gap-2"
          >
            <Plus className="w-4 h-4" />
            Raise a Ticket
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-black">
            <LifeBuoy className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold text-black">No tickets yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Raise a ticket if you run into an issue or need help.
            </p>
          </div>
        ) : (
          <div className="border-2 border-black divide-y-2 divide-black">
            {tickets.map((ticket) => (
              <button
                key={ticket._id}
                onClick={() => setSelected(ticket)}
                className="w-full text-left flex items-center gap-4 p-4 hover:bg-[#024BAB]/5 transition-colors"
              >
                <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-black text-sm truncate">
                    {ticket.subject}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {ticket.ticketId}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(ticket.createdAt).toLocaleDateString("en-IN")}
                    </span>
                    {ticket.replies?.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        {ticket.replies.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-1 border font-semibold capitalize ${PRIORITY_STYLES[ticket.priority]}`}
                  >
                    {ticket.priority}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 border font-semibold capitalize ${STATUS_STYLES[ticket.status]}`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Raise Ticket Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-2 border-black max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise a Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">Subject</label>
              <Input
                placeholder="Briefly describe the issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border-2 border-black"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">Description</label>
              <Textarea
                placeholder="Give us the details — what happened, what you expected, steps to reproduce."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-2 border-black min-h-[120px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-black">Priority</label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 text-xs px-2 py-1.5 border-2 font-semibold capitalize transition-colors ${
                      priority === p
                        ? "bg-[#024BAB] border-black text-white"
                        : "bg-white border-black text-black hover:bg-[#024BAB]/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-2 border-black"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!subject.trim() || !description.trim() || createMutation.isPending}
              className="bg-[#024BAB] text-white border-2 border-black hover:bg-[#013a87]"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="border-2 border-black max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {selected.ticketId}
                </span>
                <span
                  className={`text-xs px-2 py-1 border font-semibold capitalize ${PRIORITY_STYLES[selected.priority]}`}
                >
                  {selected.priority}
                </span>
                <span
                  className={`text-xs px-2 py-1 border font-semibold capitalize ${STATUS_STYLES[selected.status]}`}
                >
                  {selected.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-black whitespace-pre-wrap border-2 border-black p-3 bg-zinc-50">
                {selected.description}
              </p>

              {selected.replies?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Replies
                  </p>
                  {selected.replies.map((reply, i) => (
                    <div
                      key={i}
                      className={`p-3 border-2 text-sm ${
                        reply.from === "crm"
                          ? "border-black bg-white ml-8"
                          : "border-[#024BAB] bg-[#024BAB]/5 mr-8"
                      }`}
                    >
                      <p className="font-semibold text-black text-xs mb-1">
                        {reply.senderName || (reply.from === "crm" ? "You" : "Support Team")}
                      </p>
                      <p className="text-black">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
