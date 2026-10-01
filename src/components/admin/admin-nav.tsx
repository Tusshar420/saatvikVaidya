"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Clapperboard,
  Database,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Package,
  Pill,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";

type NavLink = { href: string; label: string; icon: LucideIcon };

const main: NavLink[] = [
  { href: "/admin", label: copy.nav.dashboard, icon: LayoutDashboard },
  { href: "/admin/users", label: copy.nav.users, icon: Users },
  { href: "/admin/approvals", label: copy.nav.approvals, icon: BadgeCheck },
  { href: "/admin/catalogue", label: copy.nav.catalogue, icon: Pill },
];

const content: NavLink[] = [
  { href: "/admin/content/reels", label: copy.nav.reels, icon: Clapperboard },
  { href: "/admin/content/brands", label: copy.nav.brands, icon: Building2 },
  {
    href: "/admin/content/courses",
    label: copy.nav.courses,
    icon: GraduationCap,
  },
  { href: "/admin/content/quiz", label: copy.nav.quiz, icon: ListChecks },
];

const rest: NavLink[] = [
  { href: "/admin/orders", label: copy.nav.orders, icon: Package },
  { href: "/admin/settings", label: copy.nav.settings, icon: Settings },
  { href: "/admin/database", label: copy.nav.database, icon: Database },
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
export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

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
              ? "bg-teal-soft font-extrabold text-teal"
              : "text-ink/80 hover:bg-surface-alt hover:text-teal",
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
        {main.map(item)}
        <li
          aria-hidden
          className="mt-4 mb-1 hidden px-3 text-label text-muted uppercase lg:block"
        >
          {copy.nav.contentGroup}
        </li>
        {content.map(item)}
        <li aria-hidden className="my-3 hidden border-t border-line lg:block" />
        {rest.map(item)}
      </ul>
    </nav>
  );
}
