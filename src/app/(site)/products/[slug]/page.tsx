import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AddToCart } from "@/components/site/catalogue/add-to-cart";
import { PriceBox } from "@/components/site/catalogue/price-box";
import { ProductGallery } from "@/components/site/catalogue/product-gallery";
import { SampleNote } from "@/components/site/catalogue/sample-note";
import { catalogue as copy } from "@/content/catalogue";
import { catalogueHref } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { readProductMeta, readProductPage } from "@/server/catalogue/products";
import { getSetting } from "@/server/content/settings";
import { getPricingViewer } from "@/server/pricing";

const text = copy.product;

const pill = "inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] leading-none font-extrabold";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await readProductMeta((await params).slug);
  if (!product) return { title: text.notFoundTitle };
  return { title: product.name, description: product.description.slice(0, 160) };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [viewer, phone, discount] = await Promise.all([
    getPricingViewer(),
    getSetting("contact.phone"),
    getSetting("pricing.discount"),
  ]);
  const product = await readProductPage(slug, viewer, discount.percent);
  if (!product) notFound();

  const stock = (() => {
    switch (product.stock.kind) {
      case "in":
        return { label: text.stock.inStock, className: "bg-success-soft text-success" };
      case "low":
        return { label: text.stock.low(product.stock.left), className: "bg-orange-soft text-orange-ink" };
      case "out":
        return { label: text.stock.out, className: "bg-danger-soft text-danger" };
    }
  })();

  const longText = [
    { title: text.sections.description, body: product.description },
    product.ingredients && { title: text.sections.ingredients, body: product.ingredients },
    product.dosage && { title: text.sections.dosage, body: product.dosage, note: text.dosageNote },
  ].filter(Boolean) as { title: string; body: string; note?: string }[];

  const details: [string, string][] = [
    ...(product.brand ? [[text.details.brand, product.brand.name] as [string, string]] : []),
    [text.details.form, product.form.name],
    ...(product.practiceAreas.length
      ? [[text.details.practiceAreas, product.practiceAreas.map((a) => a.name).join(", ")] as [string, string]]
      : []),
    [text.details.packSize, product.packSize],
    [text.details.gst, text.details.gstValue(product.gstRate)],
    [text.details.hsn, product.hsnCode],
    [text.details.moq, String(product.moq)],
  ];

  return (
    <div className="shell pt-5 pb-24 sm:pt-8">
      <nav aria-label={text.breadcrumb} className="mb-4 text-small">
        <ol className="flex flex-wrap items-center gap-1 text-muted">
          <li className="flex items-center gap-1">
            <Link href="/products" className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
              {text.products}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
          </li>
          <li className="flex items-center gap-1">
            <Link
              href={catalogueHref({ form: product.form.key })}
              className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
            >
              {product.form.name}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
          </li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
        <ProductGallery
          images={product.images}
          glyph={product.form.glyph}
          name={product.name}
          brandName={product.brand?.name ?? null}
        />

        <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-line bg-surface p-4.5 shadow-card sm:p-6.5 md:rounded-[21px]">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <span className={cn(pill, stock.className)}>{stock.label}</span>
              {product.isSample && (
                <span className={cn(pill, "bg-orange-soft text-orange-ink")}>{text.sampleBadge}</span>
              )}
              <span className={cn(pill, "bg-brand-soft text-brand")}>{product.form.name}</span>
            </div>
            {product.brand && (
              <p className="mt-3 text-small text-muted">
                {text.by}{" "}
                <Link
                  href={catalogueHref({ brand: product.brand.key })}
                  className="font-bold text-brand hover:underline"
                >
                  {product.brand.name}
                </Link>
              </p>
            )}
            <h1 className="mt-1 font-heading text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance text-ink md:text-[42px]">
              {product.name}
            </h1>
            <p className="mt-2 text-body text-muted">
              {text.packSize}: {product.packSize}
            </p>
          </div>

          <PriceBox product={product} />

          {product.moq > 1 && <p className="text-small text-muted">{text.moq(product.moq)}</p>}

          <AddToCart
            productId={product.id}
            name={product.name}
            moq={Math.max(1, product.moq)}
            left={product.stock.kind === "low" ? product.stock.left : null}
            outOfStock={product.stock.kind === "out"}
            phone={phone}
          />

          {product.isSample && <SampleNote>{text.sampleNote}</SampleNote>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex flex-col gap-7 rounded-lg border border-line bg-surface p-4.5 shadow-card sm:p-6.5 md:rounded-[21px]">
          {longText.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-[22px] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink">{section.title}</h2>
              <p className="mt-2 text-body whitespace-pre-line text-ink">{section.body}</p>
              {section.note && <p className="mt-2 text-small text-muted">{section.note}</p>}
            </section>
          ))}
        </div>
        <section className="self-start rounded-lg border border-line bg-surface p-4.5 shadow-card sm:p-6 md:rounded-[21px]">
          <h2 className="font-heading text-[22px] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink">{text.sections.details}</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {details.map(([term, value]) => (
              <div key={term} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{term}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
