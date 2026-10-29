import { readFile } from "node:fs/promises";
import { test, expect, type Download, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { invoices } from "../../src/content/invoices";
import { orders } from "../../src/content/orders";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";
import { makeE2eCustomer, makeE2eOrder, makeE2eProduct } from "./order-helpers";

// GST invoices (P1.6): who may download an order's invoice and credit note.
// The buyer and admins get the PDF; guests, other users, unpaid orders and
// orders that weren't cancelled after payment get the same 404. Orders are
// written straight into the database (tests/e2e/order-helpers.ts), so their
// invoice is made on first download, as for a paid order whose invoice
// couldn't be made at payment time.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const links = invoices.links;
const detail = admin.orderDetail;
const main = (page: Page) => page.getByRole("main");
const invoiceNumber = /^SV\/\d\d-\d\d\/\d{5}$/;
const creditNoteNumber = /^CN\/\d\d-\d\d\/\d{5}$/;

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

/** Clicks a download link and checks a PDF arrives; returns its file name. */
async function downloadPdf(page: Page, name: string): Promise<string> {
  const [download]: [Download, void] = await Promise.all([
    page.waitForEvent("download"),
    main(page).getByRole("link", { name }).click(),
  ]);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  return download.suggestedFilename();
}

const numberOf = async (orderId: string, kind: "invoice" | "credit_note") =>
  (await e2eDb().invoice.findUnique({ where: { orderId_kind: { orderId, kind } } }))?.number ?? null;

test("the buyer downloads their invoice; guests, other users and unpaid orders get nothing", async ({
  page,
  baseURL,
  request,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();
  const buyer = await signInAs(page, baseURL!, { role: "user", name: "E2E Invoice Buyer" });
  const paid = await makeE2eOrder({ userId: buyer.id, product });
  const unpaid = await makeE2eOrder({ userId: buyer.id, product, paid: false, quantity: 1 });
  const stranger = await makeE2eCustomer();
  const theirs = await makeE2eOrder({ userId: stranger.id, product });

  // The order page offers the invoice; its number comes with the first download.
  await page.goto(`/orders/${paid.id}`);
  const card = main(page).getByRole("region", { name: links.title });
  await expect(card).toContainText(links.invoice);
  await expect(card).toContainText(links.pending);
  await expect(card).not.toContainText(links.creditNote);
  await checkPage(page, errors);
  const fileName = await downloadPdf(page, links.downloadLabel(links.invoice, paid.number));
  const number = await numberOf(paid.id, "invoice");
  expect(number).toMatch(invoiceNumber);
  expect(fileName).toBe(`Invoice ${number!.replaceAll("/", "-")}.pdf`);
  await page.reload();
  await expect(card).toContainText(links.numbered(number!));

  // Downloading again gives the same invoice.
  await downloadPdf(page, links.downloadLabel(links.invoice, paid.number));
  expect(await e2eDb().invoice.count({ where: { orderId: paid.id } })).toBe(1);

  // No credit note for an order that wasn't cancelled.
  expect((await page.request.get(`/api/orders/${paid.id}/credit-note`)).status()).toBe(404);

  // An unpaid order says when the invoice will be ready, and has none.
  await page.goto(`/orders/${unpaid.id}`);
  await expect(main(page).getByRole("region", { name: links.title })).toContainText(links.unpaid);
  await expect(main(page).getByRole("link", { name: /\(PDF\)$/ })).toHaveCount(0);
  await checkPage(page, errors);
  expect((await page.request.get(`/api/orders/${unpaid.id}/invoice`)).status()).toBe(404);

  // Someone else's order, a made-up id, and a guest: the same 404, no PDF.
  for (const path of [`/api/orders/${theirs.id}/invoice`, `/api/orders/${"x".repeat(22)}/invoice`]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).not.toContain("pdf");
  }
  const guest = await request.get(`/api/orders/${paid.id}/invoice`, { maxRedirects: 0 });
  expect(guest.status()).toBe(404);
  // Looking didn't make an invoice for the stranger's order.
  expect(await numberOf(theirs.id, "invoice")).toBeNull();
});

test("an admin downloads the invoice, and cancelling the paid order adds a credit note for both", async ({
  page,
  baseURL,
  browser,
}) => {
  test.setTimeout(120_000);
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeE2eProduct();

  // The buyer, signed in on their own device.
  const buyerContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    extraHTTPHeaders: { "x-forwarded-for": `10.98.${Math.floor(Math.random() * 256)}.9` },
  });
  const buyerPage = await buyerContext.newPage();
  await buyerPage.emulateMedia({ reducedMotion: "reduce" });
  const buyer = await signInAs(buyerPage, baseURL!, { role: "user", name: "E2E Credit Buyer" });
  const order = await makeE2eOrder({ userId: buyer.id, product });

  await signInAs(page, baseURL!, { role: "admin" });
  await page.goto(`/admin/orders/${order.id}`);
  const card = main(page).getByRole("region", { name: links.title });
  await expect(card).toContainText(links.invoice);
  await checkPage(page, errors);
  const invoiceFile = await downloadPdf(page, links.downloadLabel(links.invoice, order.number));
  expect(invoiceFile).toMatch(/^Invoice SV-\d\d-\d\d-\d{5}\.pdf$/);

  // Cancel the paid order: a credit note reverses the invoice.
  await main(page).getByRole("button", { name: detail.cancel }).click();
  const dialog = page.getByRole("dialog", { name: detail.cancelConfirmTitle(order.number) });
  await dialog.getByRole("button", { name: detail.cancelConfirm }).click();
  await expect(main(page).getByRole("status")).toHaveText(detail.cancelled(true));
  const creditNote = await numberOf(order.id, "credit_note");
  expect(creditNote).toMatch(creditNoteNumber);
  await page.reload();
  await expect(card).toContainText(links.numbered(creditNote!));
  await expect(card).toContainText(links.creditNoteNote);
  await checkPage(page, errors);
  const noteFile = await downloadPdf(page, links.downloadLabel(links.creditNote, order.number));
  expect(noteFile).toBe(`Credit note ${creditNote!.replaceAll("/", "-")}.pdf`);

  // The buyer sees and downloads both.
  await buyerPage.goto(`/orders/${order.id}`);
  await expect(buyerPage.getByRole("main")).toContainText(orders.status.cancelled);
  const buyerCard = buyerPage.getByRole("main").getByRole("region", { name: links.title });
  await expect(buyerCard).toContainText(links.numbered(creditNote!));
  await downloadPdf(buyerPage, links.downloadLabel(links.creditNote, order.number));
  await downloadPdf(buyerPage, links.downloadLabel(links.invoice, order.number));
  expect(await e2eDb().invoice.count({ where: { orderId: order.id } })).toBe(2);
  await buyerContext.close();
});
