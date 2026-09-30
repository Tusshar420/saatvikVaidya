import Link from "next/link";
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
  balance: number;
  /** Renders a link (header use); otherwise a plain label. */
  href?: string;
  className?: string;
};

/**
 * Coin balance: icon, number and "Coins". Under 560 px only the icon shows;
 * the balance stays available to screen readers.
 */
export function CoinPill({ balance, href, className }: CoinPillProps) {
  const amount = formatNumber(balance);
  const classes = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-md bg-gold-soft px-2.5 text-gold-ink",
    href && "transition hover:bg-gold/25",
    className,
  );
  const content = (
    <>
      <CoinIcon />
      <span className="flex flex-col leading-none max-sm:sr-only">
        <span className="text-sm font-extrabold">
          <span className="sr-only">{ui.coins.accessibleLabel(amount)}</span>
          <span aria-hidden>{amount}</span>
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
