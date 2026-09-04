import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function SubscriptionExpiredModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("subscription-expired", handler);
    return () => window.removeEventListener("subscription-expired", handler);
  }, []);

  // Already on billing — the page itself handles renewal, no need to nag.
  if (location.pathname === "/billing") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="w-10 h-10 bg-[#FF3366] border-2 border-black flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <DialogTitle>Subscription Ended</DialogTitle>
          <DialogDescription>
            Your subscription has expired. Renew your plan to keep using
            NestLeads CRM.
          </DialogDescription>
        </DialogHeader>
        <button
          onClick={() => navigate("/billing")}
          className="nb-btn bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center justify-center gap-1.5 w-full"
        >
          <RefreshCw className="w-4 h-4" /> Renew Plan
        </button>
      </DialogContent>
    </Dialog>
  );
}
