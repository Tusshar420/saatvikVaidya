import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { ui } from "@/content/ui";

/** The gold "S" coin. Decorative. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6.5 shrink-0 place-items-center rounded-full text-xs font-black text-gold-ink ring-3 ring-white/55 bg-coin ring-inset",
        className,
      )}
    >
      S
    </span>
  );
}

export type CoinPillProps = {
  /**
   * The balance. `null` (wallet variant only) shows "Coins / MY WALLET"
   * without a number, for signed-out visitors.
   */
  balance: number | null;
  /** Renders a link (header use); otherwise a plain label. */
  href?: string;
  /** Below this breakpoint only the icon shows (`lg` in the header). */
  compactBelow?: "sm" | "md" | "lg";
  /**
   * `default`: coin, balance and "Coins". `wallet`: the v2 header pill, a
   * gold-soft box with the coins icon, the balance (or "Coins") and a small
   * "MY WALLET" line (`.coin-pill`).
   */
  variant?: "default" | "wallet";
  /** Accessible name for the wallet variant when there is no balance. */
  walletLabel?: string;
  /** The two wallet lines (defaults: "Coins" / "My Wallet"). */
  walletTitle?: string;
  walletSubtitle?: string;
  className?: string;
};

const hideBelow = {
  sm: "max-sm:sr-only",
  md: "max-md:sr-only",
  lg: "max-lg:sr-only",
} as const;

/**
 * Coin balance: icon, number and "Coins". Under 560 px (or the
 * `compactBelow` breakpoint) only the icon shows; the balance stays
 * available to screen readers.
 */
export function CoinPill({
  balance,
  href,
  compactBelow = "sm",
  variant = "default",
  walletLabel = "Saatvik Coins",
  walletTitle = ui.coins.label,
  walletSubtitle = "My Wallet",
  className,
}: CoinPillProps) {
  const amount = balance === null ? null : formatNumber(balance);

  if (variant === "wallet") {
    const classes = cn(
      "inline-flex h-11.5 min-w-11 items-center justify-center gap-2 rounded-[14px] border border-gold/45 bg-gold-soft px-3.25 text-gold-ink",
      "max-md:size-11 max-md:px-0 max-sm:border-transparent max-sm:bg-transparent",
      href && "transition hover:bg-gold/25",
      className,
    );
    const content = (
      <>
        <Coins aria-hidden className="size-5 shrink-0 max-sm:size-5.25" />
        <span className="flex flex-col items-start leading-[1.05] max-md:sr-only">
          <b className="font-heading text-small font-bold">
            {amount === null ? (
              walletTitle
            ) : (
              <>
                <span className="sr-only">{ui.coins.accessibleLabel(amount)}</span>
                <span aria-hidden>{amount}</span>
              </>
            )}
          </b>
          <small
            aria-hidden={amount !== null || undefined}
            className="mt-0.5 text-[11px] font-semibold tracking-[0.05em] uppercase"
          >
            {walletSubtitle}
          </small>
        </span>
      </>
    );
    // Signed out the visible words are "Coins My Wallet"; give it a clearer name.
    const label = amount === null ? walletLabel : undefined;
    return href ? (
      <Link href={href} aria-label={label} className={classes}>
        {content}
      </Link>
    ) : (
      <span className={classes}>{content}</span>
    );
  }

  const classes = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-md bg-gold-soft px-2.5 text-gold-ink",
    compactBelow === "sm"
      ? "max-sm:px-2.25"
      : compactBelow === "md"
        ? "max-md:px-2.25"
        : "max-lg:px-2.25",
    href && "transition hover:bg-gold/25",
    className,
  );
  const content = (
    <>
      <CoinIcon />
      <span className={cn("flex flex-col leading-none", hideBelow[compactBelow])}>
        <span className="text-sm font-extrabold">
          <span className="sr-only">{ui.coins.accessibleLabel(amount ?? "0")}</span>
          <span aria-hidden>{amount ?? "0"}</span>
        </span>
        <span aria-hidden className="mt-0.5 text-[11px] font-medium text-muted">
          {ui.coins.label}
        </span>
      </span>
    </>
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
