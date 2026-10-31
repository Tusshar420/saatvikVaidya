"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { notificationsChanged } from "./notifications/notification-item";
import type { SectionCounts } from "@/lib/notifications";
import { useScrollEdges } from "@/lib/use-scroll-edges";
import {
  navBadgeLabel,
  shell,
  siteNav,
  type SiteNavLink,
  type SiteNavTone,
} from "@/content/shell";

export type NavRailProps = {
  /** The rail links; defaults to the v2 site nav. */
  links?: readonly SiteNavLink[];
  /**
   * @deprecated The v2 rail links to pages, not homepage sections; kept so
   * older callers still type-check. Ignored.
   */
  items?: readonly unknown[];
  /** @deprecated The v2 rail has no phone number. Ignored. */
  phone?: string;
  /** Unread notifications per link href, from the server (empty signed out). */
  badges?: SectionCounts;
  className?: string;
};

const pollMs = 60_000;

/**
 * Per-section unread counts: the server's first answer, then refreshed every
 * minute while the tab is visible, on focus, and whenever a notification is
 * read or marked read elsewhere on the page.
 */
function useSectionBadges(
  initial: SectionCounts,
  signedIn: boolean,
): SectionCounts {
  const [counts, setCounts] = useState(initial);
  const [seen, setSeen] = useState(initial);
  // A new page load from the server brings fresh counts.
  if (seen !== initial) {
    setSeen(initial);
    setCounts(initial);
  }
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          "/api/notifications?filter=unread&limit=1",
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const result = (await response.json()) as {
          ok: boolean;
          sections?: SectionCounts;
        };
        if (alive && result.ok && result.sections) setCounts(result.sections);
      } catch {
        // Keep the counts we have.
      }
    };
    const timer = window.setInterval(refresh, pollMs);
    window.addEventListener("focus", refresh);
    window.addEventListener(notificationsChanged, refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(notificationsChanged, refresh);
    };
  }, [signedIn]);
  return counts;
}

/** Is `href` the current page (or a page under it)? */
function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const toneClasses: Record<SiteNavTone, { idle: string; active: string }> = {
  plain: {
    idle: "border-line bg-surface text-ink/80 shadow-sm group-hover:border-brand/40 group-hover:bg-brand-soft group-hover:text-brand",
    // orange-strong keeps white text AA (DESIGN.md, differences 1).
    active: "border-orange-strong bg-orange-strong text-white shadow-sm",
  },
  brand: {
    idle: "border-brand bg-brand text-white group-hover:bg-brand-mid",
    active:
      "border-brand bg-brand text-white ring-2 ring-brand/25 ring-offset-1 ring-offset-paper",
  },
  orange: {
    // orange-strong keeps white text AA (DESIGN.md, differences 1).
    idle: "border-orange-strong bg-orange-strong text-white group-hover:bg-orange-dark",
    active:
      "border-orange-strong bg-orange-strong text-white ring-2 ring-orange/30 ring-offset-1 ring-offset-paper",
  },
};

/**
 * The v2 nav rail under the header bar (46 px, 43 under 820 px): pill links
 * to every main page (the logo is the way home), with Dr. Talk as a solid green pill and
 * Quiz & Win as a solid orange one. Under 560 px the `wideOnly` links
 * (Courses, Saatvik Coins, Track Order) are hidden, because the phone dock
 * has them. It scrolls sideways with an edge fade on narrow screens and
 * marks the current page.
 */
export function NavRail({
  links = siteNav,
  badges = {},
  className,
}: NavRailProps) {
  const pathname = usePathname();
  const { data: session } = useAuthSession();
  const counts = useSectionBadges(badges, Boolean(session?.user));
  const reducedMotion = useReducedMotion();
  const { ref, onScroll, style } = useScrollEdges<HTMLDivElement>("38px");

  // Bring the current page's link into view inside the rail (sideways only).
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const link = rail.querySelector<HTMLElement>('[aria-current="page"]');
    if (!link) return;
    const railBox = rail.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.left < railBox.left || linkBox.right > railBox.right - 38) {
      rail.scrollTo({
        left: rail.scrollLeft + linkBox.left - railBox.left - 12,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [pathname, reducedMotion, ref]);

  return (
    <nav
      aria-label={shell.nav.label}
      className={cn("border-t border-ink/6 bg-cream", className)}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        style={style}
        className="scrollbar-none overflow-x-auto md:shell"
      >
        <ul className="flex h-10.75 w-max min-w-full items-center gap-2 px-3.25 sm:px-3.75 md:h-11.5 md:px-0">
          {links.map((link) => (
            <li
              key={link.href}
              className={cn(
                link.tone && link.tone !== "plain" && "mr-0.75",
                // The phone dock covers these under 560 px (sm).
                link.wideOnly && "max-sm:hidden",
              )}
            >
              <RailLink
                href={link.href}
                current={isCurrent(pathname, link.href)}
                tone={link.tone ?? "plain"}
                badge={session?.user ? (counts[link.href] ?? 0) : 0}
              >
                {link.label}
              </RailLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function RailLink({
  href,
  current,
  tone,
  badge = 0,
  children,
}: {
  href: string;
  current: boolean;
  tone: SiteNavTone;
  /** Unread notifications for this section; the badge shows when above 0. */
  badge?: number;
  children: ReactNode;
}) {
  const classes = toneClasses[tone];
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      // The link is 44 px tall for touch; the visible pill inside is ~32 px.
      className="group relative inline-flex h-11 items-center focus-visible:outline-offset-[-2px]"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.25 rounded-sm border border-transparent px-3 py-1.75 text-[11px] leading-[1.35] font-bold whitespace-nowrap transition md:px-3.5 md:py-2 md:text-xs",
          current ? classes.active : classes.idle,
        )}
      >
        {children}
        {badge > 0 && (
          <>
            <span
              aria-hidden
              data-testid="nav-badge"
              className={cn(
                "absolute -top-0.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none font-extrabold text-white ring-2 ring-cream",
                tone === "orange" ? "bg-brand" : "bg-orange-strong",
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
            <span className="sr-only">, {navBadgeLabel(badge)}</span>
          </>
        )}
      </span>
    </Link>
  );
}
