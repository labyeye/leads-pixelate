import { AutopilotShell } from "@/components/social/autopilot/AutopilotShell";
import { AutopilotReport } from "@/components/social/autopilot/AutopilotReport";

export default function SocialAutopilotReportPage() {
  return (
    <AutopilotShell allowAll>
      <AutopilotReport />
    </AutopilotShell>
  );
}
