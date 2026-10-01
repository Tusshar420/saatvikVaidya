import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { addToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { maxRedemption } from "@/lib/coins";
import { coinSummary } from "@/server/coins/ledger";
import { computeTotals } from "@/server/checkout/totals";
import { getSetting } from "@/server/content/settings";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { placeOrder, startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import type { PricingViewer } from "@/server/pricing/rules";
import { makeProduct, makeUser, validAddress } from "./shop";

// Orders for the P1.5 tests, placed and paid through the real P1.4 code
// (cart, placeOrder, completePayment), so they look exactly like real ones.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer: PricingViewer = { kind: "customer", professional: false, bulk: false };

export type TestOrder = {
  orderId: string;
  number: string;
  userId: string;
  productId: number;
  quantity: number;
};

/**
 * A customer's order for `quantity` of a new product (stock 50), paid
 * unless `pay` is false.
 */
export async function makeOrder(
  db: PrismaClient,
  options: {
    pay?: boolean;
    quantity?: number;
    userId?: string;
    email?: string;
    phoneNumber?: string;
    address?: Partial<typeof validAddress>;
    /** Use the buyer's coins on the order (the most the rules allow). */
    redeemCoins?: boolean;
    /** Unit price of the product's MRP in paise (default 32,000). */
    mrpPaise?: number;
  } = {},
): Promise<TestOrder> {
  const quantity = options.quantity ?? 2;
  const product = await makeProduct(db, { stock: 50, mrpPaise: options.mrpPaise });
  const userId =
    options.userId ??
    (await makeUser(db, { email: options.email, phoneNumber: options.phoneNumber }));
  const parsed = parseAddress({ ...validAddress, ...options.address });
  if (!parsed.success) throw new Error("fixture address should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  const owner: CartOwner = { kind: "user", userId };
  const added = await addToCart(owner, product.id, quantity);
  if (!added.ok) throw new Error("not added to cart");
  const cart = await readCart(owner, customer, shipping);
  const coinRules = await getSetting("coins.rules");
  let expectedTotalPaise = cart.totals.totalPaise;
  if (options.redeemCoins) {
    const { balance } = await coinSummary(db, userId);
    const redemption = maxRedemption(balance, cart.totals.subtotalPaise, coinRules);
    expectedTotalPaise = computeTotals(cart.lines, shipping, redemption.discountPaise).totalPaise;
  }
  const placed = await placeOrder({
    userId,
    viewer: customer,
    addressId: address.id,
    checkoutKey: randomUUID(),
    expectedTotalPaise,
    shipping,
    coinRules,
    redeemCoins: options.redeemCoins ?? false,
  });
  if (!placed.ok) throw new Error(`order not placed: ${placed.error}`);
  if (options.pay !== false) {
    const payment = await startPaymentAttempt(placed.orderId);
    if (!payment) throw new Error("no payment attempt");
    await completePayment({ reference: payment.reference, outcome: "succeeded" });
  }
  const order = await db.order.findUniqueOrThrow({
    where: { id: placed.orderId },
    select: { number: true },
  });
  return { orderId: placed.orderId, number: order.number, userId, productId: product.id, quantity };
}

/** An admin account, for actorId. */
export async function makeAdmin(db: PrismaClient): Promise<string> {
  const id = await makeUser(db);
  await db.user.update({ where: { id }, data: { role: "admin" } });
  return id;
}
