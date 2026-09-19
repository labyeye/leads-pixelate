import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Facebook, Instagram, Loader2, PartyPopper, Rocket, Sparkles } from "lucide-react";
import { autopilotAPI, socialAPI } from "@/services/api";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandKitEditor } from "./BrandKitEditor";
import { BrandProfileEditor } from "./BrandProfileEditor";
import { GenerationProgress } from "./GenerationProgress";
import { ScanAnimation } from "./ScanAnimation";
import type { AutopilotStatus } from "./useAutopilot";

const STEPS = ["Connect", "Scan", "Brand profile", "Logos & colours", "Preferences", "Launch"];
const GIVE_UP_MS = 3 * 60 * 1000;
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

interface Post {
  _id: string;
  caption: string;
  hashtags?: string[];
  imageUrl: string;
  platforms: string[];
  scheduledAt: string;
  status: string;
  createdAt?: string;
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
  const [step, setStep] = useState(scanState === "running" || scanState === "done" ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [scanFinished, setScanFinished] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => status.accounts.map((a) => a._id));
  const [prefs, setPrefs] = useState({
    language: status.settings.language,
    postsPerDay: status.settings.postsPerDay,
    tone: status.settings.tone || status.brandProfile?.tone || "",
    notes: status.settings.notes,
    reviewFirst: status.settings.reviewFirst,
  });

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
      setStep(1);
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

  const onScanComplete = useCallback(() => setScanFinished(true), []);

  return (
    <div className="max-w-3xl space-y-6">
      <Stepper step={step} />

      <div key={step} className="animate-fade-in rounded-lg border-2 border-black bg-background nb-shadow p-5 sm:p-6 space-y-5">
        {step === 0 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="Let's set up your Autopilot"
              text="Autopilot studies your Instagram or Facebook page, learns how your brand looks and sounds, then creates posts that fit. It takes about two minutes."
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
                <p className="text-xs text-muted-foreground">
                  We scan your Instagram (or Facebook) to learn your style, and post to everything you tick.
                </p>
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
                <Button variant="ghost" disabled={busy} onClick={() => setStep(2)}>
                  Skip scan, I'll fill it in myself
                </Button>
              )}
            </div>
            {!status.configured && (
              <p className="text-xs text-amber-700">Autopilot isn't switched on for this server yet. Contact support.</p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title={scanState === "failed" ? "The scan hit a problem" : scanFinished ? "Scan complete" : "Scanning your profile…"}
              text={
                scanState === "failed"
                  ? "Nothing was changed. You can try again or continue and fill in your brand details yourself."
                  : "We're reading your page the way a new social media manager would."
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
                  <Button variant="outline" onClick={() => setStep(2)}>
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
                  onComplete={onScanComplete}
                />
                {scanFinished && (
                  <Button className="animate-fade-in" onClick={() => setStep(2)}>
                    See what we found <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {step === 2 && (
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
              onSave={(p) => run(() => autopilotAPI.saveBrandProfile(p as any), 3)}
            />
            <BackButton onClick={() => setStep(0)} />
          </>
        )}

        {step === 3 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="Your logos and colours"
              text="Upload your logos and name them. Autopilot stamps your logo on every image and uses your colours in the artwork."
            />
            <BrandKitEditor kit={status.brandKit} toast={toast} onChanged={reload} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setStep(4)}>
                {status.brandKit.logos.length ? "Continue" : "Skip for now"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <BackButton onClick={() => setStep(2)} />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Heading
              icon={<Sparkles className="w-5 h-5 text-white" />}
              title="How should Autopilot post?"
              text="You can change any of this later."
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={prefs.language} onValueChange={(v) => setPrefs({ ...prefs, language: v })}>
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
              <div className="space-y-1.5">
                <Label>Posts per day</Label>
                <Select value={String(prefs.postsPerDay)} onValueChange={(v) => setPrefs({ ...prefs, postsPerDay: Number(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 per day</SelectItem>
                    <SelectItem value="2">2 per day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Brand tone (optional)</Label>
              <Input
                maxLength={200}
                placeholder="e.g. friendly, professional, no slang"
                value={prefs.tone}
                onChange={(e) => setPrefs({ ...prefs, tone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Anything else Autopilot should know? (optional)</Label>
              <Textarea
                rows={3}
                maxLength={500}
                placeholder="What to focus on, what to avoid, your audience…"
                value={prefs.notes}
                onChange={(e) => setPrefs({ ...prefs, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-black/20 p-3">
              <div>
                <p className="text-sm font-medium">Ask me before every post</p>
                <p className="text-xs text-muted-foreground">
                  Off (recommended): you approve the first post, then Autopilot runs on its own.
                </p>
              </div>
              <Switch checked={prefs.reviewFirst} onCheckedChange={(v) => setPrefs({ ...prefs, reviewFirst: v })} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy}
                onClick={() => run(() => autopilotAPI.update({ ...prefs, accountIds: selected }), 5)}
              >
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <BackButton onClick={() => setStep(3)} />
            </div>
          </>
        )}

        {step === 5 && <Launch status={status} reload={reload} toast={toast} onDone={onDone} onBack={() => setStep(4)} />}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Setup progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none" aria-current={i === step ? "step" : undefined}>
          <span
            className={`w-7 h-7 shrink-0 rounded-full border-2 border-black text-xs font-semibold flex items-center justify-center transition-colors ${
              i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-white nb-shadow-sm" : "bg-background"
            }`}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={`hidden md:inline text-xs whitespace-nowrap ${i === step ? "font-semibold" : "text-muted-foreground"}`}>
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

  // Wait for the first post to land, then show it for approval.
  useEffect(() => {
    if (phase !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await socialAPI.getPosts({ source: "autopilot" });
        const pending: Post[] = (res.data as Post[])
          .filter((p) => p.status === "PENDING_APPROVAL")
          .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
        const fresh = pending.find((p) => !p.createdAt || +new Date(p.createdAt) >= launchedAt.current - 10_000);
        // Nothing new after the run ended (e.g. a draft was already waiting): show what is there.
        const settled = Date.now() - launchedAt.current > 15_000 && !status.running;
        const found = fresh || (settled ? pending[0] : undefined);
        if (!cancelled && found) {
          setPost(found);
          setPhase("review");
        } else if (!cancelled && Date.now() - launchedAt.current > GIVE_UP_MS) {
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

  const decide = async (approve: boolean) => {
    if (!post) return;
    setBusy(true);
    try {
      if (approve) {
        await socialAPI.approvePost(post._id);
        await reload();
        setPhase("live");
      } else {
        await socialAPI.rejectPost(post._id, "Rejected during Autopilot setup");
        setPost(null);
        launchedAt.current = Date.now();
        setPhase("generating");
        await autopilotAPI.run();
        await reload();
      }
    } catch (err) {
      fail(err);
      if (!approve) setPhase("review");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "ready") {
    const logo = status.brandKit.logos.find((l) => l.id === status.brandKit.logoId) || status.brandKit.logos[0];
    return (
      <>
        <Heading icon={<Rocket className="w-5 h-5 text-white" />} title="Ready to launch" text="We'll create your first post now so you can see exactly what Autopilot makes." />
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <Fact label="Posting to" value={status.accounts.filter((a) => status.settings.accountIds.length === 0 || status.settings.accountIds.includes(a._id)).map((a) => a.accountName).join(", ") || "—"} />
          <Fact label="Language" value={status.settings.language} />
          <Fact label="Posts per day" value={String(status.settings.postsPerDay)} />
          <Fact label="Logo" value={logo && status.brandKit.logoEnabled ? logo.name : "None"} />
        </ul>
        {status.entitlement.state === "none" && (
          <p className="text-xs rounded-lg border border-blue-200 bg-blue-50 text-blue-800 p-3">
            Free for {status.trialDays} days, then {rupees(status.price)}/month. Your trial starts when you launch.
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
          text="Approve it and Autopilot takes over. From now on new posts are created and published automatically."
        />
        <div className="grid sm:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
          {post.imageUrl && <img src={post.imageUrl} alt="Generated post" className="w-full aspect-[4/5] object-cover rounded-lg border-2 border-black nb-shadow bg-muted" />}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {post.platforms.map((p) => (
                <span key={p}>{PLATFORM_ICON[p]}</span>
              ))}
              <span>
                Scheduled {new Date(post.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-line">{post.caption}</p>
            {!!post.hashtags?.length && <p className="text-sm text-primary">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button onClick={() => decide(true)} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Approve &amp; go automatic
              </Button>
              <Button variant="outline" onClick={() => decide(false)} disabled={busy}>
                Reject &amp; try another
              </Button>
            </div>
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
        New posts will be created and published on their own. You won't be asked to approve them again, and you can pause any time.
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
