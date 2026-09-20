import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Phone, PhoneOff } from "lucide-react";
import { callsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase = "ask" | "placing" | "live" | "done" | "failed";

const LABEL: Record<string, string> = {
  initiated: "Starting the call…",
  ringing: "Your phone is ringing. Pick up to be connected.",
  in_progress: "Connected. Calling the lead…",
};

// Manual call: Twilio rings YOUR phone first, and when you pick up it dials the lead and joins you.
export function ManualCallDialog({
  open,
  onClose,
  lead,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  lead: { _id: string; name: string; phone: string };
  toast: any;
}) {
  const { user } = useAuth() as { user: { phone?: string } | null };
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const [status, setStatus] = useState("initiated");
  const [seconds, setSeconds] = useState(0);
  const [reason, setReason] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(user?.phone ?? "");
      setRemember(false);
      setPhase("ask");
      setReason("");
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [open, user?.phone]);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const start = async () => {
    setPhase("placing");
    try {
      const res = await callsAPI.manual({ leadId: lead._id, agentPhone: phone.trim() || undefined, remember });
      setStatus("initiated");
      setPhase("live");
      const id = res.data.callLogId;
      timer.current = setInterval(async () => {
        try {
          const r = await callsAPI.status(id);
          setStatus(r.data.status);
          setSeconds(r.data.durationSeconds);
          if (["completed", "busy", "no_answer", "failed"].includes(r.data.status)) {
            stopPolling();
            setReason(r.data.errorReason || "");
            setPhase(r.data.status === "completed" ? "done" : "failed");
          }
        } catch {
          /* next tick retries */
        }
      }, 2500);
    } catch (err: any) {
      setPhase("ask");
      toast({ title: "Couldn't place the call", description: err.message, variant: "destructive" });
    }
  };

  const close = () => {
    stopPolling();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4" /> Call {lead.name}
          </DialogTitle>
        </DialogHeader>

        {(phase === "ask" || phase === "placing") && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              We ring <b>your phone</b> first. When you pick up, we dial <b>{lead.phone}</b> and connect you both.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="agent-phone">Your phone number</Label>
              <Input
                id="agent-phone"
                type="tel"
                value={phone}
                placeholder="+91 98765 43210"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
              Remember this number for next time
            </label>
          </div>
        )}

        {phase === "live" && (
          <div className="flex items-center gap-3 py-4" aria-live="polite">
            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
            <p className="text-sm">{LABEL[status] ?? "Working…"}</p>
          </div>
        )}
        {phase === "done" && (
          <div className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <p className="text-sm">
              Call finished{seconds ? ` (${Math.floor(seconds / 60)}m ${seconds % 60}s)` : ""}. It is saved in the lead's call log.
            </p>
          </div>
        )}
        {phase === "failed" && (
          <div className="flex items-start gap-3 py-4">
            <PhoneOff className="w-6 h-6 text-red-600 shrink-0" />
            <p className="text-sm">
              {status === "busy" ? "The line was busy." : status === "no_answer" ? "No one picked up." : "The call could not be completed."}
              {reason ? ` ${reason}.` : ""}
            </p>
          </div>
        )}

        <DialogFooter>
          {phase === "ask" || phase === "placing" ? (
            <Button onClick={start} disabled={phase === "placing" || !phone.trim()}>
              {phase === "placing" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Phone className="w-4 h-4 mr-1" /> Call me now
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>
              {phase === "live" ? "Hide" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
