import { catalogue as copy } from "@/content/catalogue";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { PriceTier } from "@/server/pricing/rules";

export type PriceTagProps = {
  price: { unitPaise: number; mrpPaise: number; tier: PriceTier; discountPercent?: number };
  size?: "md" | "lg";
  className?: string;
};

/**
 * The viewer's price. Plain MRP: "MRP ₹320". Below MRP (the site-wide
 * discount, a professional price or a bulk tier): the price, the MRP struck
 * through and the percentage off. Professional and bulk prices also say
 * "Your price".
 */
export function PriceTag({ price, size = "md", className }: PriceTagProps) {
  const big = size === "lg" ? "text-3xl sm:text-4xl" : "text-lg";
  if (price.unitPaise >= price.mrpPaise) {
    return (
      <p className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
        <span className="text-small font-bold text-muted">{copy.card.mrp}</span>
        <span className={cn("font-extrabold tracking-[-0.02em] text-ink", big)}>
          {formatPaise(price.unitPaise)}
        </span>
      </p>
    );
  }
  const percentOff = Math.round(((price.mrpPaise - price.unitPaise) / price.mrpPaise) * 100);
  return (
    <div className={className}>
      {price.tier !== "mrp" && <p className="text-label text-brand uppercase">{copy.card.yourPrice}</p>}
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-extrabold tracking-[-0.02em] text-ink", big)}>
          {formatPaise(price.unitPaise)}
        </span>
        <span className="text-small text-muted">
          <span className="sr-only">{copy.card.mrp} </span>
          <s>{formatPaise(price.mrpPaise)}</s>
        </span>
        {percentOff > 0 && (
          <span data-testid="percent-off" className="text-small font-bold text-success">
            {copy.card.percentOff(percentOff)}
          </span>
        )}
      </p>
    </div>
  );
}
