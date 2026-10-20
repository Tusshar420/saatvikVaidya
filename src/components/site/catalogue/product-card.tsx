import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { catalogue as copy } from "@/content/catalogue";
import { productHref } from "@/lib/catalogue";
import type { ProductCard as ProductCardData } from "@/server/catalogue/products";
import { PriceTag } from "./price-tag";
import { ProductVisual } from "./product-visual";
import { QuickAdd } from "./quick-add";

/**
 * One product in a listing. The picture and details link to the product
 * page; the button underneath adds the minimum order to the cart.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition hover:border-brand/40 hover:shadow-raised motion-safe:hover:-translate-y-0.75">
      <Link href={productHref(product.slug)} className="flex flex-1 flex-col">
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
          <h3 className="text-[15px] leading-snug font-bold text-ink group-hover:text-brand sm:text-base">
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
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
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
