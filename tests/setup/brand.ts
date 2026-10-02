import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { addToBrandCart, brandCartTotals, readBrandCart, setBrandCartQuantity } from "@/server/brand/cart";
import { saveDraftLogo, savePackaging } from "@/server/brand/drafts";
import { placeBrandOrder } from "@/server/brand/orders";
import { makeProduct, makeUser, validAddress } from "./shop";

// A Launch Your Brand order for the P2.2 tests, made through the real P2.1
// code (Launch cart, draft, placeBrandOrder, test payment), so it looks
// like a real one.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };

/** The first bytes of a PNG: enough for the type check. */
export const pngBytes = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
/** The first bytes of a PDF. */
export const pdfBytes = () => new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

export type TestBrandOrder = { orderId: string; userId: string; productId: number };

export async function makeBrandOrder(
  db: PrismaClient,
  options: { pay?: boolean; userId?: string } = {},
): Promise<TestBrandOrder> {
  const product = await makeProduct(db, { stock: 3, brand: { minQty: 4, unitPricePaise: 26_000 } });
  const userId = options.userId ?? (await makeUser(db));
  if (!(await addToBrandCart(userId, product.id)).ok) throw new Error("product not added");
  const logo = await saveDraftLogo({ userId, fileName: "logo.png", bytes: pngBytes() });
  if (!logo.ok) throw new Error("logo not saved");
  const packaged = await savePackaging(userId, {
    brandName: "Vaidya Care",
    tagline: "Rooted in classics",
    marketedByName: "Vaidya Care LLP",
    marketedByAddress: "12 MG Road\nPune 411001",
    contactPhone: "+91 92203 58400",
    notes: "",
  });
  if (!packaged.ok) throw new Error("packaging not saved");
  const quantity = await setBrandCartQuantity(userId, product.id, 8);
  if (!quantity.ok) throw new Error("quantity not saved");
  const expectedTotalPaise = brandCartTotals(await readBrandCart(userId), shipping).totalPaise;
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  const placed = await placeBrandOrder({
    userId,
    addressId: address.id,
    checkoutKey: randomUUID(),
    expectedTotalPaise,
    shipping,
  });
  if (!placed.ok) throw new Error(`order not placed: ${placed.error}`);
  if (options.pay !== false) {
    const attempt = await startPaymentAttempt(placed.orderId);
    if (!attempt) throw new Error("no payment attempt");
    await completePayment({ reference: attempt.reference, outcome: "succeeded" }, userId);
  }
  return { orderId: placed.orderId, userId, productId: product.id };
}
