import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { sortValue, type Sort } from "@/lib/admin-sort";
import { cn } from "@/lib/cn";

/** The "Sort by" select in a list's filter bar (the only way to sort on phones). */
export function SortSelect<K extends string>({
  id,
  name = "sort",
  sort,
  options,
}: {
  id: string;
  name?: string;
  sort: Sort<K>;
  /** Value ("name" or "-name") and label, in the order to show them. */
  options: readonly { value: string; label: string }[];
}) {
  const current = sortValue(sort);
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1.5 text-xs font-extrabold text-ink">
        {copy.common.sortBy}
      </label>
      <select id={id} name={name} defaultValue={current} className={cn(inputClasses, "cursor-pointer")}>
        {/* A header click can pick a sort the select doesn't list. */}
        {!options.some((option) => option.value === current) && <option value={current}>{copy.common.customSort}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
