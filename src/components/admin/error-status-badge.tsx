import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { errorLog as copy } from "@/content/errors";
import type { ErrorStatusKey } from "@/server/admin/errors";

const variants: Record<ErrorStatusKey, BadgeVariant> = {
  new: "live",
  investigating: "orange",
  fixed: "teal",
  ignored: "blue",
};

export function ErrorStatusBadge({ status }: { status: ErrorStatusKey }) {
  return <Badge variant={variants[status]}>{copy.statuses[status]}</Badge>;
}
