import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { productImageSrc } from "@/lib/catalogue";
import { courseForSale } from "@/lib/courses";
import { ebookCoverSrc } from "@/lib/ebooks";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";
import { db } from "@/server/db";
import { sellableByProduct, sellableOf, sweepLapsedHolds } from "@/server/inventory/availability";
import {
  computeTotals,
  type OrderTotals,
  type ShippingRule,
} from "@/server/checkout/totals";
import { enrolledCourseIds } from "@/server/courses/courses";
import { ownedEbookIds } from "@/server/ebooks/ebooks";
import { priceFor, type PriceTier, type PricingViewer } from "@/server/pricing/rules";

// The cart (docs/CHUNKS.md, P1.4). A cart belongs to a signed-in user or to
// a guest cookie (src/server/cart/request.ts works out which). It stores only
// products and quantities: every read prices the lines again with
// priceFor(), so a price change or an approval shows straight away and the
// browser never sends a price. Paid ebooks (P1.8) and course seats (B1) can
// be lines too: one each, no stock, no MOQ and no delivery.

/** Whose cart: a signed-in user's, or a guest's by cookie token hash. */
export type CartOwner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; tokenHash: string };

/** The most different products one cart may hold. */
export const MAX_CART_LINES = 50;
/** The most units of one product per line. */
export const MAX_LINE_QUANTITY = MAX_QUANTITY_INPUT;

export function cartWhere(owner: CartOwner): Prisma.CartWhereUniqueInput {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { guestTokenHash: owner.tokenHash };
}

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/** The owner's cart id, creating the cart if needed (safe if two requests race). */
async function ensureCart(owner: CartOwner): Promise<number> {
  const where = cartWhere(owner);
  const existing = await db.cart.findUnique({ where, select: { id: true } });
  if (existing) return existing.id;
  try {
    const data =
      owner.kind === "user"
        ? { userId: owner.userId }
        : { guestTokenHash: owner.tokenHash };
    const created = await db.cart.create({ data, select: { id: true } });
    // Now and then, drop guest carts nobody has touched for 30 days.
    if (owner.kind === "guest" && Math.random() < 0.01) void deleteStaleGuestCarts();
    return created.id;
  } catch (error) {
    if (!isUniqueClash(error)) throw error;
    return (await db.cart.findUniqueOrThrow({ where, select: { id: true } })).id;
  }
}

/** Deletes guest carts not changed for `days` days (their items go with them). */
export async function deleteStaleGuestCarts(days = 30, now = Date.now()) {
  const { count } = await db.cart.deleteMany({
    where: { userId: null, updatedAt: { lt: new Date(now - days * 86_400_000) } },
  });
  return count;
}

// ─── Rules for one line ─────────────────────────────────────────────────────

/** Why a line can't be bought as it is. */
export type CartIssue =
  | { kind: "unavailable" }
  | { kind: "out_of_stock" }
  | { kind: "below_moq"; moq: number }
  | { kind: "above_stock"; available: number };

type StockFields = { active: boolean; stock: number; moq: number };

/** The problem with buying `quantity` of a product today, or null. */
export function lineIssue(product: StockFields, quantity: number): CartIssue | null {
  if (!product.active) return { kind: "unavailable" };
  const moq = Math.max(1, product.moq);
  if (product.stock < moq) return { kind: "out_of_stock" };
  if (quantity < moq) return { kind: "below_moq", moq };
  if (quantity > product.stock) return { kind: "above_stock", available: product.stock };
  return null;
}

/** Issues that only removing the line can fix. */
export const isBlockingIssue = (issue: CartIssue | null) =>
  issue?.kind === "unavailable" || issue?.kind === "out_of_stock";

// ─── Changes ────────────────────────────────────────────────────────────────

export type CartError =
  | CartIssue
  | { kind: "too_many_lines"; max: number }
  | { kind: "not_in_cart" }
  | { kind: "invalid_quantity" }
  /** The user already bought this ebook. */
  | { kind: "owned" }
  /** The user is already enrolled in this course. */
  | { kind: "enrolled" };

export type CartChange = { ok: true; count: number } | { ok: false; error: CartError };

const validQuantity = (quantity: number) =>
  Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= MAX_LINE_QUANTITY;

async function touch(cartId: number): Promise<number> {
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  return db.cartItem.count({ where: { cartId } });
}

/**
 * Adds `quantity` units of an active product. The line's new quantity must
 * meet the product's MOQ and fit in its stock.
 */
export async function addToCart(
  owner: CartOwner,
  productId: number,
  quantity: number,
): Promise<CartChange> {
  if (!validQuantity(quantity)) return { ok: false, error: { kind: "invalid_quantity" } };
  const row = await db.product.findUnique({
    where: { id: productId },
    select: { active: true, moq: true },
  });
  if (!row) return { ok: false, error: { kind: "unavailable" } };
  await sweepLapsedHolds();
  const product = { ...row, stock: await sellableOf(productId) };
  const stockIssue = lineIssue(product, Math.max(1, product.moq));
  if (stockIssue) return { ok: false, error: stockIssue };

  const cartId = await ensureCart(owner);
  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { quantity: true },
  });
  if (!existing) {
    const lines = await db.cartItem.count({ where: { cartId } });
    if (lines >= MAX_CART_LINES) {
      return { ok: false, error: { kind: "too_many_lines", max: MAX_CART_LINES } };
    }
  }
  const next = (existing?.quantity ?? 0) + quantity;
  if (next > MAX_LINE_QUANTITY) {
    return { ok: false, error: { kind: "above_stock", available: Math.min(product.stock, MAX_LINE_QUANTITY) } };
  }
  const issue = lineIssue(product, next);
  if (issue) return { ok: false, error: issue };

  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: next },
    update: { quantity: next },
  });
  return { ok: true, count: await touch(cartId) };
}

/** Sets a line's quantity. It must meet the MOQ and fit in stock. */
export async function setCartQuantity(
  owner: CartOwner,
  productId: number,
  quantity: number,
): Promise<CartChange> {
  if (!validQuantity(quantity)) return { ok: false, error: { kind: "invalid_quantity" } };
  const item = await db.cartItem.findFirst({
    where: { productId, cart: cartWhere(owner) },
    select: { id: true, cartId: true, product: { select: { active: true, moq: true } } },
  });
  if (!item?.product) return { ok: false, error: { kind: "not_in_cart" } };
  await sweepLapsedHolds();
  const issue = lineIssue({ ...item.product, stock: await sellableOf(productId) }, quantity);
  if (issue) return { ok: false, error: issue };
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return { ok: true, count: await touch(item.cartId) };
}

/** Removes a product from the cart. Removing one that isn't there is fine. */
export async function removeFromCart(owner: CartOwner, productId: number): Promise<CartChange> {
  const cart = await db.cart.findUnique({ where: cartWhere(owner), select: { id: true } });
  if (!cart) return { ok: true, count: 0 };
  await db.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return { ok: true, count: await touch(cart.id) };
}

// ─── Ebooks ─────────────────────────────────────────────────────────────────

/** Why an ebook line can't be bought: hidden, made free, or already bought. */
export type EbookIssue = { kind: "unavailable" } | { kind: "owned" };

type EbookSaleFields = { active: boolean; isFree: boolean; pricePaise: number };

/** An ebook that can be sold: active, paid and priced. */
const forSale = (ebook: EbookSaleFields) => ebook.active && !ebook.isFree && ebook.pricePaise > 0;

/**
 * Adds a paid ebook (one copy). Adding one that's already in the cart
 * changes nothing; a book the user already bought is refused.
 */
export async function addEbookToCart(owner: CartOwner, ebookId: number): Promise<CartChange> {
  const ebook = await db.ebook.findUnique({
    where: { id: ebookId },
    select: { active: true, isFree: true, pricePaise: true },
  });
  if (!ebook || !forSale(ebook)) return { ok: false, error: { kind: "unavailable" } };
  if (owner.kind === "user" && (await ownedEbookIds(owner.userId, [ebookId])).has(ebookId)) {
    return { ok: false, error: { kind: "owned" } };
  }
  const cartId = await ensureCart(owner);
  const existing = await db.cartItem.findUnique({
    where: { cartId_ebookId: { cartId, ebookId } },
    select: { id: true },
  });
  if (!existing) {
    const lines = await db.cartItem.count({ where: { cartId } });
    if (lines >= MAX_CART_LINES) {
      return { ok: false, error: { kind: "too_many_lines", max: MAX_CART_LINES } };
    }
    try {
      await db.cartItem.create({ data: { cartId, ebookId, quantity: 1 } });
    } catch (error) {
      // Added by another request at the same moment: that's fine.
      if (!isUniqueClash(error)) throw error;
    }
  }
  return { ok: true, count: await touch(cartId) };
}

/** Removes an ebook from the cart. Removing one that isn't there is fine. */
export async function removeEbookFromCart(owner: CartOwner, ebookId: number): Promise<CartChange> {
  const cart = await db.cart.findUnique({ where: cartWhere(owner), select: { id: true } });
  if (!cart) return { ok: true, count: 0 };
  await db.cartItem.deleteMany({ where: { cartId: cart.id, ebookId } });
  return { ok: true, count: await touch(cart.id) };
}

// ─── Courses (B1) ───────────────────────────────────────────────────────────

/** Why a course line can't be bought: not on sale now, or already enrolled. */
export type CourseIssue = { kind: "unavailable" } | { kind: "enrolled" };

/**
 * Adds a seat on a course. Adding one that's already in the cart changes
 * nothing; a course the user is enrolled in is refused.
 */
export async function addCourseToCart(owner: CartOwner, courseId: number): Promise<CartChange> {
  const course = await db.courseTeaser.findUnique({
    where: { id: courseId },
    select: { active: true, status: true, pricePaise: true },
  });
  if (!course || !courseForSale(course)) return { ok: false, error: { kind: "unavailable" } };
  if (owner.kind === "user" && (await enrolledCourseIds(owner.userId, [courseId])).has(courseId)) {
    return { ok: false, error: { kind: "enrolled" } };
  }
  const cartId = await ensureCart(owner);
  const existing = await db.cartItem.findUnique({
    where: { cartId_courseId: { cartId, courseId } },
    select: { id: true },
  });
  if (!existing) {
    const lines = await db.cartItem.count({ where: { cartId } });
    if (lines >= MAX_CART_LINES) {
      return { ok: false, error: { kind: "too_many_lines", max: MAX_CART_LINES } };
    }
    try {
      await db.cartItem.create({ data: { cartId, courseId, quantity: 1 } });
    } catch (error) {
      // Added by another request at the same moment: that's fine.
      if (!isUniqueClash(error)) throw error;
    }
  }
  return { ok: true, count: await touch(cartId) };
}

/** Removes a course from the cart. Removing one that isn't there is fine. */
export async function removeCourseFromCart(owner: CartOwner, courseId: number): Promise<CartChange> {
  const cart = await db.cart.findUnique({ where: cartWhere(owner), select: { id: true } });
  if (!cart) return { ok: true, count: 0 };
  await db.cartItem.deleteMany({ where: { cartId: cart.id, courseId } });
  return { ok: true, count: await touch(cart.id) };
}

/** True when the course is in the owner's cart (the course page's button). */
export async function courseInCart(owner: CartOwner | null, courseId: number): Promise<boolean> {
  if (!owner) return false;
  return (await db.cartItem.count({ where: { cart: cartWhere(owner), courseId } })) > 0;
}

/** How many different products are in the cart (the header's bag count). */
export async function cartCount(owner: CartOwner | null): Promise<number> {
  if (!owner) return 0;
  return db.cartItem.count({ where: { cart: cartWhere(owner) } });
}

// ─── Reading ────────────────────────────────────────────────────────────────

export const cartProductSelect = {
  id: true,
  slug: true,
  name: true,
  packSize: true,
  isSample: true,
  active: true,
  moq: true,
  gstRate: true,
  hsnCode: true,
  mrpPaise: true,
  professionalPricePaise: true,
  bulkTiers: { select: { minQuantity: true, pricePaise: true } },
  brand: { select: { name: true } },
  form: { select: { name: true, glyph: true } },
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    take: 1,
    select: { id: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

export type CartProductRow = Prisma.ProductGetPayload<{ select: typeof cartProductSelect }>;

/** One cart line as the viewer sees it. Holds only the viewer's own price. */
export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  brandName: string | null;
  formName: string;
  glyph: string | null;
  packSize: string;
  isSample: boolean;
  image: { src: string; alt: string } | null;
  quantity: number;
  moq: number;
  /** Units in stock (the most this line can hold). */
  available: number;
  gstRate: number;
  unitPaise: number;
  mrpPaise: number;
  lineTotalPaise: number;
  tier: PriceTier;
  issue: CartIssue | null;
};

export const cartEbookSelect = {
  id: true,
  slug: true,
  title: true,
  author: true,
  active: true,
  isFree: true,
  pricePaise: true,
  gstRate: true,
  coverKey: true,
} satisfies Prisma.EbookSelect;

export type CartEbookRow = Prisma.EbookGetPayload<{ select: typeof cartEbookSelect }>;

/** A paid ebook in the cart: one copy at its price, nothing to deliver. */
export type CartEbookLine = {
  ebookId: number;
  slug: string;
  title: string;
  author: string | null;
  cover: string | null;
  gstRate: number;
  lineTotalPaise: number;
  issue: EbookIssue | null;
  /** For the totals: an ebook adds nothing to the delivery charge. */
  digital: true;
};

/** Prices an ebook line. `owned`: the buyer already has it. */
export function priceEbookLine(ebook: CartEbookRow, owned: boolean): CartEbookLine {
  return {
    ebookId: ebook.id,
    slug: ebook.slug,
    title: ebook.title,
    author: ebook.author,
    cover: ebook.coverKey ? ebookCoverSrc(ebook.id, ebook.coverKey) : null,
    gstRate: ebook.gstRate,
    lineTotalPaise: ebook.pricePaise,
    issue: owned ? { kind: "owned" } : forSale(ebook) ? null : { kind: "unavailable" },
    digital: true,
  };
}

export const cartCourseSelect = {
  id: true,
  key: true,
  title: true,
  instructor: true,
  active: true,
  status: true,
  pricePaise: true,
  gstRate: true,
} satisfies Prisma.CourseTeaserSelect;

export type CartCourseRow = Prisma.CourseTeaserGetPayload<{ select: typeof cartCourseSelect }>;

/** A course seat in the cart: one at the course's price, nothing to deliver. */
export type CartCourseLine = {
  courseId: number;
  key: string;
  title: string;
  instructor: string | null;
  gstRate: number;
  lineTotalPaise: number;
  issue: CourseIssue | null;
  /** For the totals: a course adds nothing to the delivery charge. */
  digital: true;
};

/** Prices a course line. `enrolled`: the buyer already has a seat. */
export function priceCourseLine(course: CartCourseRow, enrolled: boolean): CartCourseLine {
  return {
    courseId: course.id,
    key: course.key,
    title: course.title,
    instructor: course.instructor,
    gstRate: course.gstRate,
    lineTotalPaise: course.pricePaise ?? 0,
    issue: enrolled ? { kind: "enrolled" } : courseForSale(course) ? null : { kind: "unavailable" },
    digital: true,
  };
}

export type CartView = {
  lines: CartLine[];
  /** Paid ebooks, after the products. */
  ebooks: CartEbookLine[];
  /** Course seats, after the ebooks. */
  courses: CartCourseLine[];
  /** Totals of the lines that can be bought (not unavailable or out of stock). */
  totals: OrderTotals;
  /** True when any line has an issue, so checkout must wait. */
  hasIssues: boolean;
};

/** Prices one line for the viewer at its quantity. */
export function priceLine(
  product: CartProductRow,
  quantity: number,
  viewer: PricingViewer,
  /** Units on sale now (see sellableByProduct). */
  stock: number,
  /** Site-wide discount percent (setting "pricing.discount"). */
  discountPercent = 0,
): CartLine {
  const issue = lineIssue({ ...product, stock }, quantity);
  const price = priceFor(product, viewer, Math.max(1, quantity), discountPercent);
  const image = product.images[0];
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brand?.name ?? null,
    formName: product.form.name,
    glyph: product.form.glyph,
    packSize: product.packSize,
    isSample: product.isSample,
    image: image ? { src: productImageSrc(image.id), alt: image.alt } : null,
    quantity,
    moq: Math.max(1, product.moq),
    available: Math.max(0, stock),
    gstRate: product.gstRate,
    unitPaise: price.unitPaise,
    mrpPaise: price.mrpPaise,
    lineTotalPaise: price.totalPaise,
    tier: price.tier,
    issue,
  };
}

/**
 * The lines that count towards the totals, in the order an order stores
 * them: products that can be bought, then ebooks, then courses.
 */
export function totalsLinesOf(
  lines: readonly CartLine[],
  ebooks: readonly CartEbookLine[] = [],
  courses: readonly CartCourseLine[] = [],
): (CartLine | CartEbookLine | CartCourseLine)[] {
  return [
    ...lines.filter((line) => !isBlockingIssue(line.issue)),
    ...ebooks.filter((line) => line.issue === null),
    ...courses.filter((line) => line.issue === null),
  ];
}

/** Totals for lines that can be bought. */
export function totalsFor(
  lines: readonly CartLine[],
  shipping: ShippingRule,
  ebooks: readonly CartEbookLine[] = [],
  courses: readonly CartCourseLine[] = [],
): OrderTotals {
  return computeTotals(totalsLinesOf(lines, ebooks, courses), shipping);
}

/** The cart priced for the viewer; an empty view if there's no cart. */
export async function readCart(
  owner: CartOwner | null,
  viewer: PricingViewer,
  shipping: ShippingRule,
  /** Site-wide discount percent (setting "pricing.discount"). */
  discountPercent = 0,
): Promise<CartView> {
  const cart = owner
    ? await db.cart.findUnique({
        where: cartWhere(owner),
        select: {
          items: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              quantity: true,
              product: { select: cartProductSelect },
              ebook: { select: cartEbookSelect },
              course: { select: cartCourseSelect },
            },
          },
        },
      })
    : null;
  const items = cart?.items ?? [];
  await sweepLapsedHolds();
  const sellable = await sellableByProduct(items.flatMap((item) => (item.product ? [item.product.id] : [])));
  const lines = items.flatMap((item) =>
    item.product
      ? [priceLine(item.product, item.quantity, viewer, sellable.get(item.product.id) ?? 0, discountPercent)]
      : [],
  );
  const ebookRows = items.flatMap((item) => (item.ebook ? [item.ebook] : []));
  const owned =
    owner?.kind === "user" && ebookRows.length > 0
      ? await ownedEbookIds(owner.userId, ebookRows.map((ebook) => ebook.id))
      : new Set<number>();
  const ebooks = ebookRows.map((ebook) => priceEbookLine(ebook, owned.has(ebook.id)));
  const courseRows = items.flatMap((item) => (item.course ? [item.course] : []));
  const enrolled =
    owner?.kind === "user" && courseRows.length > 0
      ? await enrolledCourseIds(owner.userId, courseRows.map((course) => course.id))
      : new Set<number>();
  const courses = courseRows.map((course) => priceCourseLine(course, enrolled.has(course.id)));
  return {
    lines,
    ebooks,
    courses,
    totals: totalsFor(lines, shipping, ebooks, courses),
    hasIssues:
      lines.some((line) => line.issue !== null) ||
      ebooks.some((line) => line.issue !== null) ||
      courses.some((line) => line.issue !== null),
  };
}
