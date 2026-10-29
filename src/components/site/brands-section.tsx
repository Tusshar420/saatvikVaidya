import Link from "next/link";
import { ButtonArrow } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { productHref } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { SectionHeading as Heading } from "@/server/content/home";
import type { ProductCard } from "@/server/catalogue/products";
import { HomeAddToCart } from "./home-add-to-cart";
import { HomeHead } from "./home-parts";

const text = copy.brands;
const packs = ["bg-pack-saffron", "bg-pack-green", "bg-pack-blue"];

/**
 * v2 Top Brands (`.marketplace-section`): three real products with the MRP
 * struck through, the viewer's rate and "Add +" (the store cart).
 */
export function BrandsSection({
  heading,
  products,
}: {
  heading: Heading;
  products: ProductCard[];
}) {
  const href = heading.link?.href?.startsWith("/") ? heading.link.href : "/products";
  return (
    <section id="brands" aria-labelledby="brands-title" className="section-y bg-surface">
      <div className="shell">
        <HomeHead
          eyebrow={heading.eyebrow}
          title={<span id="brands-title">{heading.title}</span>}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        {products.length > 0 ? (
          <ul className="scrollbar-none -mr-3.25 flex snap-x snap-mandatory gap-4.5 overflow-x-auto pb-2 sm:mr-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {products.map((product, index) => (
              <li
                key={product.id}
                className={cn(
                  "reveal grid w-77.5 shrink-0 snap-start grid-cols-[108px_1fr] rounded-[20px] border border-line bg-surface p-3.5 shadow-card sm:w-auto sm:grid-cols-[120px_1fr]",
                  index === 2 && "sm:max-lg:hidden",
                )}
              >
                <Link
                  href={productHref(product.slug)}
                  aria-hidden
                  tabIndex={-1}
                  className={cn(
                    "flex min-h-48.75 flex-col rounded-[14px] px-2.5 py-3.5 text-white sm:min-h-52",
                    packs[index % packs.length],
                  )}
                >
                  <span className="font-heading text-[11px] font-bold">{product.brandName}</span>
                  <span className="my-auto font-heading text-[15px] leading-[1.05] font-extrabold [overflow-wrap:anywhere] sm:text-[17px]">
                    {product.name}
                  </span>
                  <span className="text-[11px] opacity-85">{product.packSize}</span>
                </Link>
                <div className="flex min-w-0 flex-col pt-1 pr-1 pb-0.75 pl-3.75">
                  <span
                    className={cn(
                      "self-start rounded-md px-1.75 py-1.25 text-[11px] font-extrabold",
                      product.inStock ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                    )}
                  >
                    {product.inStock ? text.stock : text.outOfStock}
                  </span>
                  <h3 className="mt-3 mb-0.75 font-heading text-[15px] font-extrabold">
                    <Link href={productHref(product.slug)} className="hover:text-brand">
                      {product.name}
                    </Link>
                  </h3>
                  <p className="m-0 text-[11px] text-muted">
                    {product.formName} • {product.packSize}
                  </p>
                  <dl className="mt-auto mb-3 grid grid-cols-[1fr_1.5fr] gap-1.5 pt-4">
                    {product.price.unitPaise < product.price.mrpPaise && (
                      <div className="flex flex-col">
                        <dt className="text-[11px] text-muted">{text.mrp}</dt>
                        <dd className="m-0 mt-0.75 text-xs">
                          <del>{formatPaise(product.price.mrpPaise)}</del>
                        </dd>
                      </div>
                    )}
                    <div className="col-start-2 flex flex-col">
                      <dt className="text-[11px] text-muted">
                        {product.price.tier === "mrp" && product.price.unitPaise >= product.price.mrpPaise
                          ? text.mrp
                          : product.price.tier === "mrp"
                            ? text.yourPrice
                            : text.netRate}
                      </dt>
                      <dd className="m-0 mt-0.5 font-heading text-[15px] font-extrabold text-brand">
                        {formatPaise(product.price.unitPaise)}
                      </dd>
                    </div>
                  </dl>
                  <HomeAddToCart
                    productId={product.id}
                    name={product.name}
                    moq={product.moq}
                    outOfStock={!product.inStock}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{text.empty}</p>
        )}
        <Link
          href={href}
          className="mt-6.5 inline-flex min-h-11 items-center gap-2 text-small font-extrabold text-brand hover:underline"
        >
          {heading.link?.label}
          <ButtonArrow />
        </Link>
      </div>
    </section>
  );
}
