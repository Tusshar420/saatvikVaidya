import Link from "next/link";
import { ShoppingBag, Truck } from "lucide-react";
import { CoinPill } from "@/components/ui/coin-pill";
import { cn } from "@/lib/cn";
import { shell, type NavItem } from "@/content/shell";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { NavRail } from "./nav-rail";
import { ProfileMenu } from "./profile-menu";
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
  "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md text-brand transition hover:bg-brand-soft/60 md:h-11.5";

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
        "sticky top-0 z-100 border-b border-brand/12 bg-surface/96 backdrop-blur-lg",
        className,
      )}
    >
      <div className="shell flex min-h-16.75 items-center gap-2 max-[374px]:gap-1.5 sm:gap-3.75 md:min-h-20.5 lg:gap-7">
        <Logo />
        <HeaderSearch
          popularSearches={popularSearches}
          className="ml-auto md:ml-0 md:min-w-60 md:flex-1 lg:max-w-97.5"
        />
        <div className="flex items-center gap-0.5 max-[374px]:gap-0 sm:gap-1.75 md:ml-auto">
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
            className={cn(actionClasses, "relative px-2.5")}
          >
            <ShoppingBag aria-hidden className="size-5.25" />
            <span
              aria-hidden
              className="absolute top-1 right-0.75 grid size-4.5 place-items-center rounded-full bg-orange-strong text-[11px] font-extrabold text-white"
            >
              {bagCount}
            </span>
          </Link>
          <ProfileMenu className={actionClasses} />
        </div>
      </div>
      <NavRail items={navItems} phone={phone} />
    </header>
  );
}
