import "server-only";
import type { OrderStatus } from "@/generated/prisma/client";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { db } from "@/server/db";

// The signed-in buyer's order history (/orders, docs/CHUNKS.md P1.5). Only
// their own orders, newest first.

export const ORDERS_PAGE_SIZE = 10;

export type OrderListItem = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalPaise: number;
  itemCount: number;
  /** Up to three product names, for a quick look. */
  names: string[];
  shipmentStatus: ShipmentStatusKey | null;
};

export async function listOrdersForUser(
  userId: string,
  requestedPage = 1,
): Promise<{ orders: OrderListItem[]; page: number; pageCount: number; total: number }> {
  const total = await db.order.count({ where: { userId } });
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const rows = await db.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalPaise: true,
      items: { orderBy: { id: "asc" }, select: { productName: true } },
      shipment: { select: { status: true } },
    },
  });
  return {
    orders: rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      createdAt: row.createdAt,
      totalPaise: row.totalPaise,
      itemCount: row.items.length,
      names: row.items.slice(0, 3).map((item) => item.productName),
      shipmentStatus: row.shipment?.status ?? null,
    })),
    page,
    pageCount,
    total,
  };
}
