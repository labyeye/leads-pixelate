import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { autopilotAPI, type AutopilotOverview, type CampaignAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Selection = string | "all" | null; // a campaign id, every campaign, or none exist yet

interface Ctx {
  overview: AutopilotOverview | null;
  reloadOverview: () => Promise<unknown>;
  selection: Selection;
  select: (id: string) => void;
  /** API bound to the selected campaign (null while "all" or no campaign). */
  api: CampaignAPI | null;
  openNewCampaign: () => void;
  allowAll: boolean;
}

const CampaignCtx = createContext<Ctx | null>(null);

export function useCampaigns(): Ctx {
  const ctx = useContext(CampaignCtx);
  if (!ctx) throw new Error("useCampaigns must be used inside <CampaignProvider>");
  return ctx;
}

// The campaign a component works on. Only valid where a single campaign is selected.
export function useCampaignApi(): CampaignAPI {
  const { api } = useCampaigns();
  if (!api) throw new Error("No campaign selected");
  return api;
}

// Loads the tenant's campaigns, keeps the selected campaign in the URL (?campaign=<id|all>) so
// every Autopilot page and a page refresh agree, and owns the "New campaign" dialog.
// allowAll: the page can show every campaign together (Dashboard, Report); Setup works on one.
export function CampaignProvider({ allowAll, children }: { allowAll: boolean; children: React.ReactNode }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState<AutopilotOverview | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const reloadOverview = useCallback(async () => {
    try {
      const res = await autopilotAPI.overview();
      setOverview(res.data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load Autopilot");
    }
  }, []);

  useEffect(() => {
    reloadOverview();
    const t = setInterval(reloadOverview, 20_000);
    return () => clearInterval(t);
  }, [reloadOverview]);

  const campaigns = overview?.campaigns ?? [];
  const wanted = params.get("campaign");
  const selection: Selection = useMemo(() => {
    if (!overview) return null;
    if (wanted === "all" && allowAll && campaigns.length > 1) return "all";
    if (wanted && campaigns.some((c) => c.id === wanted)) return wanted;
    if (!campaigns.length) return null;
    if (campaigns.length === 1 || !allowAll) return campaigns[0].id;
    return "all";
  }, [overview, wanted, allowAll, campaigns]);

  const select = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set("campaign", id);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const api = useMemo(() => (selection && selection !== "all" ? autopilotAPI.campaign(selection) : null), [selection]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await autopilotAPI.createCampaign(name.trim());
      await reloadOverview();
      setDialog(false);
      setName("");
      // A new campaign starts in Setup (the wizard).
      navigate(`/social-autopilot/setup?campaign=${res.data.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't create the campaign", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const value: Ctx = { overview, reloadOverview, selection, select, api, openNewCampaign: () => setDialog(true), allowAll };

  if (!overview) {
    return (
      <div className="flex items-center justify-center py-16">
        {error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <CampaignCtx.Provider value={value}>
      {children}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={name}
              maxLength={60}
              placeholder="e.g. Bakery Instagram, Winter sale"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <p className="text-xs text-muted-foreground">
              Each campaign has its own accounts, brand, logos, schedule, references and competitors. Your plan allows{" "}
              {overview.limits.campaigns} campaign{overview.limits.campaigns === 1 ? "" : "s"}.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={creating || !name.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CampaignCtx.Provider>
  );
}
