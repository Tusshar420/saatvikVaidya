import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { catalogue as copy } from "@/content/catalogue";

/**
 * The floating "Order List" button (v2 `.order-fab`) with the real cart
 * count. It opens the cart; on phones it sits above the bottom dock.
 */
export function OrderListButton({ count }: { count: number }) {
  return (
    <Link
      href="/cart"
      aria-label={copy.listing.orderListLabel(count)}
      className="fixed right-3.25 bottom-20.5 z-40 inline-flex min-h-11.5 items-center gap-2.25 rounded-[14px] bg-cta px-4.25 font-heading text-small font-extrabold text-white shadow-cta transition hover:-translate-y-0.5 md:right-6.25 md:bottom-6.25"
    >
      <ShoppingBag aria-hidden className="size-4" />
      {copy.listing.orderList}
      <span
        aria-hidden
        className="grid h-5 min-w-5 place-items-center rounded-[7px] bg-surface px-1 text-xs text-orange-ink"
      >
        {count}
      </span>
    </Link>
  );
}
