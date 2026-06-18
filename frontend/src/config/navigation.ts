import React from "react";
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
  BarChart2,
  Building2,
  FileText,
  Terminal,
  Instagram,
  Megaphone,
  Package,
  Briefcase,
  KeyRound,
} from "lucide-react";
import { WhatsAppNavIcon } from "@/components/icons/WhatsAppIcon";

export type NavIconComponent =
  | LucideIcon
  | React.ComponentType<{ className?: string }>;

export interface NavItem {
  title: string;
  href: string;
  icon: NavIconComponent;
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
    label: "Business",
    items: [
      {
        title: "Clients",
        href: "/clients",
        icon: Building2,
        roles: [
          "super_admin",
          "admin",
          "sales_executive",
          "service_manager",
          "accountant",
        ],
      },
      {
        title: "Quotations",
        href: "/quotations",
        icon: FileText,
        roles: ["super_admin", "admin", "sales_executive", "accountant"],
      },
      {
        title: "Products",
        href: "/products",
        icon: Package,
        roles: ["super_admin", "admin", "sales_executive", "service_manager"],
      },
      {
        title: "Services",
        href: "/services",
        icon: Briefcase,
        roles: ["super_admin", "admin", "service_manager"],
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart2,
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "Social Planner",
        href: "/social-planner",
        icon: Instagram,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Campaigns",
        href: "/campaigns",
        icon: Megaphone,
        roles: ["super_admin", "admin", "sales_executive"],
      },
    ],
  },
  {
    label: "WhatsApp",
    items: [
      {
        title: "Inbox",
        href: "/whatsapp/inbox",
        icon: WhatsAppNavIcon,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Logs",
        href: "/whatsapp/logs",
        icon: WhatsAppNavIcon,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Setup",
        href: "/whatsapp/setup",
        icon: WhatsAppNavIcon,
        roles: ["super_admin", "admin"],
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
      {
        title: "API Keys",
        href: "/api-keys",
        icon: KeyRound,
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
      {
        title: "Console",
        href: "/console",
        icon: Terminal,
        roles: ["super_admin"],
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
