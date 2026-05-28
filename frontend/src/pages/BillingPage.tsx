import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import {
  Check,
  CreditCard,
  Zap,
  Crown,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 999,
    color: "#A3E635",
    description: "Perfect for small sales teams",
    features: [
      "Up to 500 leads/month",
      "2 team members",
      "IndiaMART integration",
      "Follow-up reminders",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 2499,
    color: "#FA731C",
    description: "For growing sales operations",
    features: [
      "Up to 5,000 leads/month",
      "10 team members",
      "IndiaMART + Facebook Ads",
      "Advanced follow-up workflows",
      "Calendar & visit tracking",
      "Priority support",
      "CSV export",
    ],
    cta: "Upgrade Now",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 6999,
    color: "#A855F7",
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
    cta: "Contact Sales",
    popular: false,
  },
];

const currentPlan = "growth";

export default function BillingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <AppLayout title="Billing">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="nb-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#024BAB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#024BAB]" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">
                Growth Plan — Active
              </p>
              <p className="text-sm font-medium text-white/70">
                Next billing: June 13, 2026 · ₹2,499
              </p>
            </div>
          </div>
          <button className="nb-btn bg-white text-[#024BAB] px-5 py-2.5 text-sm self-start sm:self-auto">
            Manage Subscription
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Leads this month",
              value: "1,243",
              max: "5,000",
              pct: 25,
            },
            { label: "Team members", value: "4", max: "10", pct: 40 },
            { label: "Days remaining", value: "31", max: "31", pct: 100 },
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
                  className="h-full bg-[#024BAB] border-r border-black"
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="font-display font-bold text-2xl text-black">
              Change Plan
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
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const price =
                billing === "yearly"
                  ? Math.round(plan.price * 0.8)
                  : plan.price;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "nb-card p-5 flex flex-col relative",
                    isCurrent && "border-[#024BAB] border-4",
                  )}
                  style={
                    plan.popular
                      ? { boxShadow: `6px 6px 0px ${plan.color}` }
                      : {}
                  }
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-4 bg-[#024BAB] border-2 border-black px-3 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <div
                    className="w-8 h-8 border-2 border-black flex items-center justify-center mb-3"
                    style={{ backgroundColor: plan.color }}
                  >
                    <Zap className="w-4 h-4 text-black" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-black">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {plan.description}
                  </p>
                  <div className="mb-4">
                    <span className="font-display font-bold text-3xl text-black">
                      ₹{price.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      /{billing === "yearly" ? "yr" : "mo"}
                    </span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm font-medium text-black"
                      >
                        <Check
                          className="w-4 h-4 shrink-0 mt-0.5"
                          style={{
                            color:
                              plan.color === "#024BAB" ? "#024BAB" : plan.color,
                          }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={cn(
                      "nb-btn w-full py-2.5 text-sm flex items-center justify-center gap-2",
                      isCurrent
                        ? "bg-[#024BAB] text-white cursor-default"
                        : "bg-black text-white",
                    )}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : plan.cta}
                    {!isCurrent && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="nb-card p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Payment Method
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border-2 border-black bg-[#A3E635]/20 nb-shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-black flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">VISA</span>
              </div>
              <div>
                <p className="font-bold text-sm text-black">
                  •••• •••• •••• 4242
                </p>
                <p className="text-xs text-muted-foreground">Expires 12/27</p>
              </div>
            </div>
            <button className="nb-btn bg-white text-black px-4 py-2 text-sm self-start sm:self-auto">
              Change
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Payments processed securely via Razorpay. We never store your card
            details.
          </p>
        </div>

        <div className="nb-card p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4">
            Invoice History
          </h3>
          <div className="space-y-2">
            {[
              {
                date: "May 13, 2026",
                amount: "₹2,499",
                status: "Paid",
                id: "INV-0024",
              },
              {
                date: "Apr 13, 2026",
                amount: "₹2,499",
                status: "Paid",
                id: "INV-0023",
              },
              {
                date: "Mar 13, 2026",
                amount: "₹2,499",
                status: "Paid",
                id: "INV-0022",
              },
            ].map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-2 border-black hover:bg-[#024BAB]/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-muted-foreground">
                    {inv.id}
                  </span>
                  <span className="text-sm font-medium text-black">
                    {inv.date}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-black">{inv.amount}</span>
                  <span className="nb-badge nb-tag-lime text-[11px]">
                    {inv.status}
                  </span>
                  <button className="text-xs font-bold text-black underline hover:text-[#FF3366] transition-colors">
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
