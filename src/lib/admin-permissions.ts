// Which admin may do what (P1.11). Pure data and one check, so the server
// gates, the admin menu and the tests all use the same table. No
// "server-only" import: it is also used by client components.

export const adminRoles = [
  "super",
  "catalogue",
  "orders",
  "content",
  "approvals",
] as const;
export type AdminRoleKey = (typeof adminRoles)[number];

/**
 * The parts of the admin panel, each checked on the server:
 * - dashboard: the /admin landing page (every admin).
 * - approvals: professional verification decisions and their documents.
 * - catalogue: products, product photos and ebooks.
 * - orders: orders, shipments, invoices and Super Coins.
 * - content: the homepage content and the quiz.
 * - reports: reports and CSV exports.
 * - settings: site settings and maintenance mode.
 * - users: customer accounts (create, edit, delete).
 * - admins: admin accounts, roles and invites.
 * - database: the read-only database browser.
 * - errors: the error log (Phase 4).
 */
export const adminAreas = [
  "dashboard",
  "approvals",
  "catalogue",
  "orders",
  "content",
  "reports",
  "settings",
  "users",
  "admins",
  "database",
  "errors",
] as const;
export type AdminArea = (typeof adminAreas)[number];

const roleAreas: Record<AdminRoleKey, readonly AdminArea[]> = {
  super: adminAreas,
  catalogue: ["dashboard", "catalogue"],
  orders: ["dashboard", "orders", "reports"],
  content: ["dashboard", "content"],
  approvals: ["dashboard", "approvals"],
};

export function isAdminRole(value: unknown): value is AdminRoleKey {
  return typeof value === "string" && (adminRoles as readonly string[]).includes(value);
}

/** True if an admin with this role may use `area`. A missing role gets nothing. */
export function roleCanAccess(
  role: string | null | undefined,
  area: AdminArea,
): boolean {
  return isAdminRole(role) && roleAreas[role].includes(area);
}

export function areasOf(role: string | null | undefined): readonly AdminArea[] {
  return isAdminRole(role) ? roleAreas[role] : [];
}
