import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { chooseBrandProductAction } from "@/app/(site)/launch/actions";
import { LaunchFrame } from "@/components/site/brand/launch-frame";
import { ProductCustomiser } from "@/components/site/brand/product-customiser";
import { brand as copy } from "@/content/brand";
import { brandThemeOf } from "@/lib/brand-theme";
import { formatPaise } from "@/lib/format";
import { signInPath } from "@/lib/auth-routes";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { findBrandProductBySlug } from "@/server/brand/drafts";

const text = copy.customise;

export async function generateMetadata({ params }: PageProps<"/launch/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await findBrandProductBySlug(slug);
  return {
    title: product ? `${product.name} · ${copy.launch.metaTitle}` : copy.launch.metaTitle,
    robots: { index: false, follow: false },
  };
}

/**
 * A product's page in Build Your Brand ("View & customise", step 1): the
 * pack, its facts, bulk prices and "Select variant" (the label theme). The
 * page is public, like the catalogue; "Continue — choose quantity" puts the
 * product in the signed-in buyer's Launch cart and opens step 2, and signed
 * out it asks to sign in first.
 */
export default async function LaunchProductPage({ params }: PageProps<"/launch/[slug]">) {
  const { slug } = await params;
  const product = await findBrandProductBySlug(slug);
  if (!product) notFound();
  const session = await getSession();
  const inCart = session
    ? await db.brandCartItem.findUnique({
        where: { userId_productId: { userId: session.user.id, productId: product.id } },
        select: { labelTheme: true },
      })
    : null;
  const { terms } = product;
  const facts: [string, string][] = [
    [text.details.form, product.formName],
    [text.details.pack, product.packSize],
    [text.details.batch, text.batch(terms.minQty, terms.unitLabel)],
    [text.details.rate, text.rate(formatPaise(terms.unitPricePaise))],
  ];
  return (
    <LaunchFrame step={1}>
      <Link
        href="/launch"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <ProductCustomiser
        productId={product.id}
        name={product.name}
        detail={`${product.formName} • ${product.packSize}`}
        initialTheme={brandThemeOf(inCart?.labelTheme).key}
        action={session ? chooseBrandProductAction : null}
        signInHref={signInPath(`/launch/${product.slug}`)}
      >
        <div>
          <p className="text-[11px] font-extrabold tracking-wide text-orange-ink uppercase">
            {product.makerName ?? product.formName}
          </p>
          <h2 id="launch-step-title" className="mt-1 text-h2 text-ink">
            {product.name}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface p-3">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-extrabold break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {terms.tiers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {terms.tiers.map((tier) => (
                <li key={tier.minQty} className="rounded-sm bg-brand-soft px-2.5 py-1.5 text-xs font-bold text-brand">
                  {copy.cart.tier(tier.minQty, terms.unitLabel, formatPaise(tier.unitPricePaise))}
                </li>
              ))}
            </ul>
          )}
          {inCart && <p className="mt-3 text-small text-muted">{text.inCart}</p>}
        </div>
      </ProductCustomiser>
    </LaunchFrame>
  );
}
