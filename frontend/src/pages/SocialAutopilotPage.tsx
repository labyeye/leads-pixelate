import { useToast } from "@/components/ui/use-toast";
import { AutopilotShell } from "@/components/social/autopilot/AutopilotShell";
import { AutopilotDashboard } from "@/components/social/autopilot/AutopilotDashboard";

// Dashboard: one campaign, or every campaign together.
export default function SocialAutopilotPage() {
  const { toast } = useToast();
  return (
    <AutopilotShell allowAll>
      <AutopilotDashboard toast={toast} />
    </AutopilotShell>
  );
}
