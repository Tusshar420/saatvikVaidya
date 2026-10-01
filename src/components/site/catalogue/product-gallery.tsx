"use client";

import { useState } from "react";
import { catalogue as copy } from "@/content/catalogue";
import { cn } from "@/lib/cn";
import type { ProductImageView } from "@/server/catalogue/products";
import { ProductVisual } from "./product-visual";

const text = copy.product.gallery;

/**
 * The main photo with a row of thumbnails to switch it. Without photos it
 * shows the form's mark and "Image coming soon".
 */
export function ProductGallery({
  images,
  glyph,
}: {
  images: ProductImageView[];
  glyph: string | null;
}) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)] ?? null;

  return (
    <div role="group" aria-label={text.label} className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-alt">
        <ProductVisual image={current} glyph={glyph} loading="eager" />
        {!current && (
          <p className="absolute inset-x-0 bottom-4 text-center text-small font-semibold text-teal">
            {text.noImage}
          </p>
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex scrollbar-none gap-2 overflow-x-auto p-0.5">
          {images.map((image, position) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={text.show(position + 1, images.length)}
                aria-pressed={position === index}
                className={cn(
                  "block size-16 overflow-hidden rounded-md border-2 bg-surface-alt transition sm:size-20",
                  position === index
                    ? "border-teal"
                    : "border-line hover:border-teal/60",
                )}
              >
                {/* Decorative: the button's label says which image it shows. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
