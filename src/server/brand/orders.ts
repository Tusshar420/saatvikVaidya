import "server-only";
import type { OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { isOrderId } from "@/lib/orders";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { findAddress } from "@/server/checkout/addresses";
import { newOrderId, newOrderNumber, startPaymentAttempt } from "@/server/checkout/orders";
import { gstIncluded, type ShippingRule } from "@/server/checkout/totals";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments";
import { brandCartTotals, readBrandCart } from "./cart";
import { packagingSchema } from "./packaging";

// Launch Your Brand orders (docs/CHUNKS.md, P2.1). A brand order is an
// Order of type "brand" with one line per product of the user's Launch cart
// (./cart.ts) and a BrandOrderDetails row for the logo and label text (one
// brand for the whole order, from the draft). It is priced again here from
// the database, with each line's bulk tier (the browser sends only the
// address, a checkout key and the total it showed), and paid through the
// same PaymentProvider as the store (./checkout/payments.ts completes it).
//
// Brand orders are made to order: they don't use the store's stock or
// cart, and they don't earn or use Super Coins (store orders only, until
// the client decides otherwise). The store's delivery charge rule applies.

/** The price tier recorded on a brand order line. */
export const BRAND_PRICE_TIER = "brand";

export type PlaceBrandOrderInput = {
  userId: string;
  addressId: number;
  /** Random key from the review page: a second submit returns the same order. */
  checkoutKey: string;
  /** The total the review page showed; a different total means something changed. */
  expectedTotalPaise: number;
  shipping: ShippingRule;
};

export type PlaceBrandOrderError =
  | "address"
  | "draft"
  | "changed"
  | "payments_off"
  | "rate_limited";

export type PlaceBrandOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: PlaceBrandOrderError };

class Refused extends Error {
  constructor(readonly reason: PlaceBrandOrderError) {
    super(reason);
  }
}

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

async function orderForKey(userId: string, checkoutKey: string) {
  return db.order.findUnique({
    where: { userId_checkoutKey: { userId, checkoutKey } },
    select: { id: true },
  });
}

/**
 * Turns the user's Launch cart and draft into one brand order waiting for
 * payment and starts the first payment attempt. Everything is checked again:
 * every product is still open for branding, every quantity is a positive
 * multiple of its minimum, the cart is within the limits, and the packaging
 * is valid and has a logo. The cart and draft are removed in the same
 * transaction (the logo now belongs to the order).
 */
export async function placeBrandOrder(input: PlaceBrandOrderInput): Promise<PlaceBrandOrderResult> {
  const { userId, checkoutKey } = input;
  const existing = await orderForKey(userId, checkoutKey);
  if (existing) return { ok: true, orderId: existing.id };

  if (!getPaymentProvider().isAvailable()) return { ok: false, error: "payments_off" };
  const limit = await hitRateLimit(rateLimitRules.orderPlacePerUser, userId);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };
  const address = await findAddress(userId, input.addressId);
  if (!address) return { ok: false, error: "address" };

  let orderId: string | null = null;
  for (let tries = 0; tries < 3 && !orderId; tries += 1) {
    try {
      orderId = await db.$transaction(async (tx) => {
        // Locks the draft, so two submits can't both turn it into an order.
        const locked = await tx.$queryRaw<{ userId: string }[]>`
          SELECT userId FROM BrandDraft WHERE userId = ${userId} FOR UPDATE`;
        if (locked.length === 0) throw new Refused("draft");
        const draft = await tx.brandDraft.findUniqueOrThrow({ where: { userId } });
        if (!draft.packagingDone) throw new Refused("draft");
        if (!draft.logoKey || !draft.logoName || !draft.logoContentType || draft.logoSizeBytes === null) {
          throw new Refused("draft");
        }
        const packaging = packagingSchema.safeParse(draft);
        if (!packaging.success) throw new Refused("draft");

        // Locks the cart lines too: a quantity change waits for the order.
        await tx.$queryRaw`SELECT id FROM BrandCartItem WHERE userId = ${userId} FOR UPDATE`;
        const cart = await readBrandCart(userId, tx);
        if (cart.lines.length === 0) throw new Refused("draft");
        if (!cart.ready) throw new Refused("changed");
        const totals = brandCartTotals(cart, input.shipping);
        if (totals.totalPaise !== input.expectedTotalPaise) throw new Refused("changed");

        const snapshots = await tx.product.findMany({
          where: { id: { in: cart.lines.map((line) => line.productId) } },
          select: { id: true, hsnCode: true, mrpPaise: true },
        });
        const snapshotOf = new Map(snapshots.map((row) => [row.id, row]));
        const items = cart.lines.flatMap((line) => {
          const product = line.product;
          const snapshot = snapshotOf.get(line.productId);
          if (!product || !snapshot) return [];
          return [
            {
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              packSize: product.packSize,
              hsnCode: snapshot.hsnCode,
              gstRate: product.gstRate,
              mrpPaise: snapshot.mrpPaise,
              unitPaise: line.unitPricePaise,
              priceTier: BRAND_PRICE_TIER,
              quantity: line.quantity,
              lineTotalPaise: line.lineTotalPaise,
              taxPaise: gstIncluded(line.lineTotalPaise, product.gstRate),
            },
          ];
        });
        if (items.length !== cart.lines.length) throw new Refused("changed");
        const id = newOrderId();
        await tx.order.create({
          data: {
            id,
            number: newOrderNumber(),
            type: "brand",
            userId,
            checkoutKey,
            shipName: address.name,
            shipPhone: address.phone,
            shipLine1: address.line1,
            shipLine2: address.line2,
            shipLandmark: address.landmark,
            shipCity: address.city,
            shipState: address.state,
            shipPincode: address.pincode,
            subtotalPaise: totals.subtotalPaise,
            taxPaise: totals.taxPaise,
            shippingPaise: totals.shippingPaise,
            totalPaise: totals.totalPaise,
            items: { create: items },
            brandDetails: {
              create: {
                ...packaging.data,
                logoKey: draft.logoKey,
                logoName: draft.logoName,
                logoContentType: draft.logoContentType,
                logoSizeBytes: draft.logoSizeBytes,
              },
            },
          },
        });
        await tx.brandCartItem.deleteMany({ where: { userId } });
        await tx.brandDraft.delete({ where: { userId } });
        await tx.address.update({ where: { id: address.id }, data: { lastUsedAt: new Date() } });
        return id;
      });
    } catch (error) {
      if (error instanceof Refused) {
        // A double submit may have placed the order meanwhile.
        const raced = await orderForKey(userId, checkoutKey);
        if (raced) return { ok: true, orderId: raced.id };
        return { ok: false, error: error.reason };
      }
      if (!isUniqueClash(error)) throw error;
      const raced = await orderForKey(userId, checkoutKey);
      if (raced) return { ok: true, orderId: raced.id };
    }
  }
  if (!orderId) throw new Error("placeBrandOrder: could not create a unique order number.");

  await startPaymentAttempt(orderId);
  return { ok: true, orderId };
}

// ─── Reading ────────────────────────────────────────────────────────────────

/** One product of a brand order, as it was ordered. */
export type BrandOrderLine = {
  productSlug: string;
  productName: string;
  packSize: string;
  quantity: number;
  unitLabel: string | null;
  unitPaise: number;
  gstRate: number;
  lineTotalPaise: number;
};

export type BrandOrderSummary = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalPaise: number;
  brandName: string;
  /** Every product of the order, in the order they were added. */
  items: Pick<BrandOrderLine, "productName" | "quantity" | "unitLabel">[];
};

const summarySelect = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  totalPaise: true,
  brandDetails: { select: { brandName: true } },
  items: {
    orderBy: { id: "asc" },
    select: { productName: true, quantity: true, product: { select: { brandUnitLabel: true } } },
  },
} satisfies Prisma.OrderSelect;

type SummaryRow = Prisma.OrderGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): BrandOrderSummary {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    createdAt: row.createdAt,
    totalPaise: row.totalPaise,
    brandName: row.brandDetails?.brandName ?? "",
    items: row.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitLabel: item.product?.brandUnitLabel ?? null,
    })),
  };
}

/** The user's brand orders, newest first. */
export async function listBrandOrdersForUser(userId: string): Promise<BrandOrderSummary[]> {
  const rows = await db.order.findMany({
    where: { userId, type: "brand" },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 100,
    select: summarySelect,
  });
  return rows.map(toSummary);
}

export type BrandOrderView = Omit<BrandOrderSummary, "items"> & {
  paidAt: Date | null;
  subtotalPaise: number;
  taxPaise: number;
  shippingPaise: number;
  items: BrandOrderLine[];
  /** GST by rate, for the order summary. */
  gst: { rate: number; taxablePaise: number; taxPaise: number }[];
  details: {
    brandName: string;
    tagline: string | null;
    marketedByName: string | null;
    marketedByAddress: string | null;
    contactPhone: string | null;
    notes: string | null;
    logoName: string;
    logoContentType: string;
    logoSizeBytes: number;
  } | null;
  address: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  payment: {
    provider: string;
    attempt: number;
    status: PaymentStatus;
    failureReason: string | null;
  } | null;
};

const viewInclude = {
  brandDetails: true,
  items: { orderBy: { id: "asc" }, include: { product: { select: { brandUnitLabel: true } } } },
  payments: { orderBy: { attempt: "desc" }, take: 1 },
} satisfies Prisma.OrderInclude;

type ViewRow = Prisma.OrderGetPayload<{ include: typeof viewInclude }>;

function toView(order: ViewRow): BrandOrderView {
  const details = order.brandDetails;
  const payment = order.payments[0];
  const gst = new Map<number, { rate: number; taxablePaise: number; taxPaise: number }>();
  for (const item of order.items) {
    const group = gst.get(item.gstRate) ?? { rate: item.gstRate, taxablePaise: 0, taxPaise: 0 };
    group.taxablePaise += item.lineTotalPaise - item.taxPaise;
    group.taxPaise += item.taxPaise;
    gst.set(item.gstRate, group);
  }
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    totalPaise: order.totalPaise,
    subtotalPaise: order.subtotalPaise,
    taxPaise: order.taxPaise,
    shippingPaise: order.shippingPaise,
    brandName: details?.brandName ?? "",
    items: order.items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      packSize: item.packSize,
      quantity: item.quantity,
      unitLabel: item.product?.brandUnitLabel ?? null,
      unitPaise: item.unitPaise,
      gstRate: item.gstRate,
      lineTotalPaise: item.lineTotalPaise,
    })),
    gst: [...gst.values()].sort((a, b) => a.rate - b.rate),
    details: details && {
      brandName: details.brandName,
      tagline: details.tagline,
      marketedByName: details.marketedByName,
      marketedByAddress: details.marketedByAddress,
      contactPhone: details.contactPhone,
      notes: details.notes,
      logoName: details.logoName,
      logoContentType: details.logoContentType,
      logoSizeBytes: details.logoSizeBytes,
    },
    address: {
      name: order.shipName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2,
      landmark: order.shipLandmark,
      city: order.shipCity,
      state: order.shipState,
      pincode: order.shipPincode,
    },
    payment: payment
      ? {
          provider: payment.provider,
          attempt: payment.attempt,
          status: payment.status,
          failureReason: payment.failureReason,
        }
      : null,
  };
}

/** One of the user's own brand orders, or null (unknown id, a store order or someone else's). */
export async function readBrandOrderForUser(
  userId: string,
  orderId: string,
): Promise<BrandOrderView | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findFirst({
    where: { id: orderId, userId, type: "brand" },
    include: viewInclude,
  });
  return order ? toView(order) : null;
}

/** Any brand order, for the admin detail page (the caller checks the admin session). */
export async function readBrandOrderForAdmin(orderId: string) {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findFirst({
    where: { id: orderId, type: "brand" },
    include: {
      ...viewInclude,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          verificationStatus: true,
          userType: { select: { label: true, isProfessional: true } },
        },
      },
    },
  });
  if (!order) return null;
  return { ...toView(order), user: order.user };
}

/**
 * A brand order's logo file, if `viewer` may see it: the order's owner, or
 * an admin (`isAdmin`, checked by the caller). Null otherwise.
 */
export async function brandOrderLogoFile(orderId: string, viewer: { userId: string; isAdmin: boolean }) {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findFirst({
    where: { id: orderId, type: "brand", ...(viewer.isAdmin ? {} : { userId: viewer.userId }) },
    select: { brandDetails: { select: { logoKey: true, logoName: true, logoContentType: true } } },
  });
  const details = order?.brandDetails;
  if (!details) return null;
  return { key: details.logoKey, name: details.logoName, contentType: details.logoContentType };
}

