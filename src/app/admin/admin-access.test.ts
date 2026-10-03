import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminAreas, adminRoles, roleCanAccess, type AdminArea } from "@/lib/admin-permissions";
import { db } from "@/server/db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";

// Every admin entry point checks its own area on the server (the menu only
// hides links). Part 1 scans the source so a new page, action or route can't
// forget the check; part 2 runs the real check for each role.

const root = join(process.cwd(), "src/app");

function files(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, found);
    else found.push(path);
  }
  return found;
}

const rel = (path: string) => relative(root, path);

/** The area each part of the admin panel must require. */
function expectedArea(path: string): AdminArea {
  const p = rel(path);
  if (p.startsWith("admin/approvals/")) return "approvals";
  if (p.startsWith("admin/catalogue/") || p.startsWith("admin/ebooks/")) return "catalogue";
  if (
    p.startsWith("admin/orders/") ||
    p.startsWith("admin/coins/") ||
    p.startsWith("admin/brand-orders/")
  ) {
    return "orders";
  }
  if (p.startsWith("admin/content/")) return "content";
  if (p.startsWith("admin/reports/")) return "reports";
  if (p.startsWith("admin/settings/")) return "settings";
  if (p.startsWith("admin/users/")) return "users";
  if (p.startsWith("admin/admins/")) return "admins";
  if (p.startsWith("admin/errors/")) return "errors";
  if (p.startsWith("admin/inventory/")) return "inventory";
  if (p.startsWith("admin/database/") || p.startsWith("admin/tables/")) return "database";
  return "dashboard";
}

const admin = files(join(root, "admin"));
const pages = admin.filter((path) => path.endsWith("/page.tsx") && !path.endsWith("admin/layout.tsx"));
const actionFiles = admin.filter((path) => /actions\.ts$/.test(path));
const routes = [
  ...files(join(root, "api/admin")).filter((path) => path.endsWith("/route.ts")),
  ...admin.filter((path) => path.endsWith("/route.ts")),
];

describe("every admin page, action and route checks its area", () => {
  it("finds them", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(actionFiles.length).toBeGreaterThan(5);
    expect(routes.length).toBeGreaterThan(3);
  });

  it.each(pages.map((path) => [rel(path), path]))("page %s", (_name, path) => {
    const source = readFileSync(path!, "utf8");
    expect(source).toContain(`requireAdmin("${expectedArea(path!)}"`);
  });

  it("every exported action calls requireAdmin first (itself or in the helper it returns)", () => {
    const checksFirst = (body: string) => {
      const call = body.indexOf("requireAdmin(");
      // Nothing else (a database read, a Zod parse) runs before it.
      return call >= 0 && /^\s*(const \{[^}]*\} = )?(await )?$/.test(body.slice(0, call).replace(/\/\/.*$/gm, ""));
    };
    for (const path of actionFiles) {
      const source = readFileSync(path, "utf8");
      const parts = source.split(/^export async function /m).slice(1);
      expect(parts.length, rel(path)).toBeGreaterThan(0);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("("));
        const body = part.slice(part.indexOf("{") + 1);
        if (checksFirst(body)) continue;
        // A one-line wrapper: `return helper(...)`, where helper checks first.
        const helper = /return (\w+)\(/.exec(body)?.[1];
        const helperSource = helper
          ? source.split(new RegExp(`^(?:export )?async function ${helper}\\(`, "m"))[1]
          : undefined;
        const helperBody = helperSource?.slice(helperSource.indexOf("{") + 1);
        expect(helperBody !== undefined && checksFirst(helperBody), `${rel(path)}: ${name}`).toBe(true);
      }
    }
  });

  it.each(actionFiles.map((path) => [rel(path), path]))(
    "actions in %s ask for the right area",
    (_name, path) => {
      const source = readFileSync(path!, "utf8");
      const areas = [...source.matchAll(/requireAdmin\(\s*(?:\n\s*)?(?:[^"()]*\?\s*)?"(\w+)"/g)].map(
        (match) => match[1],
      );
      expect(areas.length).toBeGreaterThan(0);
      const allowed = new Set<string>([expectedArea(path!)]);
      // The user actions file also holds the approvals decisions.
      if (rel(path!).startsWith("admin/users/")) allowed.add("approvals");
      for (const area of areas) expect(allowed, `${rel(path!)} → ${area}`).toContain(area);
    },
  );

  it.each(routes.map((path) => [rel(path), path]))("route %s", (_name, path) => {
    const source = readFileSync(path!, "utf8");
    expect(source).toMatch(/getAdminSession\(/);
    expect(source).not.toMatch(/role !== "admin"/);
  });

  it("no code compares the role to \"admin\" for access any more", () => {
    const offenders = files(root)
      .filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path))
      .filter((path) => /user\.role !== "admin"|user\?\.role !== "admin"/.test(readFileSync(path, "utf8")))
      .map(rel);
    // The maintenance banner, checkout and Launch Your Brand (any signed-in
    // admin may order), and the two-factor setup (any admin, before they
    // have admin access).
    expect(offenders.sort()).toEqual([
      "(site)/account/two-factor/actions.ts",
      "(site)/account/two-factor/page.tsx",
      "(site)/checkout/actions.ts",
      "(site)/launch/actions.ts",
      "(site)/layout.tsx",
    ]);
  });
});

// ─── The real check, role by role ───────────────────────────────────────────

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.cookie ? { cookie: request.cookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (read: () => Promise<unknown>) => read,
}));

const { callAuth } = await import("../../../tests/setup/auth");
const { hashPassword } = await import("better-auth/crypto");
const { requireAdmin } = await import("@/server/auth/session");

const password = "A-long-admin-passphrase-1";

/** An admin with the role, signed in (two-factor marked on after sign-in). */
async function signInAdmin(adminRole: (typeof adminRoles)[number] | null, twoFactor = true) {
  const types = await userTypeIds(db);
  const id = `admin-${adminRole ?? "none"}-${twoFactor}`;
  await db.user.create({
    data: {
      id,
      name: "Role Admin",
      email: `${id}@example.test`,
      emailVerified: true,
      role: "admin",
      adminRole,
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
      accounts: {
        create: { id: `${id}-acc`, accountId: id, providerId: "credential", password: await hashPassword(password) },
      },
    },
  });
  const signIn = await callAuth("/sign-in/email", { email: `${id}@example.test`, password });
  request.cookie = signIn.sessionCookie!;
  // The session is read from the database each time, so turning two-factor
  // on afterwards stands in for a session that passed the second step.
  if (twoFactor) await db.user.update({ where: { id }, data: { twoFactorEnabled: true } });
  return id;
}

beforeEach(async () => {
  await resetAuthData(db);
  request.cookie = "";
});
afterAll(() => db.$disconnect());

describe("requireAdmin(area) for each role", () => {
  it.each(adminRoles)("%s is refused outside its areas", async (role) => {
    await signInAdmin(role);
    for (const area of adminAreas) {
      if (roleCanAccess(role, area)) {
        expect((await requireAdmin(area)).user.role).toBe("admin");
      } else {
        await expect(requireAdmin(area), `${role} → ${area}`).rejects.toThrow("notFound");
      }
    }
  });

  it("an admin with no role set (or a customer made admin by hand) gets nothing", async () => {
    await signInAdmin(null);
    for (const area of adminAreas) {
      await expect(requireAdmin(area)).rejects.toThrow("notFound");
    }
  });

  it("an admin without two-factor is redirected, whatever the role", async () => {
    await signInAdmin("super", false);
    await expect(requireAdmin("users")).rejects.toThrow("redirect:/account/two-factor");
  });
});

describe("real actions with a restricted role", () => {
  it("a catalogue admin can't use the users, content, orders or settings actions", async () => {
    await signInAdmin("catalogue");
    const users = await import("./users/actions");
    const content = await import("./content/actions");
    const orders = await import("./orders/actions");
    const settings = await import("./settings/actions");
    const idle = { status: "idle" } as const;
    const form = new FormData();
    const before = await db.adminLog.count();
    await expect(users.createUserAction(idle, form)).rejects.toThrow("notFound");
    await expect(users.deleteUserAction(form)).rejects.toThrow("notFound");
    await expect(content.createReelAction(idle, form)).rejects.toThrow("notFound");
    await expect(orders.cancelOrderAction(idle, form)).rejects.toThrow("notFound");
    await expect(settings.saveSwitchesAction(idle, form)).rejects.toThrow("notFound");
    expect(await db.adminLog.count()).toBe(before);
  });

  it("an approvals admin may decide verification but not delete users", async () => {
    await signInAdmin("approvals");
    const users = await import("./users/actions");
    const form = new FormData();
    form.set("operation", "delete");
    form.append("ids", "someone");
    await expect(users.bulkUsersAction({ status: "idle" }, form)).rejects.toThrow("notFound");
    form.set("operation", "approve");
    await expect(users.bulkUsersAction({ status: "idle" }, form)).resolves.toMatchObject({ status: "success" });
  });
});
