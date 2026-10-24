"use client";

import { useId, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { brand } from "@/content/brand";
import { brandUnitPriceFor, type BrandTerms } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";

const copy = brand.launch.preview;

/**
 * Up to five quantities to try: the minimum, each bulk tier (raised to a
 * multiple of the minimum, as the Launch cart does) and more steps of the
 * minimum when there are few tiers.
 */
function quantityOptions(terms: BrandTerms): number[] {
  const min = terms.minQty;
  const options = new Set<number>([min]);
  for (const tier of terms.tiers)
    options.add(Math.ceil(tier.minQty / min) * min);
  for (const times of [2, 4, 10, 20, 50]) {
    if (options.size >= 5) break;
    options.add(min * times);
  }
  return [...options].sort((a, b) => a - b).slice(0, 5);
}

export type LaunchStudioProps = {
  product: {
    name: string;
    formName: string;
    packSize: string;
    terms: BrandTerms;
  };
  /** The call to action under the quantities (sign in, or add to the cart). */
  action: ReactNode;
  className?: string;
};

/**
 * The v2 "Live product preview" card (`.product-studio`): a pack with the
 * label, the product, quantity tiers in steps of the minimum and the branded
 * price at the chosen quantity, from the product's real terms.
 */
export function LaunchStudio({
  product,
  action,
  className,
}: LaunchStudioProps) {
  const { terms } = product;
  const options = quantityOptions(terms);
  const [quantity, setQuantity] = useState(options[0] ?? terms.minQty);
  const unitPrice = brandUnitPriceFor(terms, quantity);
  const labelId = useId();

  return (
    <section
      aria-label={copy.eyebrow}
      className={cn(
        "rounded-2xl border border-brand/15 bg-surface p-4.25 shadow-raised sm:p-6.25",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4.5">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading text-[10px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
            {copy.eyebrow}
          </span>
          <b className="mt-1 truncate font-heading text-lg font-extrabold text-ink">
            {product.name}
          </b>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.25 rounded-sm bg-brand-soft px-2.5 py-1.75 text-[11px] font-extrabold text-brand">
          <ShieldCheck aria-hidden className="size-3.5" />
          {copy.badge}
        </span>
      </div>

      <div className="grid grid-cols-[120px_1fr] items-center gap-3.25 px-0 py-7 sm:grid-cols-[190px_1fr] sm:gap-6.75 sm:px-1.5">
        <div
          aria-hidden
          className="relative mx-auto h-37.5 w-25.5 rounded-t-[20px] rounded-b-[25px] border border-line bg-surface-alt shadow-card sm:h-46.25 sm:w-32.5"
        >
          <div className="absolute -top-4 left-3 h-6 w-19.5 rounded-t-[9px] rounded-b-[5px] bg-brand-mark sm:left-3.75 sm:h-7.25 sm:w-24.75" />
          <div className="absolute inset-x-2.5 top-9 bottom-5 flex flex-col items-center rounded-[11px] border-2 border-white px-1.75 py-2.75 text-center text-gold-ink bg-quiz sm:top-11.25 sm:px-2.5 sm:py-3.75">
            <small className="text-[7px] tracking-[0.12em] uppercase">
              {copy.yourLogo}
            </small>
            <b className="my-auto font-heading text-xs leading-[1.05] font-extrabold break-words sm:text-base">
              {product.name}
            </b>
            <span className="text-[8px]">{product.packSize}</span>
          </div>
        </div>
        <div className="min-w-0">
          <span className="font-heading text-[10px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
            {copy.kicker(product.formName)}
          </span>
          <p className="my-2.25 font-heading text-[23px] leading-[1.05] font-extrabold tracking-[-0.04em] text-ink sm:text-[29px]">
            {copy.title}
          </p>
          <p className="text-small text-muted">{copy.line}</p>
        </div>
      </div>

      <div className="rounded-lg border border-line p-3.25 sm:p-4.5">
        <div className="mb-2.75 flex items-baseline justify-between gap-3">
          <span id={labelId} className="text-sm font-extrabold text-ink">
            {copy.quantity}
          </span>
          <small className="text-xs text-muted">
            {copy.minimumNote(terms.minQty, terms.unitLabel)}
          </small>
        </div>
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-5 gap-1 sm:gap-1.75"
        >
          {options.map((option) => {
            const active = option === quantity;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={copy.units(option, terms.unitLabel)}
                onClick={() => setQuantity(option)}
                className={cn(
                  "h-9.5 min-w-0 rounded-sm border text-xs font-extrabold transition sm:text-sm",
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink hover:border-brand/50",
                )}
              >
                {option.toLocaleString("en-IN")}
              </button>
            );
          })}
        </div>
        <div className="mt-3.75 grid grid-cols-2 gap-3">
          <div className="flex flex-col rounded-md bg-surface-alt p-3">
            <small className="text-[11px] text-muted">{copy.branded}</small>
            <b className="mt-0.75 font-heading text-lg font-extrabold text-ink">
              {formatPaise(unitPrice)}{" "}
              <em className="font-body text-[11px] font-medium text-muted not-italic">
                {copy.perUnit}
              </em>
            </b>
          </div>
          <div className="flex flex-col rounded-md bg-surface-alt p-3">
            <small className="text-[11px] text-muted">{copy.total}</small>
            <b
              aria-live="polite"
              className="mt-0.75 font-heading text-lg font-extrabold text-ink"
            >
              {formatPaise(unitPrice * quantity)}
            </b>
          </div>
        </div>
        <div className="mt-3.75 flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-col">
            <b className="text-sm font-extrabold text-ink">
              {copy.units(quantity, terms.unitLabel)}
            </b>
          </span>
          {action}
        </div>
      </div>
      <small className="mt-3 block text-[11px] text-muted">
        {copy.footnote}
      </small>
    </section>
  );
}
