import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { emailAPI, LeadEmail } from "@/services/api";
import { Mail, Send, Loader2, LogOut, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  lead: any;
  toast: (opts: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

export function EmailDialog({ open, onClose, lead, toast }: EmailDialogProps) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [thread, setThread] = useState<LeadEmail[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCheckingStatus(true);
    emailAPI
      .getStatus()
      .then((res) => {
        setConnected(res.data.connected);
        setMyEmail(res.data.emailAddress);
        if (res.data.connected) loadThread();
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
    // Prefill a sensible default subject once per open.
    setSubject((prev) => prev || `Re: ${lead?.requirement || lead?.company || "your enquiry"}`);
  }, [open]);

  const loadThread = async () => {
    if (!lead?._id && !lead?.id) return;
    setLoadingThread(true);
    try {
      const res = await emailAPI.getThread(lead._id || lead.id);
      setThread(res.data);
    } catch (err: any) {
      toast({ title: "Couldn't load email thread", description: err.message, variant: "destructive" });
    } finally {
      setLoadingThread(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await emailAPI.getAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      setConnecting(false);
      toast({
        title: "Could not start Gmail connection",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await emailAPI.disconnect();
      setConnected(false);
      setThread([]);
      toast({ title: "Gmail disconnected" });
    } catch (err: any) {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    if (!lead?.email) {
      toast({ title: "This lead has no email address on file", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const bodyHtml = body
        .split("\n")
        .map((line) => `<p>${line || "&nbsp;"}</p>`)
        .join("");
      const res = await emailAPI.send(lead._id || lead.id, {
        subject: subject.trim(),
        bodyHtml,
        bodyText: body.trim(),
      });
      setThread((prev) => [...prev, res.data]);
      setBody("");
      toast({ title: "Email sent" });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col border-2 border-black p-0 gap-0">
        <DialogHeader className="p-4 border-b-2 border-black shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email — {lead?.name}
          </DialogTitle>
        </DialogHeader>

        {checkingStatus ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !connected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Connect your Gmail account</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Send and receive emails with this lead from inside the CRM. New replies sync automatically every few minutes.
              </p>
            </div>
            <Button onClick={handleConnect} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Connect Gmail
            </Button>
          </div>
        ) : !lead?.email ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Mail className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-semibold">No email address on file</p>
            <p className="text-xs text-muted-foreground">Add an email to this lead before sending.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 text-xs shrink-0">
              <span className="text-muted-foreground">
                Sending as <span className="font-medium text-foreground">{myEmail}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={loadThread}
                  className="p-1 hover:bg-muted rounded"
                  title="Refresh thread"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingThread && "animate-spin")} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="p-1 hover:bg-muted rounded"
                  title="Disconnect Gmail"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingThread ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : thread.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">
                  No emails with this lead yet — send the first one below.
                </p>
              ) : (
                thread.map((email) => (
                  <div
                    key={email._id}
                    className={cn(
                      "border-2 border-black p-3 text-sm",
                      email.direction === "outbound" ? "bg-primary/5 ml-6" : "bg-white mr-6",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">
                        {email.direction === "outbound" ? "You" : lead?.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(email.sentAt), "dd MMM, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs font-medium mb-1">{email.subject}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                      {email.bodyText || email.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t-2 border-black p-3 space-y-2 shrink-0">
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border-2 border-black text-sm"
              />
              <Textarea
                placeholder={`Write a message to ${lead?.email}...`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="border-2 border-black min-h-[100px] text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={sending || !body.trim()}
                className="w-full gap-2 bg-primary text-primary-foreground"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Email
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
