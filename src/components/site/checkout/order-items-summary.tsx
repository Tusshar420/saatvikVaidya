import { OrderSummary } from "@/components/site/cart/order-summary";
import { cart as cartCopy } from "@/content/cart";
import { checkout as copy } from "@/content/checkout";
import { formatPaise } from "@/lib/format";
import type { OrderView } from "@/server/checkout/orders";

/** A placed order's lines and totals, from its snapshot. */
export function OrderItemsSummary({ order, className }: { order: OrderView; className?: string }) {
  return (
    <OrderSummary
      totals={{
        subtotalPaise: order.subtotalPaise,
        gst: order.gst,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
      }}
      items={order.items.map((item) => ({
        key: item.productSlug,
        name: item.productName,
        detail: `${copy.summary.quantity(item.quantity)} · ${cartCopy.line.unitPrice(formatPaise(item.unitPaise))}`,
        totalPaise: item.lineTotalPaise,
      }))}
      itemsLabel={copy.confirmation.items}
      hideNote
      className={className}
    />
  );
}
