import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { AutopilotPanel } from "@/components/social/AutopilotPanel";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";
import { BrandSection } from "@/components/social/autopilot/BrandSection";
import { OnboardingWizard } from "@/components/social/autopilot/OnboardingWizard";
import { useAutopilot } from "@/components/social/autopilot/useAutopilot";

function AutopilotContent() {
  const { toast } = useToast();
  // null until the first status arrives; then fixed, so finishing the wizard is what
  // swaps to the dashboard (enabling Autopilot mid-wizard must not unmount it).
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
    return <OnboardingWizard status={status} reload={reload} toast={toast} onDone={() => setWizard(false)} />;
  }
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <AutopilotPanel toast={toast} />
        <AutopilotPosts toast={toast} />
      </div>
      <BrandSection status={status} reload={reload} toast={toast} />
    </div>
  );
}

export default function SocialAutopilotPage() {
  const { user } = useAuth();

  // The backend is admin-only too; this just avoids a dead page for other roles.
  if (user && user.role !== "super_admin" && user.role !== "admin") {
    return <Navigate to="/social-planner" replace />;
  }

  return (
    <AppLayout title="Social Autopilot">
      <AutopilotContent />
    </AppLayout>
  );
}
