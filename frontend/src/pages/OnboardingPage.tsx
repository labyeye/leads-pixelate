/// <reference types="vite/client" />
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  Building2,
  Building,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    icon: Zap,
    color: "#A3E635",
    employees: "Up to 25",
    priceMonthly: 499,
    priceYearly: 4999,
    custom: false,
    description: "Perfect for small sales teams just getting started",
    features: [
      "2,000 leads per month",
      "25 team members",
      "IndiaMART integration",
      "Follow-up reminders",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "growth" as const,
    name: "Growth",
    icon: Rocket,
    color: "#024BAB",
    employees: "Up to 50",
    priceMonthly: 999,
    priceYearly: 9999,
    custom: false,
    description: "For teams serious about scaling their sales pipeline",
    features: [
      "10,000 leads per month",
      "50 team members",
      "IndiaMART + Facebook Lead Ads",
      "Visit calendar & scheduling",
      "Advanced follow-up workflows",
      "Priority support",
      "CSV export",
    ],
    popular: true,
  },
  {
    id: "professional" as const,
    name: "Professional",
    icon: Crown,
    color: "#FA731C",
    employees: "Up to 100",
    priceMonthly: 1999,
    priceYearly: 19999,
    custom: false,
    description: "Advanced features for growing companies",
    features: [
      "50,000 leads per month",
      "100 team members",
      "All integrations",
      "Advanced analytics",
      "Custom workflows",
      "Priority support",
    ],
    popular: false,
  },
  {
    id: "business" as const,
    name: "Business",
    icon: Building2,
    color: "#0EA5E9",
    employees: "Up to 250",
    priceMonthly: 4499,
    priceYearly: 44999,
    custom: false,
    description: "Enterprise-grade features for large sales orgs",
    features: [
      "200,000 leads per month",
      "250 team members",
      "All integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom reporting",
    ],
    popular: false,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    icon: Building,
    color: "#A855F7",
    employees: "250+",
    priceMonthly: null,
    priceYearly: null,
    custom: true,
    description: "Custom pricing for large enterprises with unique needs",
    features: [
      "Unlimited leads",
      "Unlimited team members",
      "All integrations",
      "Dedicated infrastructure",
      "SLA guarantee",
      "Custom onboarding",
      "API access",
    ],
    popular: false,
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function OnboardingPage() {
  const { user, tenant, logout, refreshTenant } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<
    "starter" | "growth" | "professional" | "business" | "enterprise"
  >("growth");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handlePay = async () => {
    setPaying(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast({
        title: "Payment unavailable",
        description: "Could not load payment gateway. Check your connection.",
        variant: "destructive",
      });
      setPaying(false);
      return;
    }

    try {
      const order = await billingAPI.createOrder(selectedPlan, billing);
      const { orderId, amount } = order.data;

      const plan = PLANS.find((p) => p.id === selectedPlan)!;
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

      if (!keyId) {
        toast({
          title: "Configuration error",
          description: "Payment gateway is not configured.",
          variant: "destructive",
        });
        setPaying(false);
        return;
      }

      const options = {
        key: keyId,
        amount,
        currency: "INR",
        name: "NESTLead",
        description: `${plan.name} Plan — ${billing === "yearly" ? "Yearly" : "Monthly"}`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: { color: "#024BAB" },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response: any) => {
          try {
            await billingAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: selectedPlan,
              billingCycle: billing,
            });
            await refreshTenant();
            navigate(
              `/payment-success?plan=${selectedPlan}&billing=${billing}`,
              { replace: true },
            );
          } catch (err: any) {
            toast({
              title: "Payment verification failed",
              description: err.message || "Please contact support.",
              variant: "destructive",
            });
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast({
          title: "Payment failed",
          description: "Please try again or use a different payment method.",
          variant: "destructive",
        });
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      toast({
        title: "Could not initiate payment",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setPaying(false);
    }
  };

  const currentPlan = PLANS.find((p) => p.id === selectedPlan)!;
  const isCustom = currentPlan.custom;
  const yearlyTotal = currentPlan.priceYearly;
  const monthlyTotal =
    currentPlan.priceMonthly != null ? currentPlan.priceMonthly * 12 : 0;
  const yearlySaving = yearlyTotal != null ? monthlyTotal - yearlyTotal : 0;
  const price =
    billing === "yearly" && yearlyTotal != null
      ? Math.round(yearlyTotal / 12)
      : currentPlan.priceMonthly;

  return (
    <div className="min-h-screen bg-[#FFFDF5]">
      <header className="border-b-2 border-black bg-white px-4 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center nb-shadow-sm">
            <Zap className="w-4 h-4 text-black fill-black" />
          </div>
          <div>
            <span className="font-display font-bold text-black text-base block leading-tight">
              NestLeads
            </span>
            {tenant?.name && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {tenant.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs font-bold text-black hover:text-red-600 transition-colors border-2 border-transparent hover:border-black px-3 py-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#024BAB] border-2 border-black px-4 py-1.5 nb-shadow-sm mb-4">
            <span className="text-xs font-bold text-black uppercase tracking-wider">
              Step 2 of 2 — Choose your plan
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-black mb-3">
            Select a plan to get started
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Your account is ready. Pick the plan that fits your team and start
            capturing leads today.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center border-2 border-black nb-shadow-sm overflow-hidden">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-5 py-2.5 text-sm font-bold transition-colors",
                billing === "monthly"
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-[#024BAB]/20",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-5 py-2.5 text-sm font-bold transition-colors border-l-2 border-black flex items-center gap-2",
                billing === "yearly"
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-[#024BAB]/20",
              )}
            >
              Yearly
              <span className="bg-[#00C48C] text-black border border-black px-1.5 py-0.5 text-[10px] font-bold">
                2 months free
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const planPrice = plan.custom
              ? null
              : billing === "yearly" && plan.priceYearly != null
                ? Math.round(plan.priceYearly / 12)
                : plan.priceMonthly;
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  "nb-card p-4 flex flex-col text-left transition-all relative",
                  isSelected
                    ? "border-black translate-x-[-2px] translate-y-[-2px]"
                    : "border-black/30 hover:border-black",
                )}
                style={
                  isSelected
                    ? { boxShadow: `6px 6px 0px ${plan.color}` }
                    : { boxShadow: "4px 4px 0px #E5E7EB" }
                }
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-3 bg-[#024BAB] border-2 border-black px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div className="flex items-start justify-between mb-2">
                  <div
                    className="w-8 h-8 border-2 border-black flex items-center justify-center shrink-0"
                    style={{ backgroundColor: plan.color }}
                  >
                    <plan.icon className="w-4 h-4 text-black" />
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-black border-2 border-black flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {plan.employees} employees
                </span>
                <h3 className="font-display font-bold text-base text-black mb-0.5 leading-tight">
                  {plan.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
                  {plan.description}
                </p>

                <div className="mb-3">
                  {plan.custom ? (
                    <span className="font-display font-bold text-2xl text-black">
                      Custom
                    </span>
                  ) : (
                    <>
                      <span className="font-display font-bold text-2xl text-black">
                        ₹{planPrice!.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        /{billing === "yearly" ? "mo" : "mo"}
                      </span>
                    </>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-1.5 text-xs text-black"
                    >
                      <Check
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        style={{ color: plan.color }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="max-w-md mx-auto">
          <div className="nb-card bg-white p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-black">
                {currentPlan.name} Plan ·{" "}
                {isCustom
                  ? "Custom"
                  : billing === "yearly"
                    ? "Yearly"
                    : "Monthly"}
              </span>
              {isCustom ? (
                <span className="font-display font-bold text-xl text-black">
                  Custom
                </span>
              ) : (
                <span className="font-display font-bold text-xl text-black">
                  ₹{price!.toLocaleString()}
                  <span className="text-sm font-medium text-muted-foreground">
                    /mo
                  </span>
                </span>
              )}
            </div>
            {!isCustom && billing === "yearly" && (
              <div className="bg-[#A3E635]/20 border-2 border-[#A3E635] px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-black">
                  Yearly saving
                </span>
                <span className="text-xs font-bold text-[#16A34A]">
                  ₹{yearlySaving.toLocaleString()} / year
                </span>
              </div>
            )}
            {!isCustom && billing === "yearly" && yearlyTotal != null && (
              <p className="text-xs text-muted-foreground mt-2">
                Billed as ₹{yearlyTotal.toLocaleString()} today for 12 months
              </p>
            )}
          </div>

          {isCustom ? (
            <a
              href="mailto:sales@pixelatenest.com"
              className="nb-btn w-full bg-[#A855F7] text-white py-4 text-base font-bold flex items-center justify-center gap-3"
            >
              Contact Sales →
            </a>
          ) : (
            <button
              onClick={handlePay}
              disabled={paying}
              className="nb-btn w-full bg-[#024BAB] text-white py-4 text-base font-bold flex items-center justify-center gap-3"
            >
              {paying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Opening payment...
                </>
              ) : (
                <>
                  Pay ₹
                  {(billing === "yearly" && yearlyTotal != null
                    ? yearlyTotal
                    : price!
                  ).toLocaleString()}{" "}
                  &amp; Start Now
                </>
              )}
            </button>
          )}

          <p className="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
            <span className="w-4 h-4 bg-[#00C48C] border-2 border-black inline-flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-black" />
            </span>
            {isCustom
              ? "We'll get back to you within 24 hours"
              : "Secured by Razorpay · UPI, Cards, Net Banking accepted · Cancel anytime"}
          </p>
        </div>
      </div>
    </div>
  );
}
