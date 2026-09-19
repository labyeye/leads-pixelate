import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { AutopilotPanel } from "@/components/social/AutopilotPanel";
import { AutopilotPosts } from "@/components/social/AutopilotPosts";

export default function SocialAutopilotPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // The backend is admin-only too; this just avoids a dead page for other roles.
  if (user && user.role !== "super_admin" && user.role !== "admin") {
    return <Navigate to="/social-planner" replace />;
  }

  return (
    <AppLayout title="Social Autopilot">
      <div className="grid gap-6 xl:grid-cols-2 items-start max-w-6xl">
        <AutopilotPanel toast={toast} />
        <AutopilotPosts toast={toast} />
      </div>
    </AppLayout>
  );
}
