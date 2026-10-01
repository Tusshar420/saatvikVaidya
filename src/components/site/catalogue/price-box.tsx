import Link from "next/link";
import { catalogue as copy } from "@/content/catalogue";
import { signInPath } from "@/lib/auth-routes";
import { formatPaise } from "@/lib/format";
import type { ProductPage } from "@/server/catalogue/products";
import { PriceTag } from "./price-tag";

const text = copy.product;

/**
 * The viewer's price with tax and saving, a line about professional prices
 * for anyone not getting them, and bulk tiers for those who do.
 */
export function PriceBox({ product }: { product: ProductPage }) {
  const { price } = product;
  const hint = (() => {
    switch (product.viewer) {
      case "guest":
        return (
          <>
            {text.hint.guest}{" "}
            <Link
              href={signInPath(`/products/${product.slug}`)}
              className="font-bold text-teal underline underline-offset-4"
            >
              {text.hint.guestAction}
            </Link>
          </>
        );
      case "customer":
        return text.hint.customer;
      case "unverifiedProfessional":
        return (
          <>
            {text.hint.unverified}{" "}
            <Link
              href="/account"
              className="font-bold text-teal underline underline-offset-4"
            >
              {text.hint.unverifiedAction}
            </Link>
          </>
        );
      case "professional":
        return null;
    }
  })();

  return (
    <section
      aria-label={text.price.label}
      className="rounded-xl border border-line bg-surface-alt p-4 sm:p-5"
    >
      <PriceTag price={price} size="lg" />
      <p className="mt-1 text-small text-muted">{text.price.inclusive(product.gstRate)}</p>
      {price.savingPaise > 0 && (
        <p className="mt-1 text-small font-bold text-green">
          {text.price.save(formatPaise(price.savingPaise))}
        </p>
      )}
      {hint && <p className="mt-3 border-t border-line pt-3 text-small text-ink">{hint}</p>}

      {price.bulkTiers.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <h2 className="text-sm font-extrabold text-ink">{text.price.bulkTitle}</h2>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">{text.price.bulkCaption}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">{text.price.quantityColumn}</th>
                <th scope="col">{text.price.priceColumn}</th>
              </tr>
            </thead>
            <tbody>
              {price.bulkTiers.map((tier) => (
                <tr key={tier.minQuantity} className="border-t border-line first:border-t-0">
                  <th scope="row" className="py-2 text-left font-semibold text-ink">
                    {text.price.bulkQuantity(tier.minQuantity)}
                  </th>
                  <td className="py-2 text-right">
                    <span className="font-extrabold text-ink">{formatPaise(tier.pricePaise)}</span>{" "}
                    <span className="text-small text-muted">{text.price.bulkPerUnit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
