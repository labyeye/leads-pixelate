import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { autopilotAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tone = "blue" | "green" | "red";

interface Status {
  configured: boolean;
  price: number; // paise
  trialDays: number;
  entitlement: {
    state: "none" | "trial" | "paid" | "expired";
    endsAt: string | null;
  };
  settings: {
    enabled: boolean;
    postsPerDay: number;
    tone: string;
    language: string;
    notes: string;
    reviewFirst: boolean;
    accountIds: string[];
  };
  running: boolean;
  lastRunAt: string | null;
  lastError: string;
  monthCount: number;
  monthlyCap: number;
  accounts: { _id: string; platform: string; accountName: string }[];
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const daysLeft = (d: string) =>
  Math.max(1, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
    document.body.appendChild(script);
  });
}

export function AutopilotPanel({ toast }: { toast: any }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState<Status["settings"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(
    async (resetForm = false) => {
      try {
        const res = await autopilotAPI.get();
        setStatus(res.data);
        if (resetForm) setForm(res.data.settings);
      } catch (err: any) {
        toast({
          title: "Failed to load Autopilot",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    load(true);
    // Generation runs server-side for a minute or two; keep status fresh.
    const t = setInterval(() => load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (!status || !form) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { entitlement: ent, settings } = status;
  const entitled = ent.state === "trial" || ent.state === "paid";
  const noAccounts = status.accounts.length === 0;

  const run = async (fn: () => Promise<unknown>, ok: string, done: () => void) => {
    try {
      await fn();
      toast({ title: ok });
      await load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      done();
    }
  };

  const toggle = (enabled: boolean) => {
    setToggling(true);
    return run(
      () => autopilotAPI.update({ enabled }),
      enabled ? "Autopilot is on — your first posts are being prepared" : "Autopilot paused",
      () => setToggling(false),
    );
  };

  const save = () => {
    setSaving(true);
    return run(
      () =>
        autopilotAPI.update({
          postsPerDay: form.postsPerDay,
          language: form.language,
          tone: form.tone,
          notes: form.notes,
          reviewFirst: form.reviewFirst,
          accountIds: form.accountIds,
        }),
      "Settings saved",
      () => setSaving(false),
    );
  };

  const runNow = () => {
    setStarting(true);
    return run(() => autopilotAPI.run(), "Generating posts…", () => setStarting(false));
  };

  const subscribe = async () => {
    setPaying(true);
    try {
      const res = await autopilotAPI.createOrder();
      const { orderId, amount, currency, customerEmail, customerPhone, customerName, key } = res.data;
      await loadRazorpay();
      const rzp = new (window as any).Razorpay({
        key,
        amount,
        currency,
        name: "NestLeads CRM",
        description: "Social Autopilot — 30 days",
        order_id: orderId,
        prefill: { name: customerName, email: customerEmail, contact: customerPhone },
        theme: { color: "#024BAB" },
        handler: async (response: any) => {
          try {
            await autopilotAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast({ title: "Payment successful", description: "Autopilot is active for 30 days." });
            await load();
          } catch {
            toast({
              title: "Verification failed",
              description: "Payment was received but verification failed. Contact support.",
              variant: "destructive",
            });
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (err: any) {
      toast({
        title: "Payment error",
        description: err.message || "Could not start payment. Please try again.",
        variant: "destructive",
      });
      setPaying(false);
    }
  };

  const toggleAccount = (id: string, on: boolean) =>
    setForm({
      ...form,
      accountIds: on ? [...form.accountIds, id] : form.accountIds.filter((x) => x !== id),
    });

  const banner: { tone: Tone; text: string } =
    ent.state === "trial" && ent.endsAt
      ? { tone: "blue", text: `Free trial — ${daysLeft(ent.endsAt)} day(s) left (ends ${fmtDate(ent.endsAt)}). Then ${rupees(status.price)}/month.` }
      : ent.state === "paid" && ent.endsAt
        ? { tone: "green", text: `Active until ${fmtDate(ent.endsAt)}.` }
        : ent.state === "expired"
          ? { tone: "red", text: `Your Autopilot access has ended. Subscribe for ${rupees(status.price)}/month to continue.` }
          : { tone: "blue", text: `Free for ${status.trialDays} days, then ${rupees(status.price)}/month. Turn it on to start your trial.` };
  const toneClass = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
  }[banner.tone];

  return (
    <div>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary border-2 border-black nb-shadow flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Social Autopilot</h2>
            <p className="text-sm text-muted-foreground">
              Claude studies your business and plans the posts, Gemini writes the captions and creates the
              images, and Claude approves each one before it goes live. You do nothing.
            </p>
          </div>
        </div>

        {!status.configured && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Autopilot isn't switched on for this server yet. Contact support.
          </div>
        )}

        <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${toneClass}`}>
          <span>{banner.text}</span>
          {ent.state !== "none" && (
            <Button size="sm" onClick={subscribe} disabled={paying}>
              {paying && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {ent.state === "paid" ? "Renew" : "Subscribe"} · {rupees(status.price)}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border-2 border-black p-4 bg-background">
          <div>
            <p className="font-semibold text-sm">Autopilot</p>
            <p className="text-xs text-muted-foreground">
              {noAccounts
                ? "Connect a Facebook, Instagram or LinkedIn account first (Connected Accounts tab)."
                : "Creates and schedules each day's post automatically."}
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            disabled={toggling || (noAccounts && !settings.enabled) || (ent.state === "expired" && !settings.enabled)}
            onCheckedChange={toggle}
          />
        </div>

        {status.running && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" /> Generating your posts… this takes a minute or two.
          </div>
        )}
        {status.lastError && !status.running && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Last run failed: {status.lastError}. It retries automatically, or use Run now.
          </div>
        )}

        <div className="rounded-lg border-2 border-black p-4 space-y-4 bg-background">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Posts per day</Label>
              <Select
                value={String(form.postsPerDay)}
                onValueChange={(v) => setForm({ ...form, postsPerDay: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 per day</SelectItem>
                  <SelectItem value="2">2 per day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Hinglish">Hinglish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Brand tone (optional)</Label>
            <Input
              maxLength={200}
              placeholder="e.g. friendly, professional, no slang"
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes for Autopilot (optional)</Label>
            <Textarea
              maxLength={500}
              rows={3}
              placeholder="What to focus on, what to avoid, your audience…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {status.accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Post to</Label>
              <p className="text-xs text-muted-foreground">Leave all unticked to use every connected account.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {status.accounts.map((a) => (
                  <label key={a._id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.accountIds.includes(a._id)}
                      onCheckedChange={(c) => toggleAccount(a._id, c === true)}
                    />
                    <span className="capitalize text-muted-foreground">{a.platform}</span>
                    <span className="truncate">{a.accountName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ask me before every post</p>
              <p className="text-xs text-muted-foreground">
                Off = your first post needs approval, then Autopilot runs on its own. On = every post waits for your approval.
              </p>
            </div>
            <Switch checked={form.reviewFirst} onCheckedChange={(v) => setForm({ ...form, reviewFirst: v })} />
          </div>

          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save settings
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {status.monthCount} / {status.monthlyCap} posts generated this month
            {status.lastRunAt && ` · last run ${new Date(status.lastRunAt).toLocaleString("en-IN")}`}
          </span>
          {settings.enabled && entitled && (
            <Button variant="outline" size="sm" onClick={runNow} disabled={starting || status.running}>
              {starting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              Run now
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Every post Autopilot creates is listed here, and in the Posts and Calendar tabs of Social Media Planner.
        </p>
      </div>
    </div>
  );
}
