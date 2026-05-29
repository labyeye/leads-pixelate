import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  FileText,
  Zap,
  ShieldCheck,
  LogIn,
  LayoutGrid,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { facebookAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FbPage {
  id: string;
  name: string;
  category: string;
  picture: string | null;
  fanCount: number;
}

interface FbForm {
  id: string;
  name: string;
  status: string; // ACTIVE | ARCHIVED
  leadsCount: number;
}

type WizardStep = "login" | "select_page" | "select_forms" | "done";

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: "login", label: "Login", icon: LogIn },
  { id: "select_page", label: "Pick Page", icon: LayoutGrid },
  { id: "select_forms", label: "Pick Forms", icon: FileText },
  { id: "done", label: "Done", icon: CheckCircle2 },
];

function stepIndex(s: WizardStep) {
  return STEPS.findIndex((x) => x.id === s);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onConnected: () => void;
  /** If the user just came back from Facebook OAuth (fb_step=select_page in URL) */
  startAtStep?: WizardStep;
}

export function FacebookWizard({
  onClose,
  onConnected,
  startAtStep = "login",
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>(startAtStep);

  // Page selection state
  const [pages, setPages] = useState<FbPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState<FbPage | null>(null);

  // Forms selection state
  const [forms, setForms] = useState<FbForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(
    new Set(),
  );
  const [allForms, setAllForms] = useState(true); // "capture all forms" toggle
  const [allowedStates, setAllowedStates] = useState<string[]>([]); // empty = all states
  const [stateInput, setStateInput] = useState("");

  const [oauthLoading, setOauthLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Connected pages (multi-page)
  const [connectedPages, setConnectedPages] = useState<
    Array<{ pageId: string; pageName: string; webhookVerified: boolean }>
  >([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Load pages when arriving at select_page step
  useEffect(() => {
    if (step === "select_page") loadPages();
  }, [step]);

  // Load forms when page is selected
  useEffect(() => {
    if (selectedPage) loadForms(selectedPage.id);
  }, [selectedPage]);

  // Load connected pages when on done step
  useEffect(() => {
    if (step === "done") loadConnectedPages();
  }, [step]);

  const loadConnectedPages = async () => {
    try {
      const res = await facebookAPI.getConnectedPages();
      setConnectedPages(res.data);
    } catch {}
  };

  const loadPages = async () => {
    setPagesLoading(true);
    try {
      const res = await facebookAPI.getPages();
      setPages(res.data);
    } catch (err: any) {
      toast({
        title: "Could not load Pages",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPagesLoading(false);
    }
  };

  const loadForms = async (pageId: string) => {
    setFormsLoading(true);
    setForms([]);
    try {
      const res = await facebookAPI.getForms(pageId);
      setForms(res.data);
    } catch (err: any) {
      toast({
        title: "Could not load forms",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFormsLoading(false);
    }
  };

  const handleLoginWithFacebook = async () => {
    setOauthLoading(true);
    try {
      const res = await facebookAPI.getAuthUrl();
      // Open in same tab — Facebook requires this for prod (popup blocked on mobile)
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not get Facebook login URL",
        variant: "destructive",
      });
      setOauthLoading(false);
    }
  };

  const handleNextFromPage = () => {
    if (!selectedPage) {
      toast({
        title: "Select a Page",
        description: "Please choose the Facebook Page your ads run from.",
      });
      return;
    }
    setStep("select_forms");
  };

  const handleConnect = async () => {
    if (!selectedPage) return;
    setConnecting(true);
    try {
      const formIds = allForms ? [] : [...selectedFormIds];
      await facebookAPI.connectPage(selectedPage.id, formIds, allowedStates);
      setStep("done");
      onConnected();
      toast({
        title: "Facebook connected!",
        description: `${selectedPage.name} is now syncing leads.`,
      });
    } catch (err: any) {
      toast({
        title: "Connection failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const toggleForm = (id: string) => {
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const currentStepIdx = stepIndex(step);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b-2 border-black p-5 flex items-center gap-4 bg-[#EFF6FF]">
        <div className="w-12 h-12 bg-[#1877F2] border-2 border-black flex items-center justify-center shrink-0">
          <span className="text-white font-display font-bold text-lg">f</span>
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-black">
            Connect Facebook Lead Ads
          </h2>
          <p className="text-xs text-muted-foreground">
            Leads from your Facebook & Instagram ads flow in automatically
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-black border-2 border-transparent hover:border-black px-3 py-1.5 transition-all"
        >
          ✕ Close
        </button>
      </div>

      {/* Step progress */}
      <div className="px-5 pt-4 pb-3 border-b-2 border-black bg-white">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <div
                key={s.id}
                className="flex items-center flex-1 last:flex-none"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-9 h-9 border-2 border-black flex items-center justify-center transition-colors shrink-0",
                      done
                        ? "bg-[#00C48C]"
                        : active
                          ? "bg-[#1877F2]"
                          : "bg-white",
                    )}
                  >
                    {done ? (
                      <Check className="w-4 h-4 text-black" />
                    ) : (
                      <s.icon
                        className={cn(
                          "w-4 h-4",
                          active ? "text-white" : "text-muted-foreground",
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold mt-1 whitespace-nowrap",
                      active ? "text-black" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-1 mb-4",
                      i < currentStepIdx ? "bg-[#00C48C]" : "bg-[#E5E7EB]",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {step === "login" && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  icon: LogIn,
                  label: "You log in to Facebook",
                  color: "#1877F2",
                },
                {
                  icon: LayoutGrid,
                  label: "Pick your Business Page",
                  color: "#024BAB",
                },
                {
                  icon: Zap,
                  label: "Leads flow in instantly",
                  color: "#00C48C",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="nb-card bg-white p-4 text-center flex flex-col items-center gap-2"
                >
                  <div
                    className="w-10 h-10 border-2 border-black flex items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-bold text-black leading-tight">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {/* What you need */}
            <div className="border-2 border-black p-4 bg-[#024BAB]/10 nb-shadow-sm">
              <p className="text-xs font-bold text-black uppercase tracking-wider mb-3 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> What you need before
                connecting
              </p>
              <ul className="space-y-2">
                {[
                  "A Facebook Business Page (not a personal profile)",
                  "At least one Facebook Lead Ad or Lead Form created",
                  "Admin access to the Page",
                  "Your Facebook account must have access to the Business Page",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-black"
                  >
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#00C48C]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Permissions info */}
            <div className="border-2 border-black p-4 bg-white nb-shadow-sm">
              <p className="text-xs font-bold text-black uppercase tracking-wider mb-2">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> Permissions
                we ask for
              </p>
              <div className="space-y-1.5">
                {[
                  {
                    perm: "pages_show_list",
                    why: "So you can choose which Page to connect",
                  },
                  {
                    perm: "leads_retrieval",
                    why: "To read lead submissions from your ads",
                  },
                  {
                    perm: "pages_read_engagement",
                    why: "To verify page ownership",
                  },
                  {
                    perm: "pages_manage_metadata",
                    why: "To subscribe to real-time lead notifications",
                  },
                ].map(({ perm, why }) => (
                  <div key={perm} className="flex items-start gap-2">
                    <code className="text-[10px] font-mono bg-[#F3F4F6] border border-black px-1.5 py-0.5 shrink-0 text-black">
                      {perm}
                    </code>
                    <span className="text-[11px] text-muted-foreground">
                      {why}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                We never post on your behalf or access your personal profile
                data.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={handleLoginWithFacebook}
              disabled={oauthLoading}
              className="nb-btn w-full py-4 bg-[#1877F2] text-white font-bold text-base flex items-center justify-center gap-3"
            >
              {oauthLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <div className="w-6 h-6 bg-white flex items-center justify-center rounded">
                  <span className="text-[#1877F2] font-bold text-sm">f</span>
                </div>
              )}
              {oauthLoading ? "Opening Facebook…" : "Login with Facebook"}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be redirected to Facebook. After approving, you'll come
              back here to pick your Page.
            </p>
          </div>
        )}

        {step === "select_page" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <h3 className="font-display font-bold text-xl text-black mb-1">
                Which Facebook Page runs your Lead Ads?
              </h3>
              <p className="text-sm text-muted-foreground">
                Select the Page your ads are connected to. Only pages you manage
                are shown.
              </p>
            </div>

            {pagesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-2 border-black p-4 h-20 animate-pulse bg-[#F9FAFB]"
                  />
                ))}
              </div>
            ) : pages.length === 0 ? (
              <div className="nb-card bg-white p-8 text-center">
                <AlertCircle className="w-10 h-10 text-[#EF4444] mx-auto mb-3" />
                <p className="font-bold text-black">No Pages found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure you have a Facebook Business Page and you're logged
                  in with the right account.
                </p>
                <button
                  onClick={loadPages}
                  className="nb-btn mt-4 bg-white text-black px-5 py-2 text-sm flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Try again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pages.map((page) => {
                  const isSelected = selectedPage?.id === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPage(page)}
                      className={cn(
                        "border-2 border-black p-4 flex items-center gap-3 text-left transition-all w-full",
                        isSelected
                          ? "bg-[#1877F2]/10 nb-shadow-sm translate-x-[-2px] translate-y-[-2px]"
                          : "bg-white hover:bg-[#EFF6FF]",
                      )}
                      style={
                        isSelected ? { boxShadow: "4px 4px 0px #1877F2" } : {}
                      }
                    >
                      {page.picture ? (
                        <img
                          src={page.picture}
                          alt={page.name}
                          className="w-12 h-12 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#1877F2] border-2 border-black flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-lg">
                            {page.name[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-black text-sm truncate">
                          {page.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {page.category}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <Users className="w-3 h-3 inline mr-0.5" />
                          {page.fanCount.toLocaleString()} followers
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-[#1877F2] border-2 border-black flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPage && (
              <div className="border-2 border-[#00C48C] bg-[#F0FDF4] p-3 nb-shadow-green flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00C48C] shrink-0" />
                <p className="text-sm font-bold text-black">
                  Selected:{" "}
                  <span className="text-[#16A34A]">{selectedPage.name}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {step === "select_forms" && selectedPage && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <h3 className="font-display font-bold text-xl text-black mb-1">
                Which Lead Forms should we capture?
              </h3>
              <p className="text-sm text-muted-foreground">
                Forms from <strong>{selectedPage.name}</strong>. Leads from
                these forms will appear in NestLeads instantly.
              </p>
            </div>

            {/* All forms toggle */}
            <button
              onClick={() => {
                setAllForms(true);
                setSelectedFormIds(new Set());
              }}
              className={cn(
                "w-full border-2 border-black p-4 flex items-center gap-3 text-left transition-all",
                allForms
                  ? "bg-[#024BAB]/20 nb-shadow-sm"
                  : "bg-white hover:bg-[#024BAB]/10",
              )}
              style={allForms ? { boxShadow: "4px 4px 0px #024BAB" } : {}}
            >
              <div
                className={cn(
                  "w-6 h-6 border-2 border-black flex items-center justify-center shrink-0",
                  allForms ? "bg-[#024BAB]" : "bg-white",
                )}
              >
                {allForms && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
              <div>
                <p className="font-bold text-black text-sm">
                  Capture from ALL forms (recommended)
                </p>
                <p className="text-xs text-muted-foreground">
                  Any new lead form you create will be captured automatically
                </p>
              </div>
            </button>

            {/* Individual forms */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                — or pick specific forms —
              </p>

              {formsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border-2 border-black p-3 h-14 animate-pulse bg-[#F9FAFB]"
                    />
                  ))}
                </div>
              ) : forms.length === 0 ? (
                <div className="border-2 border-black p-5 text-center bg-white">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-sm font-bold text-muted-foreground">
                    No Lead Forms found on this Page
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a Lead Ad on Facebook first, then come back.
                  </p>
                </div>
              ) : (
                forms.map((form) => {
                  const isSelected = selectedFormIds.has(form.id);
                  return (
                    <button
                      key={form.id}
                      onClick={() => {
                        setAllForms(false);
                        toggleForm(form.id);
                      }}
                      className={cn(
                        "w-full border-2 border-black p-3 flex items-center gap-3 text-left transition-all",
                        !allForms && isSelected
                          ? "bg-[#1877F2]/10 nb-shadow-sm"
                          : "bg-white hover:bg-[#EFF6FF]",
                        allForms && "opacity-50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 border-2 border-black flex items-center justify-center shrink-0",
                          !allForms && isSelected ? "bg-[#1877F2]" : "bg-white",
                        )}
                      >
                        {!allForms && isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-black text-sm truncate">
                          {form.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {form.leadsCount} leads collected ·{" "}
                          <span
                            className={
                              form.status === "ACTIVE"
                                ? "text-[#16A34A]"
                                : "text-muted-foreground"
                            }
                          >
                            {form.status}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {!allForms && selectedFormIds.size === 0 && forms.length > 0 && (
              <div className="border-2 border-[#EF4444] bg-[#FEF2F2] p-3 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span className="font-medium text-black">
                  Select at least one form, or choose "All forms"
                </span>
              </div>
            )}

            {/* State / Location filter */}
            <div className="border-2 border-black p-4 bg-white space-y-3">
              <div>
                <p className="text-xs font-bold text-black uppercase tracking-wider">
                  Location Filter (Optional)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Only capture leads from specific states or cities. Leave empty
                  to capture from everywhere.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = stateInput.trim();
                      if (val && !allowedStates.includes(val)) {
                        setAllowedStates((prev) => [...prev, val]);
                      }
                      setStateInput("");
                    }
                  }}
                  placeholder="Type state or city, press Enter"
                  className="flex-1 border-2 border-black px-3 py-2 text-sm focus:outline-none focus:border-[#1877F2]"
                />
                <button
                  onClick={() => {
                    const val = stateInput.trim();
                    if (val && !allowedStates.includes(val)) {
                      setAllowedStates((prev) => [...prev, val]);
                    }
                    setStateInput("");
                  }}
                  className="border-2 border-black px-3 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800"
                >
                  Add
                </button>
              </div>

              {allowedStates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allowedStates.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1 border-2 border-black px-2 py-1 bg-[#EFF6FF] text-xs font-bold"
                    >
                      {s}
                      <button
                        onClick={() =>
                          setAllowedStates((prev) =>
                            prev.filter((x) => x !== s),
                          )
                        }
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {allowedStates.length === 0 && (
                <p className="text-[11px] text-[#00C48C] font-medium">
                  ✓ Capturing leads from all locations
                </p>
              )}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="max-w-lg mx-auto space-y-5 pt-4">
            <div className="nb-card bg-[#F0FDF4] p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 bg-[#00C48C] border-2 border-black flex items-center justify-center nb-shadow">
                <CheckCircle2 className="w-7 h-7 text-black" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-black">
                  Facebook Connected!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Leads from your connected pages flow in automatically.
                </p>
              </div>
            </div>

            {/* Connected pages list */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-black uppercase tracking-wider">
                Connected Pages ({connectedPages.length})
              </p>
              {connectedPages.map((cp) => (
                <div
                  key={cp.pageId}
                  className="border-2 border-black p-3 bg-white flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-[#1877F2] border-2 border-black flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">f</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black truncate">
                      {cp.pageName}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {cp.webhookVerified ? (
                        <>
                          <Check className="w-3 h-3 text-[#00C48C]" /> Webhook
                          active
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-orange-400" />{" "}
                          Webhook pending
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    disabled={syncing === cp.pageId}
                    onClick={async () => {
                      setSyncing(cp.pageId);
                      try {
                        const res = await facebookAPI.sync(cp.pageId);
                        toast({
                          title: "Sync complete",
                          description: res.message,
                        });
                      } catch (err: any) {
                        toast({
                          title: "Sync failed",
                          description: err.message,
                          variant: "destructive",
                        });
                      } finally {
                        setSyncing(null);
                      }
                    }}
                    className="border-2 border-black p-1.5 hover:bg-blue-50 transition-colors mr-1"
                    title="Sync leads now"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#1877F2] ${syncing === cp.pageId ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    disabled={disconnecting === cp.pageId}
                    onClick={async () => {
                      setDisconnecting(cp.pageId);
                      try {
                        await facebookAPI.disconnect(cp.pageId);
                        setConnectedPages((prev) =>
                          prev.filter((p) => p.pageId !== cp.pageId),
                        );
                        toast({ title: `${cp.pageName} disconnected` });
                      } catch (err: any) {
                        toast({
                          title: "Error",
                          description: err.message,
                          variant: "destructive",
                        });
                      } finally {
                        setDisconnecting(null);
                      }
                    }}
                    className="border-2 border-black p-1.5 hover:bg-red-50 transition-colors"
                    title="Disconnect page"
                  >
                    {disconnecting === cp.pageId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Add another page */}
            <button
              onClick={() => {
                setSelectedPage(null);
                setSelectedFormIds(new Set());
                setAllForms(true);
                setStep("select_page");
              }}
              className="nb-btn w-full bg-white text-black py-3 text-sm font-bold flex items-center justify-center gap-2 border-2 border-black hover:bg-[#EFF6FF]"
            >
              <Plus className="w-4 h-4" /> Add Another Page
            </button>

            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                {
                  icon: Zap,
                  color: "#024BAB",
                  title: "Instant capture",
                  desc: "Leads arrive the moment someone submits a form",
                },
                {
                  icon: ShieldCheck,
                  color: "#00C48C",
                  title: "No missed leads",
                  desc: "Webhook ensures zero data loss",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="nb-card bg-white p-3 flex items-start gap-3"
                >
                  <div
                    className="w-8 h-8 border-2 border-black flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    <item.icon className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-black">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-black p-4 bg-white flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            if (step === "login") onClose();
            else if (step === "select_page") setStep("login");
            else if (step === "select_forms") setStep("select_page");
            else onClose();
          }}
          className="nb-btn bg-white text-black px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === "done" ? "Close" : step === "login" ? "Cancel" : "Back"}
        </button>

        <div className="text-xs text-muted-foreground font-bold">
          Step {currentStepIdx + 1} of {STEPS.length}
        </div>

        {step === "login" && (
          <button
            onClick={handleLoginWithFacebook}
            disabled={oauthLoading}
            className="nb-btn bg-[#1877F2] text-white px-6 py-2.5 text-sm font-bold flex items-center gap-2"
          >
            {oauthLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span className="font-bold">f</span>
            )}
            Login with Facebook
          </button>
        )}

        {step === "select_page" && (
          <button
            onClick={handleNextFromPage}
            disabled={!selectedPage}
            className={cn(
              "nb-btn px-6 py-2.5 text-sm font-bold flex items-center gap-2",
              selectedPage
                ? "bg-[#1877F2] text-white"
                : "bg-[#E5E7EB] text-muted-foreground cursor-not-allowed",
            )}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {step === "select_forms" && (
          <button
            onClick={handleConnect}
            disabled={connecting || (!allForms && selectedFormIds.size === 0)}
            className={cn(
              "nb-btn px-6 py-2.5 text-sm font-bold flex items-center gap-2",
              !connecting && (allForms || selectedFormIds.size > 0)
                ? "bg-[#00C48C] text-black"
                : "bg-[#E5E7EB] text-muted-foreground cursor-not-allowed",
            )}
          >
            {connecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Connect Facebook
              </>
            )}
          </button>
        )}

        {step === "done" && (
          <button
            onClick={onClose}
            className="nb-btn bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex items-center gap-2"
          >
            Go to Leads →
          </button>
        )}
      </div>
    </div>
  );
}
