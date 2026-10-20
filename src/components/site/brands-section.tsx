"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";
import type {
  BrandItem,
  SectionHeading as SectionHeadingContent,
} from "@/server/content/home";

const toneStyles: Partial<Record<string, string>> = {
  orange: "bg-orange-soft",
  teal: "bg-brand-soft",
  gold: "bg-gold-soft",
  blue: "bg-blue-soft",
} as const;

const toneTextStyles: Partial<Record<string, string>> = {
  orange: "text-orange-ink",
  teal: "text-brand",
  gold: "text-gold-ink",
  blue: "text-blue",
} as const;

type BrandsSectionProps = {
  heading: SectionHeadingContent;
  brands: BrandItem[];
};

export function BrandsSection({ heading, brands }: BrandsSectionProps) {
  const featured = brands.filter((b) => b.featured);
  const others = brands.filter((b) => !b.featured);

  return (
    <section className="section-y" id="brands">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
          action={
            heading.link?.href?.startsWith("/")
              ? { href: heading.link.href, label: heading.link.label }
              : undefined
          }
        />

        <div className="mt-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((brand) => (
              <Card
                key={brand.key}
                interactive
                className={cn(
                  "overflow-hidden",
                  featured.length % 3 !== 0 && featured.indexOf(brand) === featured.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""
                )}
              >
                <div
                  className={cn(
                    "flex h-32 items-center justify-center text-3xl font-extrabold",
                    toneStyles[brand.tone] || "bg-surface-alt",
                    toneTextStyles[brand.tone] || "text-ink"
                  )}
                >
                  {brand.monogram}
                </div>
                <div className="p-6">
                  <div className="text-label text-muted uppercase">
                    {brand.eyebrow}
                  </div>
                  <h3 className="text-h3 mt-2">{brand.name}</h3>
                  <p className="text-body text-muted mt-3">{brand.description}</p>
                  {brand.link.href ? (
                    <Link
                      href={brand.link.href}
                      aria-label={`${brand.link.label}: ${brand.name}`}
                      className="mt-3 inline-flex min-h-11 items-center text-brand font-600 hover:underline"
                    >
                      {brand.link.label} →
                    </Link>
                  ) : (
                    <span className="inline-block text-muted font-600 mt-4">
                      {brand.link.label} (coming soon)
                    </span>
                  )}
                </div>
              </Card>
            ))}

            {others.map((brand) => (
              <Card key={brand.key} interactive>
                <div
                  className={cn(
                    "flex h-24 items-center justify-center text-2xl font-extrabold",
                    toneStyles[brand.tone] || "bg-surface-alt",
                    toneTextStyles[brand.tone] || "text-ink"
                  )}
                >
                  {brand.monogram}
                </div>
                <div className="p-4">
                  <h4 className="text-body font-600">{brand.name}</h4>
                  <p className="text-small text-muted mt-2">{brand.description}</p>
                  {brand.link.href && (
                    <Link
                      href={brand.link.href}
                      aria-label={`${brand.link.label}: ${brand.name}`}
                      className="mt-3 inline-flex min-h-11 items-center text-small font-bold text-brand hover:underline"
                    >
                      {brand.link.label} →
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
