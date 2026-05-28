import { UserRole } from "@/types/crm";
import {
  LayoutDashboard,
  Users,
  Target,
  Settings,
  LucideIcon,
  MapPin,
  Clock,
  CreditCard,
  Plug,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const allGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        roles: [
          "super_admin",
          "admin",
          "sales_executive",
          "service_manager",
          "accountant",
        ],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Leads",
        href: "/leads",
        icon: Target,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Visit Calendar",
        href: "/visit-calendar",
        icon: MapPin,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Follow-ups",
        href: "/followup-calendar",
        icon: Clock,
        roles: ["super_admin", "admin", "sales_executive"],
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Team",
        href: "/users",
        icon: Users,
        roles: ["super_admin", "admin"],
      },
      {
        title: "Integrations",
        href: "/integrations",
        icon: Plug,
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Billing",
        href: "/billing",
        icon: CreditCard,
        roles: ["super_admin", "admin"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["super_admin", "admin"],
      },
    ],
  },
];

export const navItems: NavItem[] = allGroups.flatMap((g) => g.items);

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}
