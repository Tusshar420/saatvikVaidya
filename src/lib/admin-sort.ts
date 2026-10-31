import { z } from "zod";

// Sorting for admin lists. A sort lives in the URL as `sort=name` (A to Z,
// low to high) or `sort=-name` (Z to A, high to low), so a sorted list can be
// bookmarked and paging keeps it. Column headers and the "Sort by" select
// both write the same value.

export type SortDir = "asc" | "desc";
export type Sort<K extends string> = { key: K; dir: SortDir };

/** The URL value for a sort: "name" or "-name". */
export const sortValue = <K extends string>(sort: Sort<K>): string =>
  `${sort.dir === "desc" ? "-" : ""}${sort.key}`;

/** Reads a sort from the URL. Anything unknown falls back to the default. */
export function parseSort<K extends string>(
  raw: unknown,
  keys: readonly K[],
  fallback: Sort<K>,
): Sort<K> {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return fallback;
  const desc = value.startsWith("-");
  const key = (desc ? value.slice(1) : value) as K;
  return keys.includes(key) ? { key, dir: desc ? "desc" : "asc" } : fallback;
}

/** Zod field for a sort, for filter schemas. */
export const sortField = <K extends string>(keys: readonly K[], fallback: Sort<K>) =>
  z.unknown().optional().transform((raw) => parseSort(raw, keys, fallback));

/** The URL value, or undefined when it is the default (keeps links short). */
export function sortParam<K extends string>(sort: Sort<K>, fallback: Sort<K>): string | undefined {
  const value = sortValue(sort);
  return value === sortValue(fallback) ? undefined : value;
}

/** The sort a column header links to: flips the direction if already sorted by it. */
export function nextSort<K extends string>(current: Sort<K>, key: K, firstDir: SortDir = "asc"): Sort<K> {
  if (current.key !== key) return { key, dir: firstDir };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

/**
 * Sorts rows in memory (lists that are read whole). Text compares naturally
 * ("Jar 100 g" before "Jar 250 g"); empty values always go last; ties keep
 * their order.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: Sort<K>,
  valueOf: (row: T, key: K) => string | number | Date | null | undefined,
): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row, sort.key) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === undefined;
      const bEmpty = b.value === null || b.value === undefined;
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const order =
        typeof a.value === "string" && typeof b.value === "string"
          ? a.value.localeCompare(b.value, "en-IN", { numeric: true, sensitivity: "base" })
          : Number(a.value) - Number(b.value);
      return order === 0 ? a.index - b.index : sign * order;
    })
    .map((entry) => entry.row);
}

/** A link to an admin list with these query values (empty ones dropped). */
export function listHref(
  basePath: string,
  params: Record<string, string | undefined>,
  hash?: string,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return `${basePath}${text ? `?${text}` : ""}${hash ? `#${hash}` : ""}`;
}
