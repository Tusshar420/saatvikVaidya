import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { orders as copy } from "@/content/orders";
import type { OrderStatus } from "@/generated/prisma/enums";

const variants: Record<OrderStatus, BadgeVariant> = {
  pending_payment: "orange",
  payment_failed: "live",
  paid: "brand",
  processing: "blue",
  shipped: "blue",
  delivered: "brand",
  returned: "orange",
  cancelled: "live",
};

/** An order's status as a coloured badge. Labels default to the customer's wording. */
export function OrderStatusBadge({
  status,
  labels = copy.status,
  className,
}: {
  status: OrderStatus;
  labels?: Record<OrderStatus, string>;
  className?: string;
}) {
  return (
    <Badge variant={variants[status]} className={className}>
      {labels[status]}
    </Badge>
  );
}
