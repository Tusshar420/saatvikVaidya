import { cn } from "@/lib/cn";
import type { ProductImageView } from "@/server/catalogue/products";

export type ProductVisualProps = {
  image: ProductImageView | null;
  /** The form's Devanagari mark, shown when there's no photo. */
  glyph: string | null;
  /** Lazy for listings; eager for the product page's main image. */
  loading?: "lazy" | "eager";
  className?: string;
};

/**
 * A product photo, or, while a product has none, a designed tile with its
 * form's mark (decorative: the product name is always next to it).
 */
export function ProductVisual({
  image,
  glyph,
  loading = "lazy",
  className,
}: ProductVisualProps) {
  if (image) {
    return (
      // Plain <img>: photos come from our own route (/api/product-images),
      // already sized by the admin; next/image would need a loader for it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        alt={image.alt}
        loading={loading}
        decoding="async"
        className={cn("size-full object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-full place-items-center bg-brand-soft font-serif-hindi text-5xl font-bold text-brand sm:text-6xl",
        className,
      )}
    >
      {glyph ?? "आ"}
    </span>
  );
}
