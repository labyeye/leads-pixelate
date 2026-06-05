import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  CreditCard,
  Zap,
  Crown,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { billingAPI, settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const PLAN_META: Record<
  string,
  {
    color: string;
    icon: string;
    description: string;
    features: string[];
    popular?: boolean;
  }
> = {
  starter: {
    color: "#A3E635",
    icon: "Zap",
    description: "Perfect for small sales teams",
    features: [
      "Up to 500 leads/month",
      "2 team members",
      "IndiaMART integration",
      "Follow-up reminders",
      "Email support",
    ],
  },
  growth: {
    color: "#FA731C",
    icon: "Zap",
    description: "For growing sales operations",
    popular: true,
    features: [
      "Up to 5,000 leads/month",
      "10 team members",
      "IndiaMART + Facebook Ads",
      "Advanced follow-up workflows",
      "Calendar & visit tracking",
      "Priority support",
      "CSV export",
    ],
  },
  pro: {
    color: "#A855F7",
    icon: "Zap",
    description: "Unlimited scale, custom needs",
    features: [
      "Unlimited leads",
      "Unlimited team members",
      "All integrations",
      "Custom workflows",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom reporting",
      "API access",
    ],
  },
  enterprise: {
    color: "#A855F7",
    icon: "Zap",
    description: "Unlimited scale, custom needs",
    features: [
      "Unlimited leads",
      "Unlimited team members",
      "All integrations",
      "Custom workflows",
    ],
  },
};

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// ── PDF generator ─────────────────────────────────────────────────────────────

function downloadInvoicePDF(invoice: any, settings: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header bar
  doc.setFillColor(2, 75, 171);
  doc.rect(0, 0, pageW, 18, "F");

  // Company name on header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const companyName = settings?.companyName || "Agency Flow CRM";
  doc.text(companyName, margin, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("TAX INVOICE", pageW - margin, 12, { align: "right" });

  y = 28;

  // Company details (left)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const lines: string[] = [];
  if (settings?.companyAddress) lines.push(settings.companyAddress);
  if (settings?.companyPhone) lines.push(`Tel: ${settings.companyPhone}`);
  if (settings?.companyEmail) lines.push(`Email: ${settings.companyEmail}`);
  if (settings?.companyGST) lines.push(`GSTIN: ${settings.companyGST}`);
  if (settings?.companyWebsite) lines.push(settings.companyWebsite);
  lines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  // Invoice details (right)
  const rightX = pageW - margin;
  let ry = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, rightX, ry, {
    align: "right",
  });
  ry += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date: ${formatDate(invoice.paidAt)}`, rightX, ry, {
    align: "right",
  });
  ry += 5;
  if (invoice.hdfcTrackingId) {
    doc.text(`Payment Ref: ${invoice.hdfcTrackingId}`, rightX, ry, {
      align: "right",
    });
    ry += 5;
  }

  y = Math.max(y, ry) + 8;

  // Divider
  doc.setDrawColor(2, 75, 171);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Table header
  doc.setFillColor(2, 75, 171);
  doc.rect(margin, y, pageW - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Description", margin + 3, y + 5.5);
  doc.text("Billing Cycle", pageW / 2 - 10, y + 5.5, { align: "center" });
  doc.text("Amount", pageW - margin - 3, y + 5.5, { align: "right" });
  y += 8;

  // Table row
  doc.setFillColor(245, 247, 255);
  doc.rect(margin, y, pageW - margin * 2, 10, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, pageW - margin * 2, 10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const planLabel = `${capitalise(invoice.plan || "—")} Plan Subscription`;
  doc.text(planLabel, margin + 3, y + 6.5);
  doc.text(
    capitalise(invoice.billingCycle || "monthly"),
    pageW / 2 - 10,
    y + 6.5,
    { align: "center" },
  );
  doc.setFont("helvetica", "bold");
  doc.text(formatAmount(invoice.amount), pageW - margin - 3, y + 6.5, {
    align: "right",
  });
  y += 16;

  // Total
  doc.setFillColor(2, 75, 171);
  doc.rect(pageW - margin - 55, y, 55, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total:", pageW - margin - 35, y + 7);
  doc.text(formatAmount(invoice.amount), pageW - margin - 3, y + 7, {
    align: "right",
  });
  y += 18;

  // Status badge
  doc.setTextColor(0, 196, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("✓ PAID", margin, y);
  y += 10;

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setDrawColor(2, 75, 171);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const footerText =
    settings?.quotationFooter ||
    "This is a computer generated invoice. No signature required.";
  doc.text(footerText, pageW / 2, footerY + 5, { align: "center" });
  doc.text(companyName, pageW / 2, footerY + 10, { align: "center" });

  doc.save(`${invoice.invoiceNumber}.pdf`);
}

// ── HDFC payment form submitter ───────────────────────────────────────────────

function submitHdfcForm(
  encRequest: string,
  accessCode: string,
  gatewayUrl: string,
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = gatewayUrl;
  form.style.display = "none";

  const enc = document.createElement("input");
  enc.name = "encRequest";
  enc.value = encRequest;
  form.appendChild(enc);

  const ac = document.createElement("input");
  ac.name = "access_code";
  ac.value = accessCode;
  form.appendChild(ac);

  document.body.appendChild(form);
  form.submit();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [subscription, setSubscription] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [plans, setPlans] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const notifiedRef = useRef(false);

  // Handle redirect back from HDFC
  useEffect(() => {
    if (notifiedRef.current) return;
    const payment = searchParams.get("payment");
    if (payment === "success") {
      notifiedRef.current = true;
      const plan = searchParams.get("plan");
      toast({
        title: "Payment Successful!",
        description: `Your ${plan ? capitalise(plan) : ""} plan is now active.`,
      });
      window.history.replaceState({}, "", "/billing");
    } else if (payment === "failed") {
      notifiedRef.current = true;
      toast({
        title: "Payment Failed",
        description: "Your payment could not be processed. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/billing");
    } else if (payment === "cancelled") {
      notifiedRef.current = true;
      toast({ title: "Payment Cancelled" });
      window.history.replaceState({}, "", "/billing");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [subRes, plansRes, invRes] = await Promise.allSettled([
        billingAPI.getSubscription(),
        billingAPI.getPlans(),
        billingAPI.getInvoices(),
      ]);

      if (subRes.status === "fulfilled") {
        setSubscription(subRes.value.data.subscription);
        setTenant(subRes.value.data.tenant);
      }
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data);
      if (invRes.status === "fulfilled") setInvoices(invRes.value.data || []);

      // Load settings for PDF
      try {
        const settingsRes = await settingsAPI.get();
        setSettings(settingsRes.data);
      } catch {
        // settings not critical
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    setPayingPlan(planId);
    try {
      const res = await billingAPI.createHdfcOrder(planId, billing);
      const { encRequest, accessCode, gatewayUrl } = res.data;
      submitHdfcForm(encRequest, accessCode, gatewayUrl);
    } catch (err: any) {
      toast({
        title: "Payment Error",
        description:
          err.message || "Could not initiate payment. Please try again.",
        variant: "destructive",
      });
      setPayingPlan(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    setCancelling(true);
    try {
      await billingAPI.cancelSubscription();
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled.",
      });
      loadAll();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }

  function handleChangePaymentMethod() {
    toast({
      title: "Update Payment Method",
      description:
        "To update your payment method, please make a new payment on plan renewal. HDFC SmartGateway securely manages your card details.",
    });
  }

  const currentPlanId = subscription?.plan || tenant?.plan || "trial";
  const periodEnd = subscription?.currentPeriodEnd || tenant?.planExpiresAt;

  // Usage stats derived from tenant limits
  const planLimits = plans?.[currentPlanId] || {};
  const maxLeads = planLimits?.limits?.leadsPerMonth ?? 100;
  const maxMembers = planLimits?.limits?.teamMembers ?? 2;
  const daysRemaining = periodEnd
    ? Math.max(
        0,
        Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000),
      )
    : 0;

  const planIds = ["starter", "growth", "pro"];

  return (
    <AppLayout title="Billing">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
          </div>
        ) : (
          <>
            {/* Current plan banner */}
            <div className="nb-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#024BAB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-[#024BAB]" />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-lg">
                    {capitalise(currentPlanId)} Plan —{" "}
                    {subscription?.status === "active" ||
                    tenant?.status === "active"
                      ? "Active"
                      : capitalise(
                          subscription?.status || tenant?.status || "Trial",
                        )}
                  </p>
                  <p className="text-sm font-medium text-white/70">
                    {periodEnd
                      ? `Next billing: ${formatDate(periodEnd)} · ${plans?.[currentPlanId] ? formatAmount(billing === "yearly" ? plans[currentPlanId].priceYearly : plans[currentPlanId].priceMonthly) : "—"}`
                      : "Free trial — upgrade to activate"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleCancel}
                  disabled={cancelling || currentPlanId === "trial"}
                  className="nb-btn bg-white/20 text-white px-4 py-2 text-sm border-white/50 disabled:opacity-50"
                >
                  {cancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Cancel Plan"
                  )}
                </button>
                <button
                  onClick={loadAll}
                  className="nb-btn bg-white text-[#024BAB] px-4 py-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Usage stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Leads this month",
                  value: "—",
                  max: maxLeads.toLocaleString(),
                  pct: 0,
                },
                {
                  label: "Team members",
                  value: "—",
                  max: maxMembers === 999 ? "∞" : maxMembers.toString(),
                  pct: 0,
                },
                {
                  label: "Days remaining",
                  value: daysRemaining.toString(),
                  max: "31",
                  pct: Math.min(100, Math.round((daysRemaining / 31) * 100)),
                },
              ].map((stat) => (
                <div key={stat.label} className="nb-card p-4 bg-white">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {stat.label}
                  </p>
                  <p className="font-display font-bold text-2xl text-black mb-2">
                    {stat.value}
                    <span className="text-sm font-medium text-muted-foreground ml-1">
                      / {stat.max}
                    </span>
                  </p>
                  <div className="h-2 bg-[#024BAB]/20 border border-black">
                    <div
                      className="h-full bg-[#024BAB] border-r border-black transition-all"
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Plan selector */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="font-display font-bold text-2xl text-black">
                  {currentPlanId === "trial" ? "Choose a Plan" : "Change Plan"}
                </h2>
                <div className="flex items-center border-2 border-black nb-shadow-sm overflow-hidden self-start">
                  <button
                    onClick={() => setBilling("monthly")}
                    className={cn(
                      "px-4 py-2 text-sm font-bold transition-colors",
                      billing === "monthly"
                        ? "bg-[#024BAB] text-white"
                        : "bg-white text-black hover:bg-[#024BAB]/10",
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBilling("yearly")}
                    className={cn(
                      "px-4 py-2 text-sm font-bold transition-colors border-l-2 border-black",
                      billing === "yearly"
                        ? "bg-[#024BAB] text-white"
                        : "bg-white text-black hover:bg-[#024BAB]/10",
                    )}
                  >
                    Yearly
                    <span className="ml-1.5 text-[10px] bg-[#00C48C] text-black border border-black px-1 py-0.5 font-bold">
                      2 months free
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {planIds.map((planId) => {
                  const meta = PLAN_META[planId];
                  const apiPlan = plans?.[planId];
                  const isCurrent = planId === currentPlanId;
                  const isPaying = payingPlan === planId;
                  const priceRaw = apiPlan
                    ? billing === "yearly"
                      ? apiPlan.priceYearly
                      : apiPlan.priceMonthly
                    : null;
                  const priceDisplay =
                    priceRaw !== null
                      ? `₹${(priceRaw / 100).toLocaleString("en-IN")}`
                      : "—";

                  return (
                    <div
                      key={planId}
                      className={cn(
                        "nb-card p-5 flex flex-col relative",
                        isCurrent && "border-[#024BAB] border-4",
                      )}
                      style={
                        meta.popular
                          ? { boxShadow: `6px 6px 0px ${meta.color}` }
                          : {}
                      }
                    >
                      {meta.popular && (
                        <div className="absolute -top-3 left-4 bg-[#024BAB] border-2 border-black px-3 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                          Most Popular
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-3 right-4 bg-[#00C48C] border-2 border-black px-3 py-0.5 text-[11px] font-bold text-black uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Active
                        </div>
                      )}
                      <div
                        className="w-8 h-8 border-2 border-black flex items-center justify-center mb-3"
                        style={{ backgroundColor: meta.color }}
                      >
                        <Zap className="w-4 h-4 text-black" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-black">
                        {capitalise(planId)}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        {meta.description}
                      </p>
                      <div className="mb-4">
                        <span className="font-display font-bold text-3xl text-black">
                          {priceDisplay}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          /{billing === "yearly" ? "yr" : "mo"}
                        </span>
                      </div>
                      <ul className="space-y-2 flex-1 mb-5">
                        {meta.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2 text-sm font-medium text-black"
                          >
                            <Check
                              className="w-4 h-4 shrink-0 mt-0.5"
                              style={{ color: meta.color }}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => !isCurrent && handleUpgrade(planId)}
                        disabled={isCurrent || isPaying || !!payingPlan}
                        className={cn(
                          "nb-btn w-full py-2.5 text-sm flex items-center justify-center gap-2",
                          isCurrent
                            ? "bg-[#024BAB] text-white cursor-default"
                            : "bg-black text-white disabled:opacity-60",
                        )}
                      >
                        {isPaying ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Redirecting…
                          </>
                        ) : isCurrent ? (
                          "Current Plan"
                        ) : (
                          <>
                            {"Upgrade Now"}{" "}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment method */}
            <div className="nb-card p-4 sm:p-5 bg-white">
              <h3 className="font-display font-bold text-lg text-black mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Method
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border-2 border-black bg-[#A3E635]/20 nb-shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-[#024BAB] flex items-center justify-center shrink-0 border border-black">
                    <span className="text-white font-bold text-[10px] leading-tight text-center">
                      HDFC
                      <br />
                      PAY
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-black">
                      HDFC SmartGateway
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subscription?.status === "active"
                        ? "Your subscription is managed securely via HDFC SmartGateway"
                        : "No active payment method — subscribe to a plan"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleChangePaymentMethod}
                  className="nb-btn bg-white text-black px-4 py-2 text-sm self-start sm:self-auto"
                >
                  Change
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Payments processed securely via HDFC SmartGateway. We never
                store your card details.
              </p>
            </div>

            {/* Invoice history */}
            <div className="nb-card p-4 sm:p-5 bg-white">
              <h3 className="font-display font-bold text-lg text-black mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Invoice History
              </h3>
              {invoices.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-black/30">
                  <p className="text-sm text-muted-foreground">
                    No invoices yet. They will appear here after your first
                    payment.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-2 border-black hover:bg-[#024BAB]/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-muted-foreground">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-sm font-medium text-black">
                          {formatDate(inv.paidAt)}
                        </span>
                        {inv.plan && (
                          <span className="text-xs font-medium text-[#024BAB]">
                            {capitalise(inv.plan)} Plan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-black">
                          {formatAmount(inv.amount)}
                        </span>
                        <span className="nb-badge nb-tag-lime text-[11px]">
                          {capitalise(inv.status)}
                        </span>
                        <button
                          onClick={() => downloadInvoicePDF(inv, settings)}
                          className="text-xs font-bold text-black underline hover:text-[#FF3366] transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
