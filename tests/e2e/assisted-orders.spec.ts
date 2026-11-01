import { createHash, randomBytes } from "node:crypto";
import { test, expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { assistedOrders } from "../../src/content/assisted-orders";
import { e164, e2eDb, freshEmail, freshPhone, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";
import { makeE2eProduct } from "./order-helpers";

// Orders our staff prepare for customers who call or message: staff find the
// customer and the medicines and send the link; the customer places it from
// the link (or from "Your orders"); or staff place it on the call with the
// code the customer reads back.

const admin = assistedOrders.admin;
const create = admin.create;
const detail = admin.detail;
const customer = assistedOrders.customer;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** No WCAG issues, sideways scroll or console errors on the current page. */
async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

/** A second browser window at this project's screen size. */
async function secondPage(browser: Browser, testInfo: TestInfo) {
  const { viewport, isMobile, hasTouch, userAgent } = testInfo.project.use;
  const context = await browser.newContext({ viewport, isMobile, hasTouch, userAgent });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return page;
}

/** A customer account (not signed in) with a mobile number and an email. */
async function makeE2eCustomerWithPhone(name: string) {
  const db = e2eDb();
  const type = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  return db.user.create({
    data: {
      id: randomBytes(24).toString("base64url"),
      name,
      email: freshEmail(),
      phoneNumber: e164(freshPhone()),
      userTypeId: type.id,
      termsAcceptedAt: new Date(),
    },
    select: { id: true, name: true },
  });
}

/** A saved delivery address for the customer. */
async function giveAddress(userId: string) {
  return e2eDb().address.create({
    data: {
      userId,
      name: "Asha Rao",
      phone: "+919876543210",
      line1: "Flat 4, Shanti Apartments",
      line2: "MG Road",
      city: "Pune",
      state: "MH",
      pincode: "411001",
    },
    select: { id: true },
  });
}

test("staff prepare an order and the customer places it from the link", async ({ page, browser, baseURL }, testInfo) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();

  const buyerPage = await secondPage(browser, testInfo);
  const buyerErrors = collectErrors(buyerPage);
  await useFreshIp(buyerPage);
  const buyer = await signInAs(buyerPage, baseURL!, { role: "user", name: "E2E Prepared Buyer" });
  await giveAddress(buyer.id);

  await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  await page.goto("/admin/assisted-orders");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(admin.title);
  await page.getByRole("link", { name: admin.newButton }).click();

  // 1. Find the customer.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(create.title);
  await page.getByRole("searchbox", { name: create.searchLabel }).fill(buyer.email);
  await page.getByRole("button", { name: create.search, exact: true }).click();
  await page.getByRole("link", { name: create.chooseLabel(buyer.name) }).click();
  await expect(page.getByRole("heading", { name: create.customerTitle })).toBeVisible();
  await expect(page.getByText(buyer.email)).toBeVisible();

  // 2. Add the medicine, 3 of them. 3. A message.
  const save = page.getByRole("button", { name: create.submit });
  await expect(save).toBeDisabled();
  await page.getByRole("searchbox", { name: create.productSearchLabel }).fill(product.name);
  await page.getByRole("button", { name: create.addProductLabel(product.name) }).click();
  await page.getByRole("spinbutton", { name: create.quantityLabel(product.name) }).fill("3");
  await page.getByRole("textbox", { name: create.noteLabel, exact: true }).fill("As discussed on the phone today.");
  await checkPage(page, errors);
  await save.click();

  // The order page: the link went by email and shows on their account.
  await expect(page).toHaveURL(/\/admin\/assisted-orders\/[A-Za-z0-9_-]{24}\?sent=email$/);
  await expect(page.getByRole("status").filter({ hasText: detail.sentBy(detail.channels.email) })).toBeVisible();
  await expect(page.getByText(assistedOrders.statuses.open).first()).toBeVisible();
  const link = await page.getByRole("textbox", { name: detail.linkLabel }).inputValue();
  const path = new URL(link).pathname;
  const id = path.split("/").pop()!;
  await expect(page.getByRole("link", { name: detail.whatsapp })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await checkPage(page, errors);

  // The customer sees it on "Your orders"...
  await buyerPage.goto("/orders");
  const box = buyerPage.getByRole("region", { name: customer.list.title });
  await expect(box).toBeVisible();
  await expect(box).toContainText(admin.itemCount(1));
  await box.getByRole("link").click();
  await expect(buyerPage).toHaveURL(path);

  // ...and on the link: the items, the message, then the usual checkout.
  await expect(buyerPage.getByRole("heading", { level: 1 })).toContainText(customer.titleEmphasis);
  await expect(buyerPage.getByText("As discussed on the phone today.")).toBeVisible();
  await expect(buyerPage.getByText(product.name)).toBeVisible();
  await expect(buyerPage.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();
  await checkPage(buyerPage, buyerErrors);
  await buyerPage.getByRole("button", { name: customer.placeButton }).click();
  await expect(buyerPage).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);

  const placed = await e2eDb().assistedOrder.findUniqueOrThrow({
    where: { id },
    include: { order: { include: { items: true } } },
  });
  expect(placed).toMatchObject({ status: "placed", placedBy: "customer" });
  expect(placed.order?.items.map((item) => [item.productId, item.quantity])).toEqual([[product.id, 3]]);

  // The link now says it's done, and staff see the order.
  await buyerPage.goto(path);
  await expect(buyerPage.getByRole("heading", { level: 1 })).toHaveText(customer.placedTitle);
  await page.reload();
  await expect(page.getByRole("heading", { name: detail.placedTitle })).toBeVisible();
  await expect(page.getByText(placed.order!.number)).toBeVisible();
  await buyerPage.context().close();
});

test("staff place an order on the call with the customer's code", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();
  const buyer = await makeE2eCustomerWithPhone("E2E Phone Buyer");
  await giveAddress(buyer.id);
  const staff = await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  const id = randomBytes(18).toString("base64url");
  await e2eDb().assistedOrder.create({
    data: {
      id,
      userId: buyer.id,
      createdById: staff.id,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      items: { create: { productId: product.id, quantity: 2 } },
    },
  });

  await page.goto(`/admin/assisted-orders/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(detail.title(buyer.name));
  await page.getByRole("button", { name: detail.sendCode }).click();
  await expect(page.getByText(detail.codeSent(detail.channels.email, 10))).toBeVisible();
  await checkPage(page, errors);

  // The code itself is only stored as a hash: give the order a known one.
  const code = "482913";
  await e2eDb().assistedOrder.update({
    where: { id },
    data: { codeHash: createHash("sha256").update(`${id}:${code}`).digest("hex") },
  });
  const codeBox = page.getByRole("textbox", { name: detail.codeLabel });
  await codeBox.fill("000000");
  await page.getByRole("button", { name: detail.place }).click();
  await expect(page.getByText(detail.errors.wrong_code(4)).first()).toBeVisible();
  await page.getByRole("textbox", { name: detail.codeLabel }).fill(code);
  await page.getByRole("button", { name: detail.place }).click();

  await expect(page).toHaveURL(/\/admin\/orders\/[A-Za-z0-9_-]{22}$/);
  const placed = await e2eDb().assistedOrder.findUniqueOrThrow({ where: { id }, include: { order: true } });
  expect(placed).toMatchObject({ status: "placed", placedBy: "staff", codeHash: null });
  expect(placed.order).toMatchObject({ userId: buyer.id, status: "pending_payment" });

  // The link opens only for the customer it was prepared for.
  await page.goto(`/orders/prepared/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(customer.notYoursTitle);
});
