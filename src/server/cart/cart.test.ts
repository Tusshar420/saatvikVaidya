import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { guestViewer, type PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeProduct, makeUser } from "../../../tests/setup/shop";
import {
  addToCart,
  cartCount,
  deleteStaleGuestCarts,
  MAX_CART_LINES,
  readCart,
  removeFromCart,
  setCartQuantity,
  type CartOwner,
} from "./cart";
import { mergeGuestCart } from "./merge";
import { hashGuestToken, newGuestToken } from "./token";

// The cart (P1.4): MOQ and stock rules, prices from priceFor() for each
// viewer, guest carts and merging them at sign-in.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer: PricingViewer = { kind: "customer", professional: false, bulk: false };
const pharmacy: PricingViewer = { kind: "professional", professional: true, bulk: true };

const guest = (): CartOwner => ({
  kind: "guest",
  tokenHash: hashGuestToken(newGuestToken()) as string,
});
const user = (userId: string): CartOwner => ({ kind: "user", userId });

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("guest token", () => {
  it("hashes only tokens it made", () => {
    const token = newGuestToken();
    expect(token).toHaveLength(43);
    expect(hashGuestToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashGuestToken(token)).toBe(hashGuestToken(token));
    expect(hashGuestToken("short")).toBeNull();
    expect(hashGuestToken(`${token.slice(0, 42)}!`)).toBeNull();
    expect(hashGuestToken(undefined)).toBeNull();
  });
});

describe("addToCart", () => {
  it("creates the cart, adds up quantities and counts products", async () => {
    const owner = guest();
    const a = await makeProduct(db);
    const b = await makeProduct(db);
    expect(await cartCount(owner)).toBe(0);
    expect(await addToCart(owner, a.id, 2)).toEqual({ ok: true, count: 1 });
    expect(await addToCart(owner, a.id, 3)).toEqual({ ok: true, count: 1 });
    expect(await addToCart(owner, b.id, 1)).toEqual({ ok: true, count: 2 });
    const cart = await readCart(owner, guestViewer, shipping);
    expect(cart.lines.map((line) => [line.productId, line.quantity])).toEqual([
      [a.id, 5],
      [b.id, 1],
    ]);
  });

  it("enforces MOQ and stock, and refuses hidden or sold-out products", async () => {
    const owner = guest();
    const moq = await makeProduct(db, { moq: 3, stock: 10 });
    expect(await addToCart(owner, moq.id, 2)).toEqual({
      ok: false,
      error: { kind: "below_moq", moq: 3 },
    });
    expect(await addToCart(owner, moq.id, 11)).toEqual({
      ok: false,
      error: { kind: "above_stock", available: 10 },
    });
    expect((await addToCart(owner, moq.id, 3)).ok).toBe(true);
    // 3 in the cart, so 8 more would be 11.
    expect(await addToCart(owner, moq.id, 8)).toMatchObject({ ok: false, error: { kind: "above_stock" } });

    const hidden = await makeProduct(db, { active: false });
    expect(await addToCart(owner, hidden.id, 1)).toEqual({ ok: false, error: { kind: "unavailable" } });
    const soldOut = await makeProduct(db, { stock: 1, moq: 2 });
    expect(await addToCart(owner, soldOut.id, 2)).toEqual({ ok: false, error: { kind: "out_of_stock" } });
    expect(await addToCart(owner, 999_999, 1)).toEqual({ ok: false, error: { kind: "unavailable" } });
  });

  it("refuses bad quantities and too many products", async () => {
    const owner = guest();
    const product = await makeProduct(db);
    for (const quantity of [0, -1, 1.5, Number.NaN, 10_000]) {
      expect(await addToCart(owner, product.id, quantity)).toEqual({
        ok: false,
        error: { kind: "invalid_quantity" },
      });
    }
    // A refused first add doesn't leave an empty cart behind.
    expect(await db.cart.count()).toBe(0);

    const many = [];
    for (let i = 0; i < MAX_CART_LINES; i += 1) many.push(await makeProduct(db));
    for (const p of many) expect((await addToCart(owner, p.id, 1)).ok).toBe(true);
    expect(await addToCart(owner, product.id, 1)).toEqual({
      ok: false,
      error: { kind: "too_many_lines", max: MAX_CART_LINES },
    });
  });
});

describe("setCartQuantity and removeFromCart", () => {
  it("changes and removes lines within the rules", async () => {
    const owner = guest();
    const product = await makeProduct(db, { moq: 2, stock: 6 });
    await addToCart(owner, product.id, 2);
    expect(await setCartQuantity(owner, product.id, 6)).toEqual({ ok: true, count: 1 });
    expect(await setCartQuantity(owner, product.id, 7)).toEqual({
      ok: false,
      error: { kind: "above_stock", available: 6 },
    });
    expect(await setCartQuantity(owner, product.id, 1)).toEqual({
      ok: false,
      error: { kind: "below_moq", moq: 2 },
    });
    expect(await setCartQuantity(guest(), product.id, 2)).toEqual({
      ok: false,
      error: { kind: "not_in_cart" },
    });
    expect(await removeFromCart(owner, product.id)).toEqual({ ok: true, count: 0 });
    expect(await removeFromCart(owner, product.id)).toEqual({ ok: true, count: 0 });
  });

  it("can't touch another owner's cart", async () => {
    const mine = guest();
    const theirs = guest();
    const product = await makeProduct(db);
    await addToCart(theirs, product.id, 1);
    await removeFromCart(mine, product.id);
    expect(await cartCount(theirs)).toBe(1);
  });
});

describe("readCart", () => {
  it("prices each line for the viewer at its quantity and totals with delivery", async () => {
    const product = await makeProduct(db, {
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      bulkTiers: [{ minQuantity: 10, pricePaise: 22_000 }],
      stock: 100,
    });
    const userId = await makeUser(db);
    const owner = user(userId);
    await addToCart(owner, product.id, 10);

    const asCustomer = await readCart(owner, customer, shipping);
    expect(asCustomer.lines[0]).toMatchObject({
      unitPaise: 32_000,
      lineTotalPaise: 320_000,
      tier: "mrp",
      issue: null,
    });
    expect(asCustomer.totals).toMatchObject({
      subtotalPaise: 320_000,
      taxPaise: 15_238,
      shippingPaise: 0,
      totalPaise: 320_000,
    });

    const asPharmacy = await readCart(owner, pharmacy, shipping);
    expect(asPharmacy.lines[0]).toMatchObject({ unitPaise: 22_000, tier: "bulk", lineTotalPaise: 220_000 });

    await setCartQuantity(owner, product.id, 2);
    const small = await readCart(owner, pharmacy, shipping);
    expect(small.lines[0]).toMatchObject({ unitPaise: 24_000, tier: "professional" });
    expect(small.totals).toMatchObject({ subtotalPaise: 48_000, shippingPaise: 8_000, totalPaise: 56_000 });
  });

  it("flags lines that changed since they were added and leaves sold-out lines out of the totals", async () => {
    const owner = guest();
    const hidden = await makeProduct(db, { mrpPaise: 10_000 });
    const short = await makeProduct(db, { mrpPaise: 20_000, stock: 10 });
    const fine = await makeProduct(db, { mrpPaise: 30_000 });
    await addToCart(owner, hidden.id, 1);
    await addToCart(owner, short.id, 5);
    await addToCart(owner, fine.id, 1);
    await db.product.update({ where: { id: hidden.id }, data: { active: false } });
    await db.product.update({ where: { id: short.id }, data: { stock: 3 } });

    const cart = await readCart(owner, guestViewer, shipping);
    expect(cart.hasIssues).toBe(true);
    expect(cart.lines.map((line) => line.issue)).toEqual([
      { kind: "unavailable" },
      { kind: "above_stock", available: 3 },
      null,
    ]);
    // The hidden line isn't counted; the short one still is, at its quantity.
    expect(cart.totals.subtotalPaise).toBe(5 * 20_000 + 30_000);
  });

  it("is empty without an owner or a cart", async () => {
    expect((await readCart(null, guestViewer, shipping)).lines).toEqual([]);
    expect((await readCart(guest(), guestViewer, shipping)).totals.totalPaise).toBe(0);
  });

  it("never holds a professional price for a viewer who doesn't get it", async () => {
    const owner = guest();
    const product = await makeProduct(db, { mrpPaise: 32_000, professionalPricePaise: 24_123 });
    await addToCart(owner, product.id, 1);
    const cart = await readCart(owner, guestViewer, shipping);
    expect(JSON.stringify(cart)).not.toContain("24123");
  });
});

describe("mergeGuestCart", () => {
  it("moves the guest's lines into the user's cart, adding quantities, and deletes the guest cart", async () => {
    const userId = await makeUser(db);
    const a = await makeProduct(db);
    const b = await makeProduct(db);
    await addToCart(user(userId), a.id, 1);
    const token = newGuestToken();
    const tokenHash = hashGuestToken(token) as string;
    const owner: CartOwner = { kind: "guest", tokenHash };
    await addToCart(owner, a.id, 2);
    await addToCart(owner, b.id, 4);

    expect(await mergeGuestCart(tokenHash, userId)).toBe(2);
    const cart = await readCart(user(userId), customer, shipping);
    expect(cart.lines.map((line) => [line.productId, line.quantity])).toEqual([
      [a.id, 3],
      [b.id, 4],
    ]);
    expect(await db.cart.count({ where: { guestTokenHash: tokenHash } })).toBe(0);
    // Merging again (a replayed sign-in) changes nothing.
    expect(await mergeGuestCart(tokenHash, userId)).toBe(0);
    expect((await readCart(user(userId), customer, shipping)).lines[0]?.quantity).toBe(3);
  });

  it("creates the user's cart if needed and merges once when two sign-ins race", async () => {
    const userId = await makeUser(db);
    const product = await makeProduct(db);
    const tokenHash = hashGuestToken(newGuestToken()) as string;
    await addToCart({ kind: "guest", tokenHash }, product.id, 2);
    const results = await Promise.allSettled([
      mergeGuestCart(tokenHash, userId),
      mergeGuestCart(tokenHash, userId),
    ]);
    const moved = results.map((r) => (r.status === "fulfilled" ? r.value : 0));
    expect(moved.sort()).toEqual([0, 1]);
    expect((await readCart(user(userId), customer, shipping)).lines[0]?.quantity).toBe(2);
  });
});

describe("deleteStaleGuestCarts", () => {
  it("drops guest carts untouched for 30 days, never users' carts", async () => {
    const product = await makeProduct(db);
    const old = guest();
    const fresh = guest();
    const userId = await makeUser(db);
    await addToCart(old, product.id, 1);
    await addToCart(fresh, product.id, 1);
    await addToCart(user(userId), product.id, 1);
    const longAgo = new Date(Date.now() - 31 * 86_400_000);
    await db.cart.updateMany({
      where: { guestTokenHash: old.kind === "guest" ? old.tokenHash : "" },
      data: { updatedAt: longAgo },
    });
    await db.cart.updateMany({ where: { userId }, data: { updatedAt: longAgo } });
    expect(await deleteStaleGuestCarts()).toBe(1);
    expect(await cartCount(old)).toBe(0);
    expect(await cartCount(fresh)).toBe(1);
    expect(await cartCount(user(userId))).toBe(1);
  });
});
