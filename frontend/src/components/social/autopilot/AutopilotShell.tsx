import { NavLink, Navigate } from "react-router-dom";
import { BarChart3, LayoutDashboard, Settings2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/social-autopilot", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/social-autopilot/setup", label: "Setup", icon: Settings2, end: false },
  { to: "/social-autopilot/report", label: "Report", icon: BarChart3, end: false },
];

// Frame shared by the three Autopilot pages: Dashboard (numbers + queue), Setup, Report.
export function AutopilotShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // The backend is admin-only too; this just avoids a dead page for other roles.
  if (user && user.role !== "super_admin" && user.role !== "admin") {
    return <Navigate to="/social-planner" replace />;
  }

  return (
    <AppLayout title="Social Autopilot">
      <div className="max-w-6xl space-y-6">
        <nav className="flex flex-wrap gap-2" aria-label="Autopilot sections">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
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
        {children}
      </div>
    </AppLayout>
  );
}
