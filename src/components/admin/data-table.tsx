import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// A table that becomes a list of cards under 820 px, so nothing scrolls
// sideways on phones. Changing a table's display drops its semantics in some
// browsers, so the table roles are set explicitly. Each cell repeats its
// column name on phones through `label`.

export function DataTable({
  caption,
  className,
  children,
}: {
  caption: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "md:overflow-hidden md:rounded-xl md:border md:border-line md:bg-surface md:shadow-card",
        className,
      )}
    >
      <table role="table" className="w-full text-sm max-md:block">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead role="rowgroup" className="bg-surface-alt text-left max-md:sr-only">
      <tr role="row">{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      role="columnheader"
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-extrabold tracking-wide text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return (
    <tbody
      role="rowgroup"
      className="max-md:flex max-md:flex-col max-md:gap-3"
    >
      {children}
    </tbody>
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      role="row"
      className={cn(
        "max-md:flex max-md:flex-col max-md:gap-1 max-md:rounded-lg max-md:border max-md:border-line max-md:bg-surface max-md:p-4 max-md:shadow-card md:border-t md:border-line",
        className,
      )}
      {...props}
    />
  );
}

export type TdProps = ComponentProps<"td"> & {
  /** Column name, shown before the value on phones. */
  label?: string;
};

export function Td({ label, className, ...props }: TdProps) {
  return (
    <td
      role="cell"
      data-label={label}
      className={cn(
        "align-middle md:px-4 md:py-3",
        label &&
          "max-md:flex max-md:items-baseline max-md:gap-3 max-md:before:w-28 max-md:before:shrink-0 max-md:before:text-small max-md:before:font-bold max-md:before:text-muted max-md:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}

/** Shown in place of rows when a list is empty. */
export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr role="row" className="max-md:block">
      <td
        role="cell"
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-muted max-md:block max-md:rounded-lg max-md:border max-md:border-dashed max-md:border-line-strong"
      >
        {children}
      </td>
    </tr>
  );
}
