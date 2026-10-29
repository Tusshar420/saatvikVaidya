"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { brandThemes, type BrandThemeKey } from "@/lib/brand-theme";
import { cn } from "@/lib/cn";
import { ThemedPack } from "./themed-pack";

const text = copy.customise;

/** One theme's two-tone swatch (header colour beside the body colour). */
const swatches: Record<BrandThemeKey, [string, string]> = {
  "classic-green": ["bg-pack-green", "bg-orange"],
  "saffron-glow": ["bg-orange", "bg-pack-green"],
  "royal-maroon": ["bg-pack-maroon", "bg-pack-gold"],
  "minimal-white": ["bg-surface", "bg-brand-mid"],
};

/**
 * A product's page: the big pack that follows the chosen label theme, one
 * small pack per theme, "Select variant" (a radio group, so it also works
 * with the keyboard) and the button that puts the product in the Launch cart
 * with that theme and goes on to the quantity step. `action` is a server
 * action; with no `action` (signed out) the button is a sign-in link.
 */
export function ProductCustomiser({
  productId,
  name,
  detail,
  initialTheme,
  action,
  signInHref,
  children,
}: {
  productId: number;
  name: string;
  /** "Tablet • 60 tabs". */
  detail: string;
  initialTheme: BrandThemeKey;
  action: ((formData: FormData) => Promise<void>) | null;
  signInHref: string;
  /** The product's facts, drawn between the pack and the variants. */
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<BrandThemeKey>(initialTheme);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="min-w-0">
        <div className="grid place-items-center rounded-2xl bg-brand-soft p-6 sm:p-10">
          <ThemedPack theme={theme} name={name} detail={detail} size="lg" />
        </div>
        <ul aria-hidden className="mt-3 grid grid-cols-4 gap-2">
          {brandThemes.map((option) => (
            <li
              key={option.key}
              className={cn(
                "grid place-items-center rounded-lg border-2 bg-surface-alt p-2",
                option.key === theme ? "border-brand" : "border-line",
              )}
            >
              <ThemedPack theme={option.key} name={name} detail={detail} size="sm" />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {children}
        <form action={action ?? undefined} className="flex flex-col gap-5">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="theme" value={theme} />
          <fieldset className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <legend className="sr-only">{text.variantLabel}</legend>
            <h2 className="text-h3 text-ink">{text.variantTitle}</h2>
            <p className="mt-1 mb-4 text-small text-muted">{text.variantLine}</p>
            <div role="radiogroup" aria-label={text.variantLabel} className="grid gap-3 sm:grid-cols-2">
              {brandThemes.map((option) => {
                const active = option.key === theme;
                const [left, right] = swatches[option.key];
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(option.key)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border-2 bg-surface p-3 text-left text-sm font-bold text-ink transition focus-visible:ring-3 focus-visible:ring-brand/20",
                      active ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50",
                    )}
                  >
                    <span aria-hidden className="flex h-8 w-10 shrink-0 overflow-hidden rounded-sm border border-line">
                      <span className={cn("w-1/2", left)} />
                      <span className={cn("w-1/2", right)} />
                    </span>
                    <span className="min-w-0 flex-1">{text.themes[option.key]}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border-2",
                        active ? "border-brand bg-brand text-white" : "border-line",
                      )}
                    >
                      {active && <Check strokeWidth={3} className="size-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {action ? (
            <button type="submit" className={buttonClasses({ size: "lg", className: "w-full" })}>
              {text.continue}
              <ButtonArrow />
            </button>
          ) : (
            <Link href={signInHref} className={buttonClasses({ size: "lg", className: "w-full" })}>
              {text.signIn}
              <ButtonArrow />
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
