import Link from "next/link";
import { ProductVisual } from "@/components/site/catalogue/product-visual";
import { Badge } from "@/components/ui/badge";
import { cart as copy } from "@/content/cart";
import { catalogue } from "@/content/catalogue";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { isBlockingIssue, type CartIssue, type CartLine } from "@/server/cart/cart";
import { CartLineControls } from "./cart-line-controls";

const text = copy.line;

function issueText(issue: CartIssue): string {
  switch (issue.kind) {
    case "unavailable":
      return copy.issues.unavailable;
    case "out_of_stock":
      return copy.issues.outOfStock;
    case "below_moq":
      return copy.issues.belowMoq(issue.moq);
    case "above_stock":
      return copy.issues.aboveStock(issue.available);
  }
}

/** One cart line: product, the viewer's price, quantity, total and any problem. */
export function CartLineItem({ line }: { line: CartLine }) {
  const issueId = `cart-issue-${line.productId}`;
  const limitsId = `cart-limits-${line.productId}`;
  const describedBy = [line.issue ? issueId : null, line.moq > 1 ? limitsId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const href = `/products/${line.slug}`;
  const tierLabel =
    line.tier === "bulk" ? text.bulkPrice : line.tier === "professional" ? text.professionalPrice : null;

  return (
    <li
      className={cn(
        "rounded-lg border bg-surface p-4 shadow-card sm:p-5 md:rounded-[21px]",
        line.issue ? "border-danger/50" : "border-line",
      )}
    >
      <div className="flex gap-4">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="size-20 shrink-0 overflow-hidden rounded-md border border-line bg-cream sm:size-24"
        >
          <ProductVisual image={line.image} glyph={line.glyph} className="text-3xl sm:text-4xl" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-small text-muted">
            {[line.brandName, line.formName].filter(Boolean).join(" · ")}
          </p>
          <h3 className="font-heading text-base font-extrabold tracking-[-0.01em] text-ink">
            <Link href={href} className="hover:text-brand hover:underline">
              {line.name}
            </Link>
          </h3>
          <p className="text-small text-muted">{text.packSize(line.packSize)}</p>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold text-ink">{text.unitPrice(formatPaise(line.unitPaise))}</span>
            {line.unitPaise < line.mrpPaise && (
              <span className="text-small text-muted">
                <span className="sr-only">{catalogue.card.mrp} </span>
                <s>{formatPaise(line.mrpPaise)}</s>
              </span>
            )}
            {line.unitPaise < line.mrpPaise && (
              <span className="text-small font-bold text-success">
                {catalogue.card.percentOff(
                  Math.round(((line.mrpPaise - line.unitPaise) / line.mrpPaise) * 100),
                )}
              </span>
            )}
            {tierLabel && <Badge>{tierLabel}</Badge>}
            {line.isSample && <Badge variant="soon">{catalogue.card.sample}</Badge>}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <CartLineControls
          productId={line.productId}
          name={line.name}
          quantity={line.quantity}
          moq={line.moq}
          available={line.available}
          removeOnly={isBlockingIssue(line.issue)}
          describedBy={describedBy}
        />
        {!isBlockingIssue(line.issue) && (
          <p className="text-right text-sm">
            <span className="block text-small text-muted">{text.lineTotal}</span>
            <span className="text-lg font-extrabold text-ink">{formatPaise(line.lineTotalPaise)}</span>
          </p>
        )}
      </div>

      {line.moq > 1 && (
        <p id={limitsId} className="mt-2 text-small text-muted">
          {text.moq(line.moq)}
        </p>
      )}
      {line.issue && (
        <p id={issueId} className="mt-2 text-small font-bold text-danger">
          {issueText(line.issue)}
        </p>
      )}
    </li>
  );
}
