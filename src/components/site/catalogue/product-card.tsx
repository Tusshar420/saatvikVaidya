import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { catalogue as copy } from "@/content/catalogue";
import { productHref } from "@/lib/catalogue";
import type { ProductCard as ProductCardData } from "@/server/catalogue/products";
import { PriceTag } from "./price-tag";
import { ProductVisual } from "./product-visual";

/** One product in a listing; the whole card links to the product page. */
export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <li className="min-w-0">
      <Link
        href={productHref(product.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition hover:border-teal/40 hover:shadow-raised motion-safe:hover:-translate-y-0.75"
      >
        <div className="relative aspect-square overflow-hidden border-b border-line bg-surface-alt">
          <ProductVisual image={product.image} glyph={product.glyph} />
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
            {product.isSample && <Badge variant="soon">{copy.card.sample}</Badge>}
            {!product.inStock && <Badge variant="live">{copy.card.outOfStock}</Badge>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
          {product.brandName && (
            <p className="truncate text-label text-muted uppercase">{product.brandName}</p>
          )}
          <h3 className="text-[15px] leading-snug font-bold text-ink group-hover:text-teal sm:text-base">
            {product.name}
          </h3>
          <p className="text-small text-muted">
            {product.formName} · {product.packSize}
          </p>
          <PriceTag price={product.price} className="mt-auto pt-2" />
          {product.moq > 1 && (
            <p className="text-small text-muted">{copy.card.minOrder(product.moq)}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Product cards: two across on phones, three from 820 px. */
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
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
    >
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}
