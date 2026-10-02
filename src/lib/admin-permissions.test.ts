import { describe, expect, it } from "vitest";
import {
  adminAreas,
  adminRoles,
  areasOf,
  roleCanAccess,
  type AdminArea,
  type AdminRoleKey,
} from "./admin-permissions";

const expected: Record<AdminRoleKey, AdminArea[]> = {
  super: [...adminAreas],
  catalogue: ["dashboard", "catalogue"],
  orders: ["dashboard", "orders", "reports"],
  content: ["dashboard", "content"],
  approvals: ["dashboard", "approvals"],
};

describe("admin roles", () => {
  it.each(adminRoles)("%s may use exactly its own areas", (role) => {
    for (const area of adminAreas) {
      expect(roleCanAccess(role, area), `${role} → ${area}`).toBe(
        expected[role].includes(area),
      );
    }
  });

  it("only a super admin reaches admins, users, settings and the database", () => {
    for (const area of ["admins", "users", "settings", "database"] as const) {
      expect(adminRoles.filter((role) => roleCanAccess(role, area))).toEqual(["super"]);
    }
  });

  it("no role (or an unknown one) gets nothing", () => {
    for (const area of adminAreas) {
      expect(roleCanAccess(null, area)).toBe(false);
      expect(roleCanAccess(undefined, area)).toBe(false);
      expect(roleCanAccess("owner", area)).toBe(false);
    }
    expect(areasOf(null)).toEqual([]);
  });
});
