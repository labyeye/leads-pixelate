import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Facebook,
  FileText,
  Instagram,
  Loader2,
  PartyPopper,
  Rocket,
  Sparkles,
} from "lucide-react";
import { autopilotAPI, socialAPI } from "@/services/api";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BrandKitEditor } from "./BrandKitEditor";
import { BrandProfileEditor } from "./BrandProfileEditor";
import { GenerationProgress } from "./GenerationProgress";
import { IntroStep } from "./IntroStep";
import { PostingPlan, type PlanPatch } from "./PostingPlan";
import { ReviewActions } from "./ReviewActions";
import { ScanAnimation } from "./ScanAnimation";
import type { AutopilotStatus } from "./useAutopilot";

const STEPS = ["Brand intro", "Accounts", "Scan", "Brand profile", "Logos", "Schedule", "Launch"];
const GIVE_UP_MS = 3 * 60 * 1000;

interface Post {
  _id: string;
  caption: string;
  hashtags?: string[];
  imageUrl: string;
  platforms: string[];
  scheduledAt: string;
  status: string;
  createdAt?: string;
  autopilotMeta?: { revising?: boolean; revisions?: number; revisionError?: string };
}

const PLATFORM_ICON: Record<string, JSX.Element> = {
  facebook: <Facebook className="w-4 h-4 text-blue-600" />,
  instagram: <Instagram className="w-4 h-4 text-pink-600" />,
  linkedin: <LinkedInIcon className="w-4 h-4" />,
};

interface Props {
  status: AutopilotStatus;
  reload: () => Promise<unknown>;
  toast: any;
  onDone: () => void;
}

export function OnboardingWizard({ status, reload, toast, onDone }: Props) {
  const scanState = status.analysis.status;
  const hasIntro = !!(status.intro?.text?.trim() || status.intro?.pdfName);
  const [step, setStep] = useState(scanState === "running" || scanState === "done" ? 2 : 0);
  const [busy, setBusy] = useState(false);
  const [scanFinished, setScanFinished] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => status.accounts.map((a) => a._id));

  const fail = (err: any) => toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
  const chosen = status.accounts.filter((a) => selected.includes(a._id));
  const scanAccount = chosen.find((a) => a.platform === "instagram") || chosen.find((a) => a.platform === "facebook");
  const noAccounts = status.accounts.length === 0;

  const startScan = async () => {
    setBusy(true);
    try {
      try {
        await autopilotAPI.analyze(scanAccount?._id);
      } catch (err: any) {
        if (err.status !== 429) throw err; // scanned a moment ago: just show that result
      }
      setScanFinished(false);
      await reload();
      setStep(2);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, next: number) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      setStep(next);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const savePlan = (p: PlanPatch) => run(() => autopilotAPI.update({ ...p, accountIds: selected }), 6);
  const onScanComplete = useCallback(() => setScanFinished(true), []);

  return (
    <div className="max-w-3xl space-y-6">
      <Stepper step={step} />

      <div key={step} className="animate-fade-in rounded-lg border-2 border-black bg-background nb-shadow p-5 sm:p-6 space-y-5">
        {step === 0 && (
          <>
            <Heading
              icon={<FileText className="w-5 h-5 text-white" />}
              title="Let's set up your Autopilot"
              text="First, tell us about your brand in your own words, or import a document you already have. Autopilot reads it before looking at your social profiles."
            />
            <IntroStep status={status} toast={toast} reload={reload} onNext={() => setStep(1)} />
          </>
        )}

        {step === 1 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="Which accounts should we use?"
              text="We scan your Instagram (or Facebook) to learn how your brand really looks and sounds, and post to everything you tick."
            />
            {noAccounts ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
                <p>Connect a Facebook, Instagram or LinkedIn account first. Autopilot needs somewhere to post.</p>
                <Button asChild size="sm">
                  <Link to="/social-planner?tab=accounts">Connect an account</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Accounts to use</Label>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {status.accounts.map((a) => (
                    <li key={a._id}>
                      <label className="flex items-center gap-3 rounded-lg border-2 border-black/20 has-[:checked]:border-black has-[:checked]:nb-shadow-sm p-3 cursor-pointer">
                        <Checkbox
                          checked={selected.includes(a._id)}
                          onCheckedChange={(c) =>
                            setSelected(c === true ? [...selected, a._id] : selected.filter((x) => x !== a._id))
                          }
                        />
                        {PLATFORM_ICON[a.platform]}
                        <span className="text-sm truncate">{a.accountName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={startScan} disabled={busy || noAccounts || !chosen.length || !status.configured}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Scan my profile
              </Button>
              {!noAccounts && (
                <Button variant="ghost" disabled={busy} onClick={() => setStep(3)}>
                  Skip scan, I'll fill it in myself
                </Button>
              )}
              <BackButton onClick={() => setStep(0)} />
            </div>
            {!status.configured && (
              <p className="text-xs text-amber-700">Autopilot isn't switched on for this server yet. Contact support.</p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title={scanState === "failed" ? "The scan hit a problem" : scanFinished ? "Scan complete" : "Analysing your brand…"}
              text={
                scanState === "failed"
                  ? "Nothing was changed. You can try again or continue and fill in your brand details yourself."
                  : "We're reading your notes and your page the way a new social media manager would."
              }
            />
            {scanState === "failed" ? (
              <>
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {status.analysis.error || "Scan failed"}
                </div>
                <div className="flex gap-3">
                  <Button onClick={startScan} disabled={busy}>
                    {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Try again
                  </Button>
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Continue without it
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ScanAnimation
                  status={scanState}
                  stage={status.analysis.stage}
                  accountName={scanAccount?.accountName}
                  platform={scanAccount?.platform}
                  avatar={scanAccount?.profilePicture}
                  hasIntro={hasIntro}
                  onComplete={onScanComplete}
                />
                {scanFinished && (
                  <Button className="animate-fade-in" onClick={() => setStep(3)}>
                    See what we found <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Heading
              icon={<Check className="w-5 h-5 text-white" />}
              title="Here's what we understood"
              text="Check this is right. Everything is editable, and Autopilot follows it on every post."
            />
            {status.analysis.note && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {status.analysis.note}
              </div>
            )}
            <BrandProfileEditor
              key={status.analysis.at ?? "manual"}
              profile={status.brandProfile}
              saving={busy}
              saveLabel="Looks right, continue"
              onSave={(p) => run(() => autopilotAPI.saveBrandProfile(p as unknown as Record<string, unknown>), 4)}
            />
            <BackButton onClick={() => setStep(1)} />
          </>
        )}

        {step === 4 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="Add your logos"
              text="Upload every logo you use, for example a dark and a light version, and give each a name. Autopilot puts your logo on every image."
            />
            <BrandKitEditor kit={status.brandKit} toast={toast} onChanged={reload} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setStep(5)}>
                {status.brandKit.logos.length ? "Continue" : "Skip for now"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <BackButton onClick={() => setStep(3)} />
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="When and what should we post?"
              text="Pick the days and times, and the kinds of posts you want. You can change this any time."
            />
            <PostingPlan status={status} saving={busy} saveLabel="Continue" onSave={savePlan} />
            <BackButton onClick={() => setStep(4)} />
          </>
        )}

        {step === 6 && <Launch status={status} reload={reload} toast={toast} onDone={onDone} onBack={() => setStep(5)} />}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Setup progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none"
          aria-current={i === step ? "step" : undefined}
        >
          <span
            className={`w-7 h-7 shrink-0 rounded-full border-2 border-black text-xs font-semibold flex items-center justify-center transition-colors ${
              i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-white nb-shadow-sm" : "bg-background"
            }`}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={`hidden lg:inline text-xs whitespace-nowrap ${i === step ? "font-semibold" : "text-muted-foreground"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 min-w-2 ${i < step ? "bg-green-500" : "bg-black/15"}`} />}
        </li>
      ))}
    </ol>
  );
}

function Heading({ icon, title, text }: { icon: JSX.Element; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 bg-primary border-2 border-black nb-shadow flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      <ArrowLeft className="w-4 h-4 mr-1" /> Back
    </Button>
  );
}

// ------------------------------------------------------------------- final step

type Phase = "ready" | "generating" | "review" | "live";

function Launch({ status, reload, toast, onDone, onBack }: Props & { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [post, setPost] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const launchedAt = useRef(0);
  const postId = useRef<string | null>(null);
  const failed = status.progress?.stage === "failed" && !status.running;

  const fail = (err: any) => toast({ title: "Something went wrong", description: err.message, variant: "destructive" });

  const launch = async () => {
    setBusy(true);
    try {
      launchedAt.current = Date.now();
      setTimedOut(false);
      // Enabling starts the trial and kicks off the first run on the server.
      await autopilotAPI.update({ enabled: true });
      await reload();
      setPhase("generating");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      launchedAt.current = Date.now();
      setTimedOut(false);
      await autopilotAPI.run();
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  // Wait for the first post to land; keep refreshing it while the owner reviews (a change
  // request rewrites it in the background).
  useEffect(() => {
    if (phase !== "generating" && phase !== "review") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await socialAPI.getPosts({ source: "autopilot" });
        const pending: Post[] = (res.data as Post[])
          .filter((p) => p.status === "PENDING_APPROVAL")
          .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
        if (cancelled) return;
        if (postId.current) {
          const same = pending.find((p) => p._id === postId.current);
          if (same) setPost(same);
          return;
        }
        const fresh = pending.find((p) => !p.createdAt || +new Date(p.createdAt) >= launchedAt.current - 10_000);
        // Nothing new after the run ended (e.g. a draft was already waiting): show what is there.
        const settled = Date.now() - launchedAt.current > 15_000 && !status.running;
        const found = fresh || (settled ? pending[0] : undefined);
        if (found) {
          postId.current = found._id;
          setPost(found);
          setPhase("review");
        } else if (Date.now() - launchedAt.current > GIVE_UP_MS) {
          setTimedOut(true);
        }
      } catch {
        /* next tick retries */
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [phase, status.running]);

  const approve = async () => {
    if (!post) return;
    await socialAPI.approvePost(post._id);
    await reload();
    setPhase("live");
  };

  const rejectAndRetry = async () => {
    if (!post) return;
    await socialAPI.rejectPost(post._id, "Rejected during Autopilot setup");
    postId.current = null;
    setPost(null);
    launchedAt.current = Date.now();
    setPhase("generating");
    await autopilotAPI.run();
    await reload();
  };

  if (phase === "ready") {
    const logos = status.brandKit.logos;
    const s = status.settings;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const when = s.schedule?.times?.length
      ? `${!s.schedule.days.length || s.schedule.days.length === 7 ? "Every day" : [...s.schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => dayNames[d]).join(", ")} at ${s.schedule.times.join(" & ")}`
      : `${s.postsPerDay} per day`;
    return (
      <>
        <Heading
          icon={<Rocket className="w-5 h-5 text-white" />}
          title="Ready to launch"
          text={`We'll create your first post now so you can see exactly what Autopilot makes. During your ${status.trialDays}-day free trial you approve every post, and you can ask for changes.`}
        />
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <Fact
            label="Posting to"
            value={
              status.accounts
                .filter((a) => s.accountIds.length === 0 || s.accountIds.includes(a._id))
                .map((a) => a.accountName)
                .join(", ") || "—"
            }
          />
          <Fact label="When" value={when} />
          <Fact label="Language" value={s.language} />
          <Fact
            label="Logos"
            value={!logos.length || !status.brandKit.logoEnabled ? "None" : `${logos.length} (${status.brandKit.logoMode === "auto" ? "picked automatically" : "fixed"})`}
          />
        </ul>
        {status.entitlement.state === "none" && (
          <p className="text-xs rounded-lg border border-blue-200 bg-blue-50 text-blue-800 p-3">
            Free for {status.trialDays} days, then Autopilot is included in your NestLeads plan. Your trial starts when you
            launch and includes up to {status.limits.daysPerWeek} posting days a week. After the trial, posts you have approved
            before go out automatically.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={launch} disabled={busy || !status.configured}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate my first post
          </Button>
          <BackButton onClick={onBack} />
        </div>
      </>
    );
  }

  if (phase === "generating") {
    return (
      <div className="space-y-4">
        <GenerationProgress stage={status.progress?.stage} />
        {(failed || timedOut) && (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {failed && status.lastError ? status.lastError : "This is taking longer than expected."}
            </div>
            <Button onClick={retry} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "review" && post) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Heading
          icon={<Sparkles className="w-5 h-5 text-white" />}
          title="Your first post is ready"
          text="Something not right? Ask for a change and Autopilot fixes it and regenerates. Approve it when you're happy."
        />
        <div className="grid sm:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt="Generated post"
              className="w-full aspect-[4/5] object-cover rounded-lg border-2 border-black nb-shadow bg-muted"
            />
          )}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {post.platforms.map((p) => (
                <span key={p}>{PLATFORM_ICON[p]}</span>
              ))}
              <span>
                Scheduled{" "}
                {new Date(post.scheduledAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-line">{post.caption}</p>
            {!!post.hashtags?.length && (
              <p className="text-sm text-primary">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
            )}
            <ReviewActions
              post={post}
              toast={toast}
              onChanged={reload}
              approveLabel="Approve"
              rejectLabel="Reject & try another"
              onApprove={approve}
              onReject={rejectAndRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4 py-4 animate-fade-in">
      <span className="mx-auto w-16 h-16 rounded-full border-2 border-black bg-green-500 flex items-center justify-center nb-shadow animate-pop-in">
        <PartyPopper className="w-8 h-8 text-white" />
      </span>
      <h2 className="text-xl font-semibold">Autopilot is live</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        New posts are prepared a day ahead at the times you chose. During your free trial you approve each one, and what you
        approve or correct teaches Autopilot your style. You can pause any time.
      </p>
      <Button size="lg" onClick={onDone}>
        Go to my Autopilot <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-lg border-2 border-black/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </li>
  );
}
