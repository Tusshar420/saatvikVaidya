import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/client";
import { ORDER_NUMBER_ALPHABET, isOrderId } from "@/lib/orders";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { cartProductSelect, priceLine } from "@/server/cart/cart";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments";
import type { PricingViewer } from "@/server/pricing/rules";
import { findAddress } from "./addresses";
import { computeTotals, gstIncluded, type ShippingRule } from "./totals";

// Placing an order and starting payment attempts (docs/CHUNKS.md, P1.4).
// Everything is priced again here from the database with priceFor(); the
// browser sends only the address, a checkout key and the total it showed
// (used only to notice that something changed, never as a price).
// Completing a payment is in ./payments.ts.

/** 16 random bytes, base64url: 22 characters (see orderIdPattern). */
export function newOrderId(): string {
  return randomBytes(16).toString("base64url");
}

/** "SV-" and 8 random Crockford base32 characters. */
export function newOrderNumber(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += ORDER_NUMBER_ALPHABET[byte % 32];
  return `SV-${code}`;
}

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export type PlaceOrderInput = {
  userId: string;
  viewer: PricingViewer;
  addressId: number;
  /** Random key from the checkout page: a second submit returns the same order. */
  checkoutKey: string;
  /** The total the checkout page showed; a different total means something changed. */
  expectedTotalPaise: number;
  shipping: ShippingRule;
};

export type PlaceOrderError =
  | "address"
  | "empty"
  | "cart_changed"
  | "payments_off"
  | "rate_limited";

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: PlaceOrderError };

class CheckoutRefused extends Error {
  constructor(readonly reason: PlaceOrderError) {
    super(reason);
  }
}

async function orderForKey(userId: string, checkoutKey: string) {
  return db.order.findUnique({
    where: { userId_checkoutKey: { userId, checkoutKey } },
    select: { id: true },
  });
}

/**
 * Turns the user's cart into an order waiting for payment and starts the
 * first payment attempt. The cart and stock don't change until the payment
 * succeeds.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { userId, viewer, checkoutKey } = input;
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
        const cart = await tx.cart.findUnique({
          where: { userId },
          select: {
            items: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { quantity: true, product: { select: cartProductSelect } },
            },
          },
        });
        const items = cart?.items ?? [];
        if (items.length === 0) throw new CheckoutRefused("empty");
        const lines = items.map((item) => ({
          line: priceLine(item.product, item.quantity, viewer),
          product: item.product,
        }));
        if (lines.some(({ line }) => line.issue !== null)) {
          throw new CheckoutRefused("cart_changed");
        }
        const totals = computeTotals(
          lines.map(({ line }) => line),
          input.shipping,
        );
        if (totals.totalPaise !== input.expectedTotalPaise) {
          throw new CheckoutRefused("cart_changed");
        }

        const id = newOrderId();
        await tx.order.create({
          data: {
            id,
            number: newOrderNumber(),
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
            items: {
              create: lines.map(({ line, product }) => ({
                productId: product.id,
                productSlug: product.slug,
                productName: product.name,
                packSize: product.packSize,
                hsnCode: product.hsnCode,
                gstRate: product.gstRate,
                mrpPaise: line.mrpPaise,
                unitPaise: line.unitPaise,
                priceTier: line.tier,
                quantity: line.quantity,
                lineTotalPaise: line.lineTotalPaise,
                taxPaise: gstIncluded(line.lineTotalPaise, product.gstRate),
              })),
            },
          },
        });
        await tx.address.update({
          where: { id: address.id },
          data: { lastUsedAt: new Date() },
        });
        return id;
      });
    } catch (error) {
      if (error instanceof CheckoutRefused) return { ok: false, error: error.reason };
      if (!isUniqueClash(error)) throw error;
      // The same checkout key placed an order meanwhile (a double submit):
      // that's the order. Otherwise the random order number clashed: retry.
      const raced = await orderForKey(userId, checkoutKey);
      if (raced) return { ok: true, orderId: raced.id };
    }
  }
  if (!orderId) throw new Error("placeOrder: could not create a unique order number.");

  await startPaymentAttempt(orderId);
  return { ok: true, orderId };
}

export type LivePayment = { id: number; reference: string; attempt: number };

/**
 * The order's open payment attempt, creating the next one through the
 * provider if there's none. Null unless the order is waiting for payment.
 */
export async function startPaymentAttempt(orderId: string): Promise<LivePayment | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      totalPaise: true,
      payments: {
        orderBy: { attempt: "desc" },
        select: { id: true, reference: true, attempt: true, status: true },
      },
    },
  });
  if (!order || order.status !== "pending_payment") return null;
  const open = order.payments.find((payment) => payment.status === "created");
  if (open) return { id: open.id, reference: open.reference, attempt: open.attempt };

  const attempt = (order.payments[0]?.attempt ?? 0) + 1;
  const provider = getPaymentProvider();
  const { reference } = await provider.createPayment({
    orderId: order.id,
    orderNumber: order.number,
    amountPaise: order.totalPaise,
    attempt,
  });
  try {
    const created = await db.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        reference,
        amountPaise: order.totalPaise,
        attempt,
      },
      select: { id: true, reference: true, attempt: true },
    });
    return created;
  } catch (error) {
    // Another request started this attempt at the same moment.
    if (!isUniqueClash(error)) throw error;
    return db.payment.findFirst({
      where: { orderId: order.id, status: "created" },
      select: { id: true, reference: true, attempt: true },
    });
  }
}

/**
 * "Try again" after a failed payment: the same order goes back to waiting
 * for payment with a new attempt. Only the order's owner can do this.
 */
export async function retryPayment(userId: string, orderId: string): Promise<LivePayment | null> {
  if (!isOrderId(orderId)) return null;
  if (!getPaymentProvider().isAvailable()) return null;
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    select: { status: true },
  });
  if (!order) return null;
  if (order.status === "payment_failed") {
    await db.order.updateMany({
      where: { id: orderId, userId, status: "payment_failed" },
      data: { status: "pending_payment" },
    });
  }
  return startPaymentAttempt(orderId);
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type OrderView = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  subtotalPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  gst: { rate: number; taxablePaise: number; taxPaise: number }[];
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
  items: {
    productSlug: string;
    productName: string;
    packSize: string;
    quantity: number;
    unitPaise: number;
    lineTotalPaise: number;
    gstRate: number;
  }[];
  /** The latest attempt, if any. */
  payment: {
    reference: string;
    provider: string;
    attempt: number;
    status: PaymentStatus;
    failureReason: string | null;
  } | null;
};

/** One of the user's own orders, or null (unknown id or someone else's). */
export async function readOrderForUser(userId: string, orderId: string): Promise<OrderView | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { attempt: "desc" }, take: 1 },
    },
  });
  if (!order) return null;

  const gst = new Map<number, { rate: number; taxablePaise: number; taxPaise: number }>();
  for (const item of order.items) {
    const group = gst.get(item.gstRate) ?? { rate: item.gstRate, taxablePaise: 0, taxPaise: 0 };
    group.taxablePaise += item.lineTotalPaise - item.taxPaise;
    group.taxPaise += item.taxPaise;
    gst.set(item.gstRate, group);
  }
  const payment = order.payments[0];
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    subtotalPaise: order.subtotalPaise,
    taxPaise: order.taxPaise,
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
    gst: [...gst.values()].sort((a, b) => a.rate - b.rate),
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
    items: order.items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      packSize: item.packSize,
      quantity: item.quantity,
      unitPaise: item.unitPaise,
      lineTotalPaise: item.lineTotalPaise,
      gstRate: item.gstRate,
    })),
    payment: payment
      ? {
          reference: payment.reference,
          provider: payment.provider,
          attempt: payment.attempt,
          status: payment.status,
          failureReason: payment.failureReason,
        }
      : null,
  };
}
