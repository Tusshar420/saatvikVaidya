import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { ADMIN_ORDERS_PAGE_SIZE, filtersWhere, type OrderFilters } from "./orders";

// Build Your Brand orders in the admin panel (/admin/brand-orders, P2.1):
// the same filters as /admin/orders, over brand orders only, and the search
// also matches the brand name. Callers check the admin session ("orders").

export type AdminBrandOrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalPaise: number;
  brandName: string;
  productName: string;
  quantity: number;
  unitLabel: string | null;
  /** Products after the first one (a brand order can hold several). */
  moreProducts: number;
  customerName: string;
  customerContact: string | null;
};

export async function listAdminBrandOrders(filters: OrderFilters): Promise<{
  orders: AdminBrandOrderRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const base = filtersWhere({ ...filters, q: undefined }, "brand");
  const where: Prisma.OrderWhereInput = filters.q
    ? {
        AND: [
          base,
          {
            OR: [
              ...(filtersWhere({ q: filters.q }, "brand").OR ?? []),
              { brandDetails: { is: { brandName: { contains: filters.q } } } },
            ],
          },
        ],
      }
    : base;
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pageCount);
  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
    take: ADMIN_ORDERS_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalPaise: true,
      shipName: true,
      shipPhone: true,
      user: { select: { name: true } },
      brandDetails: { select: { brandName: true } },
      items: {
        take: 1,
        orderBy: { id: "asc" },
        select: { productName: true, quantity: true, product: { select: { brandUnitLabel: true } } },
      },
      _count: { select: { items: true } },
    },
  });
  return {
    orders: rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      createdAt: row.createdAt,
      totalPaise: row.totalPaise,
      brandName: row.brandDetails?.brandName ?? "",
      productName: row.items[0]?.productName ?? "",
      quantity: row.items[0]?.quantity ?? 0,
      unitLabel: row.items[0]?.product?.brandUnitLabel ?? null,
      moreProducts: Math.max(0, row._count.items - 1),
      customerName: row.user?.name ?? row.shipName,
      customerContact: row.shipPhone,
    })),
    total,
    page,
    pageCount,
  };
}
