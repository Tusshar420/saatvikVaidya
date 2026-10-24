import { stockCreate } from "../setup/stock-create";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { E2E_CONTENT_PREFIX, e2eDb } from "./auth-helpers";
import { ORDER_PHONE } from "./order-helpers";
import { ORDER_NUMBER_ALPHABET } from "../../src/lib/orders";

// Build Your Brand fixtures for the e2e specs (P2.2, P2.4): a tiny PNG and a
// paid brand order written straight into the database, as in order-helpers.ts.

/** A 1 × 1 PNG, used as the logo and as a proof. */
export const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Writes `bytes` to local storage under `key`, as the app's Storage would. */
export async function writeStorageFile(key: string, bytes: Buffer) {
  const path = resolve(process.env.STORAGE_DIR ?? "storage", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

/** A paid brand order for `userId`, with its logo file in storage. */
export async function makePaidBrandOrder(userId: string) {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const token = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const product = await db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}proof-${token}`,
      name: `E2E Proof Avaleha ${token}`,
      formId: form.id,
      description: "A product made by the label proof e2e test.",
      packSize: "250 g",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate("E2E Proof Avaleha", 2),
      brandEligible: true,
      brandMinQty: 4,
      brandUnitPricePaise: 26_000,
      brandUnitLabel: "jars",
    },
  });
  const logoKey = `brand-logos/${userId.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}/${randomBytes(16).toString("hex")}.png`;
  await writeStorageFile(logoKey, png);

  const id = randomBytes(16).toString("base64url");
  let code = "";
  for (const byte of randomBytes(8)) code += ORDER_NUMBER_ALPHABET[byte % 32];
  const number = `SV-${code}`;
  const now = new Date();
  const line = 26_000 * 8;
  const tax = Math.round((line * 5) / 105);
  await db.order.create({
    data: {
      id,
      number,
      type: "brand",
      userId,
      checkoutKey: crypto.randomUUID(),
      status: "paid",
      shipName: "Asha Rao",
      shipPhone: `+91${ORDER_PHONE}`,
      shipLine1: "Flat 4, Shanti Apartments",
      shipCity: "Pune",
      shipState: "MH",
      shipPincode: "411001",
      subtotalPaise: line,
      taxPaise: tax,
      shippingPaise: 0,
      totalPaise: line,
      paidAt: now,
      items: {
        create: {
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          packSize: "250 g",
          hsnCode: "30049011",
          gstRate: 5,
          mrpPaise: 32_000,
          unitPaise: 26_000,
          priceTier: "brand",
          quantity: 8,
          lineTotalPaise: line,
          taxPaise: tax,
        },
      },
      payments: {
        create: {
          provider: "test",
          reference: `test_${randomBytes(12).toString("hex")}`,
          amountPaise: line,
          status: "succeeded",
          attempt: 1,
          completedAt: now,
        },
      },
      brandDetails: {
        create: {
          brandName: "Asha Ayurveda",
          tagline: "Classical care",
          logoKey,
          logoName: "logo.png",
          logoContentType: "image/png",
          logoSizeBytes: png.byteLength,
          stageEvents: { create: { toStage: "awaiting_proof", actorKind: "system" } },
        },
      },
    },
  });
  return { id, number };
}
