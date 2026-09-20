import { useState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCampaignApi, useCampaigns } from "./CampaignContext";
import type { AutopilotStatus } from "./useAutopilot";

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const daysLeft = (d: string) => Math.max(1, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));

// One campaign's basics: name, the accounts it posts to (an account belongs to one campaign),
// the on/off switch, and deleting it.
export function CampaignSettings({
  status,
  reload,
  toast,
  onDeleted,
}: {
  status: AutopilotStatus;
  reload: () => Promise<unknown>;
  toast: any;
  onDeleted: () => void;
}) {
  const api = useCampaignApi();
  const { reloadOverview } = useCampaigns();
  const [name, setName] = useState(status.campaign.name);
  const [accountIds, setAccountIds] = useState<string[]>(status.settings.accountIds);
  const [busy, setBusy] = useState<string | null>(null);
  const { entitlement: ent, settings } = status;

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      await Promise.all([reload(), reloadOverview()]);
      toast({ title: ok });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const banner =
    ent.state === "trial" && ent.endsAt
      ? `Free trial: ${daysLeft(ent.endsAt)} day(s) left (ends ${fmtDate(ent.endsAt)}). Every post waits for your approval. After that Autopilot is included in your NestLeads plan.`
      : ent.state === "paid" && ent.endsAt
        ? `Included in your NestLeads plan until ${fmtDate(ent.endsAt)}.`
        : ent.state === "expired"
          ? "Your Autopilot access has ended. Choose a NestLeads plan to keep it running."
          : `Free for ${status.trialDays} days, then it comes with your NestLeads plan. Turn it on to start your trial.`;
  const noAccounts = status.accounts.length === 0;
  const accountsChanged = [...accountIds].sort().join() !== [...settings.accountIds].sort().join();

  return (
    <div className="rounded-lg border-2 border-black p-4 space-y-5 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaign settings</h2>
          <p className="text-xs text-muted-foreground">{banner}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          {settings.enabled ? "On" : "Off"}
          <Switch
            aria-label="Autopilot on or off"
            checked={settings.enabled}
            disabled={busy === "toggle" || (ent.state === "expired" && !settings.enabled) || (!settings.enabled && !settings.accountIds.length)}
            onCheckedChange={(on) => act("toggle", () => api.update({ enabled: on }), on ? "Campaign is on" : "Campaign paused")}
          />
        </label>
      </div>
      {!settings.enabled && !settings.accountIds.length && (
        <p className="flex gap-2 text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> Choose the account(s) this campaign posts to, then you can turn it on.
        </p>
      )}
      {!status.configured && (
        <p className="text-xs text-amber-800">Autopilot isn't switched on for this server yet. Contact support.</p>
      )}

      <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-rename">Campaign name</Label>
          <Input id="campaign-rename" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          variant="outline"
          disabled={busy === "name" || !name.trim() || name.trim() === status.campaign.name}
          onClick={() => act("name", () => api.update({ name: name.trim() }), "Campaign renamed")}
        >
          {busy === "name" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Rename
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Posts to</Label>
        <p className="text-xs text-muted-foreground">
          An account can belong to one campaign only, so two campaigns never post to the same page.
        </p>
        {noAccounts ? (
          <p className="text-sm text-muted-foreground">Connect an account in Social Media Planner → Connected Accounts first.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {status.accounts.map((a) => {
              const elsewhere = a.campaign && a.campaign.id !== status.campaign.id ? a.campaign.name : null;
              return (
                <li key={a._id}>
                  <label
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
                      elsewhere ? "border-black/10 opacity-60" : "border-black/20 has-[:checked]:border-black cursor-pointer"
                    }`}
                  >
                    <Checkbox
                      disabled={!!elsewhere}
                      checked={accountIds.includes(a._id)}
                      onCheckedChange={(c) => setAccountIds(c === true ? [...accountIds, a._id] : accountIds.filter((x) => x !== a._id))}
                    />
                    <span className="capitalize text-xs text-muted-foreground">{a.platform}</span>
                    <span className="text-sm truncate">{a.accountName}</span>
                    {elsewhere && <span className="ml-auto text-[11px] text-muted-foreground">used by {elsewhere}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="outline"
          disabled={busy === "accounts" || !accountsChanged}
          onClick={() => act("accounts", () => api.update({ accountIds }), "Accounts saved")}
        >
          {busy === "accounts" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save accounts
        </Button>
      </div>

      <div className="border-t-2 border-black/10 pt-4">
        <Button
          variant="ghost"
          className="text-red-700 hover:text-red-800"
          disabled={busy === "delete"}
          onClick={async () => {
            if (!confirm(`Delete the campaign "${status.campaign.name}"? Its queued posts go back to drafts. Published posts stay.`)) return;
            setBusy("delete");
            try {
              await api.remove();
              await reloadOverview();
              toast({ title: "Campaign deleted" });
              onDeleted();
            } catch (err: any) {
              toast({ title: "Failed", description: err.message, variant: "destructive" });
              setBusy(null);
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete this campaign
        </Button>
      </div>
    </div>
  );
}
