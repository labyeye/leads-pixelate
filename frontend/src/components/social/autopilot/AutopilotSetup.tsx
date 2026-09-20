import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandSection } from "./BrandSection";
import { CampaignSettings } from "./CampaignSettings";
import { useCampaigns } from "./CampaignContext";
import { OnboardingWizard } from "./OnboardingWizard";
import { useAutopilot } from "./useAutopilot";

// Setup of ONE campaign: a new campaign is walked through brand intro, accounts, references and
// competitors, scan, logos and schedule; after that this page holds its settings, brand profile,
// references and competitors, logos and posting plan.
function SetupBody({ campaignId, toast }: { campaignId: string; toast: any }) {
  const navigate = useNavigate();
  // null until the first status arrives; then fixed, so finishing the wizard is what leaves it
  // (enabling Autopilot mid-wizard must not unmount it).
  const [wizard, setWizard] = useState<boolean | null>(null);

  // Fast polling only while a scan or a generation is in flight.
  const [fast, setFast] = useState(false);
  const { status, reload } = useAutopilot(campaignId, fast ? 1500 : 10_000);
  const busyNow = !!status && (status.analysis.status === "running" || status.running);
  if (busyNow !== fast) setFast(busyNow);
  if (status && wizard === null) setWizard(status.onboarded === false);

  if (!status || wizard === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (wizard) {
    return (
      <OnboardingWizard
        status={status}
        reload={reload}
        toast={toast}
        onDone={() => {
          setWizard(false);
          navigate(`/social-autopilot?campaign=${campaignId}`);
        }}
      />
    );
  }
  return (
    <div className="space-y-6">
      <CampaignSettings status={status} reload={reload} toast={toast} onDeleted={() => navigate("/social-autopilot")} />
      <BrandSection status={status} reload={reload} toast={toast} />
    </div>
  );
}

export function AutopilotSetup({ toast }: { toast: any }) {
  const { overview, selection, openNewCampaign } = useCampaigns();

  if (!overview?.campaigns.length) {
    return (
      <div className="nb-card p-8 bg-white text-center space-y-3">
        <h2 className="font-display font-bold text-xl text-black">Create your first Autopilot campaign</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Each campaign has its own accounts, brand, logos, schedule, references and competitors, so you can run several brands
          or pages side by side.
        </p>
        <Button onClick={openNewCampaign}>
          <Plus className="w-4 h-4 mr-1" /> New campaign
        </Button>
      </div>
    );
  }
  if (!selection || selection === "all") return null;
  // key: another campaign starts from a clean slate (its own wizard state)
  return <SetupBody key={selection} campaignId={selection} toast={toast} />;
}
