import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { FacebookWizard } from "@/components/integrations/FacebookWizard";

// ─── Types ──────────────────────────────────────────────────────────────────

type IntegrationId = "indiamart" | "facebook" | "tradeindia" | "justdial";

interface StepField {
  key: string;
  label: string;
  type: "text" | "password" | "readonly";
  placeholder?: string;
  help?: string;
  value?: string; // for readonly pre-filled fields
}

interface WizardStep {
  title: string;
  subtitle: string;
  visual: React.ReactNode;
  instructions: string[];
  fields?: StepField[];
  actionLabel?: string;
}

interface Integration {
  id: IntegrationId;
  name: string;
  shortDesc: string;
  color: string;
  bgColor: string;
  icon: string;
  connected: boolean;
  leadsToday?: number;
  lastSync?: string;
  steps: WizardStep[];
  docsUrl: string;
}

// ─── Visual helpers ─────────────────────────────────────────────────────────

function MockBrowser({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-black nb-shadow-sm overflow-hidden">
      <div className="bg-[#E5E7EB] border-b-2 border-black px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          {["#EF4444", "#024BAB", "#00C48C"].map((c) => (
            <div
              key={c}
              className="w-2.5 h-2.5 rounded-full border border-black/20"
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex-1 bg-white border border-black/20 rounded px-2 py-0.5 text-[10px] text-gray-500 ml-2">
          seller.indiamart.com
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

function HighlightBox({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="relative border-2 border-[#024BAB] bg-[#024BAB]/10 p-3 nb-shadow-blue">
      <div className="absolute -top-3 left-3 bg-[#024BAB] border-2 border-black px-2 py-0.5 text-[10px] font-bold text-black uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── IndiaMART step visuals ──────────────────────────────────────────────────

const IndiamartStep1Visual = () => (
  <MockBrowser>
    <div className="p-4 space-y-2">
      <div className="text-xs font-bold text-gray-400 uppercase mb-3">
        IndiaMART Seller Panel
      </div>
      <div className="flex gap-2">
        {["Dashboard", "My Products", "Enquiries", "Settings"].map((t, i) => (
          <div
            key={t}
            className={cn(
              "text-xs px-2 py-1 border",
              i === 3
                ? "border-[#FB923C] bg-[#FB923C]/10 font-bold text-[#FB923C]"
                : "border-gray-200 text-gray-400",
            )}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="mt-3 border border-gray-200 p-3">
        <div className="text-xs font-bold mb-2">Settings → API</div>
        <HighlightBox label="Click here">
          <div className="text-xs text-gray-700 font-medium">
            CRM API Integration
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            Connect 3rd party CRM to receive enquiries
          </div>
        </HighlightBox>
      </div>
    </div>
  </MockBrowser>
);

const IndiamartStep2Visual = () => (
  <MockBrowser>
    <div className="p-4">
      <div className="text-xs font-bold text-gray-400 mb-3">
        CRM API Integration
      </div>
      <div className="space-y-2">
        <div className="text-[11px] text-gray-500">
          Your unique API Key for CRM integration:
        </div>
        <HighlightBox label="Copy this key">
          <div className="font-mono text-xs bg-white border border-gray-200 px-3 py-2 text-gray-800 tracking-wider">
            IMXXXXXXXXXXXXXXXXXXXXXXXXXX
          </div>
        </HighlightBox>
        <div className="text-[10px] text-gray-400">
          ⚠ Do not share this key with anyone
        </div>
      </div>
    </div>
  </MockBrowser>
);

const IndiamartStep3Visual = () => (
  <div className="border-2 border-black bg-[#A3E635]/10 p-5 flex flex-col items-center justify-center gap-3 nb-shadow-sm min-h-[140px]">
    <CheckCircle2 className="w-10 h-10 text-[#00C48C]" />
    <div className="text-center">
      <p className="font-display font-bold text-base text-black">
        Connection verified!
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Leads will auto-import every 5 minutes
      </p>
    </div>
    <div className="flex gap-4 mt-1">
      <div className="text-center">
        <p className="font-bold text-lg text-black">14</p>
        <p className="text-[10px] text-muted-foreground">Today</p>
      </div>
      <div className="text-center">
        <p className="font-bold text-lg text-black">2 min</p>
        <p className="text-[10px] text-muted-foreground">Last sync</p>
      </div>
    </div>
  </div>
);

// ─── Facebook step visuals ───────────────────────────────────────────────────

const FacebookStep1Visual = () => (
  <div className="border-2 border-black nb-shadow-sm overflow-hidden">
    <div className="bg-[#1877F2] p-4 text-center">
      <div className="text-white font-bold text-lg">f</div>
    </div>
    <div className="bg-white p-4 space-y-3">
      <div className="text-center">
        <p className="text-xs font-bold text-black">Facebook for Developers</p>
        <p className="text-[10px] text-muted-foreground">
          developers.facebook.com/apps
        </p>
      </div>
      <HighlightBox label="Go here">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-black">My Apps → Your App</div>
          <ChevronRight className="w-3 h-3" />
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          → Products → Lead Ads
        </div>
      </HighlightBox>
    </div>
  </div>
);

const FacebookStep2Visual = () => (
  <div className="border-2 border-black nb-shadow-sm overflow-hidden">
    <div className="bg-white border-b-2 border-black p-3">
      <div className="text-xs font-bold text-black">
        Facebook Page Settings → Webhooks
      </div>
    </div>
    <div className="bg-white p-4 space-y-2">
      <div className="text-[11px] text-gray-600">Subscribe URL:</div>
      <HighlightBox label="Paste your webhook URL here">
        <div className="font-mono text-[10px] text-gray-700 break-all">
          https://api.nestleads.app/api/facebook/webhook
        </div>
      </HighlightBox>
      <div className="text-[11px] text-gray-600 mt-2">Verify Token:</div>
      <div className="border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-[10px] text-gray-700">
        nestleads_verify_token
      </div>
      <div className="text-[10px] text-gray-400 flex items-start gap-1 mt-1">
        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
        Subscribe to the <strong>leadgen</strong> event only
      </div>
    </div>
  </div>
);

const FacebookStep3Visual = () => (
  <div className="border-2 border-black nb-shadow-sm overflow-hidden">
    <div className="bg-white border-b-2 border-black p-3">
      <div className="text-xs font-bold text-black">
        Facebook Page → Settings → Access Tokens
      </div>
    </div>
    <div className="bg-white p-4 space-y-2">
      <HighlightBox label="Copy this">
        <div className="text-xs font-bold text-black mb-1">
          Page Access Token
        </div>
        <div className="font-mono text-[10px] text-gray-700 bg-white border border-gray-200 p-1.5 break-all">
          EAAxxxxxxxxxxxxxxx...
        </div>
      </HighlightBox>
      <div className="text-[10px] text-gray-400 flex items-start gap-1">
        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
        Use a <strong>Never Expire</strong> token. Go to Access Token Tool →
        Generate.
      </div>
    </div>
  </div>
);

const FacebookStep4Visual = () => (
  <div className="border-2 border-black bg-[#3B82F6]/10 p-5 flex flex-col items-center justify-center gap-3 nb-shadow-sm min-h-[140px]">
    <ShieldCheck className="w-10 h-10 text-[#3B82F6]" />
    <div className="text-center">
      <p className="font-display font-bold text-base text-black">All set!</p>
      <p className="text-xs text-muted-foreground mt-1">
        New Facebook Lead Ad submissions will appear in NestLeads instantly.
      </p>
    </div>
  </div>
);

// ─── Integration definitions ─────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  {
    id: "indiamart",
    name: "IndiaMART",
    shortDesc: "Auto-import buyer enquiries every 5 min",
    color: "#FB923C",
    bgColor: "#FFF7ED",
    icon: "IM",
    connected: false,
    docsUrl:
      "https://seller.indiamart.com/messagecentre/crm-api-lead-integration/",
    steps: [
      {
        title: "Log in to your IndiaMART Seller Account",
        subtitle: "Step 1 of 3 — Open IndiaMART and go to Settings",
        visual: <IndiamartStep1Visual />,
        instructions: [
          "Go to seller.indiamart.com and log in",
          'Click "Settings" in the top navigation',
          'Under Settings, look for "CRM API Integration" or "API Settings"',
          "Click on it to open the API configuration page",
        ],
        actionLabel: "I've opened CRM API Settings →",
      },
      {
        title: "Copy your CRM API Key",
        subtitle: "Step 2 of 3 — Get your unique API key",
        visual: <IndiamartStep2Visual />,
        instructions: [
          "On the CRM API Integration page, find your unique API Key",
          "Click the Copy button or select and copy the key",
          "The key looks like: IMXXXXXXXXXXXXXXXXXXXXXXXXXX",
          "Paste it in the field below",
        ],
        fields: [
          {
            key: "api_key",
            label: "IndiaMART CRM API Key",
            type: "password",
            placeholder: "Paste your API key here e.g. IMXXXXXXXXXX",
            help: "Found in IndiaMART Seller Panel → Settings → CRM API Integration",
          },
        ],
        actionLabel: "Save & Verify Connection →",
      },
      {
        title: "You're connected!",
        subtitle: "Step 3 of 3 — IndiaMART is now syncing leads",
        visual: <IndiamartStep3Visual />,
        instructions: [
          "NestLeads will check for new enquiries every 5 minutes automatically",
          "All new IndiaMART buyer enquiries will appear in your Leads tab",
          "You can also do a manual sync anytime from this page",
          'Each lead will be tagged with source "IndiaMART"',
        ],
        actionLabel: "Go to Leads →",
      },
    ],
  },
  {
    id: "facebook",
    name: "Facebook Lead Ads",
    shortDesc: "Capture leads from FB & Instagram ads instantly",
    color: "#1877F2",
    bgColor: "#EFF6FF",
    icon: "FB",
    connected: false,
    docsUrl:
      "https://developers.facebook.com/docs/marketing-api/guides/lead-ads/",
    steps: [
      {
        title: "Open Facebook Developer App",
        subtitle: "Step 1 of 4 — Set up your Facebook App",
        visual: <FacebookStep1Visual />,
        instructions: [
          "Go to developers.facebook.com and log in with your Facebook account",
          'Click "My Apps" at the top right and open your existing app (or create a new one)',
          'In the left sidebar, go to "Products" and click "+ Add a Product"',
          'Find "Lead Ads Retrieval" and click "Set Up"',
        ],
        actionLabel: "I've set up Lead Ads →",
      },
      {
        title: "Add NestLeads Webhook in Facebook",
        subtitle: "Step 2 of 4 — Tell Facebook where to send leads",
        visual: <FacebookStep2Visual />,
        instructions: [
          'In your Facebook App, go to "Webhooks" in the left menu',
          'Click "Add Callback URL"',
          'Paste the Webhook URL shown below into the "Callback URL" field',
          'In the "Verify Token" field, type exactly: nestleads_verify_token',
          'Click "Verify and Save" — Facebook will confirm the connection',
          'Then subscribe to the "leadgen" field to receive lead notifications',
        ],
        fields: [
          {
            key: "webhook_url",
            label: "Your Webhook URL (copy and paste into Facebook)",
            type: "readonly",
            value: "https://api.nestleads.app/api/facebook/webhook",
            help: "Paste this URL in Facebook App → Webhooks → Callback URL",
          },
          {
            key: "verify_token",
            label: "Verify Token (copy and paste into Facebook)",
            type: "readonly",
            value: "nestleads_verify_token",
            help: "Paste this exact text in Facebook App → Webhooks → Verify Token",
          },
        ],
        actionLabel: "I've added the Webhook →",
      },
      {
        title: "Enter your Page details",
        subtitle: "Step 3 of 4 — Connect your Facebook Page",
        visual: <FacebookStep3Visual />,
        instructions: [
          "Go to your Facebook Page → Settings → Professional Tools → Leads Access",
          "Find your Page ID (it's a number like 123456789) in the About section of your Page",
          "To get a Page Access Token: Go to Graph API Explorer, select your Page, generate token",
          'Make sure the token has "never expire" option enabled',
          "Copy and paste both values below",
        ],
        fields: [
          {
            key: "page_id",
            label: "Facebook Page ID",
            type: "text",
            placeholder: "e.g. 123456789012345",
            help: "Found in your Facebook Page → About → Page Transparency section",
          },
          {
            key: "access_token",
            label: "Page Access Token",
            type: "password",
            placeholder: "EAAxxxxxxxxxxxxxxx...",
            help: "Get this from Graph API Explorer or Page Settings → Access Tokens",
          },
        ],
        actionLabel: "Save & Connect →",
      },
      {
        title: "Facebook Lead Ads connected!",
        subtitle: "Step 4 of 4 — You're all set",
        visual: <FacebookStep4Visual />,
        instructions: [
          "Every time someone fills your Facebook or Instagram Lead Ad, the lead will appear in NestLeads instantly",
          'Leads are tagged with source "Facebook" so you can filter them',
          "You can create separate ad forms for different products and they'll all funnel here",
          "Go to Leads tab and filter by Source → Facebook to see them",
        ],
        actionLabel: "Go to Leads →",
      },
    ],
  },
  {
    id: "tradeindia",
    name: "TradeIndia",
    shortDesc: "Import leads from your TradeIndia listings",
    color: "#16A34A",
    bgColor: "#F0FDF4",
    icon: "TI",
    connected: false,
    docsUrl: "#",
    steps: [
      {
        title: "Get your TradeIndia API credentials",
        subtitle: "Step 1 of 2 — Log in to TradeIndia Seller",
        visual: (
          <div className="border-2 border-black p-5 bg-[#F0FDF4] text-center nb-shadow-sm">
            <div className="w-12 h-12 bg-[#16A34A] border-2 border-black flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-display font-bold text-sm">
                TI
              </span>
            </div>
            <p className="text-sm font-bold text-black">
              tradeindia.com/seller
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Settings → API Access
            </p>
          </div>
        ),
        instructions: [
          "Log in to your TradeIndia Seller account at tradeindia.com",
          "Go to My Account → API Settings",
          "Find your User ID and API Key on that page",
          "Copy both values and paste them below",
        ],
        fields: [
          {
            key: "user_id",
            label: "TradeIndia User ID",
            type: "text",
            placeholder: "Your TradeIndia User ID",
            help: "Found in TradeIndia Seller Panel → My Account → API Settings",
          },
          {
            key: "api_key",
            label: "TradeIndia API Key",
            type: "password",
            placeholder: "Your TradeIndia API Key",
            help: "Found alongside your User ID in API Settings",
          },
        ],
        actionLabel: "Connect TradeIndia →",
      },
      {
        title: "TradeIndia is connected!",
        subtitle: "Step 2 of 2 — Leads will start importing",
        visual: (
          <div className="border-2 border-black bg-[#F0FDF4] p-5 flex flex-col items-center justify-center gap-3 nb-shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-[#16A34A]" />
            <p className="font-display font-bold text-base text-black text-center">
              TradeIndia connected!
            </p>
            <p className="text-xs text-muted-foreground text-center">
              New enquiries will sync automatically
            </p>
          </div>
        ),
        instructions: [
          "NestLeads will check for new TradeIndia enquiries automatically",
          'Leads will be tagged with source "TradeIndia"',
          "You can filter your Leads page by source to see TradeIndia leads",
        ],
        actionLabel: "Go to Leads →",
      },
    ],
  },
  {
    id: "justdial",
    name: "Justdial",
    shortDesc: "Pull enquiries from Justdial business listings",
    color: "#DC2626",
    bgColor: "#FEF2F2",
    icon: "JD",
    connected: false,
    docsUrl: "#",
    steps: [
      {
        title: "Get your Justdial API Key",
        subtitle: "Step 1 of 2 — Contact Justdial for API access",
        visual: (
          <div className="border-2 border-black p-5 bg-[#FEF2F2] nb-shadow-sm">
            <div className="text-xs font-bold text-black mb-3">
              How to get your Justdial API Key:
            </div>
            {[
              "Call Justdial Business Support: 1800-123-456",
              'Ask for "CRM API Integration" setup',
              "They will send your API Key via email",
              "Usually takes 1-2 business days",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-5 h-5 bg-[#DC2626] border-2 border-black flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold">
                    {i + 1}
                  </span>
                </div>
                <p className="text-xs text-black">{s}</p>
              </div>
            ))}
          </div>
        ),
        instructions: [
          "Justdial provides API access on request — call their business support team",
          "Once you receive your API key via email, paste it below",
          "NestLeads will then auto-import all new Justdial enquiries",
        ],
        fields: [
          {
            key: "api_key",
            label: "Justdial API Key",
            type: "password",
            placeholder: "Paste your Justdial API key here",
            help: "Received from Justdial Business Support team via email",
          },
        ],
        actionLabel: "Connect Justdial →",
      },
      {
        title: "Justdial is connected!",
        subtitle: "Step 2 of 2 — All set",
        visual: (
          <div className="border-2 border-black bg-[#FEF2F2] p-5 flex flex-col items-center justify-center gap-3 nb-shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-[#DC2626]" />
            <p className="font-display font-bold text-base text-black text-center">
              Justdial connected!
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Enquiries will sync automatically
            </p>
          </div>
        ),
        instructions: [
          "All Justdial enquiries will now appear in your Leads tab automatically",
          'Leads will be tagged with source "Justdial"',
        ],
        actionLabel: "Go to Leads →",
      },
    ],
  },
];

// ─── Wizard Component ────────────────────────────────────────────────────────

function IntegrationWizard({
  integration,
  onClose,
}: {
  integration: Integration;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const current = integration.steps[step];
  const isLast = step === integration.steps.length - 1;
  const isFirst = step === 0;
  const totalSteps = integration.steps.length;

  const setField = (key: string, val: string) =>
    setFields((p) => ({ ...p, [key]: val }));

  const handleNext = async () => {
    // On the second-to-last step (save step), simulate saving
    const isSaveStep =
      current.fields && current.fields.some((f) => f.type !== "readonly");
    if (isSaveStep) {
      const missing = current.fields?.filter(
        (f) => f.type !== "readonly" && !fields[f.key],
      );
      if (missing?.length) {
        toast({
          title: "Please fill all fields",
          description: `${missing[0].label} is required.`,
          variant: "destructive",
        });
        return;
      }
      setSaving(true);
      await new Promise((r) => setTimeout(r, 1200));
      setSaving(false);
      toast({ title: "Saved!", description: "Verifying connection…" });
    }

    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const copyToClipboard = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="border-b-2 border-black p-4 sm:p-5 flex items-center gap-4"
        style={{ backgroundColor: integration.bgColor }}
      >
        <div
          className="w-12 h-12 border-2 border-black flex items-center justify-center font-display font-bold text-sm text-white shrink-0"
          style={{ backgroundColor: integration.color }}
        >
          {integration.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-xl text-black">
            {integration.name}
          </h2>
          <p className="text-xs text-muted-foreground">{current.subtitle}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-black border-2 border-transparent hover:border-black px-3 py-1.5 transition-all"
        >
          ✕ Close
        </button>
      </div>

      <div className="px-5 pt-4 pb-2 border-b-2 border-black bg-white">
        <div className="flex items-center gap-1">
          {integration.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  "w-7 h-7 border-2 border-black flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  i < step
                    ? "bg-[#00C48C] text-black"
                    : i === step
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-muted-foreground",
                )}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    i < step ? "bg-[#00C48C]" : "bg-[#E5E7EB]",
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {integration.steps.map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <span
                className={cn(
                  "text-[10px] font-bold",
                  i === step ? "text-black" : "text-muted-foreground",
                )}
              >
                {s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 sm:p-6">
          <div className="space-y-5">
            <div>
              <h3 className="font-display font-bold text-xl text-black mb-1">
                {current.title}
              </h3>
            </div>

            <div className="space-y-3">
              {current.instructions.map((inst, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: integration.color,
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm text-black leading-relaxed">{inst}</p>
                </div>
              ))}
            </div>

            {current.fields && current.fields.length > 0 && (
              <div className="space-y-4 pt-2 border-t-2 border-black">
                {current.fields.map((field) => {
                  const isReadonly = field.type === "readonly";
                  const val = isReadonly
                    ? (field.value ?? "")
                    : (fields[field.key] ?? "");
                  return (
                    <div key={field.key}>
                      <label className="block text-sm font-bold text-black mb-1">
                        {field.label}
                      </label>
                      {field.help && (
                        <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {field.help}
                        </p>
                      )}
                      <div className="flex border-2 border-black nb-shadow-sm">
                        <input
                          type={
                            field.type === "password" && !show[field.key]
                              ? "password"
                              : "text"
                          }
                          readOnly={isReadonly}
                          value={val}
                          onChange={(e) =>
                            !isReadonly && setField(field.key, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className={cn(
                            "flex-1 px-3 py-2.5 text-sm font-medium outline-none",
                            isReadonly
                              ? "bg-[#F9FAFB] text-gray-700 font-mono cursor-default"
                              : "bg-white text-black",
                          )}
                        />
                        {isReadonly && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(val, field.label)}
                            className="px-3 border-l-2 border-black hover:bg-[#024BAB]/30 transition-colors flex items-center gap-1 text-xs font-bold text-black"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </button>
                        )}
                        {field.type === "password" && !isReadonly && (
                          <button
                            type="button"
                            onClick={() =>
                              setShow((p) => ({
                                ...p,
                                [field.key]: !p[field.key],
                              }))
                            }
                            className="px-3 border-l-2 border-black hover:bg-[#024BAB]/20 transition-colors"
                          >
                            {show[field.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {integration.docsUrl !== "#" && (
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-black underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                <ExternalLink className="w-3 h-3" />
                Read official documentation
              </a>
            )}
          </div>

          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Visual Guide
            </div>
            {current.visual}

            {!isLast && (
              <div className="border-2 border-[#024BAB] bg-[#024BAB]/10 p-3 nb-shadow-blue flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-black">Need help?</p>
                  <p className="text-[11px] text-black/70 mt-0.5">
                    If you're stuck, follow the numbered steps on the left
                    exactly as shown in the visual above.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-black p-4 bg-white flex items-center justify-between">
        <button
          onClick={() => (isFirst ? onClose() : setStep((s) => s - 1))}
          className="nb-btn bg-white text-black px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {isFirst ? "Cancel" : "Back"}
        </button>

        <div className="text-xs text-muted-foreground font-medium">
          Step {step + 1} of {totalSteps}
        </div>

        <button
          onClick={handleNext}
          disabled={saving}
          className="nb-btn px-6 py-2.5 text-sm flex items-center gap-2 font-bold"
          style={{
            backgroundColor: integration.color,
            color: "#fff",
            borderColor: "#0A0A0A",
          }}
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Verifying…
            </>
          ) : (
            <>{current.actionLabel || "Next →"}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selected, setSelected] = useState<Integration | null>(null);
  const [showFbWizard, setShowFbWizard] = useState(false);
  const [fbStartStep, setFbStartStep] = useState<
    "login" | "select_page" | "select_forms" | "done"
  >("login");
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fbStep = searchParams.get("fb_step");
    const fbError = searchParams.get("fb_error");

    if (fbStep === "select_page") {
      setFbStartStep("select_page");
      setShowFbWizard(true);
      // Clean URL
      setSearchParams({}, { replace: true });
    } else if (fbError) {
      const msg =
        fbError === "access_denied"
          ? "You cancelled the Facebook login."
          : fbError === "token_exchange_failed"
            ? "Facebook login failed. Please try again."
            : `Facebook error: ${fbError}`;
      toast({
        title: "Facebook connection failed",
        description: msg,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = (integ: Integration) => {
    if (integ.id === "facebook") {
      setFbStartStep("login");
      setShowFbWizard(true);
    } else {
      setSelected(integ);
    }
  };

  const handleClose = () => {
    if (selected) {
      setConnectedIds((prev) => new Set([...prev, selected.id]));
    }
    setSelected(null);
  };

  const handleFbClose = () => {
    setShowFbWizard(false);
  };

  const handleFbConnected = () => {
    setConnectedIds((prev) => new Set([...prev, "facebook"]));
  };

  // Show Facebook wizard full-screen
  if (showFbWizard) {
    return (
      <AppLayout title="Integrations">
        <div className="max-w-5xl mx-auto nb-card bg-white min-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
          <FacebookWizard
            onClose={handleFbClose}
            onConnected={handleFbConnected}
            startAtStep={fbStartStep}
          />
        </div>
      </AppLayout>
    );
  }

  // Show other integration wizards full-screen
  if (selected) {
    return (
      <AppLayout title="Integrations">
        <div className="max-w-5xl mx-auto nb-card bg-white min-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
          <IntegrationWizard integration={selected} onClose={handleClose} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Integrations">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="nb-card bg-[#024BAB] p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary border-2 border-black flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-[#024BAB] fill-white" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-black">
              Connect your lead sources
            </h2>
            <p className="text-sm font-medium text-black/70 mt-0.5">
              Connect once — leads flow in automatically. No manual uploads
              needed.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEGRATIONS.map((integ) => {
            const isConnected = connectedIds.has(integ.id);
            return (
              <div
                key={integ.id}
                className="nb-card bg-white p-5 flex flex-col"
              >
                {/* Card top */}
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-12 h-12 border-2 border-black flex items-center justify-center font-display font-bold text-sm text-white shrink-0"
                    style={{ backgroundColor: integ.color }}
                  >
                    {integ.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-base text-black">
                        {integ.name}
                      </h3>
                      {isConnected && (
                        <span className="nb-badge nb-tag-lime flex items-center gap-0.5 text-[10px]">
                          <Check className="w-2.5 h-2.5" /> Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {integ.shortDesc}
                    </p>
                  </div>
                </div>

                {isConnected && (
                  <div className="flex gap-3 mb-4 pb-4 border-b-2 border-black">
                    <div className="border-2 border-black px-3 py-1.5 bg-[#024BAB]/20 text-center flex-1">
                      <p className="font-bold text-lg text-black">14</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        Today
                      </p>
                    </div>
                    <div className="border-2 border-black px-3 py-1.5 bg-[#A3E635]/20 text-center flex-1">
                      <p className="font-bold text-sm text-black flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" /> 2 min
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        Last sync
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 mb-4 flex-wrap">
                  {integ.steps.slice(0, -1).map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="flex items-center gap-1 border border-black px-2 py-0.5 text-[10px] font-bold text-black bg-[#F9FAFB]">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: integ.color }}
                        >
                          {i + 1}
                        </span>
                        {s.title.length > 18
                          ? s.title.slice(0, 18) + "…"
                          : s.title}
                      </div>
                      {i < integ.steps.length - 2 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleOpen(integ)}
                  className="nb-btn w-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 mt-auto"
                  style={
                    isConnected
                      ? { backgroundColor: "#fff", color: "#0A0A0A" }
                      : { backgroundColor: integ.color, color: "#fff" }
                  }
                >
                  {isConnected ? (
                    <>
                      <RefreshCw className="w-4 h-4" /> Manage Connection
                    </>
                  ) : (
                    <>
                      Connect {integ.name} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="nb-card bg-white p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Coming Soon
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Sulekha",
              "99acres",
              "MagicBricks",
              "LinkedIn Lead Gen",
              "Google Ads",
              "IndiaBizForSale",
            ].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 border-2 border-dashed border-black px-3 py-1.5"
              >
                <div className="w-2 h-2 bg-muted-foreground/30 border border-black" />
                <span className="text-xs font-bold text-muted-foreground">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
