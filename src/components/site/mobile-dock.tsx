"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, House, Package, Sparkles, UserRound } from "lucide-react";
import { useAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { shell } from "@/content/shell";
import { SiteModalButton, useClaimFocus } from "./site-modals";

const itemClasses =
  "flex min-h-13.5 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md text-muted transition focus-visible:outline-offset-[-2px] [&_svg]:size-5.5";

const labelClasses = "text-[11px] leading-tight font-bold";

const links = [
  { href: "/", label: shell.dock.home, Icon: House },
  { href: "/my-brand", label: shell.dock.myBrand, Icon: Sparkles },
  { href: "/orders", label: shell.dock.orders, Icon: Package },
  { href: "/coins", label: shell.dock.coins, Icon: Coins },
] as const;

/**
 * Fixed bottom bar on phones (under 560 px): Home, My Brand (Launch Your
 * Brand orders, P2.1; the cart is the bag in the header), Orders, Coins and
 * Profile (sign-in, or /account once signed in). It clears the home indicator with safe-area-inset-bottom; the
 * footer carries matching bottom padding so nothing hides behind it.
 */
export function MobileDock({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={shell.dock.label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-150 border-t border-line bg-surface/96 px-1.25 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-[15px] sm:hidden",
        className,
      )}
    >
      <ul className="grid grid-cols-5">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClasses, active && "text-brand")}
              >
                <Icon aria-hidden />
                <span className={labelClasses}>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <ProfileItem active={pathname === "/account"} />
        </li>
      </ul>
    </nav>
  );
}

const profileFocusKey = "profile-dock";

/** Signed in: a link to /account. Signed out (or loading): opens sign-in. */
function ProfileItem({ active }: { active: boolean }) {
  const { data } = useAuthSession();
  const signedIn = Boolean(data?.user);
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useClaimFocus(profileFocusKey, ref, signedIn);

  const content = (
    <>
      <UserRound aria-hidden />
      <span className={labelClasses}>{shell.dock.profile}</span>
    </>
  );

  if (signedIn) {
    return (
      <Link
        ref={ref}
        href="/account"
        data-focus-key={profileFocusKey}
        aria-current={active ? "page" : undefined}
        className={cn(itemClasses, active && "text-brand")}
      >
        {content}
      </Link>
    );
  }
  return (
    <SiteModalButton
      ref={ref}
      modal="signIn"
      data-focus-key={profileFocusKey}
      className={cn(itemClasses, "w-full")}
    >
      {content}
    </SiteModalButton>
  );
}
