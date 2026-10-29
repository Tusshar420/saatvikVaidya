import "server-only";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { logAdminAction } from "./audit";
import { istDay, rangeWindow, type ReportRange } from "./reports";

// CSV exports of orders and users (admin only, and logged). The route
// handler checks the admin session; `exportCsv` writes the AdminLog row.

export const exportKinds = ["orders", "users"] as const;
export type ExportKind = (typeof exportKinds)[number];

/** The most rows one export contains. */
export const MAX_EXPORT_ROWS = 50_000;

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (starting with
 * = + - @ or a tab or return) gets a leading apostrophe, since names and
 * addresses are typed by users. Numbers are ours, so they are written as is.
 */
export function csvCell(value: string | number | boolean | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  let text = value instanceof Date ? value.toISOString() : value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Parameters<typeof csvCell>[0][])[]): string {
  // The BOM makes Excel read the file as UTF-8 (Hindi names, ₹ signs).
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Paise as rupees with two decimals, e.g. 123456 -> "1234.56". */
export const rupees = (paise: number) => (paise / 100).toFixed(2);

/** "9876543210" for "+919876543210": no leading "+", so it isn't escaped. */
const nationalNumber = (phone: string | null) => (phone ? phone.replace(/^\+91/, "") : null);

const ordersHeader = [
  "Order number",
  "Placed at",
  "Paid at",
  "Status",
  "Customer",
  "Mobile",
  "City",
  "State",
  "PIN code",
  "Items",
  "Items total (INR, incl. GST)",
  "GST included (INR)",
  "Delivery (INR)",
  "Coin discount (INR)",
  "Total (INR)",
] as const;

export async function ordersCsv(range?: ReportRange): Promise<{ csv: string; rows: number }> {
  const orders = await db.order.findMany({
    where: range ? { createdAt: rangeWindow(range) } : undefined,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_EXPORT_ROWS,
    select: {
      number: true,
      createdAt: true,
      paidAt: true,
      status: true,
      shipName: true,
      shipPhone: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      subtotalPaise: true,
      taxPaise: true,
      shippingPaise: true,
      coinDiscountPaise: true,
      totalPaise: true,
      _count: { select: { items: true } },
    },
  });
  const rows = orders.map((order) => [
    order.number,
    order.createdAt,
    order.paidAt,
    order.status,
    order.shipName,
    nationalNumber(order.shipPhone),
    order.shipCity,
    order.shipState,
    order.shipPincode,
    order._count.items,
    rupees(order.subtotalPaise),
    rupees(order.taxPaise),
    rupees(order.shippingPaise),
    rupees(order.coinDiscountPaise),
    rupees(order.totalPaise),
  ]);
  return { csv: toCsv(ordersHeader, rows), rows: rows.length };
}

const usersHeader = [
  "Name",
  "Email",
  "Email verified",
  "Mobile",
  "User type",
  "Role",
  "Verification status",
  "Joined at",
] as const;

export async function usersCsv(range?: ReportRange): Promise<{ csv: string; rows: number }> {
  const users = await db.user.findMany({
    where: range ? { createdAt: rangeWindow(range) } : undefined,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_EXPORT_ROWS,
    select: {
      name: true,
      email: true,
      emailVerified: true,
      phoneNumber: true,
      role: true,
      verificationStatus: true,
      createdAt: true,
      userType: { select: { label: true } },
    },
  });
  const rows = users.map((user) => {
    const hasEmail = !isPlaceholderEmail(user.email);
    return [
      user.name,
      hasEmail ? user.email : null,
      hasEmail ? user.emailVerified : null,
      nationalNumber(user.phoneNumber),
      user.userType.label,
      user.role,
      user.verificationStatus,
      user.createdAt,
    ];
  });
  return { csv: toCsv(usersHeader, rows), rows: rows.length };
}

/**
 * Builds the CSV and records the export in the admin log, in one go: nothing
 * is returned if the log row can't be written. The caller has checked that
 * `actorId` is an admin.
 */
export async function exportCsv(
  actorId: string,
  kind: ExportKind,
  range?: ReportRange,
): Promise<{ csv: string; fileName: string }> {
  const { csv, rows } = kind === "orders" ? await ordersCsv(range) : await usersCsv(range);
  await db.$transaction((tx) =>
    logAdminAction(tx, {
      actorId,
      action: kind === "orders" ? "export.orders" : "export.users",
      resource: "Export",
      resourceId: kind,
      note: `${rows} rows${range ? `, ${range.from} to ${range.to}` : ""}`,
    }),
  );
  const stamp = range ? `${range.from}_to_${range.to}` : istDay(new Date());
  return { csv, fileName: `saatvik-vaidya-${kind}-${stamp}.csv` };
}
