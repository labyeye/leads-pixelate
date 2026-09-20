import { useToast } from "@/components/ui/use-toast";
import { AutopilotShell } from "@/components/social/autopilot/AutopilotShell";
import { AutopilotSetup } from "@/components/social/autopilot/AutopilotSetup";

export default function SocialAutopilotSetupPage() {
  const { toast } = useToast();
  return (
    <AutopilotShell>
      <AutopilotSetup toast={toast} />
    </AutopilotShell>
  );
}
