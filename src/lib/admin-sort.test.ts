import { describe, expect, it } from "vitest";
import { listHref, nextSort, parseSort, sortField, sortParam, sortRows, sortValue } from "./admin-sort";

const keys = ["name", "available"] as const;
const fallback = { key: "name", dir: "asc" } as const;

describe("admin sort", () => {
  it("reads a sort from the URL and falls back on anything unknown", () => {
    expect(parseSort("available", keys, fallback)).toEqual({ key: "available", dir: "asc" });
    expect(parseSort("-available", keys, fallback)).toEqual({ key: "available", dir: "desc" });
    expect(parseSort(["-name", "available"], keys, fallback)).toEqual({ key: "name", dir: "desc" });
    expect(parseSort("price", keys, fallback)).toEqual(fallback);
    expect(parseSort("--name", keys, fallback)).toEqual(fallback);
    expect(parseSort(undefined, keys, fallback)).toEqual(fallback);
    expect(sortField(keys, fallback).parse("-name")).toEqual({ key: "name", dir: "desc" });
  });

  it("writes the URL value and leaves out the default", () => {
    expect(sortValue({ key: "available", dir: "desc" })).toBe("-available");
    expect(sortParam({ key: "name", dir: "asc" }, fallback)).toBeUndefined();
    expect(sortParam({ key: "name", dir: "desc" }, fallback)).toBe("-name");
  });

  it("flips the direction when a sorted column is clicked again", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "available", "desc")).toEqual({ key: "available", dir: "desc" });
  });

  it("sorts text naturally, numbers both ways and empty values last", () => {
    const rows = [
      { name: "Jar 250 g", available: 600 },
      { name: "jar 100 g", available: null },
      { name: "Amber bottle", available: 2000 },
      { name: "Jar 1000 g", available: 600 },
    ];
    const names = (list: typeof rows) => list.map((row) => row.name);
    const value = (row: (typeof rows)[number], key: "name" | "available") => row[key];
    expect(names(sortRows(rows, { key: "name", dir: "asc" }, value))).toEqual(["Amber bottle", "jar 100 g", "Jar 250 g", "Jar 1000 g"]);
    expect(names(sortRows(rows, { key: "available", dir: "desc" }, value))).toEqual(["Amber bottle", "Jar 250 g", "Jar 1000 g", "jar 100 g"]);
    expect(names(sortRows(rows, { key: "available", dir: "asc" }, value))).toEqual(["Jar 250 g", "Jar 1000 g", "Amber bottle", "jar 100 g"]);
  });

  it("builds list links without empty values", () => {
    expect(listHref("/admin/x", { q: "jar", sort: undefined, page: "" })).toBe("/admin/x?q=jar");
    expect(listHref("/admin/x", {}, "can-make")).toBe("/admin/x#can-make");
  });
});
