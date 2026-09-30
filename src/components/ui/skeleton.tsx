import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

/** A grey placeholder block. Decorative; wrap groups in SkeletonGroup. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-line/70 motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

/** Lines of text; the last one is shorter. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3.5",
            i === lines - 1 && lines > 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

/** A card-shaped placeholder: media, title and two lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-xl border border-line bg-surface p-4", className)}
    >
      <Skeleton className="aspect-4/3 w-full rounded-lg" />
      <Skeleton className="mt-4 h-5 w-2/3" />
      <SkeletonText lines={2} className="mt-3" />
    </div>
  );
}

/** Announces "Loading" once for a group of skeletons. */
export function SkeletonGroup({
  label = ui.loading,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
