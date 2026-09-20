import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { autopilotAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandKitEditor } from "./BrandKitEditor";
import { BrandProfileEditor } from "./BrandProfileEditor";
import { PostingPlan, type PlanPatch } from "./PostingPlan";
import { ScanAnimation } from "./ScanAnimation";
import type { AutopilotStatus } from "./useAutopilot";

// Dashboard home for what the onboarding wizard collected: edit the brand profile,
// logos and colours, the posting plan, or re-scan the profile after the brand changes.
export function BrandSection({ status, reload, toast }: { status: AutopilotStatus; reload: () => Promise<unknown>; toast: any }) {
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const scanning = status.analysis.status === "running";
  const hasIntro = !!(status.intro?.text?.trim() || status.intro?.pdfName);
  const account =
    status.accounts.find((a) => a.platform === "instagram") || status.accounts.find((a) => a.platform === "facebook");

  const fail = (title: string, err: any) => toast({ title, description: err.message, variant: "destructive" });

  const rescan = async () => {
    setStarting(true);
    try {
      await autopilotAPI.analyze(account?._id);
      await reload();
    } catch (err) {
      fail("Couldn't start the scan", err);
    } finally {
      setStarting(false);
    }
  };

  const saveWith = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try {
      await fn();
      await reload();
      toast({ title: ok });
    } catch (err) {
      fail("Failed", err);
    } finally {
      setSaving(false);
    }
  };

  const forget = (i: number) =>
    saveWith(
      () => autopilotAPI.update({ lessons: status.settings.lessons.filter((_, j) => j !== i) }),
      "Rule removed",
    );

  return (
    <div className="rounded-lg border-2 border-black p-4 space-y-4 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Brand &amp; posting plan</h3>
          <p className="text-xs text-muted-foreground">What Autopilot knows about your business. Changes apply to the next post.</p>
        </div>
        {account && (
          <Button variant="outline" size="sm" onClick={rescan} disabled={starting || scanning}>
            {starting || scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Re-scan {account.platform === "facebook" ? "Facebook" : "Instagram"}
          </Button>
        )}
      </div>

      {scanning && (
        <ScanAnimation
          status={status.analysis.status}
          stage={status.analysis.stage}
          accountName={account?.accountName}
          platform={account?.platform}
          avatar={account?.profilePicture}
          hasIntro={hasIntro}
        />
      )}
      {status.analysis.status === "failed" && (
        <p className="text-xs text-red-600">Last scan failed: {status.analysis.error}</p>
      )}
      {status.analysis.note && !scanning && <p className="text-xs text-amber-700">{status.analysis.note}</p>}

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Posting plan</TabsTrigger>
          <TabsTrigger value="profile">Brand profile</TabsTrigger>
          <TabsTrigger value="kit">Logos &amp; colours</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="pt-3 space-y-6">
          <PostingPlan
            status={status}
            saving={saving}
            onSave={(p: PlanPatch) => saveWith(() => autopilotAPI.update({ ...p }), "Posting plan saved")}
          />
          {status.settings.lessons.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rules Autopilot learned from your feedback</p>
              <ul className="flex flex-wrap gap-2">
                {status.settings.lessons.map((l, i) => (
                  <li key={l} className="inline-flex items-center gap-1 rounded-full border-2 border-black px-2.5 py-0.5 text-xs">
                    {l}
                    <button type="button" aria-label={`Forget rule: ${l}`} onClick={() => forget(i)} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
        <TabsContent value="profile" className="pt-3">
          <BrandProfileEditor
            key={status.analysis.at ?? "manual"}
            profile={status.brandProfile}
            saving={saving}
            onSave={(p) => saveWith(() => autopilotAPI.saveBrandProfile(p as unknown as Record<string, unknown>), "Brand profile saved")}
          />
        </TabsContent>
        <TabsContent value="kit" className="pt-3">
          <BrandKitEditor kit={status.brandKit} toast={toast} onChanged={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
