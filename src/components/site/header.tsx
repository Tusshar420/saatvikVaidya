import Link from "next/link";
import { ChevronDown, ShoppingBag, Truck, UserRound } from "lucide-react";
import { CoinPill } from "@/components/ui/coin-pill";
import { cn } from "@/lib/cn";
import { shell, type NavItem } from "@/content/shell";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { NavRail } from "./nav-rail";
import { SiteModalButton } from "./site-modals";

export type HeaderProps = {
  popularSearches: readonly string[];
  phone: string;
  navItems: readonly NavItem[];
  /** `null` hides the coin pill (A8: when signed out). */
  coinBalance: number | null;
  bagCount: number;
  className?: string;
};

const actionClasses =
  "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md text-teal transition hover:bg-teal-soft/60 md:h-11.5";

/**
 * Sticky site header: the utility bar (logo, search, track order, coins, bag,
 * profile) and the section nav rail under it. 82 px bar, 67 px on phones.
 */
export function Header({
  popularSearches,
  phone,
  navItems,
  coinBalance,
  bagCount,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-100 border-b border-teal/12 bg-surface/96 backdrop-blur-lg",
        className,
      )}
    >
      <div className="shell flex min-h-16.75 items-center gap-2 sm:gap-3.75 md:min-h-20.5 lg:gap-7">
        <Logo />
        <HeaderSearch
          popularSearches={popularSearches}
          className="ml-auto md:ml-0 md:min-w-60 md:flex-1 lg:max-w-97.5"
        />
        <div className="flex items-center gap-0.5 sm:gap-1.75 md:ml-auto">
          <SiteModalButton
            modal="trackOrder"
            className={cn(actionClasses, "px-2.5 max-md:hidden")}
          >
            <Truck aria-hidden className="size-5.25" />
            <span className="text-small font-bold text-ink max-lg:sr-only">
              {shell.header.trackOrder}
            </span>
          </SiteModalButton>
          {coinBalance !== null && (
            <CoinPill
              balance={coinBalance}
              href="/coins"
              compactBelow="lg"
              className="md:h-11.5"
            />
          )}
          <Link
            href="/cart"
            aria-label={shell.header.bag(bagCount)}
            className={cn(actionClasses, "relative px-2.5 max-sm:hidden")}
          >
            <ShoppingBag aria-hidden className="size-5.25" />
            <span
              aria-hidden
              className="absolute top-1 right-0.75 grid size-4.5 place-items-center rounded-full bg-orange-strong text-[11px] font-extrabold text-white"
            >
              {bagCount}
            </span>
          </Link>
          <SiteModalButton
            modal="signIn"
            className={cn(actionClasses, "text-ink lg:pr-1 lg:pl-1.5")}
          >
            <span
              aria-hidden
              className="grid size-9.75 place-items-center rounded-[11px] bg-teal text-white lg:size-8.75"
            >
              <UserRound className="size-5" />
            </span>
            <span className="flex flex-col items-start leading-none max-lg:sr-only">
              <span className="text-xs font-bold">
                {shell.header.profileTitle}
              </span>{" "}
              <span className="mt-0.75 text-[11px] font-medium text-muted">
                {shell.header.profileSubtitle}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className="size-4.25 text-muted max-lg:hidden"
            />
          </SiteModalButton>
        </div>
      </div>
      <NavRail items={navItems} phone={phone} />
    </header>
  );
}
