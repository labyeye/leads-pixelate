import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getNavGroupsForRole } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, LogOut, Zap, X } from "lucide-react";
import { useState } from "react";
import nestleadslogo from "@/assets/images/NestLeads_Logo_Name.png";
import nestleadslogosmall from "../../../public/favicon.png";

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const groups = getNavGroupsForRole(user.role);

  return (
    <>
      <aside
        className={cn(
          "h-screen min-h-screen bg-white border-r-2 border-black flex flex-col transition-all duration-300 ease-out z-50 shrink-0",
          "fixed inset-y-0 left-0 lg:sticky lg:top-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "h-16 flex items-center border-b-2 border-black shrink-0",
            collapsed ? "lg:justify-center lg:px-2 px-4 gap-3" : "px-4 gap-3",
          )}
        >
          {}
          <img
            src={nestleadslogo}
            alt="NestLeads"
            className={cn(
              "h-14 w-auto object-contain shrink-0",
              collapsed && "lg:hidden",
            )}
          />
          <img
            src={nestleadslogosmall}
            alt="NestLeads"
            className={cn(
              "hidden items-center justify-center w-10 h-10 shrink-0",
              collapsed && "lg:flex",
            )}
          />

          <button
            onClick={onClose}
            className="ml-auto lg:hidden p-1 hover:bg-[#024BAB]/20 border border-transparent hover:border-black transition-colors"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.href;
                  const isWa = group.label === "WhatsApp";
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={collapsed ? item.title : undefined}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-100 border-2",
                        active && isWa
                          ? "bg-[#25D366] border-black text-white nb-shadow-sm"
                          : active
                            ? "bg-[#024BAB] border-black text-white nb-shadow-sm"
                            : isWa
                              ? "border-transparent text-black hover:bg-[#25D366]/10 hover:border-[#25D366]/60"
                              : "border-transparent text-black hover:bg-[#024BAB]/10 hover:border-black",
                        collapsed && "lg:justify-center lg:px-0",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0",
                          isWa && !active && "text-[#25D366]",
                        )}
                      />
                      <span className={cn(collapsed && "lg:hidden")}>
                        {item.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={cn(
            "border-t-2 border-black px-3 py-3 shrink-0",
            collapsed && "lg:hidden",
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#024BAB] border-2 text-white border-black flex items-center justify-center text-xs font-bold shrink-0">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-black truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate capitalize">
                {user.role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs font-semibold text-black hover:text-red-600 transition-colors w-full py-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-4 top-20 w-7 h-7 bg-[#024BAB] border-2 border-black items-center justify-center hover:bg-[#013a87] transition-colors nb-shadow-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 text-white" />
          )}
        </button>
      </aside>
    </>
  );
}
