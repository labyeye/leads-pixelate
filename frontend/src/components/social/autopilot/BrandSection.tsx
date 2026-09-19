import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { autopilotAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandKitEditor } from "./BrandKitEditor";
import { BrandProfileEditor } from "./BrandProfileEditor";
import { ScanAnimation } from "./ScanAnimation";
import type { AutopilotStatus } from "./useAutopilot";

// Dashboard home for what the onboarding wizard collected: edit the brand profile,
// logos and colours, or re-scan the profile after the brand changes.
export function BrandSection({ status, reload, toast }: { status: AutopilotStatus; reload: () => Promise<unknown>; toast: any }) {
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const scanning = status.analysis.status === "running";
  const account =
    status.accounts.find((a) => a.platform === "instagram") || status.accounts.find((a) => a.platform === "facebook");

  const rescan = async () => {
    setStarting(true);
    try {
      await autopilotAPI.analyze(account?._id);
      await reload();
    } catch (err: any) {
      toast({ title: "Couldn't start the scan", description: err.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const saveProfile = async (p: unknown) => {
    setSaving(true);
    try {
      await autopilotAPI.saveBrandProfile(p as Record<string, unknown>);
      await reload();
      toast({ title: "Brand profile saved" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-black p-4 space-y-4 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Brand</h3>
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
        />
      )}
      {status.analysis.status === "failed" && (
        <p className="text-xs text-red-600">Last scan failed: {status.analysis.error}</p>
      )}
      {status.analysis.note && !scanning && <p className="text-xs text-amber-700">{status.analysis.note}</p>}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Brand profile</TabsTrigger>
          <TabsTrigger value="kit">Logos &amp; colours</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-3">
          <BrandProfileEditor key={status.analysis.at ?? "manual"} profile={status.brandProfile} saving={saving} onSave={saveProfile} />
        </TabsContent>
        <TabsContent value="kit" className="pt-3">
          <BrandKitEditor kit={status.brandKit} toast={toast} onChanged={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
