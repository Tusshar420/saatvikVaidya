import { test, expect, type Locator, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { orders } from "../../src/content/orders";
import { shell } from "../../src/content/shell";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";
import { ORDER_PHONE, makeE2eCustomer, makeE2eOrder, makeE2eProduct } from "./order-helpers";

// Orders and test delivery tracking (P1.5): the buyer's order history, the
// admin moving a shipment through every step, and the buyer following each
// step on /track (and in the Track Order modal). Orders are written straight
// into the database (tests/e2e/order-helpers.ts); cleanup removes them.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const detail = admin.orderDetail;
const track = orders.track;
const main = (page: Page) => page.getByRole("main");

/** No WCAG issues, sideways scroll or console errors on the current page. */
async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

/** The step marked current on a timeline, or none when all are done. */
const currentStep = (timeline: Locator) => timeline.locator('[aria-current="step"]');

test("the buyer sees their orders, newest first, and opens one", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();
  const buyer = await signInAs(page, baseURL!, { role: "user", name: "E2E History Buyer" });
  const older = await makeE2eOrder({
    userId: buyer.id,
    product,
    createdAt: new Date(Date.now() - 3 * 24 * 3600_000),
  });
  const unpaid = await makeE2eOrder({ userId: buyer.id, product, paid: false, quantity: 1 });
  const stranger = await makeE2eCustomer();
  const theirs = await makeE2eOrder({ userId: stranger.id, product });

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(orders.list.title);
  const list = page.getByRole("list", { name: orders.list.listLabel });
  const cards = list.getByRole("listitem");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText(unpaid.number);
  await expect(cards.nth(0)).toContainText(orders.status.pending_payment);
  await expect(cards.nth(0).getByRole("link", { name: orders.list.payNow })).toHaveAttribute(
    "href",
    `/checkout/pay/${unpaid.id}`,
  );
  await expect(cards.nth(1)).toContainText(older.number);
  await expect(cards.nth(1)).toContainText(orders.status.paid);
  await expect(cards.nth(1)).toContainText("₹720");
  await expect(list).not.toContainText(theirs.number);
  await checkPage(page, errors);

  // The order page: timeline, address, payment and items.
  await cards.nth(1).getByRole("link", { name: orders.list.viewLabel(older.number) }).click();
  await expect(page).toHaveURL(`/orders/${older.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(older.number);
  const timeline = page.getByRole("list", { name: orders.tracking.timelineLabel(older.number) });
  await expect(timeline.getByRole("listitem")).toHaveCount(6);
  await expect(currentStep(timeline)).toContainText(orders.steps.packed);
  await expect(main(page).getByText(orders.tracking.notShipped)).toBeVisible();
  await expect(main(page).getByText("Pune, Maharashtra 411001")).toBeVisible();
  await expect(main(page).getByText(orders.detail.testNote)).toBeVisible();
  await expect(main(page).getByText(product.name)).toBeVisible();
  await checkPage(page, errors);

  // Someone else's order is not found; the list link is back to all orders.
  const response = await page.goto(`/orders/${theirs.id}`);
  expect(response?.status()).toBe(404);
  await page.goto(`/orders/${older.id}`);
  await page.getByRole("link", { name: orders.detail.back }).click();
  await expect(page).toHaveURL("/orders");
});

test("the admin moves a shipment through every step and the buyer sees each one", async ({
  page,
  baseURL,
  browser,
}) => {
  test.setTimeout(120_000);
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();
  const buyer = await makeE2eCustomer();
  const order = await makeE2eOrder({ userId: buyer.id, product });
  await signInAs(page, baseURL!, { role: "admin" });

  // Find the order in the list.
  await page.goto("/admin/orders");
  await main(page).getByRole("searchbox", { name: admin.orders.searchLabel }).fill(order.number);
  await main(page).getByRole("button", { name: admin.common.filter }).click();
  const row = main(page).getByRole("row").filter({ hasText: order.number });
  await expect(row).toContainText(admin.orders.statuses.paid);
  await checkPage(page, errors);
  await row.getByRole("link", { name: admin.orders.viewLabel(order.number) }).click();
  await expect(page).toHaveURL(`/admin/orders/${order.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(order.number);

  // The buyer, on another device, looks the order up before it ships.
  const buyerContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    extraHTTPHeaders: { "x-forwarded-for": `10.99.${Math.floor(Math.random() * 256)}.7` },
  });
  const buyerPage = await buyerContext.newPage();
  await buyerPage.emulateMedia({ reducedMotion: "reduce" });
  await buyerPage.goto("/track");
  await buyerPage.getByRole("textbox", { name: track.number }).fill(order.number.toLowerCase());
  await buyerPage.getByRole("textbox", { name: track.contact }).fill(ORDER_PHONE);
  await buyerPage.getByRole("button", { name: track.submit }).click();
  const result = buyerPage.getByRole("heading", { name: track.resultTitle(order.number) });
  await expect(result).toBeFocused();
  const timeline = buyerPage.getByRole("list", { name: orders.tracking.timelineLabel(order.number) });
  await expect(currentStep(timeline)).toContainText(orders.steps.packed);
  await expect(buyerPage.getByText(orders.tracking.notShipped)).toBeVisible();
  const buyerErrors = collectErrors(buyerPage);
  expect(await axeViolations(buyerPage)).toEqual([]);

  // Create the shipment: a simulated courier and AWB.
  const shipment = main(page).getByRole("region", { name: detail.shipmentTitle, exact: true });
  await shipment.getByRole("button", { name: detail.createShipment }).click();
  await expect(shipment.getByRole("status")).toHaveText(detail.results.created);
  const awb = (await e2eDb().shipment.findUniqueOrThrow({ where: { orderId: order.id } })).awb;
  await expect(shipment).toContainText(awb);
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(
    admin.orders.statuses.processing,
  );
  await checkPage(page, errors);

  // Each step, as the admin moves it on and as the buyer sees it.
  const history = buyerPage.getByRole("list", { name: orders.tracking.historyLabel });
  const steps = [
    { step: "packed", current: orders.steps.shipped },
    { step: "shipped", current: orders.steps.in_transit },
    { step: "in_transit", current: orders.steps.out_for_delivery },
    { step: "out_for_delivery", current: orders.steps.delivered },
    { step: "delivered", current: null },
  ] as const;
  for (const { step, current } of steps) {
    const label = orders.shipmentStatus[step];
    await shipment.getByRole("button", { name: detail.simulateNext(label) }).click();
    await expect(shipment.getByRole("status")).toHaveText(detail.results.moved(label));

    await buyerPage.getByRole("button", { name: track.again }).click();
    await expect(history.getByRole("listitem").first()).toContainText(label);
    if (current) await expect(currentStep(timeline)).toContainText(current);
    else await expect(currentStep(timeline)).toHaveCount(0);
  }
  await expect(buyerPage.getByText(orders.tracking.delivered)).toBeVisible();
  await expect(buyerPage.getByText(awb)).toBeVisible();
  await expect(history.getByRole("listitem")).toHaveCount(6);
  expect(await horizontalOverflow(buyerPage)).toBeLessThanOrEqual(0);
  expect(await axeViolations(buyerPage)).toEqual([]);
  expect(buyerErrors).toEqual([]);

  // Delivered: nothing more to simulate, and the order can't be cancelled.
  await expect(shipment).toContainText(detail.finished);
  await expect(main(page).getByText(detail.cancelNotAllowed)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(
    admin.orders.statuses.delivered,
  );
  const events = await e2eDb().shipmentEvent.findMany({
    where: { shipment: { orderId: order.id } },
    orderBy: { id: "asc" },
  });
  expect(events.map((event) => event.status)).toEqual([
    "created",
    "packed",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
  ]);
  await checkPage(page, errors);

  // The Track Order modal shows the same, from the footer of any page.
  await buyerPage.goto("/");
  await buyerPage
    .getByRole("contentinfo")
    .getByRole("button", { name: shell.footer.trackOrder })
    .click();
  const dialog = buyerPage.getByRole("dialog", { name: shell.trackOrder.title });
  await dialog.getByRole("textbox", { name: track.number }).fill(order.number);
  await dialog.getByRole("textbox", { name: track.contact }).fill(`+91 ${ORDER_PHONE}`);
  await dialog.getByRole("button", { name: track.submit }).click();
  await expect(dialog.getByRole("heading", { name: track.resultTitle(order.number) })).toBeVisible();
  await expect(dialog.getByText(orders.tracking.delivered)).toBeVisible();
  expect(await axeViolations(buyerPage)).toEqual([]);
  await buyerContext.close();
});

test("tracking never says whether an order exists for wrong details", async ({ page }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();
  const buyer = await makeE2eCustomer();
  const order = await makeE2eOrder({ userId: buyer.id, product });

  await page.goto("/track");
  const number = page.getByRole("textbox", { name: track.number });
  const contact = page.getByRole("textbox", { name: track.contact });
  const submit = page.getByRole("button", { name: track.submit });

  // Bad input points at the field.
  await number.fill("12");
  await contact.fill(ORDER_PHONE);
  await submit.click();
  await expect(page.getByText(track.errors.number)).toBeVisible();
  await expect(number).toHaveAttribute("aria-invalid", "true");

  // A real order with the wrong phone, and a made-up order: the same answer.
  await number.fill(order.number);
  await contact.fill("9000000001");
  await submit.click();
  await expect(main(page).getByRole("alert")).toHaveText(track.errors.notFound);
  await number.fill("SV-00000000");
  await contact.fill(ORDER_PHONE);
  await submit.click();
  await expect(main(page).getByRole("alert")).toHaveText(track.errors.notFound);
  await checkPage(page, errors);
});

test("the admin cancels a paid order and its stock goes back", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const product = await makeE2eProduct(20);
  const buyer = await makeE2eCustomer();
  const order = await makeE2eOrder({ userId: buyer.id, product, quantity: 3 });
  const stock = async () =>
    (await e2eDb().product.findUniqueOrThrow({ where: { id: product.id } })).stock;
  expect(await stock()).toBe(17);
  await signInAs(page, baseURL!, { role: "admin" });

  await page.goto(`/admin/orders/${order.id}`);
  await main(page).getByRole("button", { name: detail.cancel }).click();
  const dialog = page.getByRole("dialog", { name: detail.cancelConfirmTitle(order.number) });
  await expect(dialog).toContainText(detail.cancelConfirmBody(true));
  await dialog.getByLabel(detail.cancelNote).fill("Customer asked");
  await dialog.getByRole("button", { name: detail.cancelConfirm }).click();
  await expect(main(page).getByRole("status")).toHaveText(detail.cancelled(true));
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(
    admin.orders.statuses.cancelled,
  );
  await expect(main(page).getByRole("button", { name: detail.cancel })).toHaveCount(0);
  expect(await stock()).toBe(20);
  await expect(main(page).getByText(admin.activity.actions["order.cancel"]!)).toBeVisible();
});
