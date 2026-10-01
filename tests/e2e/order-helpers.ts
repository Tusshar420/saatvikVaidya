import { randomBytes, randomInt } from "node:crypto";
import { ORDER_NUMBER_ALPHABET } from "../../src/lib/orders";
import { E2E_CONTENT_PREFIX, e2eDb, freshEmail } from "./auth-helpers";

// Orders for the P1.5 e2e tests, written straight into the dev database
// (the e2e process can't run the server-only checkout code). They look like
// orders placed through checkout: an address snapshot, one line with its
// GST, and a payment attempt. tests/e2e/cleanup.ts removes them with their
// e2e users and products.

/** The phone on the test orders' delivery address. */
export const ORDER_PHONE = "9876543210";

export async function makeE2eProduct(stock = 20) {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}order-${token}`,
      name: `E2E Order Vati ${token}`,
      formId: form.id,
      description: "A product made by the orders e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stock,
    },
    select: { id: true, name: true, slug: true },
  });
}

/** A customer account (not signed in) to own orders. */
export async function makeE2eCustomer(name = "E2E Buyer") {
  const db = e2eDb();
  const type = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  return db.user.create({
    data: {
      id: randomBytes(24).toString("base64url"),
      name,
      email: freshEmail(),
      userTypeId: type.id,
      termsAcceptedAt: new Date(),
    },
    select: { id: true, name: true, email: true },
  });
}

function orderNumber(): string {
  let code = "";
  for (const byte of randomBytes(8)) code += ORDER_NUMBER_ALPHABET[byte % 32];
  return `SV-${code}`;
}

/**
 * An order of `quantity` units of `product` for `userId`. Paid orders have
 * taken their stock (as completePayment does), so cancelling puts it back.
 */
export async function makeE2eOrder(options: {
  userId: string;
  product: { id: number; name: string; slug: string };
  quantity?: number;
  paid?: boolean;
  createdAt?: Date;
}) {
  const db = e2eDb();
  const quantity = options.quantity ?? 2;
  const unit = 32_000;
  const line = unit * quantity;
  const tax = Math.round((line * 5) / 105);
  const paid = options.paid ?? true;
  const id = randomBytes(16).toString("base64url");
  const number = orderNumber();
  const now = options.createdAt ?? new Date();
  await db.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        id,
        number,
        userId: options.userId,
        checkoutKey: crypto.randomUUID(),
        status: paid ? "paid" : "pending_payment",
        shipName: "Asha Rao",
        shipPhone: `+91${ORDER_PHONE}`,
        shipLine1: "Flat 4, Shanti Apartments",
        shipLine2: "MG Road",
        shipCity: "Pune",
        shipState: "MH",
        shipPincode: "411001",
        subtotalPaise: line,
        taxPaise: tax,
        shippingPaise: 8_000,
        totalPaise: line + 8_000,
        paidAt: paid ? now : null,
        createdAt: now,
        items: {
          create: {
            productId: options.product.id,
            productSlug: options.product.slug,
            productName: options.product.name,
            packSize: "60 tablets",
            hsnCode: "30049011",
            gstRate: 5,
            mrpPaise: unit,
            unitPaise: unit,
            priceTier: "mrp",
            quantity,
            lineTotalPaise: line,
            taxPaise: tax,
          },
        },
        payments: {
          create: {
            provider: "test",
            reference: `test_${randomBytes(12).toString("hex")}`,
            amountPaise: line + 8_000,
            status: paid ? "succeeded" : "created",
            attempt: 1,
            completedAt: paid ? now : null,
          },
        },
      },
    });
    if (paid) {
      await tx.product.update({
        where: { id: options.product.id },
        data: { stock: { decrement: quantity } },
      });
    }
  });
  return { id, number };
}
