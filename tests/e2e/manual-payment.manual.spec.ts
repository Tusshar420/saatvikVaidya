import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import { adminSettings } from "../../src/content/admin-site";
import { admin as adminCopy } from "../../src/content/admin";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { stockCreate } from "../setup/stock-create";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Paying by QR code or bank transfer (PAYMENT_PROVIDER=manual): the admin
// sets the payment details, the customer places an order and sees them with
// a QR code, and the order stays "waiting for payment" until an admin marks
// it paid. Runs on its own server (playwright.manual.config.ts).

const g = adminSettings.groups.payment;
const fields = checkout.address.fields;

async function makeProduct() {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const brand = await db.brand.findFirst({ where: { active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}manual-${token}`,
      name: `E2E Manual Vati ${token}`,
      brandId: brand?.id,
      formId: form.id,
      description: "A product made by the manual payment e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate(`E2E Manual Vati ${token}`, 20),
      moq: 1,
    },
    select: { id: true, slug: true, name: true },
  });
}

test("the customer pays by QR or bank transfer and an admin marks the order paid", async ({ page, browser, baseURL }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectErrors(page);
  const product = await makeProduct();

  // The admin sets the payment details.
  const adminContext = await browser.newContext({ baseURL });
  const adminPage = await adminContext.newPage();
  await signInAs(adminPage, baseURL!, { role: "admin" });
  await adminPage.goto("/admin/settings");
  const form = adminPage.locator("form", { has: adminPage.getByLabel(g.upiId) });
  await form.getByLabel(g.payeeName).fill("Saatvik Vaidya Test");
  await form.getByLabel(g.upiId).fill("saatvik.test@okaxis");
  await form.getByLabel(g.bankName).fill("Test Bank");
  await form.getByLabel(g.accountNumber).fill("123456789012");
  await form.getByLabel(g.ifsc).fill("hdfc0001234");
  await form.getByLabel(g.note).fill("Pay within 24 hours.");
  await form.getByRole("button", { name: adminSettings.save }).click();
  // "Nothing changed" when an earlier run left the same details saved.
  await expect(form.getByText(new RegExp(`${adminSettings.saved}|${adminSettings.unchanged}`))).toBeVisible();

  // A bad UPI ID is refused.
  await form.getByLabel(g.upiId).fill("not a upi id");
  await form.getByRole("button", { name: adminSettings.save }).click();
  await expect(adminPage.getByText(adminSettings.errors.upi)).toBeVisible();

  // The customer orders.
  await signInAs(page, baseURL!, { role: "user" });
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

  // The button says "Place order", not "and pay"; the QR and bank details follow.
  await page.getByRole("button", { name: checkout.place.manualButton, exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);
  const orderId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: checkout.pay.manual.title })).toBeVisible();
  await expect(page.getByRole("img", { name: /UPI QR code for/ })).toBeVisible();
  await expect(page.getByText("saatvik.test@okaxis")).toBeVisible();
  await expect(page.getByText("123456789012")).toBeVisible();
  await expect(page.getByText("HDFC0001234")).toBeVisible();
  await expect(page.getByText("Pay within 24 hours.")).toBeVisible();
  // No test-payment buttons in manual mode.
  await expect(page.getByRole("button", { name: checkout.pay.success })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  const order = await e2eDb().order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  expect(order.status).toBe("pending_payment");
  expect(order.payments.map((p) => [p.provider, p.status])).toEqual([["manual", "created"]]);

  // The admin marks it paid.
  await adminPage.goto(`/admin/orders/${orderId}`);
  await adminPage.getByRole("button", { name: adminCopy.orderDetail.markPaid.button }).click();
  // The page refreshes with the order paid, so the button is gone.
  await expect(adminPage.getByRole("button", { name: adminCopy.orderDetail.markPaid.button })).toHaveCount(0);
  await expect.poll(async () => (await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");
  // The customer's payment page now goes to the confirmation.
  await page.goto(`/checkout/pay/${orderId}`);
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);
  expect(errors).toEqual([]);

  // Put the payment details back to empty so other runs start clean.
  await adminPage.goto("/admin/settings");
  const reset = adminPage.locator("form", { has: adminPage.getByLabel(g.upiId) });
  for (const label of [g.upiId, g.bankName, g.accountNumber, g.ifsc, g.note]) await reset.getByLabel(label).fill("");
  await reset.getByLabel(g.payeeName).fill("Saatvik Vaidya");
  await reset.getByRole("button", { name: adminSettings.save }).click();
  await expect(reset.getByText(new RegExp(`${adminSettings.saved}|${adminSettings.unchanged}`))).toBeVisible();
  await adminContext.close();
});
