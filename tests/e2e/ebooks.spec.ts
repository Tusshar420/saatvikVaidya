import { randomBytes, randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { ebooks } from "../../src/content/ebooks";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Ebooks (P1.8), end to end: who can download (guest, free, paid non-buyer,
// buyer), buying a paid ebook through the cart and the test payment, and
// the admin's ebooks with their uploads and download switches. Ebooks made
// here have "e2e-" slugs; tests/e2e/cleanup.ts removes them and their files.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const pdf = Buffer.from("%PDF-1.4\n% e2e ebook\n%%EOF\n");
// A 1×1 PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const token = () => `${Date.now().toString(36)}${randomInt(10_000)}`;

/** An ebook with a PDF in the dev storage folder, as an admin upload leaves it. */
async function makeEbook(options: { free: boolean; title?: string }) {
  const db = e2eDb();
  const id = token();
  const ebook = await db.ebook.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}ebook-${id}`,
      title: options.title ?? `E2E ${options.free ? "Free" : "Paid"} Ebook ${id}`,
      description: "An ebook made by the ebooks e2e test.\nSecond line.",
      isFree: options.free,
      pricePaise: options.free ? 0 : 19_900,
      gstRate: 18,
    },
  });
  const fileKey = `ebooks/${ebook.id}/${randomBytes(16).toString("hex")}.pdf`;
  const path = resolve(process.env.STORAGE_DIR ?? "storage", fileKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, pdf);
  return db.ebook.update({
    where: { id: ebook.id },
    data: { fileKey, fileName: "E2E book.pdf", fileSizeBytes: pdf.byteLength },
  });
}

const downloadHref = (id: number) => `/api/ebooks/${id}/download`;

/**
 * Opens a page and waits for its download button. The desktop admin test
 * pauses downloads site-wide for a moment, so reload until they're on.
 */
async function openWithDownload(page: Page, url: string, title: string) {
  const button = page.getByRole("link", { name: ebooks.actions.downloadLabel(title) });
  await expect(async () => {
    await page.goto(url);
    await expect(button).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return button;
}

async function downloadFrom(page: Page, link: ReturnType<Page["getByRole"]>) {
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe("E2E book.pdf");
}

const fields = checkout.address.fields;

test("guests sign in for free ebooks; a signed-in reader downloads a free one but not a paid one", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const free = await makeEbook({ free: true });
  const paid = await makeEbook({ free: false });

  await page.goto("/ebooks");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(ebooks.title);
  const list = page.getByRole("list", { name: ebooks.listLabel });
  const freeCard = list.getByRole("listitem").filter({ hasText: free.title });
  const paidCard = list.getByRole("listitem").filter({ hasText: paid.title });
  await expect(freeCard.getByRole("link", { name: ebooks.actions.signIn })).toBeVisible();
  await expect(paidCard.getByText("₹199")).toBeVisible();
  await expect(paidCard.getByRole("button", { name: new RegExp(ebooks.actions.addToCart) })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // Never a public URL: a guest gets 404 for both files.
  expect((await page.request.get(downloadHref(free.id))).status()).toBe(404);
  expect((await page.request.get(downloadHref(paid.id))).status()).toBe(404);

  await signInAs(page, baseURL!, { role: "user" });
  const download = await openWithDownload(page, `/ebooks/${free.slug}`, free.title);
  await expect(page.getByText(ebooks.free, { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  await downloadFrom(page, download);

  // The paid ebook: no download link, and the route refuses a non-buyer.
  await page.goto(`/ebooks/${paid.slug}`);
  await expect(page.getByRole("button", { name: new RegExp(ebooks.actions.addToCart) })).toBeVisible();
  await expect(page.getByRole("link", { name: ebooks.actions.downloadLabel(paid.title) })).toHaveCount(0);
  expect((await page.request.get(downloadHref(paid.id))).status()).toBe(404);
  expect(errors).toEqual([]);
});

test("a paid ebook is bought through the cart and test payment, then downloads from /ebooks, the account and the order", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const paid = await makeEbook({ free: false });
  await signInAs(page, baseURL!, { role: "user" });

  await page.goto(`/ebooks/${paid.slug}`);
  await page.getByRole("button", { name: new RegExp(ebooks.actions.addToCart) }).click();
  await expect(page.getByText(ebooks.actions.inCart)).toBeVisible();

  await page.goto("/cart");
  const ebookList = page.getByRole("list", { name: cart.ebook.listLabel });
  await expect(ebookList.getByText(paid.title)).toBeVisible();
  await expect(ebookList.getByText(cart.ebook.note)).toBeVisible();
  // Nothing to deliver: no delivery charge.
  const summary = page.getByRole("region", { name: cart.summary.title });
  await expect(summary).toContainText(cart.summary.free);
  await expect(summary).toContainText("₹199");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

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
  await page.getByRole("button", { name: checkout.place.button }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//);
  const orderId = page.url().split("/").pop()!;
  await page.getByRole("button", { name: checkout.pay.success }).click();
  await expect(page).toHaveURL(`/checkout/confirmation/${orderId}`);
  const order = await e2eDb().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  expect(order).toMatchObject({ status: "paid", shippingPaise: 0, totalPaise: 19_900 });
  expect(order.items).toMatchObject([{ kind: "ebook", ebookId: paid.id, hsnCode: "998431" }]);

  // Now a buyer: the download works from the ebook page...
  const fromPage = await openWithDownload(page, `/ebooks/${paid.slug}`, paid.title);
  await expect(page.getByText(ebooks.owned, { exact: true })).toBeVisible();
  await downloadFrom(page, fromPage);

  // ...from the account...
  const fromAccount = await openWithDownload(page, "/account", paid.title);
  await expect(page.getByRole("heading", { name: ebooks.account.title })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  await downloadFrom(page, fromAccount);

  // ...and from the order, which has no delivery timeline.
  await openWithDownload(page, `/orders/${orderId}`, paid.title);
  await expect(page.getByRole("heading", { name: ebooks.order.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: /track/i })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // Bought once: adding it again is refused.
  await page.goto(`/ebooks/${paid.slug}`);
  await expect(page.getByRole("button", { name: new RegExp(ebooks.actions.addToCart) })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an admin creates an ebook, uploads its cover and PDF, and pauses its downloads", async ({
  page,
  baseURL,
}, testInfo) => {
  const errors = collectErrors(page);
  const text = admin.ebooks;
  const title = `E2E Admin Ebook ${token()}`;
  await signInAs(page, baseURL!, { role: "admin" });

  await page.goto("/admin/ebooks/new");
  await page.getByLabel(text.form.title).fill(title);
  await page.getByLabel(text.form.description).fill("Made by the admin e2e test.");
  await page.getByLabel(text.form.price).fill("149");
  await page.getByRole("button", { name: text.add }).click();
  await expect(page).toHaveURL(/\/admin\/ebooks\/\d+\/edit\?notice=created/);
  const ebookId = Number(page.url().match(/ebooks\/(\d+)\/edit/)![1]);

  const coverForm = page.locator("form").filter({ has: page.getByLabel(text.files.coverLabel) });
  await coverForm.getByLabel(text.files.coverLabel).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await coverForm.getByRole("button", { name: text.files.upload }).click();
  await expect(coverForm.getByText(text.files.uploaded)).toBeVisible();
  const fileForm = page.locator("form").filter({ has: page.getByLabel(text.files.fileLabel) });
  // A file that isn't really a PDF is refused.
  await fileForm.getByLabel(text.files.fileLabel).setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") });
  await fileForm.getByRole("button", { name: text.files.upload }).click();
  await expect(fileForm.getByText(text.files.errors.fileType)).toBeVisible();
  await fileForm.getByLabel(text.files.fileLabel).setInputFiles({ name: "E2E book.pdf", mimeType: "application/pdf", buffer: pdf });
  await fileForm.getByRole("button", { name: text.files.upload }).click();
  await expect(page.getByText(/Current file: E2E book\.pdf/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  const saved = await e2eDb().ebook.findUniqueOrThrow({ where: { id: ebookId } });
  expect(saved).toMatchObject({ pricePaise: 14_900, isFree: false, fileName: "E2E book.pdf", coverContentType: "image/png" });
  expect((await page.request.get(`/api/ebook-covers/${ebookId}`)).status()).toBe(200);

  // Pause this ebook's downloads.
  await page.getByLabel(text.form.downloadsEnabled).uncheck();
  await page.getByRole("button", { name: admin.common.save }).click();
  await expect(page).toHaveURL(/\/admin\/ebooks\?notice=saved/);
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row.getByText(text.downloadsOff)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // A reader sees it paused, and the route refuses them.
  const reader = await page.context().browser()!.newContext({ baseURL });
  const readerPage = await reader.newPage();
  await signInAs(readerPage, baseURL!, { role: "user" });
  const free = await makeEbook({ free: true });
  await e2eDb().ebook.update({ where: { id: free.id }, data: { downloadsEnabled: false } });
  await readerPage.goto(`/ebooks/${free.slug}`);
  await expect(readerPage.getByText(ebooks.actions.pausedLine)).toBeVisible();
  expect((await readerPage.request.get(downloadHref(free.id))).status()).toBe(404);

  // The site-wide switch, on desktop only (both projects share one
  // database). Turned back on through the page, which refreshes the cached
  // setting; the database write below is only a fallback if a step fails.
  if (testInfo.project.name === "desktop") {
    try {
      await page.getByRole("button", { name: text.site.turnOff }).click();
      await expect(page.getByText(text.site.savedOff)).toBeVisible();
      await readerPage.goto("/ebooks");
      await expect(readerPage.getByText(ebooks.pausedSite)).toBeVisible();
      await page.getByRole("button", { name: text.site.turnOn }).click();
      await expect(page.getByText(text.site.savedOn)).toBeVisible();
      await readerPage.goto("/ebooks");
      await expect(readerPage.getByText(ebooks.pausedSite)).toHaveCount(0);
    } finally {
      await e2eDb().setting.update({ where: { key: "ebooks.downloads" }, data: { value: { enabled: true } } });
    }
  }
  await reader.close();
  // The fake PDF's refusal (415) is logged by the browser; that one is expected.
  expect(errors.filter((error) => !error.includes("(Unsupported Media Type)"))).toEqual([]);
});
