import Link from "next/link";
import { catalogue as copy } from "@/content/catalogue";
import { productHref } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { ProductCard as ProductCardData } from "@/server/catalogue/products";
import { ProductPack } from "./product-pack";
import { QuickAdd } from "./quick-add";

const pill = "inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] leading-none font-extrabold";

/** MRP on the left; the viewer's rate (and any percentage off) on the right. */
function CardPrice({ price }: { price: ProductCardData["price"] }) {
  const below = price.unitPaise < price.mrpPaise;
  const percentOff = below
    ? Math.round(((price.mrpPaise - price.unitPaise) / price.mrpPaise) * 100)
    : 0;
  const rateLabel = price.tier === "mrp" ? copy.card.ourPrice : copy.card.netRate;
  return (
    <div className="mt-3.5 mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <p className="flex flex-col">
        <span className="text-[11px] leading-tight text-muted">{copy.card.mrp}</span>
        {below ? (
          <s className="mt-0.5 text-small text-ink/80">{formatPaise(price.mrpPaise)}</s>
        ) : (
          <span className="mt-0.5 font-heading text-base font-extrabold text-ink">
            {formatPaise(price.unitPaise)}
          </span>
        )}
      </p>
      {below && (
        <p className="flex flex-col items-end text-right">
          <span className="text-[11px] leading-tight text-muted">
            {rateLabel}
            {percentOff > 0 && (
              <>
                {" · "}
                <span data-testid="percent-off" className="font-bold text-success">
                  {copy.card.percentOff(percentOff)}
                </span>
              </>
            )}
          </span>
          <span className="mt-0.5 font-heading text-base font-extrabold tracking-[-0.02em] text-ink">
            {formatPaise(price.unitPaise)}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * One product in a listing (v2 `.shop-card`): the pack, stock pill, name and
 * meta, MRP and net rate link to the product page; under them the quantity
 * stepper (from the minimum order) and "Add to Order".
 */
export function ProductCard({
  product,
  index = 0,
  className,
}: {
  product: ProductCardData;
  index?: number;
  className?: string;
}) {
  const meta = [product.brandName, product.formName, product.packSize].filter(Boolean).join(" · ");
  return (
    <li
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition hover:shadow-raised motion-safe:hover:-translate-y-0.75 md:rounded-[21px]",
        className,
      )}
    >
      <Link href={productHref(product.slug)} className="flex flex-1 flex-col">
        <ProductPack
          image={product.image}
          brandName={product.brandName}
          name={product.name}
          index={index}
        />
        <div className="flex flex-1 flex-col px-3 pt-3.75 sm:px-3.75">
          <div className="flex flex-wrap items-center gap-1.5">
            {product.inStock ? (
              <span className={cn(pill, "bg-success-soft text-success")}>{copy.card.inStock}</span>
            ) : (
              <span className={cn(pill, "bg-danger-soft text-danger")}>{copy.card.outOfStock}</span>
            )}
            {product.isSample && (
              <span className={cn(pill, "bg-orange-soft text-orange-ink")}>{copy.card.sample}</span>
            )}
          </div>
          <h3 className="mt-2.75 mb-1 font-heading text-[15px] leading-snug font-extrabold tracking-[-0.01em] text-ink group-hover:text-brand">
            {product.name}
          </h3>
          <p className="text-xs text-muted">{meta}</p>
          <div className="mt-auto">
            <CardPrice price={product.price} />
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3.75 sm:px-3.75">
        <QuickAdd
          productId={product.id}
          name={product.name}
          moq={product.moq}
          outOfStock={!product.inStock}
        />
      </div>
    </li>
  );
}

/**
 * Product cards: four across from 1100 px, three from 820 px, and two across
 * on every smaller screen, phones included, wrapping into rows of two.
 */
export function ProductGrid({
  products,
  label,
}: {
  products: ProductCardData[];
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:gap-3.25 md:grid-cols-3 lg:grid-cols-4"
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          index={index}
        />
      ))}
    </ul>
  );
}
