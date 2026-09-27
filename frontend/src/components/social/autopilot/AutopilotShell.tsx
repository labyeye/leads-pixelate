import { useState } from "react";
import { NavLink, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, LayoutDashboard, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CampaignProvider, useCampaigns } from "./CampaignContext";

const TABS = [
  { to: "/social-autopilot", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/social-autopilot/setup", label: "Setup", icon: Settings2, end: false },
  { to: "/social-autopilot/report", label: "Report", icon: BarChart3, end: false },
];
const NEW = "__new";

// Picks the campaign every Autopilot page works on (the choice lives in the URL).
function CampaignSwitcher() {
  const { overview, selection, select, api, reloadOverview, openNewCampaign, allowAll } = useCampaigns();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const campaigns = overview?.campaigns ?? [];
  if (!campaigns.length) return null;
  const canAdd = campaigns.length < (overview?.limits.campaigns ?? 1);
  const current = campaigns.find((c) => c.id === selection);

  const remove = async () => {
    if (!current || !api) return;
    if (!confirm(`Delete the campaign "${current.name}"? Its queued posts go back to drafts. Published posts stay.`)) return;
    setDeleting(true);
    try {
      await api.remove();
      await reloadOverview();
      toast({ title: "Campaign deleted" });
      navigate("/social-autopilot");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selection ?? undefined} onValueChange={(v) => (v === NEW ? openNewCampaign() : select(v))}>
        <SelectTrigger className="w-[230px] h-10 border-2 border-black bg-white font-bold" aria-label="Campaign">
          <SelectValue placeholder="Choose a campaign" />
        </SelectTrigger>
        <SelectContent>
          {allowAll && campaigns.length > 1 && <SelectItem value="all">All campaigns</SelectItem>}
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              {!c.enabled && <span className="text-muted-foreground"> · paused</span>}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NEW}>+ New campaign</SelectItem>
        </SelectContent>
      </Select>
      {canAdd && (
        <Button type="button" variant="outline" size="icon" className="border-2 border-black" aria-label="New campaign" onClick={openNewCampaign}>
          <Plus className="w-4 h-4" />
        </Button>
      )}
      {current && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-2 border-black text-red-700 hover:text-red-800"
          aria-label="Delete campaign"
          disabled={deleting}
          onClick={remove}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const keep = params.get("campaign") ? `?campaign=${params.get("campaign")}` : "";
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Autopilot sections">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to + keep}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-2 border-black transition-colors",
                  isActive ? "bg-[#024BAB] text-white nb-shadow-sm" : "bg-white text-black hover:bg-[#FFDE00]",
                )
              }
            >
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <CampaignSwitcher />
      </div>
      {children}
    </div>
  );
}

// Frame shared by the three Autopilot pages: Dashboard (numbers + queue), Setup, Report, with the
// campaign picker. allowAll: this page can show every campaign together.
export function AutopilotShell({ children, allowAll = false }: { children: React.ReactNode; allowAll?: boolean }) {
  const { user } = useAuth();

  // The backend is admin-only too; this just avoids a dead page for other roles.
  if (user && user.role !== "super_admin" && user.role !== "admin") {
    return <Navigate to="/social-planner" replace />;
  }

  return (
    <AppLayout title="Social Autopilot">
      <CampaignProvider allowAll={allowAll}>
        <Frame>{children}</Frame>
      </CampaignProvider>
    </AppLayout>
  );
}
