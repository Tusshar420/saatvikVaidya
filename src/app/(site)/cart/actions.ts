"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cart as copy } from "@/content/cart";
import {
  addEbookToCart,
  addToCart,
  MAX_LINE_QUANTITY,
  removeEbookFromCart,
  removeFromCart,
  setCartQuantity,
  type CartChange,
  type CartError,
  type CartOwner,
} from "@/server/cart/cart";
import { cartOwnerForChange } from "@/server/cart/request";

// Server actions for the cart. Guests and signed-in users both use them; the
// owner comes from the session or the guest cookie, never from the browser.
// Only a product id and a quantity are accepted: prices are always worked
// out on the server.

export type CartActionResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

const lineSchema = z.object({
  productId: z.number().int().positive().max(2_147_483_647),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});
const removeSchema = lineSchema.pick({ productId: true });
const ebookSchema = z.object({ ebookId: z.number().int().positive().max(2_147_483_647) });

function messageFor(error: CartError): string {
  switch (error.kind) {
    case "unavailable":
    case "not_in_cart":
      return copy.errors.unavailable;
    case "out_of_stock":
      return copy.errors.outOfStock;
    case "below_moq":
      return copy.errors.belowMoq(error.moq);
    case "above_stock":
      return copy.errors.aboveStock(error.available);
    case "too_many_lines":
      return copy.errors.tooManyLines(error.max);
    case "invalid_quantity":
      return copy.errors.invalid;
    case "owned":
      return copy.errors.ebookOwned;
  }
}

async function run(
  change: (owner: CartOwner) => Promise<CartChange>,
): Promise<CartActionResult> {
  const owner = await cartOwnerForChange();
  if (owner === "rate_limited") return { ok: false, message: copy.errors.rateLimited };
  const result = await change(owner);
  if (!result.ok) return { ok: false, message: messageFor(result.error) };
  // The header's bag count and the cart page change.
  revalidatePath("/", "layout");
  return { ok: true, count: result.count };
}

export async function addToCartAction(input: unknown): Promise<CartActionResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.errors.invalid };
  return run((owner) => addToCart(owner, parsed.data.productId, parsed.data.quantity));
}

export async function setCartQuantityAction(input: unknown): Promise<CartActionResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.errors.invalid };
  return run((owner) => setCartQuantity(owner, parsed.data.productId, parsed.data.quantity));
}

export async function removeFromCartAction(input: unknown): Promise<CartActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.errors.generic };
  return run((owner) => removeFromCart(owner, parsed.data.productId));
}

/** Adds a paid ebook (one copy; P1.8). */
export async function addEbookToCartAction(input: unknown): Promise<CartActionResult> {
  const parsed = ebookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.errors.invalid };
  return run((owner) => addEbookToCart(owner, parsed.data.ebookId));
}

export async function removeEbookFromCartAction(input: unknown): Promise<CartActionResult> {
  const parsed = ebookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.errors.generic };
  return run((owner) => removeEbookFromCart(owner, parsed.data.ebookId));
}
