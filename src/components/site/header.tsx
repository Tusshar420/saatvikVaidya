import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { SectionCounts } from "@/lib/notifications";
import { cn } from "@/lib/cn";
import { shell, type NavItem, type SiteNavLink } from "@/content/shell";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { NavRail } from "./nav-rail";
import { NotificationBell } from "./notifications/notification-bell";
import { ProfileMenu } from "./profile-menu";

export type HeaderProps = {
  popularSearches: readonly string[];
  /** @deprecated The v2 header shows no phone number; kept for callers. */
  phone?: string;
  /** @deprecated The v2 rail links to pages (`navLinks`); ignored. */
  navItems?: readonly NavItem[];
  /** The rail's links after Home; defaults to the v2 site nav. */
  navLinks?: readonly SiteNavLink[];
  bagCount: number;
  /** Unread notifications of the signed-in user, for the bell (0 signed out). */
  notificationCount?: number;
  /** Unread notifications per nav link, for the rail's badges. */
  sectionBadges?: SectionCounts;
  className?: string;
};

const actionClasses =
  "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md text-brand transition hover:bg-brand-soft/60";

/**
 * Sticky v2 site header: the bar (logo, search with the ⌘K hint, the
 * notification bell when signed in, bag and profile) and the nav rail under it. Coins live in the orange bar above it
 * and the rail, not here. The bar is 82 px tall, 70 under 820 px and 65
 * under 560 px.
 */
export function Header({
  popularSearches,
  navLinks,
  bagCount,
  notificationCount = 0,
  sectionBadges,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-100 border-b border-line bg-paper/94 backdrop-blur-[18px]",
        className,
      )}
    >
      <div className="shell grid h-16.25 grid-cols-[auto_1fr_auto] items-center gap-2 sm:h-17.5 sm:gap-4.5 md:h-20.5 md:grid-cols-[170px_minmax(240px,1fr)_auto] lg:grid-cols-[185px_minmax(240px,1fr)_auto] lg:gap-8">
        <Logo priority />
        <HeaderSearch
          popularSearches={popularSearches}
          className="justify-self-end md:w-full md:max-w-127.5 md:justify-self-center"
        />
        <div className="flex items-center gap-px sm:gap-1.5 lg:gap-2.5">
          <NotificationBell initialUnread={notificationCount} />
          <Link
            href="/cart"
            aria-label={shell.header.bag(bagCount)}
            className={cn(actionClasses, "relative px-2")}
          >
            <ShoppingBag aria-hidden className="size-5.25" />
            {bagCount > 0 && (
              <span
                aria-hidden
                className="absolute top-0.5 right-0 grid h-4.5 min-w-4.5 place-items-center rounded-sm bg-orange-strong px-1 text-[11px] font-extrabold text-white"
              >
                {bagCount}
              </span>
            )}
          </Link>
          <ProfileMenu className="inline-flex max-sm:hidden h-12 min-w-11 cursor-pointer items-center gap-2.25 rounded-md text-left transition" />
        </div>
      </div>
      <NavRail links={navLinks} badges={sectionBadges} />
    </header>
  );
}
