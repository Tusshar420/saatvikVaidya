import { describe, expect, it } from "vitest";
import {
  adminLinkGroups,
  consoleAddress,
  isCurrentLink,
  linkGroupsFor,
  quickActionsFor,
  searchLinks,
} from "./admin-links";

const rows = adminLinkGroups.flatMap((group) =>
  group.links.map((link) => ({ link, group: group.label })),
);
const hrefs = (query: string) =>
  searchLinks(query, rows).map((row) => row.link.href);

describe("admin links", () => {
  it("lists every page once", () => {
    const all = rows.map((row) => row.link.href);
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives a super admin every group and a content admin only theirs", () => {
    expect(linkGroupsFor("super")).toHaveLength(adminLinkGroups.length);
    const content = linkGroupsFor("content").flatMap((group) => group.links);
    expect(
      content.every((link) => ["content", "dashboard"].includes(link.area)),
    ).toBe(true);
    expect(content.map((link) => link.href)).not.toContain("/admin/orders");
    expect(linkGroupsFor(null)).toEqual([]);
    expect(quickActionsFor("orders")).toEqual([]);
    expect(quickActionsFor("catalogue").map((link) => link.href)).toContain(
      "/admin/catalogue/new",
    );
  });

  it("finds pages by label, keyword and group, label matches first", () => {
    expect(hrefs("")).toHaveLength(rows.length);
    expect(hrefs("orders")[0]).toBe("/admin/orders");
    expect(hrefs("stock")).toContain("/admin/inventory");
    expect(hrefs("private label")).toEqual(["/admin/brand-orders"]);
    expect(hrefs("HOME page hero")).toEqual(["/admin/content/hero"]);
    expect(hrefs("zzz")).toEqual([]);
  });

  it("only opens typed admin addresses", () => {
    expect(consoleAddress(" /admin/orders/abc-123 ")).toBe(
      "/admin/orders/abc-123",
    );
    expect(consoleAddress("/admin")).toBe("/admin");
    expect(consoleAddress("/account")).toBeNull();
    expect(consoleAddress("/administrator")).toBeNull();
    expect(consoleAddress("/admin/../account")).toBeNull();
    expect(consoleAddress("https://example.com/admin")).toBeNull();
    expect(consoleAddress("orders")).toBeNull();
  });

  it("marks the current page, including database tables", () => {
    expect(isCurrentLink("/admin", "/admin")).toBe(true);
    expect(isCurrentLink("/admin/orders", "/admin")).toBe(false);
    expect(isCurrentLink("/admin/orders/1", "/admin/orders")).toBe(true);
    expect(isCurrentLink("/admin/tables/User", "/admin/database")).toBe(true);
  });
});
