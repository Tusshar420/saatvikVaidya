import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { shell } from "../../src/content/shell";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Cart, checkout and the test payment (P1.4), end to end: once ending in
// success and once in failure, then a retry that succeeds. Each test makes
// its own product (slug "e2e-...") so the seeded stock never changes;
// tests/e2e/cleanup.ts removes the products, the e2e users and their orders.

// Buttons fade between disabled and enabled; without motion, axe never sees
// one halfway.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const fields = checkout.address.fields;

/** A product with known stock, MOQ and price (₹320 MRP, 5% GST). */
async function makeProduct(options: { stock?: number; moq?: number } = {}) {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const brand = await db.brand.findFirst({ where: { active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}cart-${token}`,
      name: `E2E Cart Vati ${token}`,
      brandId: brand?.id,
      formId: form.id,
      description: "A product made by the checkout e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stock: options.stock ?? 20,
      moq: options.moq ?? 1,
    },
    select: { id: true, slug: true, name: true },
  });
}

const stockOf = async (id: number) =>
  (await e2eDb().product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;

/** The header bag's label (the link itself is hidden on phones, under the dock). */
const bag = (page: Page) => page.getByRole("banner").locator('a[href="/cart"]');

/** No WCAG issues, sideways scroll or console errors on the current page. */
async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

async function fillAddress(page: Page, values: { state: string; pincode: string }) {
  const form = page.getByRole("form", { name: checkout.address.formTitleNew });
  await form.getByLabel(fields.name).fill("Asha Rao");
  await form.getByLabel(fields.phone).fill("9876543210");
  await form.getByLabel(fields.line1).fill("Flat 4, Shanti Apartments");
  await form.getByLabel(fields.line2).fill("MG Road");
  await form.getByLabel(fields.city).fill("Pune");
  await form.getByLabel(fields.state).selectOption({ label: values.state });
  await form.getByLabel(fields.pincode).fill(values.pincode);
  await form.getByRole("button", { name: checkout.address.save }).click();
  return form;
}

test("a guest's cart moves into their account, and checkout ends in a paid order", async ({
  page,
  baseURL,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeProduct({ stock: 20 });

  // Add two to the cart as a guest.
  await page.goto(`/products/${product.slug}`);
  await page.getByRole("button", { name: cart.line.increase(product.name) }).click();
  await expect(page.getByLabel(cart.line.quantityFor(product.name))).toHaveValue("2");
  await page.getByRole("button", { name: cart.add.button }).click();
  await expect(page.getByText(cart.add.addedLine(product.name))).toBeVisible();
  await expect(bag(page)).toHaveAttribute("aria-label", shell.header.bag(1));

  // The cart prices the line and refuses to check out while stock is short.
  await page.goto("/cart");
  const items = page.getByRole("list", { name: cart.listLabel });
  await expect(items.getByRole("link", { name: product.name })).toBeVisible();
  await expect(page.getByLabel(cart.line.quantityFor(product.name))).toHaveValue("2");
  const summary = page.getByRole("region", { name: cart.summary.title });
  await expect(summary).toContainText("₹640");
  await expect(summary).toContainText("₹80"); // delivery under ₹999
  await expect(summary).toContainText("₹720");
  await checkPage(page, errors);

  await e2eDb().product.update({ where: { id: product.id }, data: { stock: 1 } });
  await page.reload();
  await expect(page.getByText(cart.issues.aboveStock(1))).toBeVisible();
  await expect(summary.getByRole("button", { name: cart.summary.checkout })).toBeDisabled();
  await e2eDb().product.update({ where: { id: product.id }, data: { stock: 20 } });
  await page.reload();

  // Guests are asked to sign in first, coming back to checkout.
  await expect(summary.getByRole("link", { name: cart.summary.signInToCheckout })).toHaveAttribute(
    "href",
    /next=%2Fcheckout/,
  );
  await signInAs(page, baseURL!, { role: "user" });
  await page.goto("/checkout");
  const orderSummary = page.getByRole("region", { name: checkout.summary.title });
  await expect(orderSummary).toContainText(product.name);
  await expect(orderSummary).toContainText(checkout.summary.quantity(2));

  // A PIN code from another state is refused; then the address saves and is picked.
  const form = await fillAddress(page, { state: "Delhi", pincode: "411001" });
  await expect(form.getByText(checkout.address.errors.pincodeState)).toBeVisible();
  await form.getByLabel(fields.state).selectOption({ label: "Maharashtra" });
  await form.getByRole("button", { name: checkout.address.save }).click();
  const choice = page.getByRole("radio", { name: /Asha Rao/ });
  await expect(choice).toBeChecked();
  // The form closes with focus on the saved address, not back at the top.
  await expect(choice).toBeFocused();
  await expect(page.getByText("Pune, Maharashtra 411001")).toBeVisible();
  await checkPage(page, errors);

  // Place the order: the test payment screen says no money is taken.
  await page.getByRole("button", { name: checkout.place.button }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);
  const payUrl = page.url();
  const orderId = payUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: checkout.pay.testTitle })).toBeVisible();
  await expect(page.getByText(checkout.pay.testBadge)).toBeVisible();
  await checkPage(page, errors);

  // A double click on "Simulate success" pays once.
  await page.getByRole("button", { name: checkout.pay.success }).dblclick();
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(checkout.confirmation.title);
  await expect(page.getByText(checkout.confirmation.testNote)).toBeVisible();
  await expect(bag(page)).toHaveAttribute("aria-label", shell.header.bag(0));
  await checkPage(page, errors);

  const order = await e2eDb().order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true, items: true },
  });
  expect(order.status).toBe("paid");
  expect(order.totalPaise).toBe(72_000);
  expect(order.payments.map((p) => [p.attempt, p.status])).toEqual([[1, "succeeded"]]);
  expect(order.items).toMatchObject([{ productId: product.id, quantity: 2, unitPaise: 32_000 }]);
  await expect(page.getByText(order.number).first()).toBeVisible();
  expect(await stockOf(product.id)).toBe(18);

  // Coming back to the payment screen can't pay again.
  await page.goto(payUrl);
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);
  expect(await stockOf(product.id)).toBe(18);
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(cart.empty.title);
});

test("a failed payment keeps cart and stock, and trying again pays the same order", async ({
  page,
  browser,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const product = await makeProduct({ stock: 10, moq: 2 });
  const buyer = await signInAs(page, baseURL!, { role: "user" });

  // The quantity starts at the MOQ and can't go below it.
  await page.goto(`/products/${product.slug}`);
  const quantity = page.getByLabel(cart.line.quantityFor(product.name));
  await expect(quantity).toHaveValue("2");
  await expect(page.getByRole("button", { name: cart.line.decrease(product.name) })).toBeDisabled();
  await page.getByRole("button", { name: cart.add.button }).click();
  await expect(page.getByText(cart.add.addedLine(product.name))).toBeVisible();

  // No saved address yet: checkout opens the form straight away.
  await page.goto("/cart");
  await page.getByRole("link", { name: cart.summary.checkout }).click();
  await expect(page).toHaveURL("/checkout");
  await expect(page.getByRole("button", { name: checkout.place.button })).toBeDisabled();
  await fillAddress(page, { state: "Maharashtra", pincode: "411001" });
  await expect(page.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();

  await page.getByRole("button", { name: checkout.place.button }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//);
  const orderId = page.url().split("/").pop()!;

  // Failure: the order waits for payment; stock and cart are untouched.
  await page.getByRole("button", { name: checkout.pay.failure }).click();
  await expect(page).toHaveURL(`/checkout/failed/${orderId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(checkout.failed.title);
  await expect(page.getByRole("link", { name: checkout.failed.backToCart })).toHaveAttribute(
    "href",
    "/cart",
  );
  await checkPage(page, errors);
  expect(await stockOf(product.id)).toBe(10);
  expect((await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
    "payment_failed",
  );
  await expect(page.getByRole("banner").locator('a[href="/cart"]')).toHaveAttribute(
    "aria-label",
    shell.header.bag(1),
  );

  // Someone else can't see the order.
  const stranger = await browser.newContext({ baseURL });
  const strangerPage = await stranger.newPage();
  await signInAs(strangerPage, baseURL!, { role: "user" });
  const response = await strangerPage.goto(`/checkout/failed/${orderId}`);
  expect(response?.status()).toBe(404);
  await stranger.close();

  // Try again: attempt 2 on the same order, then success.
  await page.getByRole("button", { name: checkout.failed.tryAgain }).click();
  await expect(page).toHaveURL(`/checkout/pay/${orderId}`);
  await expect(page.getByText(checkout.pay.attempt(2))).toBeVisible();
  await page.getByRole("button", { name: checkout.pay.success }).click();
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);

  const payments = await e2eDb().payment.findMany({ where: { orderId }, orderBy: { attempt: "asc" } });
  expect(payments.map((p) => [p.attempt, p.status])).toEqual([
    [1, "failed"],
    [2, "succeeded"],
  ]);
  expect(await stockOf(product.id)).toBe(8);
  // Retrying paid the same order rather than placing another.
  expect(await e2eDb().order.count({ where: { userId: buyer.id } })).toBe(1);
});

test("checkout needs sign-in", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL("/?auth=sign-in&next=%2Fcheckout");
});
