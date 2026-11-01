import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { AutoSubmit } from "@/components/admin/auto-submit";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

// Pieces of a list's GET filter bar: a search box and labelled selects. The
// bar applies a select change straight away (AutoSubmit).

export function FilterBar({
  label,
  action,
  hidden,
  className,
  children,
}: {
  label: string;
  /** Where the form goes, e.g. "/admin/inventory/b2b#components". */
  action?: string;
  /** Values of other lists on the page to keep when this one is filtered. */
  hidden?: Record<string, string | undefined>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label={label}
      className={cn("mt-4 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card", className)}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <AutoSubmit />
    </form>
  );
}

export function FilterSearch({
  id,
  name = "q",
  label,
  placeholder,
  value,
}: {
  id: string;
  name?: string;
  label: string;
  placeholder: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1.5 text-xs font-extrabold text-ink">
        {label}
      </label>
      <span className="relative block">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          name={name}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          maxLength={100}
          className={cn(inputClasses, "pl-10")}
        />
      </span>
    </div>
  );
}

export function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1.5 text-xs font-extrabold text-ink">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} className={cn(inputClasses, "cursor-pointer")}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
