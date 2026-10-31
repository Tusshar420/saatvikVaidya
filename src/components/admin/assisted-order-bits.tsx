import { Mail, Phone } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { assistedOrders as copy } from "@/content/assisted-orders";
import type { AssistedStatus } from "@/lib/assisted-orders";
import { cn } from "@/lib/cn";
import { formatIndianPhone } from "@/lib/phone";
import type { CustomerMatch } from "@/server/assisted-orders/assisted-orders";

// Small pieces shared by the "orders for customers" admin pages.

const variants: Record<AssistedStatus, BadgeVariant> = {
  open: "orange",
  placed: "success",
  cancelled: "live",
  expired: "soon",
};

export function AssistedStatusBadge({ status, className }: { status: AssistedStatus; className?: string }) {
  return (
    <Badge variant={variants[status]} className={className}>
      {copy.statuses[status]}
    </Badge>
  );
}

/** The customer's name, account type, mobile and email. */
export function CustomerSummary({
  customer,
  compact = false,
  className,
}: {
  customer: CustomerMatch;
  /** One block for a search result, without icons. */
  compact?: boolean;
  className?: string;
}) {
  const text = copy.admin.detail;
  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <p className="font-bold break-words text-ink">
        {customer.name} <span className="font-normal text-muted">· {customer.typeLabel}</span>
      </p>
      {customer.phoneNumber && (
        <p className="mt-0.5 flex items-center gap-1.5 text-ink">
          {!compact && <Phone aria-hidden className="size-3.5 text-muted" />}
          <span className="sr-only">{text.phone}: </span>
          {formatIndianPhone(customer.phoneNumber)}
        </p>
      )}
      {customer.email && (
        <p className="mt-0.5 flex items-center gap-1.5 break-all text-ink">
          {!compact && <Mail aria-hidden className="size-3.5 shrink-0 text-muted" />}
          <span className="sr-only">{text.email}: </span>
          {customer.email}
        </p>
      )}
      {!customer.phoneNumber && !customer.email && <p className="mt-0.5 text-muted">{text.noContact}</p>}
    </div>
  );
}
