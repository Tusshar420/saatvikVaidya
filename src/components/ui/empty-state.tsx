import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";
import { Badge } from "./badge";
import { IconTile, type IconTileTone } from "./icon-tile";

export type EmptyStateProps = {
  icon?: ReactNode;
  tone?: IconTileTone;
  title: ReactNode;
  description?: ReactNode;
  /** Optional button or link. Never a button that does nothing. */
  action?: ReactNode;
  badge?: ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
};

export function EmptyState({
  icon,
  tone = "teal",
  title,
  description,
  action,
  badge,
  as: Heading = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-alt px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <IconTile tone={tone} size="lg">
          {icon}
        </IconTile>
      )}
      {badge && <div className="mt-4">{badge}</div>}
      <Heading className={cn("text-h3 text-ink", icon || badge ? "mt-3" : "")}>
        {title}
      </Heading>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export type ComingSoonProps = Omit<EmptyStateProps, "badge"> & {
  /** Badge text; defaults to "Coming soon". */
  badgeLabel?: string;
};

/** EmptyState for features whose integration isn't built yet. */
export function ComingSoon({
  icon = <Clock aria-hidden />,
  tone = "orange",
  badgeLabel = ui.comingSoon,
  ...props
}: ComingSoonProps) {
  return (
    <EmptyState
      icon={icon}
      tone={tone}
      badge={<Badge variant="soon">{badgeLabel}</Badge>}
      {...props}
    />
  );
}
