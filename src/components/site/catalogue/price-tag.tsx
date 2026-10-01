import { catalogue as copy } from "@/content/catalogue";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { PriceTier } from "@/server/pricing/rules";

export type PriceTagProps = {
  price: { unitPaise: number; mrpPaise: number; tier: PriceTier };
  size?: "md" | "lg";
  className?: string;
};

/**
 * The viewer's price. At MRP: "MRP ₹320". Below MRP (professional or bulk):
 * the price, the MRP struck through, and a "Your price" label.
 */
export function PriceTag({ price, size = "md", className }: PriceTagProps) {
  const big = size === "lg" ? "text-3xl sm:text-4xl" : "text-lg";
  if (price.tier === "mrp") {
    return (
      <p className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
        <span className="text-small font-bold text-muted">{copy.card.mrp}</span>
        <span className={cn("font-extrabold tracking-[-0.02em] text-ink", big)}>
          {formatPaise(price.unitPaise)}
        </span>
      </p>
    );
  }
  return (
    <div className={className}>
      <p className="text-label text-teal uppercase">{copy.card.yourPrice}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-extrabold tracking-[-0.02em] text-ink", big)}>
          {formatPaise(price.unitPaise)}
        </span>
        <span className="text-small text-muted">
          <span className="sr-only">{copy.card.mrp} </span>
          <s>{formatPaise(price.mrpPaise)}</s>
        </span>
      </p>
    </div>
  );
}
