import { Badge } from "@/components/ui/badge";
import { admin as copy } from "@/content/admin";
import type { VerificationStatus } from "@/server/admin/users";

const statusVariant = {
  pending: "orange",
  approved: "teal",
  rejected: "live",
} as const;

/** Verification status; "Not needed" is plain text, not a badge. */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "none") {
    return (
      <span className="text-small text-muted">{copy.users.status.none}</span>
    );
  }
  return (
    <Badge variant={statusVariant[status]}>{copy.users.status[status]}</Badge>
  );
}

/** Shown on the site, or hidden. */
export function ActiveBadge({
  active,
  activeLabel = copy.common.active,
  hiddenLabel = copy.common.hidden,
}: {
  active: boolean;
  activeLabel?: string;
  hiddenLabel?: string;
}) {
  return active ? (
    <Badge variant="teal">{activeLabel}</Badge>
  ) : (
    <span className="text-small font-semibold text-muted">{hiddenLabel}</span>
  );
}
