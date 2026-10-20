"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Coins,
  Clapperboard,
  Bug,
  Database,
  GalleryHorizontal,
  GraduationCap,
  LayoutList,
  LineChart,
  ListOrdered,
  MessageSquareQuote,
  Shapes,
  Tag,
  Zap,
  LayoutDashboard,
  ListChecks,
  Package,
  Pill,
  KeyRound,
  Settings,
  Sparkles,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { admin as copy } from "@/content/admin";
import { brand as brandCopy } from "@/content/brand";
import { inventory as inventoryCopy } from "@/content/inventory";
import { errorLog } from "@/content/errors";
import { adminSecurity } from "@/content/admin-security";
import { adminHome } from "@/content/admin-site";
import { roleCanAccess, type AdminArea, type AdminRoleKey } from "@/lib/admin-permissions";
import { cn } from "@/lib/cn";

const home = adminHome.nav;

type NavLink = { href: string; label: string; icon: LucideIcon; area: AdminArea };

const main: NavLink[] = [
  { href: "/admin", area: "dashboard", label: copy.nav.dashboard, icon: LayoutDashboard },
  { href: "/admin/users", area: "users", label: copy.nav.users, icon: Users },
  { href: "/admin/approvals", area: "approvals", label: copy.nav.approvals, icon: BadgeCheck },
  { href: "/admin/catalogue", area: "catalogue", label: copy.nav.catalogue, icon: Pill },
  { href: "/admin/ebooks", area: "catalogue", label: copy.nav.ebooks, icon: BookOpen },
  { href: "/admin/inventory", area: "inventory", label: inventoryCopy.nav, icon: Boxes },
];

const content: NavLink[] = [
  { href: "/admin/content/sections", area: "content", label: home.sections, icon: LayoutList },
  { href: "/admin/content/hero", area: "content", label: home.hero, icon: GalleryHorizontal },
  { href: "/admin/content/offers", area: "content", label: home.offers, icon: Tag },
  { href: "/admin/content/stats", area: "content", label: home.stats, icon: BarChart3 },
  { href: "/admin/content/quick-actions", area: "content", label: home.quickActions, icon: Zap },
  { href: "/admin/content/categories", area: "content", label: home.categories, icon: Shapes },
  { href: "/admin/content/feedback", area: "content", label: home.feedback, icon: MessageSquareQuote },
  { href: "/admin/content/why", area: "content", label: home.why, icon: ListOrdered },
  { href: "/admin/content/reels", area: "content", label: copy.nav.reels, icon: Clapperboard },
  { href: "/admin/content/brands", area: "content", label: copy.nav.brands, icon: Building2 },
  {
    href: "/admin/content/courses",
    area: "content",
    label: copy.nav.courses,
    icon: GraduationCap,
  },
  { href: "/admin/content/quiz", area: "content", label: copy.nav.quiz, icon: ListChecks },
];

const rest: NavLink[] = [
  { href: "/admin/orders", area: "orders", label: copy.nav.orders, icon: Package },
  { href: "/admin/brand-orders", area: "orders", label: brandCopy.admin.nav, icon: Sparkles },
  { href: "/admin/reports", area: "reports", label: copy.nav.reports, icon: LineChart },
  { href: "/admin/coins", area: "orders", label: copy.nav.coins, icon: Coins },
  { href: "/admin/settings", area: "settings", label: copy.nav.settings, icon: Settings },
  { href: "/admin/database", area: "database", label: copy.nav.database, icon: Database },
  { href: "/admin/errors", area: "errors", label: errorLog.nav, icon: Bug },
  { href: "/admin/admins", area: "admins", label: adminSecurity.admins.nav, icon: ShieldCheck },
  { href: "/account/two-factor", area: "dashboard", label: adminSecurity.twoFactor.metaTitle, icon: KeyRound },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/database") {
    return pathname === href || pathname.startsWith("/admin/tables/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin sections. From 1100 px a sidebar; below that a strip under the
 * header that scrolls sideways (the "Content" heading is hidden there).
 */
export function AdminNav({
  pendingCount,
  adminRole,
}: {
  pendingCount: number;
  /** Only the sections this role may open are listed (the server refuses the rest). */
  adminRole: AdminRoleKey | null;
}) {
  const pathname = usePathname();
  const allowed = (links: NavLink[]) =>
    links.filter((link) => roleCanAccess(adminRole, link.area));
  const contentLinks = allowed(content);

  const item = (link: NavLink) => {
    const current = isCurrent(pathname, link.href);
    const Icon = link.icon;
    return (
      <li key={link.href} className="shrink-0">
        <Link
          href={link.href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition",
            current
              ? "bg-brand-soft font-extrabold text-brand"
              : "text-ink/80 hover:bg-surface-alt hover:text-brand",
          )}
        >
          <Icon aria-hidden className="size-4.5 shrink-0" />
          {link.label}
          {link.href === "/admin/approvals" && pendingCount > 0 && (
            <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-orange-strong px-1.5 text-xs font-extrabold text-white">
              {pendingCount}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={copy.nav.label}>
      <ul className="scrollbar-none flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:p-0">
        {allowed(main).map(item)}
        {contentLinks.length > 0 && (
          <li
            aria-hidden
            className="mt-4 mb-1 hidden px-3 text-label text-muted uppercase lg:block"
          >
            {copy.nav.contentGroup}
          </li>
        )}
        {contentLinks.map(item)}
        <li aria-hidden className="my-3 hidden border-t border-line lg:block" />
        {allowed(rest).map(item)}
      </ul>
    </nav>
  );
}
