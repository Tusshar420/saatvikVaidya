import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "@/server/db";
import { isSecureSite } from "@/server/request-origin";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "./cart";
import { GUEST_CART_COOKIE, guestCookieOptions, hashGuestToken } from "./token";

/**
 * Moves a guest cart's lines into the user's cart and deletes the guest
 * cart. Quantities of a product in both carts are added together (the cart
 * page then flags anything over stock). Returns how many lines moved.
 */
export async function mergeGuestCart(tokenHash: string, userId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { guestTokenHash: tokenHash },
      select: { id: true, items: { select: { productId: true, ebookId: true, quantity: true } } },
    });
    if (!guest) return 0;
    // Deleting first claims the merge: another sign-in racing this one
    // waits on the row lock, then finds nothing to delete.
    const { count } = await tx.cart.deleteMany({ where: { id: guest.id } });
    if (count === 0 || guest.items.length === 0) return 0;

    const cart =
      (await tx.cart.findUnique({ where: { userId }, select: { id: true } })) ??
      (await tx.cart.create({ data: { userId }, select: { id: true } }));
    const current = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      select: { productId: true, ebookId: true, quantity: true },
    });
    const quantities = new Map(
      current.flatMap((item) => (item.productId === null ? [] : [[item.productId, item.quantity] as const])),
    );
    const ebooks = new Set(current.flatMap((item) => (item.ebookId === null ? [] : [item.ebookId])));
    const lineCount = () => quantities.size + ebooks.size;

    let moved = 0;
    for (const item of guest.items) {
      // Ebooks (P1.8): one copy each; already in the account's cart is fine.
      if (item.ebookId !== null) {
        if (ebooks.has(item.ebookId) || lineCount() >= MAX_CART_LINES) continue;
        await tx.cartItem.create({ data: { cartId: cart.id, ebookId: item.ebookId, quantity: 1 } });
        ebooks.add(item.ebookId);
        moved += 1;
        continue;
      }
      if (item.productId === null) continue;
      const existing = quantities.get(item.productId);
      if (existing === undefined && lineCount() >= MAX_CART_LINES) continue;
      const quantity = Math.min(MAX_LINE_QUANTITY, (existing ?? 0) + item.quantity);
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
        create: { cartId: cart.id, productId: item.productId, quantity },
        update: { quantity },
      });
      quantities.set(item.productId, quantity);
      moved += 1;
    }
    await tx.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
    return moved;
  });
}

/** Endpoints that sign someone in (phone OTP also signs up). */
const signInPaths = new Set(["/sign-in/email", "/phone-number/verify", "/sign-in/phone-number"]);

/**
 * Better Auth plugin: after a successful sign-in, a guest cart in this
 * browser (the "sv.cart" cookie) is merged into the account's cart and the
 * cookie is cleared. A failed merge never blocks the sign-in.
 */
export function cartMergePlugin() {
  return {
    id: "saatvik-cart-merge",
    hooks: {
      after: [
        {
          matcher: (ctx) => signInPaths.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.newSession;
            if (!session) return;
            const token = ctx.getCookie(GUEST_CART_COOKIE);
            if (!token) return;
            const tokenHash = hashGuestToken(token);
            if (tokenHash) {
              try {
                await mergeGuestCart(tokenHash, session.user.id);
              } catch (error) {
                console.error("cartMergePlugin: could not merge the guest cart.", error);
              }
            }
            ctx.setCookie(GUEST_CART_COOKIE, "", {
              ...guestCookieOptions(isSecureSite()),
              maxAge: 0,
            });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
