import { cn } from "@/lib/cn";
import type { ProductImageView } from "@/server/catalogue/products";

const packColours = ["bg-pack-green", "bg-pack-saffron", "bg-pack-blue"] as const;

/**
 * The v2 pack colour for the nth card (0-based), as the mockup's
 * `.shop-card:nth-child(2n)` saffron and `(3n)` blue.
 */
export function packColour(index: number) {
  const n = index + 1;
  if (n % 3 === 0) return packColours[2];
  if (n % 2 === 0) return packColours[1];
  return packColours[0];
}

export type ProductPackProps = {
  image: ProductImageView | null;
  brandName: string | null;
  name: string;
  /** Position in the list; picks the label colour of the drawn pack. */
  index?: number;
  size?: "md" | "lg";
  loading?: "lazy" | "eager";
  className?: string;
};

/**
 * The v2 "shop pack" area: the product photo on a soft panel or, while a
 * product has no photo, a drawn bottle (white body, orange cap, coloured
 * label with the brand and name). The bottle is decorative: the name is
 * always next to it.
 */
export function ProductPack({
  image,
  brandName,
  name,
  index = 0,
  size = "md",
  loading = "lazy",
  className,
}: ProductPackProps) {
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-cream",
        lg ? "aspect-square" : "h-41.25",
        className,
      )}
    >
      {image ? (
        // Plain <img>: photos come from our own route (/api/product-images),
        // already sized by the admin; next/image would need a loader for it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt={image.alt}
          loading={loading}
          decoding="async"
          className={cn("size-full object-contain", lg ? "p-6" : "p-3")}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "relative block bg-linear-to-r from-track via-surface to-track shadow-card",
            lg ? "h-59 w-39 rounded-[22px]" : "h-29.5 w-19.5 rounded-[11px]",
          )}
        >
          <span
            className={cn(
              "absolute bg-orange",
              lg ? "inset-x-4 -top-5 h-10 rounded-xl" : "inset-x-2 -top-2.5 h-5 rounded-md",
            )}
          />
          <span
            className={cn(
              "absolute grid place-items-center overflow-hidden text-center font-heading font-extrabold break-words text-white",
              lg
                ? "inset-x-3 top-14 bottom-6 rounded-[14px] p-2.5 text-base leading-tight"
                : "inset-x-1.5 top-7 bottom-3 rounded-[7px] p-1.25 text-[8px] leading-[1.25]",
              packColour(index),
            )}
          >
            <span>
              {brandName && (
                <>
                  {brandName}
                  <br />
                </>
              )}
              {name}
            </span>
          </span>
        </span>
      )}
    </div>
  );
}
