import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { userTypeIds } from "./auth";

// Helpers for cart and checkout tests: products with known prices and
// stock, and users of each type. Expects the seeded user types and
// categories (seedDatabase).

let counter = 0;

export type TestProduct = { id: number; slug: string };

export async function makeProduct(
  db: PrismaClient,
  values: {
    mrpPaise?: number;
    professionalPricePaise?: number;
    gstRate?: number;
    stock?: number;
    moq?: number;
    active?: boolean;
    bulkTiers?: { minQuantity: number; pricePaise: number }[];
    /** Build Your Brand terms (P2.1); the product is then open for branding. */
    brand?: {
      minQty: number;
      unitPricePaise: number;
      unitLabel?: string;
      tiers?: { minQuantity: number; pricePaise: number }[];
    };
  } = {},
): Promise<TestProduct> {
  counter += 1;
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM" } });
  const slug = `test-product-${counter}-${randomBytes(3).toString("hex")}`;
  const product = await db.product.create({
    data: {
      slug,
      name: `Test product ${counter}`,
      formId: form.id,
      description: "A product made by a test.",
      packSize: "60 tablets",
      mrpPaise: values.mrpPaise ?? 32_000,
      professionalPricePaise: values.professionalPricePaise ?? 24_000,
      gstRate: values.gstRate ?? 5,
      hsnCode: "30049011",
      moq: values.moq ?? 1,
      active: values.active ?? true,
      bulkTiers: values.bulkTiers ? { create: values.bulkTiers } : undefined,
      ...(values.brand && {
        brandEligible: true,
        brandMinQty: values.brand.minQty,
        brandUnitPricePaise: values.brand.unitPricePaise,
        brandUnitLabel: values.brand.unitLabel ?? "bottles",
        brandTiers: values.brand.tiers ? { create: values.brand.tiers } : undefined,
      }),
    },
    select: { id: true, slug: true },
  });
  await giveStock(db, product.id, values.stock ?? 50);
  return product;
}

export async function makeUser(
  db: PrismaClient,
  options: {
    type?: string;
    verificationStatus?: "none" | "pending" | "approved" | "rejected";
    email?: string;
    phoneNumber?: string;
  } = {},
): Promise<string> {
  const types = await userTypeIds(db);
  const id = `user-${randomBytes(6).toString("hex")}`;
  const type = options.type ?? "customer";
  await db.user.create({
    data: {
      id,
      name: `Name ${id}`,
      email: options.email ?? `${id}@example.test`,
      phoneNumber: options.phoneNumber,
      userTypeId: types[type],
      verificationStatus: options.verificationStatus ?? (type === "customer" ? "none" : "pending"),
      termsAcceptedAt: new Date(),
    },
  });
  return id;
}

export { stockCreate } from "./stock-create";

/** Makes the product's finished-goods item with one batch of `quantity` units (no expiry). */
export async function giveStock(db: PrismaClient, productId: number, quantity: number): Promise<number> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { name: true } });
  const item = await db.stockItem.create({
    data: { kind: "finished", name: product.name, productId, onHand: quantity },
    select: { id: true },
  });
  await db.stockBatch.create({ data: { itemId: item.id, batchNo: "TEST", qtyOnHand: quantity } });
  return item.id;
}

/** Sets a product's single test batch to exactly `quantity` units (nothing held). */
export async function setStock(db: PrismaClient, productId: number, quantity: number): Promise<void> {
  const item = await db.stockItem.findUniqueOrThrow({ where: { productId }, select: { id: true } });
  await db.stockItem.update({ where: { id: item.id }, data: { onHand: quantity, reserved: 0 } });
  await db.stockBatch.updateMany({ where: { itemId: item.id }, data: { qtyOnHand: quantity, qtyReserved: 0 } });
}

/** Units on hand for the product (held units are still on hand until the sale). */
export const stockOf = async (db: PrismaClient, id: number) =>
  (await db.stockItem.findUniqueOrThrow({ where: { productId: id }, select: { onHand: true } })).onHand;

/** Address form values that pass parseAddress(). */
export const validAddress = {
  name: "Asha Rao",
  phone: "98765 43210",
  line1: "Flat 4, Shanti Apartments",
  line2: "MG Road",
  landmark: "",
  city: "Pune",
  state: "MH",
  pincode: "411001",
};
