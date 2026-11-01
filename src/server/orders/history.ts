import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { productImageSrc } from "@/lib/catalogue";
import { orderRangeBounds, type OrderRange } from "@/lib/order-ranges";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { db } from "@/server/db";
import { sellableByProduct } from "@/server/inventory/availability";

// The signed-in buyer's order history (/orders, docs/CHUNKS.md P1.5). Only
// their own orders, newest first, optionally within a period ("This year").
// Also the "Buy again" row: products from their past orders.

export const ORDERS_PAGE_SIZE = 10;
export const BUY_AGAIN_LIMIT = 10;

/** Orders whose products the buyer really got (or will): shown in "Buy again". */
const BOUGHT_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

const firstImage = {
  orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  take: 1,
  select: { id: true, alt: true },
};

type ImageView = { src: string; alt: string };

export type OrderListItem = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalPaise: number;
  itemCount: number;
  /** Up to three product names, for a quick look. */
  names: string[];
  /** The first product's photo, if it has one. */
  image: ImageView | null;
  /** The first product's form mark, shown when there's no photo. */
  glyph: string | null;
  shipmentStatus: ShipmentStatusKey | null;
};

export async function listOrdersForUser(
  userId: string,
  requestedPage = 1,
  range: OrderRange = "all",
): Promise<{ orders: OrderListItem[]; page: number; pageCount: number; total: number }> {
  const { from, to } = orderRangeBounds(range);
  // Store orders only: brand orders (P2.1) are listed on /my-brand.
  const where: Prisma.OrderWhereInput = {
    userId,
    type: "store",
    ...(from || to ? { createdAt: { gte: from, lt: to } } : {}),
  };
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalPaise: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          productName: true,
          product: { select: { images: firstImage, form: { select: { glyph: true } } } },
        },
      },
      shipment: { select: { status: true } },
    },
  });
  return {
    orders: rows.map((row) => {
      const product = row.items.find((item) => item.product)?.product ?? null;
      const image = product?.images[0];
      return {
        id: row.id,
        number: row.number,
        status: row.status,
        createdAt: row.createdAt,
        totalPaise: row.totalPaise,
        itemCount: row.items.length,
        names: row.items.slice(0, 3).map((item) => item.productName),
        image: image ? { src: productImageSrc(image.id), alt: image.alt } : null,
        glyph: product?.form.glyph ?? null,
        shipmentStatus: row.shipment?.status ?? null,
      };
    }),
    page,
    pageCount,
    total,
  };
}

export type BuyAgainItem = {
  productId: number;
  slug: string;
  name: string;
  packSize: string;
  /** Minimum order: what "Add to cart" adds. */
  moq: number;
  image: ImageView | null;
  glyph: string | null;
  outOfStock: boolean;
};

/**
 * Products from the buyer's paid store orders, most recently bought first,
 * each once. Products taken off sale are left out.
 */
export async function listBuyAgainForUser(userId: string, limit = BUY_AGAIN_LIMIT): Promise<BuyAgainItem[]> {
  const lines = await db.orderItem.findMany({
    where: {
      kind: "product",
      order: { userId, type: "store", status: { in: BOUGHT_STATUSES } },
      product: { active: true },
    },
    orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
    // Enough lines to find `limit` different products in most histories.
    take: limit * 5,
    select: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          packSize: true,
          moq: true,
          images: firstImage,
          form: { select: { glyph: true } },
        },
      },
    },
  });
  const products = new Map<number, NonNullable<(typeof lines)[number]["product"]>>();
  for (const { product } of lines) {
    if (product && !products.has(product.id)) products.set(product.id, product);
    if (products.size === limit) break;
  }
  const stock = await sellableByProduct([...products.keys()]);
  return [...products.values()].map((product) => {
    const moq = Math.max(1, product.moq);
    const image = product.images[0];
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      packSize: product.packSize,
      moq,
      image: image ? { src: productImageSrc(image.id), alt: image.alt } : null,
      glyph: product.form.glyph,
      outOfStock: (stock.get(product.id) ?? 0) < moq,
    };
  });
}
