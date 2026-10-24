"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleUserRound, Coins, GraduationCap, Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { dockNav, shell, type DockHref } from "@/content/shell";

const itemClasses =
  "flex min-h-13.5 cursor-pointer flex-col items-center justify-center gap-0.75 rounded-md text-muted transition focus-visible:outline-offset-[-2px] [&_svg]:size-4.75 [&_svg]:stroke-[1.8]";

const labelClasses = "text-[11px] leading-tight font-bold";

const icons: Record<DockHref, typeof Coins> = {
  "/coins": Coins,
  "/notifications": Bell,
  "/courses": GraduationCap,
  "/orders": Truck,
  "/account": CircleUserRound,
};

const links = dockNav.map((link) => ({ ...link, Icon: icons[link.href] }));

/**
 * Fixed bottom bar on phones (under 560 px), as the client asked: Coins,
 * Updates, Courses, Order and You. From 560 px up the nav rail shows these
 * links instead (`dockNav`). It clears the
 * home indicator with safe-area-inset-bottom; the footer carries matching
 * bottom padding so nothing hides behind it.
 */
export function MobileDock({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={shell.dock.label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-150 border-t border-line bg-paper/96 px-2 pt-1.75 pb-[calc(7px+env(safe-area-inset-bottom))] shadow-dock backdrop-blur-[16px] sm:hidden",
        className,
      )}
    >
      <ul className="grid grid-cols-5">
        {links.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClasses, active && "bg-orange-soft text-orange-ink")}
              >
                <Icon aria-hidden />
                <span className={labelClasses}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
