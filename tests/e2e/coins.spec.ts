import { stockCreate } from "../setup/stock-create";
import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { coins } from "../../src/content/coins";
import { settingDefaults } from "../../src/content/settings";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Super Coins (P1.7), end to end: using coins at checkout, getting them back
// after a failed payment, and the admin's rules and adjustments. Each test
// makes its own product and user; tests/e2e/cleanup.ts removes them (a
// user's coin rows go with the user).

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const fields = checkout.address.fields;

async function makeProduct() {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}coins-${token}`,
      name: `E2E Coins Vati ${token}`,
      formId: form.id,
      description: "A product made by the coins e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate("E2E Coins Vati", 20),
    },
    select: { id: true, slug: true, name: true },
  });
}

const giveCoins = (userId: string, amount: number) =>
  e2eDb().coinLedger.create({ data: { userId, amount, reason: "admin_adjust", note: "e2e start" } });

const balanceOf = async (userId: string) =>
  (await e2eDb().coinLedger.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? 0;

/** Two of the product in the cart, a saved address, and the checkout page open. */
async function openCheckout(page: Page, product: { slug: string; name: string }) {
  await page.goto(`/products/${product.slug}`);
  await page.getByRole("button", { name: cart.line.increase(product.name) }).click();
  await page.getByRole("button", { name: cart.add.button }).click();
  await expect(page.getByText(cart.add.addedLine(product.name))).toBeVisible();
  await page.goto("/checkout");
  const form = page.getByRole("form", { name: checkout.address.formTitleNew });
  await form.getByLabel(fields.name).fill("Asha Rao");
  await form.getByLabel(fields.phone).fill("9876543210");
  await form.getByLabel(fields.line1).fill("Flat 4, Shanti Apartments");
  await form.getByLabel(fields.city).fill("Pune");
  await form.getByLabel(fields.state).selectOption({ label: "Maharashtra" });
  await form.getByLabel(fields.pincode).fill("411001");
  await form.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();
}

test("coins are used at checkout within the limits, shown on /coins, and returned after a failed payment", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const product = await makeProduct();
  const buyer = await signInAs(page, baseURL!, { role: "user" });
  await giveCoins(buyer.id, 1_000);

  await page.goto("/coins");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(coins.title);
  await expect(page.getByText(coins.balance.coins(1_000), { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  await openCheckout(page, product);
  const summary = page.getByRole("region", { name: checkout.summary.title });
  // ₹640 + ₹80 delivery; 20% of ₹640 allows 1,280 coins, so all 1,000 (₹100) can be used.
  await expect(summary).toContainText("₹720");
  const useCoins = page.getByRole("checkbox", { name: /Use 1,000 coins/ });
  await expect(useCoins).not.toBeChecked();
  await useCoins.check();
  await expect(summary).toContainText(coins.order.row);
  await expect(summary).toContainText("₹620");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // Place the order: the coins are held straight away.
  await page.getByRole("button", { name: checkout.place.button }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//);
  const orderId = page.url().split("/").pop()!;
  const placed = await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } });
  expect(placed).toMatchObject({ coinsRedeemed: 1_000, coinDiscountPaise: 10_000, totalPaise: 62_000 });
  expect(await balanceOf(buyer.id)).toBe(0);

  // A failed payment gives them back; "Try again" takes them again.
  await page.getByRole("button", { name: checkout.pay.failure }).click();
  await expect(page).toHaveURL(`/checkout/failed/${orderId}`);
  expect(await balanceOf(buyer.id)).toBe(1_000);
  await page.getByRole("button", { name: checkout.failed.tryAgain }).click();
  await expect(page).toHaveURL(`/checkout/pay/${orderId}`);
  expect(await balanceOf(buyer.id)).toBe(0);
  await page.getByRole("button", { name: checkout.pay.success }).click();
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);
  await expect(page.getByText(coins.order.row)).toBeVisible();

  // The history lists both moves; the order earns its coins only after delivery.
  await page.goto("/coins");
  await expect(page.getByText(coins.balance.coins(0), { exact: true })).toBeVisible();
  const history = page.getByRole("list", { name: coins.history.title });
  // Used on the first attempt, returned, then used again on the retry.
  await expect(history.getByText(coins.history.reason.redeem(placed.number))).toHaveCount(2);
  await expect(history.getByText(coins.history.reason.redeem_return(placed.number))).toBeVisible();
  await expect(history.getByText(coins.history.reason.admin_adjust("e2e start"))).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("checkout offers no coin option without a balance, and /coins explains the rules when signed out", async ({
  page,
  baseURL,
}) => {
  await page.goto("/coins");
  await expect(page.getByText(coins.signedOutLine)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  const product = await makeProduct();
  await signInAs(page, baseURL!, { role: "user" });
  await openCheckout(page, product);
  await expect(page.getByRole("checkbox", { name: /coins/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: checkout.place.button })).toBeEnabled();
});

test("an admin adjusts a user's coins with a reason and edits the rules", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const db = e2eDb();
  const customer = await signInAs(page, baseURL!, { role: "user", name: "E2E Coin Customer" });
  await signInAs(page, baseURL!, { role: "admin" });
  const text = admin.userDetail.coins;

  await page.goto(`/admin/users/${customer.id}`);
  const adjust = page.getByRole("heading", { name: text.adjustTitle }).locator("..");
  await adjust.getByLabel(text.amountLabel).fill("500");
  await adjust.getByRole("button", { name: text.submit }).click();
  // The reason is required.
  await expect(adjust.getByText(text.errors.note)).toBeVisible();
  await adjust.getByLabel(text.noteLabel).fill("Goodwill for a late parcel");
  await adjust.getByRole("button", { name: text.submit }).click();
  await expect(adjust.getByText(text.saved("500"))).toBeVisible();
  expect(await balanceOf(customer.id)).toBe(500);
  expect(
    await db.adminLog.count({ where: { action: "coins.adjust", resourceId: customer.id } }),
  ).toBe(1);

  // Taking away more than the balance is refused.
  await adjust.getByLabel(text.amountLabel).fill("-501");
  await adjust.getByLabel(text.noteLabel).fill("Too much");
  await adjust.getByRole("button", { name: text.submit }).click();
  await expect(adjust.getByText(text.errors.insufficient)).toBeVisible();
  expect(await balanceOf(customer.id)).toBe(500);
  expect(await axeViolations(page)).toEqual([]);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // The rules page saves, and shows the new value to customers.
  await page.goto("/admin/coins");
  const original = settingDefaults["coins.rules"];
  try {
    const expiry = page.getByLabel(admin.coins.fields.expiryMonths);
    await expect(expiry).toHaveValue(String(original.expiryMonths));
    await expiry.fill("48");
    await page.getByRole("button", { name: admin.coins.save }).click();
    await expect(page.getByText(admin.coins.saved)).toBeVisible();
    const stored = await db.setting.findUniqueOrThrow({ where: { key: "coins.rules" } });
    expect(stored.value).toMatchObject({ expiryMonths: 48 });

    // An out-of-range value is refused.
    await expiry.fill("999");
    await page.getByRole("button", { name: admin.coins.save }).click();
    await expect(page.getByText(admin.coins.errors.form)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  } finally {
    await db.setting.update({ where: { key: "coins.rules" }, data: { value: original } });
  }
  expect(errors).toEqual([]);
});
