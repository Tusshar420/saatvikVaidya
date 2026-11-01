import "server-only";
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import {
  ASSISTED_CODE_MINUTES,
  ASSISTED_CODE_TRIES,
  ASSISTED_LINK_DAYS,
  ASSISTED_MAX_LINES,
  assistedStatusOf,
  isAssistedOrderId,
  type AssistedStatus,
} from "@/lib/assisted-orders";
import { formatPaise } from "@/lib/format";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";
import { logAdminAction } from "@/server/admin/audit";
import { rateLimitRules } from "@/server/auth/policy";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { cartProductSelect, priceLine, totalsFor, type CartLine } from "@/server/cart/cart";
import { listAddresses, type SavedAddress } from "@/server/checkout/addresses";
import { placeOrder, type PlaceOrderError } from "@/server/checkout/orders";
import type { OrderTotals, ShippingRule } from "@/server/checkout/totals";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import { sellableByProduct, sweepLapsedHolds } from "@/server/inventory/availability";
import {
  canReach,
  sendPreparedOrderCode,
  sendPreparedOrderLink,
  type Customer,
  type Sent,
} from "@/server/notify/assisted-orders";
import { pricingViewerForUserId, type PricingViewer } from "@/server/pricing";

// Orders our staff prepare for customers who call or message us. Staff pick
// the customer and the medicines; the customer then either
// - opens the link (sent by SMS and email, and shown on their account),
//   chooses the address and places it like a normal checkout, or
// - confirms it on the call: staff send them a 6-digit code, the customer
//   reads it back, and staff place it for them.
// Either way placeOrder() prices it for the customer and turns it into a
// normal order waiting for payment; nothing is charged before that.

/** 18 random bytes, base64url: 24 characters (see assistedOrderIdPattern). */
export function newAssistedOrderId(): string {
  return randomBytes(18).toString("base64url");
}

/** SHA-256 of the order id and the code, as stored. */
export function codeHashOf(id: string, code: string): string {
  return createHash("sha256").update(`${id}:${code}`).digest("hex");
}

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  userType: { select: { label: true } },
} satisfies Prisma.UserSelect;

export type CustomerMatch = {
  id: string;
  name: string;
  /** Null for phone-only accounts (their stored email is a placeholder). */
  email: string | null;
  phoneNumber: string | null;
  typeLabel: string;
};

function toMatch(user: Prisma.UserGetPayload<{ select: typeof customerSelect }>): CustomerMatch {
  return {
    id: user.id,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    phoneNumber: user.phoneNumber,
    typeLabel: user.userType.label,
  };
}

// ─── Finding the customer and the medicines ────────────────────────────────

/** Customers (not staff) whose name, email or mobile matches. Up to 10. */
export async function findCustomers(query: string): Promise<CustomerMatch[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 3) return [];
  const digits = q.replace(/\D/g, "");
  // "+91 98765 43210" and "098765..." both match the stored "+919876543210".
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  const users = await db.user.findMany({
    where: {
      role: "user",
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        ...(national.length >= 3 ? [{ phoneNumber: { contains: national } }] : []),
      ],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 10,
    select: customerSelect,
  });
  return users.map(toMatch);
}

/** One customer for the "prepare an order" form; null for staff or unknown ids. */
export async function readCustomer(userId: string): Promise<CustomerMatch | null> {
  if (userId.length === 0 || userId.length > 64) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: customerSelect });
  return user && user.role === "user" ? toMatch(user) : null;
}

export type ProductOption = {
  id: number;
  name: string;
  packSize: string;
  brandName: string | null;
  moq: number;
};

/** Every product on sale, for the medicine picker. */
export async function listOrderableProducts(): Promise<ProductOption[]> {
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 2_000,
    select: { id: true, name: true, packSize: true, moq: true, brand: { select: { name: true } } },
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    packSize: product.packSize,
    brandName: product.brand?.name ?? null,
    moq: Math.max(1, product.moq),
  }));
}

// ─── Preparing ──────────────────────────────────────────────────────────────

export const createAssistedSchema = z.object({
  userId: z.string().min(1).max(64),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive().max(2_147_483_647),
        quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_INPUT),
      }),
    )
    .min(1)
    .max(ASSISTED_MAX_LINES),
});

export type CreateAssistedInput = z.input<typeof createAssistedSchema>;

export type CreateAssistedResult =
  | { ok: true; id: string; sent: Sent }
  | { ok: false; error: "invalid" | "customer" | "admin" | "items" | "too_many" | "product" }
  | { ok: false; error: "quantity"; name: string; min: number };

/**
 * Saves an order prepared for `input.userId` by staff member `staffId` and
 * sends the customer the link (SMS, email and a bell notification).
 */
export async function createAssistedOrder(
  staffId: string,
  input: CreateAssistedInput,
  now: Date = new Date(),
): Promise<CreateAssistedResult> {
  if (Array.isArray(input.items) && input.items.length === 0) return { ok: false, error: "items" };
  if (Array.isArray(input.items) && input.items.length > ASSISTED_MAX_LINES) return { ok: false, error: "too_many" };
  const parsed = createAssistedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { userId, note } = parsed.data;

  const customer = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!customer) return { ok: false, error: "customer" };
  if (customer.role !== "user") return { ok: false, error: "admin" };

  // The same medicine added twice becomes one line.
  const quantities = new Map<number, number>();
  for (const item of parsed.data.items) {
    quantities.set(item.productId, Math.min(MAX_QUANTITY_INPUT, (quantities.get(item.productId) ?? 0) + item.quantity));
  }
  const products = await db.product.findMany({
    where: { id: { in: [...quantities.keys()] }, active: true },
    select: { id: true, name: true, moq: true },
  });
  if (products.length !== quantities.size) return { ok: false, error: "product" };
  for (const product of products) {
    const min = Math.max(1, product.moq);
    if (quantities.get(product.id)! < min) return { ok: false, error: "quantity", name: product.name, min };
  }

  const id = newAssistedOrderId();
  const expiresAt = new Date(now.getTime() + ASSISTED_LINK_DAYS * 86_400_000);
  await db.$transaction(async (tx) => {
    await tx.assistedOrder.create({
      data: {
        id,
        userId,
        createdById: staffId,
        note,
        expiresAt,
        items: {
          create: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
        },
      },
    });
    await logAdminAction(tx, {
      actorId: staffId,
      action: "assisted.create",
      resource: "AssistedOrder",
      resourceId: id,
      changes: {
        userId: { from: null, to: userId },
        items: { from: null, to: quantities.size },
      },
    });
  });
  const sent = await sendLink(id);
  return { ok: true, id, sent };
}

/** Reads what the link message needs and sends it. */
async function sendLink(id: string): Promise<Sent> {
  const order = await db.assistedOrder.findUnique({
    where: { id },
    select: {
      id: true,
      note: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      items: {
        orderBy: { id: "asc" },
        select: { quantity: true, product: { select: { name: true, packSize: true } } },
      },
    },
  });
  if (!order) return { sms: false, email: false };
  return sendPreparedOrderLink(order.user, {
    id: order.id,
    note: order.note,
    expiresAt: order.expiresAt,
    items: order.items.map((item) => ({
      name: item.product.name,
      detail: `${item.product.packSize} · Qty ${item.quantity.toLocaleString("en-IN")}`,
    })),
  });
}

export type StaffActionError = "not_found" | "closed" | "expired" | "rate_limited";

/** "Send link again". */
export async function resendAssistedOrderLink(
  id: string,
): Promise<{ ok: true; sent: Sent } | { ok: false; error: StaffActionError }> {
  const order = await findOpen(id);
  if (!order.ok) return order;
  const limit = await hitRateLimit(rateLimitRules.assistedLinkPerOrder, id);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };
  return { ok: true, sent: await sendLink(id) };
}

async function findOpen(id: string, now: Date = new Date()) {
  if (!isAssistedOrderId(id)) return { ok: false as const, error: "not_found" as const };
  const order = await db.assistedOrder.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, expiresAt: true },
  });
  if (!order) return { ok: false as const, error: "not_found" as const };
  const status = assistedStatusOf(order, now);
  if (status === "expired") return { ok: false as const, error: "expired" as const };
  if (status !== "open") return { ok: false as const, error: "closed" as const };
  return { ok: true as const, order };
}

/** Withdraws an open prepared order: the link stops working. */
export async function cancelAssistedOrder(staffId: string, id: string): Promise<boolean> {
  if (!isAssistedOrderId(id)) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.assistedOrder.updateMany({
      where: { id, status: "open" },
      data: { status: "cancelled", codeHash: null, codeExpiresAt: null },
    });
    if (count !== 1) return false;
    await logAdminAction(tx, {
      actorId: staffId,
      action: "assisted.cancel",
      resource: "AssistedOrder",
      resourceId: id,
      changes: { status: { from: "open", to: "cancelled" } },
    });
    return true;
  });
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type PricedItems = {
  lines: CartLine[];
  totals: OrderTotals;
  /** Some line can't be bought as it is (off sale, out of stock, below the minimum). */
  hasIssues: boolean;
};

type ItemRow = { quantity: number; product: Prisma.ProductGetPayload<{ select: typeof cartProductSelect }> };

const itemsSelect = {
  orderBy: { id: "asc" },
  select: { quantity: true, product: { select: cartProductSelect } },
} satisfies Prisma.AssistedOrder$itemsArgs;

/** The items priced for `viewer`, with the delivery charge and discount settings. */
export async function priceAssistedItems(
  rows: readonly ItemRow[],
  viewer: PricingViewer,
  shipping?: ShippingRule,
  discountPercent?: number,
): Promise<PricedItems> {
  const [shippingRule, discount] = await Promise.all([
    shipping ?? getSetting("checkout.shipping"),
    discountPercent ?? getSetting("pricing.discount").then((value) => value.percent),
  ]);
  await sweepLapsedHolds();
  const sellable = await sellableByProduct(rows.map((row) => row.product.id));
  const lines = rows.map((row) =>
    priceLine(row.product, row.quantity, viewer, sellable.get(row.product.id) ?? 0, discount),
  );
  return {
    lines,
    totals: totalsFor(lines, shippingRule),
    hasIssues: lines.some((line) => line.issue !== null),
  };
}

export type AssistedOrderRow = {
  id: string;
  status: AssistedStatus;
  customer: { id: string; name: string; phoneNumber: string | null };
  preparedBy: string | null;
  itemCount: number;
  createdAt: Date;
  order: { id: string; number: string } | null;
};

export const assistedFilterStatuses = ["open", "placed", "cancelled", "expired"] as const;

export const assistedFiltersSchema = z.object({
  status: z.enum(assistedFilterStatuses).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const ASSISTED_PAGE_SIZE = 25;

/** Prepared orders for the admin list, newest first. */
export async function listAssistedOrders(
  filters: z.infer<typeof assistedFiltersSchema>,
  now: Date = new Date(),
): Promise<{ rows: AssistedOrderRow[]; total: number; page: number; pageCount: number }> {
  const where: Prisma.AssistedOrderWhereInput =
    filters.status === "expired"
      ? { status: "open", expiresAt: { lte: now } }
      : filters.status === "open"
        ? { status: "open", expiresAt: { gt: now } }
        : filters.status
          ? { status: filters.status }
          : {};
  const total = await db.assistedOrder.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ASSISTED_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.assistedOrder.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ASSISTED_PAGE_SIZE,
    take: ASSISTED_PAGE_SIZE,
    select: {
      id: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, phoneNumber: true } },
      createdBy: { select: { name: true } },
      order: { select: { id: true, number: true } },
      _count: { select: { items: true } },
    },
  });
  return {
    rows: rows.map((row) => ({
      id: row.id,
      status: assistedStatusOf(row, now),
      customer: row.user,
      preparedBy: row.createdBy?.name ?? null,
      itemCount: row._count.items,
      createdAt: row.createdAt,
      order: row.order,
    })),
    total,
    page,
    pageCount,
  };
}

export type AssistedOrderDetail = {
  id: string;
  status: AssistedStatus;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
  placedAt: Date | null;
  placedBy: "customer" | "staff" | null;
  preparedBy: string | null;
  customer: CustomerMatch;
  order: { id: string; number: string; status: OrderStatus } | null;
  priced: PricedItems;
  /** The customer's saved addresses, for placing it on a call. */
  addresses: SavedAddress[];
  /** A code was sent and still works. */
  codeLive: boolean;
  /** A message (the code) can reach the customer: email, or SMS once connected. */
  canReach: boolean;
};

/** One prepared order for the admin page, priced for its customer today. */
export async function readAssistedOrderForAdmin(
  id: string,
  now: Date = new Date(),
): Promise<AssistedOrderDetail | null> {
  if (!isAssistedOrderId(id)) return null;
  const order = await db.assistedOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      placedAt: true,
      placedBy: true,
      codeHash: true,
      codeExpiresAt: true,
      codeAttempts: true,
      userId: true,
      user: { select: customerSelect },
      createdBy: { select: { name: true } },
      order: { select: { id: true, number: true, status: true } },
      items: itemsSelect,
    },
  });
  if (!order) return null;
  const viewer = (await pricingViewerForUserId(order.userId)) ?? {
    kind: "customer",
    professional: false,
    bulk: false,
  };
  const [priced, addresses] = await Promise.all([
    priceAssistedItems(order.items, viewer),
    listAddresses(order.userId),
  ]);
  return {
    id: order.id,
    status: assistedStatusOf(order, now),
    note: order.note,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    placedAt: order.placedAt,
    placedBy: order.placedBy === "customer" || order.placedBy === "staff" ? order.placedBy : null,
    preparedBy: order.createdBy?.name ?? null,
    customer: toMatch(order.user),
    order: order.order,
    priced,
    addresses,
    codeLive:
      order.codeHash !== null &&
      order.codeExpiresAt !== null &&
      order.codeExpiresAt > now &&
      order.codeAttempts < ASSISTED_CODE_TRIES,
    canReach: canReach(order.user),
  };
}

export type CustomerPreparedOrder =
  | { mine: false }
  | {
      mine: true;
      id: string;
      status: AssistedStatus;
      note: string | null;
      expiresAt: Date;
      preparedBy: string | null;
      orderId: string | null;
      priced: PricedItems;
    };

/**
 * A prepared order as its customer sees it, priced for them. `{ mine: false }`
 * when it belongs to someone else; null when there's no such order.
 */
export async function readPreparedOrderForCustomer(
  userId: string,
  viewer: PricingViewer,
  id: string,
  now: Date = new Date(),
): Promise<CustomerPreparedOrder | null> {
  if (!isAssistedOrderId(id)) return null;
  const order = await db.assistedOrder.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      note: true,
      expiresAt: true,
      orderId: true,
      createdBy: { select: { name: true } },
      items: itemsSelect,
    },
  });
  if (!order) return null;
  if (order.userId !== userId) return { mine: false };
  return {
    mine: true,
    id: order.id,
    status: assistedStatusOf(order, now),
    note: order.note,
    expiresAt: order.expiresAt,
    preparedBy: order.createdBy?.name ?? null,
    orderId: order.orderId,
    priced: await priceAssistedItems(order.items, viewer),
  };
}

export type OpenPreparedOrder = { id: string; createdAt: Date; itemCount: number; totalPaise: number };

/** The customer's open prepared orders (for /orders), newest first. */
export async function listOpenPreparedOrders(
  userId: string,
  viewer: PricingViewer,
  now: Date = new Date(),
): Promise<OpenPreparedOrder[]> {
  const orders = await db.assistedOrder.findMany({
    where: { userId, status: "open", expiresAt: { gt: now } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 10,
    select: { id: true, createdAt: true, items: itemsSelect },
  });
  if (orders.length === 0) return [];
  const [shipping, discount] = await Promise.all([getSetting("checkout.shipping"), getSetting("pricing.discount")]);
  return Promise.all(
    orders.map(async (order) => ({
      id: order.id,
      createdAt: order.createdAt,
      itemCount: order.items.length,
      totalPaise: (await priceAssistedItems(order.items, viewer, shipping, discount.percent)).totals.totalPaise,
    })),
  );
}

// ─── Confirming on a call ───────────────────────────────────────────────────

export type SendCodeResult =
  | { ok: true; sent: Sent; minutes: number }
  | { ok: false; error: StaffActionError | "no_contact" };

/**
 * Sends the customer a new 6-digit code for this order (the old one stops
 * working). They read it back to staff on the call to confirm the order.
 */
export async function sendAssistedOrderCode(
  staffId: string,
  id: string,
  now: Date = new Date(),
): Promise<SendCodeResult> {
  const found = await findOpen(id, now);
  if (!found.ok) return found;
  const order = await db.assistedOrder.findUniqueOrThrow({
    where: { id },
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      items: itemsSelect,
    },
  });
  const customer: Customer = order.user;
  if (!canReach(customer)) return { ok: false, error: "no_contact" };
  const limit = await hitRateLimit(rateLimitRules.assistedCodePerOrder, id);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const viewer = (await pricingViewerForUserId(order.userId)) ?? {
    kind: "customer",
    professional: false,
    bulk: false,
  };
  const { totals } = await priceAssistedItems(order.items, viewer);
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + ASSISTED_CODE_MINUTES * 60_000);
  await db.$transaction(async (tx) => {
    await tx.assistedOrder.update({
      where: { id },
      data: { codeHash: codeHashOf(id, code), codeExpiresAt: expiresAt, codeAttempts: 0 },
    });
    await logAdminAction(tx, {
      actorId: staffId,
      action: "assisted.code",
      resource: "AssistedOrder",
      resourceId: id,
    });
  });
  const sent = await sendPreparedOrderCode(customer, code, formatPaise(totals.totalPaise), expiresAt, ASSISTED_CODE_MINUTES);
  return { ok: true, sent, minutes: ASSISTED_CODE_MINUTES };
}

export type StaffPlaceError =
  | StaffActionError
  | "no_code"
  | "code_expired"
  | "too_many_tries"
  | Exclude<PlaceOrderError, "closed">;

export type StaffPlaceResult =
  | { ok: true; orderId: string }
  | { ok: false; error: StaffPlaceError }
  | { ok: false; error: "wrong_code"; triesLeft: number };

/**
 * Places the prepared order for the customer once they have read back the
 * code: priced for them, to the address chosen on the call, without coins.
 */
export async function placeAssistedOrderByStaff(
  staffId: string,
  input: { id: string; code: string; addressId: number; expectedTotalPaise: number },
  now: Date = new Date(),
): Promise<StaffPlaceResult> {
  const found = await findOpen(input.id, now);
  if (!found.ok) return found;
  const order = await db.assistedOrder.findUniqueOrThrow({
    where: { id: input.id },
    select: { userId: true, codeHash: true, codeExpiresAt: true, codeAttempts: true },
  });
  if (!order.codeHash || !order.codeExpiresAt) return { ok: false, error: "no_code" };
  if (order.codeAttempts >= ASSISTED_CODE_TRIES) return { ok: false, error: "too_many_tries" };
  if (order.codeExpiresAt <= now) return { ok: false, error: "code_expired" };
  const expected = Buffer.from(order.codeHash, "hex");
  const given = Buffer.from(codeHashOf(input.id, input.code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    // Counted only against this code: a new code starts again from 0.
    await db.assistedOrder.updateMany({
      where: { id: input.id, codeHash: order.codeHash },
      data: { codeAttempts: { increment: 1 } },
    });
    const triesLeft = Math.max(0, ASSISTED_CODE_TRIES - order.codeAttempts - 1);
    return { ok: false, error: "wrong_code", triesLeft };
  }

  const viewer = await pricingViewerForUserId(order.userId);
  if (!viewer) return { ok: false, error: "not_found" };
  const [shipping, discount] = await Promise.all([getSetting("checkout.shipping"), getSetting("pricing.discount")]);
  const result = await placeOrder({
    userId: order.userId,
    viewer,
    addressId: input.addressId,
    checkoutKey: randomUUID(),
    expectedTotalPaise: input.expectedTotalPaise,
    shipping,
    discountPercent: discount.percent,
    assisted: { id: input.id, placedBy: "staff" },
  });
  if (!result.ok) return { ok: false, error: result.error === "closed" ? "closed" : result.error };
  await db.$transaction(async (tx) => {
    // The code is used up.
    await tx.assistedOrder.update({
      where: { id: input.id },
      data: { codeHash: null, codeExpiresAt: null, codeAttempts: 0 },
    });
    await logAdminAction(tx, {
      actorId: staffId,
      action: "assisted.place",
      resource: "AssistedOrder",
      resourceId: input.id,
      changes: { orderId: { from: null, to: result.orderId } },
    });
  });
  return result;
}
