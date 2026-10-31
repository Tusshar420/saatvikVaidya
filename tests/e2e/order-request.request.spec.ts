import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import { admin as adminCopy } from "../../src/content/admin";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { orders as ordersCopy } from "../../src/content/orders";
import { stockCreate } from "../setup/stock-create";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Order request (PAYMENT_PROVIDER=request): the customer places an order, sees
// no payment options, and the order stays "waiting for payment" until an
// admin marks it paid after the team has been in touch. The admin then
// records the courier the team booked and marks each delivery step
// (SHIPPING_PROVIDER=manual). Runs on its own server
// (playwright.request.config.ts).

const fields = checkout.address.fields;

async function makeProduct() {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const brand = await db.brand.findFirst({ where: { active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}request-${token}`,
      name: `E2E Request Vati ${token}`,
      brandId: brand?.id,
      formId: form.id,
      description: "A product made by the request e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate(`E2E Request Vati ${token}`, 20),
      moq: 1,
    },
    select: { id: true, slug: true, name: true },
  });
}

test("the customer places an order with no payment options and an admin marks it paid later", async ({ page, browser, baseURL }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectErrors(page);
  const product = await makeProduct();

  const customer = await signInAs(page, baseURL!, { role: "user" });
  await page.goto(`/products/${product.slug}`);
  await page.getByRole("button", { name: cart.add.button }).click();
  await expect(page.getByText(cart.add.addedLine(product.name))).toBeVisible();
  await page.goto("/checkout");
  const address = page.getByRole("form", { name: checkout.address.formTitleNew });
  await address.getByLabel(fields.name).fill("Asha Rao");
  await address.getByLabel(fields.phone).fill("9876543210");
  await address.getByLabel(fields.line1).fill("Flat 4, Shanti Apartments");
  await address.getByLabel(fields.city).fill("Pune");
  await address.getByLabel(fields.state).selectOption({ label: "Maharashtra" });
  await address.getByLabel(fields.pincode).fill("411001");
  await address.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();
  await expect(page.getByText(checkout.place.requestNote)).toBeVisible();

  await page.getByRole("button", { name: checkout.place.manualButton, exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);
  const orderId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: checkout.pay.request.pageTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: checkout.pay.request.title })).toBeVisible();
  // No payment options of any kind.
  await expect(page.getByRole("img", { name: /UPI QR code/ })).toHaveCount(0);
  await expect(page.getByText(checkout.pay.manual.upiId)).toHaveCount(0);
  await expect(page.getByRole("button", { name: checkout.pay.success })).toHaveCount(0);
  expect(await e2eDb().cartItem.count({ where: { cart: { userId: customer.id } } })).toBe(0);
  await expect(page.getByRole("link", { name: checkout.pay.manual.viewOrders })).toHaveAttribute("href", "/orders");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  const order = await e2eDb().order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  expect(order.status).toBe("pending_payment");
  expect(order.payments.map((p) => [p.provider, p.status])).toEqual([["request", "created"]]);

  // After the team has been in touch, an admin marks it paid.
  const adminContext = await browser.newContext({ baseURL });
  const adminPage = await adminContext.newPage();
  await signInAs(adminPage, baseURL!, { role: "admin" });
  await adminPage.goto(`/admin/orders/${orderId}`);
  await adminPage.getByRole("button", { name: adminCopy.orderDetail.markPaid.button }).click();
  await expect(adminPage.getByRole("button", { name: adminCopy.orderDetail.markPaid.button })).toHaveCount(0);
  await expect.poll(async () => (await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");

  // The team books the courier itself, types it in and moves each step on.
  const detail = adminCopy.orderDetail;
  const adminErrors = collectErrors(adminPage);
  await adminPage.reload();
  const shipment = adminPage.getByRole("region", { name: detail.shipmentTitle, exact: true });
  await expect(shipment.getByText(detail.manualIntro)).toBeVisible();
  await shipment.getByLabel(detail.manualTracking).fill("bad tracking!");
  await shipment.getByRole("button", { name: detail.createShipment }).click();
  await expect(shipment.getByRole("alert")).toHaveText(detail.results.invalid_details);
  const trackingNumber = `E2E${Date.now()}${randomInt(1_000)}`;
  await shipment.getByLabel(detail.manualCourier).fill("DTDC");
  await shipment.getByLabel(detail.manualTracking).fill(trackingNumber);
  expect(await horizontalOverflow(adminPage)).toBeLessThanOrEqual(0);
  expect(await axeViolations(adminPage)).toEqual([]);
  await shipment.getByRole("button", { name: detail.createShipment }).click();
  await expect(shipment.getByRole("status")).toHaveText(detail.results.created);
  await expect(shipment).toContainText("DTDC");
  await expect(shipment).toContainText(trackingNumber);
  for (const step of ["packed", "shipped", "in_transit", "out_for_delivery", "delivered"] as const) {
    const label = ordersCopy.shipmentStatus[step];
    await shipment.getByRole("button", { name: detail.markStep(label) }).click();
    await expect(shipment.getByRole("status")).toHaveText(detail.results.moved(label));
  }
  await expect(shipment).toContainText(detail.finished);
  expect(await horizontalOverflow(adminPage)).toBeLessThanOrEqual(0);
  expect(await axeViolations(adminPage)).toEqual([]);
  expect((await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("delivered");
  await adminContext.close();
  expect(adminErrors).toEqual([]);

  // The buyer sees the real courier and tracking number, with no "test delivery" note.
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText(trackingNumber)).toBeVisible();
  await expect(page.getByText("DTDC")).toBeVisible();
  await expect(page.getByText(ordersCopy.tracking.testCourier)).toHaveCount(0);
  await expect(page.getByText(ordersCopy.tracking.delivered)).toBeVisible();
  expect(errors).toEqual([]);
});
