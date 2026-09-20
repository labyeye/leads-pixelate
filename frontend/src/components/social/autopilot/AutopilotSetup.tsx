import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AutopilotPanel } from "@/components/social/AutopilotPanel";
import { BrandSection } from "./BrandSection";
import { OnboardingWizard } from "./OnboardingWizard";
import { useAutopilot } from "./useAutopilot";

// Setup: a new tenant is walked through brand intro, scan, logos and schedule; after that this
// page holds the settings, brand profile, logos and posting plan.
export function AutopilotSetup({ toast }: { toast: any }) {
  const navigate = useNavigate();
  // null until the first status arrives; then fixed, so finishing the wizard is what leaves it
  // (enabling Autopilot mid-wizard must not unmount it).
  const [wizard, setWizard] = useState<boolean | null>(null);

  // Fast polling only while a scan or a generation is in flight.
  const [fast, setFast] = useState(false);
  const { status, reload } = useAutopilot(fast ? 1500 : 10_000);
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
          navigate("/social-autopilot");
        }}
      />
    );
  }
  return (
    <div className="space-y-6">
      <AutopilotPanel toast={toast} />
      <BrandSection status={status} reload={reload} toast={toast} />
    </div>
  );
}
