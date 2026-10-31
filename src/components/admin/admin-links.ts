// The admin panel's pages, grouped as the sidebar shows them. Shared by the
// sidebar (AdminNav) and the search console (AdminConsole), so both list the
// same pages and hide the same ones from each admin role.

import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Bug,
  Clapperboard,
  Coins,
  Database,
  GalleryHorizontal,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  LineChart,
  ListChecks,
  ListOrdered,
  MessageSquareQuote,
  Package,
  PhoneCall,
  Pill,
  Plus,
  Settings,
  Shapes,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { admin as copy } from "@/content/admin";
import { assistedOrders as assistedCopy } from "@/content/assisted-orders";
import { adminSecurity } from "@/content/admin-security";
import { adminHome } from "@/content/admin-site";
import { brand as brandCopy } from "@/content/brand";
import { errorLog } from "@/content/errors";
import { inventory as inventoryCopy } from "@/content/inventory";
import {
  roleCanAccess,
  type AdminArea,
  type AdminRoleKey,
} from "@/lib/admin-permissions";

export type AdminLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  area: AdminArea;
  /** Extra words the console search matches (never shown). */
  keywords?: string;
};

export type AdminLinkGroup = { id: string; label: string; links: AdminLink[] };

const home = adminHome.nav;
const groups = copy.nav.groups;
const words = copy.console.keywords;

export const adminLinkGroups: AdminLinkGroup[] = [
  {
    id: "overview",
    label: groups.overview,
    links: [
      {
        href: "/admin",
        area: "dashboard",
        label: copy.nav.dashboard,
        icon: LayoutDashboard,
        keywords: words.dashboard,
      },
      {
        href: "/admin/reports",
        area: "reports",
        label: copy.nav.reports,
        icon: LineChart,
        keywords: words.reports,
      },
    ],
  },
  {
    // Daily work comes first, so staff don't scroll the menu to reach orders.
    id: "sales",
    label: groups.sales,
    links: [
      {
        href: "/admin/orders",
        area: "orders",
        label: copy.nav.orders,
        icon: Package,
        keywords: words.orders,
      },
      {
        href: "/admin/assisted-orders",
        area: "orders",
        label: assistedCopy.admin.nav,
        icon: PhoneCall,
        keywords: assistedCopy.admin.keywords,
      },
      {
        href: "/admin/brand-orders",
        area: "orders",
        label: brandCopy.admin.nav,
        icon: Sparkles,
        keywords: words.brandOrders,
      },
      {
        href: "/admin/coins",
        area: "orders",
        label: copy.nav.coins,
        icon: Coins,
        keywords: words.coins,
      },
    ],
  },
  {
    id: "people",
    label: groups.people,
    links: [
      {
        href: "/admin/users",
        area: "users",
        label: copy.nav.users,
        icon: Users,
        keywords: words.users,
      },
      {
        href: "/admin/approvals",
        area: "approvals",
        label: copy.nav.approvals,
        icon: BadgeCheck,
        keywords: words.approvals,
      },
      {
        href: "/admin/admins",
        area: "admins",
        label: adminSecurity.admins.nav,
        icon: ShieldCheck,
        keywords: words.admins,
      },
    ],
  },
  {
    id: "shop",
    label: groups.shop,
    links: [
      {
        href: "/admin/catalogue",
        area: "catalogue",
        label: copy.nav.catalogue,
        icon: Pill,
        keywords: words.catalogue,
      },
      {
        href: "/admin/ebooks",
        area: "catalogue",
        label: copy.nav.ebooks,
        icon: BookOpen,
        keywords: words.ebooks,
      },
      {
        href: "/admin/inventory",
        area: "inventory",
        label: inventoryCopy.nav,
        icon: Boxes,
        keywords: words.inventory,
      },
    ],
  },
  {
    id: "learning",
    label: groups.learning,
    links: [
      {
        href: "/admin/content/courses",
        area: "content",
        label: copy.nav.courses,
        icon: GraduationCap,
        keywords: words.courses,
      },
      {
        href: "/admin/content/quiz",
        area: "content",
        label: copy.nav.quiz,
        icon: ListChecks,
        keywords: words.quiz,
      },
      {
        href: "/admin/content/reels",
        area: "content",
        label: copy.nav.reels,
        icon: Clapperboard,
        keywords: words.reels,
      },
      {
        href: "/admin/content/brands",
        area: "content",
        label: copy.nav.brands,
        icon: Building2,
        keywords: words.brands,
      },
    ],
  },
  {
    id: "homePage",
    label: groups.homePage,
    links: [
      {
        href: "/admin/content/sections",
        area: "content",
        label: home.sections,
        icon: LayoutList,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/hero",
        area: "content",
        label: home.hero,
        icon: GalleryHorizontal,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/offers",
        area: "content",
        label: home.offers,
        icon: Tag,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/stats",
        area: "content",
        label: home.stats,
        icon: BarChart3,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/quick-actions",
        area: "content",
        label: home.quickActions,
        icon: Zap,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/categories",
        area: "content",
        label: home.categories,
        icon: Shapes,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/feedback",
        area: "content",
        label: home.feedback,
        icon: MessageSquareQuote,
        keywords: words.homePage,
      },
      {
        href: "/admin/content/why",
        area: "content",
        label: home.why,
        icon: ListOrdered,
        keywords: words.homePage,
      },
    ],
  },
  {
    id: "system",
    label: groups.system,
    links: [
      {
        href: "/admin/settings",
        area: "settings",
        label: copy.nav.settings,
        icon: Settings,
        keywords: words.settings,
      },
      {
        href: "/admin/errors",
        area: "errors",
        label: errorLog.nav,
        icon: Bug,
        keywords: words.errors,
      },
      {
        href: "/admin/database",
        area: "database",
        label: copy.nav.database,
        icon: Database,
        keywords: words.database,
      },
      {
        href: "/account/two-factor",
        area: "dashboard",
        label: adminSecurity.twoFactor.metaTitle,
        icon: KeyRound,
        keywords: words.twoFactor,
      },
    ],
  },
];

const actions = copy.console.actions;

/** "Create" shortcuts the console offers next to the pages. */
export const adminQuickActions: AdminLink[] = [
  {
    href: "/admin/catalogue/new",
    area: "catalogue",
    label: actions.newProduct,
    icon: Plus,
    keywords: words.catalogue,
  },
  {
    href: "/admin/ebooks/new",
    area: "catalogue",
    label: actions.newEbook,
    icon: Plus,
    keywords: words.ebooks,
  },
  {
    href: "/admin/users/new",
    area: "users",
    label: actions.newUser,
    icon: Plus,
    keywords: words.users,
  },
  {
    href: "/admin/content/courses/new",
    area: "content",
    label: actions.newCourse,
    icon: Plus,
    keywords: words.courses,
  },
  {
    href: "/admin/content/quiz/new",
    area: "content",
    label: actions.newQuiz,
    icon: Plus,
    keywords: words.quiz,
  },
  {
    href: "/admin/content/reels/new",
    area: "content",
    label: actions.newReel,
    icon: Plus,
    keywords: words.reels,
  },
  {
    href: "/admin/content/brands/new",
    area: "content",
    label: actions.newBrand,
    icon: Plus,
    keywords: words.brands,
  },
];

/** The groups this role may open, with empty groups dropped. */
export function linkGroupsFor(role: AdminRoleKey | null): AdminLinkGroup[] {
  return adminLinkGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => roleCanAccess(role, link.area)),
    }))
    .filter((group) => group.links.length > 0);
}

export function quickActionsFor(role: AdminRoleKey | null): AdminLink[] {
  return adminQuickActions.filter((link) => roleCanAccess(role, link.area));
}

/** True when `href` is the page being shown (or a page below it). */
export function isCurrentLink(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/database") {
    return pathname === href || pathname.startsWith("/admin/tables/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Console search: every word typed must appear in the label, the group name
 * or the page's keywords. Label matches rank first, then label prefixes.
 */
export function searchLinks(
  query: string,
  links: { link: AdminLink; group: string }[],
): { link: AdminLink; group: string }[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return links;
  const scored: {
    item: { link: AdminLink; group: string };
    score: number;
    index: number;
  }[] = [];
  links.forEach((item, index) => {
    const label = item.link.label.toLowerCase();
    const haystack = `${label} ${item.group.toLowerCase()} ${item.link.keywords ?? ""} ${item.link.href}`;
    if (!terms.every((term) => haystack.includes(term))) return;
    let score = 0;
    for (const term of terms) {
      if (label.startsWith(term)) score += 3;
      else if (label.includes(term)) score += 2;
    }
    scored.push({ item, score, index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

/** A typed address the console may open: admin pages only. */
export function consoleAddress(query: string): string | null {
  const path = query.trim();
  if (!/^\/admin(\/[\w\-./]*)?$/.test(path) || path.includes("..")) return null;
  return path;
}
