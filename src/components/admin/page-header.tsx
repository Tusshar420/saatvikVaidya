import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type AdminPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually one button or link, e.g. "Add user". */
  action?: ReactNode;
  className?: string;
};

/** Eyebrow, page title and an optional action, stacked on phones. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1.5 text-2xl leading-tight font-extrabold tracking-[-0.03em] break-words text-ink sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 max-sm:*:w-full">{action}</div>}
    </div>
  );
}
