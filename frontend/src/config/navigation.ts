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
  Megaphone,
  Package,
  Briefcase,
  KeyRound,
  LifeBuoy,
  ShieldCheck,
  LayoutGrid,
  Layers,
  ImageIcon,
  BarChart3,
  ClipboardList,
  Sparkles,
  Inbox,
  Send,
} from "lucide-react";
import { WhatsAppNavIcon } from "@/components/icons/WhatsAppIcon";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { GoogleAdsIcon } from "@/components/icons/GoogleAdsIcon";
import { MetaIcon } from "@/components/icons/MetaIcon";
import { Facebook } from "lucide-react";

export type NavIconComponent =
  LucideIcon | React.ComponentType<{ className?: string }>;

export interface NavItem {
  title: string;
  href: string;
  icon: NavIconComponent;
  roles: UserRole[];
  children?: NavItem[];
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
    label: "Social Media",
    items: [
      {
        title: "Meta",
        href: "/social-planner",
        icon: MetaIcon,
        roles: ["super_admin", "admin", "sales_executive"],
      },
      {
        title: "Autopilot",
        href: "/social-autopilot",
        icon: Sparkles,
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    label: "Campaigns",
    items: [
      {
        title: "Campaigns",
        href: "/campaigns",
        icon: Megaphone,
        roles: ["super_admin", "admin", "sales_executive"],
        children: [
          {
            title: "Facebook",
            href: "/campaigns/facebook",
            icon: Facebook,
            roles: ["super_admin", "admin", "sales_executive"],
            children: [
              {
                title: "Dashboard",
                href: "/campaigns/facebook",
                icon: LayoutGrid,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Campaigns",
                href: "/campaigns/facebook/campaigns",
                icon: Megaphone,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Sets",
                href: "/campaigns/facebook/adsets",
                icon: Layers,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ads",
                href: "/campaigns/facebook/ads",
                icon: ImageIcon,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Campaign Management",
                href: "/campaigns/facebook/management",
                icon: ClipboardList,
                roles: ["super_admin", "admin"],
              },
            ],
          },
          {
            title: "LinkedIn",
            href: "/campaigns/linkedin",
            icon: LinkedInIcon,
            roles: ["super_admin", "admin", "sales_executive"],
            children: [
              {
                title: "Dashboard",
                href: "/campaigns/linkedin/dashboard",
                icon: LayoutGrid,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Campaigns",
                href: "/campaigns/linkedin/campaigns",
                icon: Megaphone,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Sets",
                href: "/campaigns/linkedin/adsets",
                icon: Layers,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ads",
                href: "/campaigns/linkedin/ads",
                icon: ImageIcon,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Lead Sync Setup",
                href: "/campaigns/linkedin",
                icon: LinkedInIcon,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Campaign Management",
                href: "/campaigns/linkedin/management",
                icon: ClipboardList,
                roles: ["super_admin", "admin"],
              },
            ],
          },
          {
            title: "Google Ads",
            href: "/campaigns/google",
            icon: GoogleAdsIcon,
            roles: ["super_admin", "admin", "sales_executive"],
            children: [
              {
                title: "Dashboard",
                href: "/campaigns/google/dashboard",
                icon: LayoutGrid,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Campaigns",
                href: "/campaigns/google/campaigns",
                icon: Megaphone,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ad Groups",
                href: "/campaigns/google/adgroups",
                icon: Layers,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Ads",
                href: "/campaigns/google/ads",
                icon: ImageIcon,
                roles: ["super_admin", "admin", "sales_executive"],
              },
              {
                title: "Lead Sync Setup",
                href: "/campaigns/google",
                icon: GoogleAdsIcon,
                roles: ["super_admin", "admin", "sales_executive"],
              },
            ],
          },
          {
            title: "Reports & Analytics",
            href: "/campaigns/reports",
            icon: BarChart3,
            roles: ["super_admin", "admin"],
          },
          {
            title: "Campaign Management",
            href: "/campaigns/management",
            icon: ClipboardList,
            roles: ["super_admin", "admin"],
          },
        ],
      },
    ],
  },
  {
    label: "Messaging",
    items: [
      {
        title: "WhatsApp",
        href: "/whatsapp",
        icon: WhatsAppNavIcon,
        roles: ["super_admin", "admin", "sales_executive"],
        children: [
          {
            title: "Inbox",
            href: "/whatsapp/inbox",
            icon: Inbox,
            roles: ["super_admin", "admin", "sales_executive"],
          },
          {
            title: "Campaigns",
            href: "/whatsapp/campaigns",
            icon: Send,
            roles: ["super_admin", "admin", "sales_executive"],
          },
          {
            title: "Logs",
            href: "/whatsapp/logs",
            icon: FileText,
            roles: ["super_admin", "admin", "sales_executive"],
          },
          {
            // Connection, Templates, Campaign Analytics and Replies tabs
            title: "Setup",
            href: "/whatsapp/setup",
            icon: Settings,
            roles: ["super_admin", "admin"],
          },
        ],
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
      {
        title: "Security",
        href: "/account/security",
        icon: ShieldCheck,
        roles: [
          "super_admin",
          "admin",
          "sales_executive",
          "service_manager",
          "accountant",
        ],
      },
      {
        title: "Support",
        href: "/support",
        icon: LifeBuoy,
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
    label: "System",
    items: [
      {
        title: "AI Usage",
        href: "/ai-usage",
        icon: BarChart3,
        roles: ["super_admin", "admin"],
      },
      {
        title: "Billing",
        href: "/billing",
        icon: CreditCard,
        roles: ["super_admin", "admin"],
      },
      {
        title: "Activity Log",
        href: "/activity-log",
        icon: Terminal,
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

// Children carry their own roles (e.g. WhatsApp > Setup is admin-only), so the
// filter has to recurse; a dropdown left with no visible children disappears.
function filterByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) =>
      item.children
        ? { ...item, children: filterByRole(item.children, role) }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return allGroups
    .map((g) => ({ ...g, items: filterByRole(g.items, role) }))
    .filter((g) => g.items.length > 0);
}
