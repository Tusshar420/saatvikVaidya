import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { brand } from "../../src/content/brand";
import { checkout } from "../../src/content/checkout";
import { shell } from "../../src/content/shell";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Launch Your Brand (P2.1) with the Launch cart, end to end on phone and
// desktop: add several products to the Launch cart, step their quantities by
// each product's minimum (a bulk tier kicks in), remove one, upload a logo
// and the label text, then pay for the whole cart as one brand order with
// the test provider (a failure first, then a retry that succeeds), see it on
// My Brand, and open it as an admin. Each test makes its own products (slug
// "e2e-..."); tests/e2e/cleanup.ts removes them with the e2e users, their
// orders and their logo files.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** A 1 × 1 PNG. */
const pngLogo = {
  name: "brand-logo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
};

/**
 * A product open for branding: by default minimum 4 jars at ₹260 (5% GST),
 * low stock; `overrides` change the name, terms and bulk tiers.
 */
async function makeBrandProduct(
  overrides: {
    label?: string;
    brandMinQty?: number;
    brandUnitPricePaise?: number;
    brandUnitLabel?: string;
    tiers?: { minQuantity: number; pricePaise: number }[];
  } = {},
) {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}brand-${token}`,
      name: `E2E Brand ${overrides.label ?? "Avaleha"} ${token}`,
      formId: form.id,
      description: "A product made by the Launch Your Brand e2e test.",
      packSize: "250 g",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stock: 2,
      brandEligible: true,
      brandMinQty: overrides.brandMinQty ?? 4,
      brandUnitPricePaise: overrides.brandUnitPricePaise ?? 26_000,
      brandUnitLabel: overrides.brandUnitLabel ?? "jars",
      brandTiers: overrides.tiers ? { create: overrides.tiers } : undefined,
    },
    select: { id: true, slug: true, name: true },
  });
}

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

const fields = checkout.address.fields;

test("add several products to the launch cart, set bulk quantities, pay for them as one order, and see it on My Brand", async ({
  page,
  browser,
  baseURL,
  isMobile,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeBrandProduct();
  // Minimum 10 packs at ₹100, ₹90 each from 50.
  const bulk = await makeBrandProduct({
    label: "Churna",
    brandMinQty: 10,
    brandUnitPricePaise: 10_000,
    brandUnitLabel: "packs",
    tiers: [{ minQuantity: 50, pricePaise: 9_000 }],
  });
  const extra = await makeBrandProduct({ label: "Vati" });

  // Signed out, /launch asks to sign in first.
  await page.goto("/launch");
  await expect(page).toHaveURL(/next=%2Flaunch/);

  // Any account type can order: here a doctor still waiting for approval.
  const buyer = await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    verificationStatus: "pending",
  });

  // Step 1: eligible products only, with their minimum, branded and bulk price.
  await page.goto("/launch");
  const steps = page.getByRole("list", { name: brand.launch.stepsLabel });
  await expect(steps.getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await page.getByRole("searchbox", { name: brand.product.searchLabel }).fill(product.name);
  await page.getByRole("button", { name: brand.product.search }).click();
  const choices = page.getByRole("list", { name: brand.product.listLabel });
  await expect(choices.getByRole("listitem")).toHaveCount(1);
  await expect(choices).toContainText(brand.product.minimum(4, "jars"));
  await expect(choices).toContainText(brand.product.price("₹260"));
  // Packaging can't be opened yet; the empty cart shows instead.
  await page.goto("/launch?step=3");
  await expect(page).toHaveURL("/launch?step=2");
  await expect(page.getByRole("heading", { name: brand.cart.empty.title })).toBeVisible();

  // Add the first product, then one more step of its minimum.
  await page.goto(`/launch?q=${encodeURIComponent(product.name)}`);
  await checkPage(page, errors);
  await page.getByRole("button", { name: brand.product.addLabel(product.name) }).click();
  await expect(choices).toContainText(brand.product.inCartLine(4, "jars"));
  const cartBar = page.getByRole("region", { name: brand.product.cartBar.label });
  await expect(cartBar).toContainText(brand.product.cartBar.summary(1, 4, "₹1,040"));
  await page.getByRole("button", { name: brand.product.addMoreLabel(product.name, 4) }).click();
  await expect(choices).toContainText(brand.product.inCartLine(8, "jars"));
  await expect(cartBar).toContainText(brand.product.cartBar.summary(1, 8, "₹2,080"));
  // Two more products: their cards show the bulk price.
  for (const other of [bulk, extra]) {
    await page.goto(`/launch?q=${encodeURIComponent(other.name)}`);
    await page.getByRole("button", { name: brand.product.addLabel(other.name) }).click();
    await expect(choices).toContainText(brand.product.inCart);
  }
  await page.goto(`/launch?q=${encodeURIComponent(bulk.name)}`);
  await expect(choices).toContainText(brand.product.bulkFrom(50, "packs", "₹90"));
  await checkPage(page, errors);
  await page.getByRole("link", { name: brand.product.cartBar.view }).click();
  await expect(page).toHaveURL("/launch?step=2");

  // Step 2: the cart is saved to the account, so it is still there after leaving.
  await page.goto("/");
  await page.goto("/launch?step=2");
  const lines = page.getByRole("list", { name: brand.cart.listLabel });
  await expect(lines.getByRole("listitem").filter({ has: page.getByRole("heading") })).toHaveCount(3);
  const summary = page.getByRole("region", { name: brand.cart.summaryTitle });
  // 8 × ₹260 + 10 × ₹100 + 4 × ₹260
  await expect(summary).toContainText("₹4,120");

  // − and + move by each product's minimum.
  const first = page.getByLabel(brand.cart.quantityFor(product.name, "jars"));
  await expect(first).toHaveValue("8");
  await page.getByRole("button", { name: brand.cart.decrease(product.name, 4) }).click();
  await expect(first).toHaveValue("4");
  await expect(page.getByRole("button", { name: brand.cart.decrease(product.name, 4) })).toBeDisabled();
  // A typed number moves up to the next multiple of 4, with a note.
  await first.fill("7");
  await first.blur();
  await expect(first).toHaveValue("8");
  await expect(page.getByText(brand.cart.snapped(8, 4))).toBeVisible();
  await page.getByRole("button", { name: brand.cart.decrease(product.name, 4) }).click();
  await expect(first).toHaveValue("4");

  // The bulk product: the next tier is 40 packs away; at 50 it costs ₹90 each.
  const bulkQuantity = page.getByLabel(brand.cart.quantityFor(bulk.name, "packs"));
  await expect(page.getByText(brand.cart.nextTier(40, "packs", "₹90"))).toBeVisible();
  const morePacks = page.getByRole("button", { name: brand.cart.increase(bulk.name, 10) });
  for (const expected of ["20", "30", "40", "50"]) {
    await morePacks.click();
    await expect(bulkQuantity).toHaveValue(expected);
  }
  const bulkLine = lines.getByRole("listitem").filter({ has: page.getByRole("heading", { name: bulk.name }) });
  await expect(bulkLine).toContainText(brand.cart.each("₹90"));
  await expect(bulkLine).toContainText(brand.cart.bulkApplied);
  await expect(bulkLine).toContainText("₹4,500");

  // Remove the third product.
  await page.getByRole("button", { name: brand.cart.removeLabel(extra.name) }).click();
  await expect(page.getByRole("heading", { name: extra.name })).toHaveCount(0);
  // 4 × ₹260 + 50 × ₹90
  await expect(summary).toContainText("₹5,540");
  await checkPage(page, errors);
  await page.getByRole("link", { name: brand.cart.continue }).click();
  await expect(page).toHaveURL("/launch?step=3");

  // Step 2: an SVG is refused; a PNG logo uploads and shows.
  const fileInput = page.locator("#logo-file");
  await fileInput.setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  });
  await expect(page.getByText(brand.packaging.logo.errors.fileType)).toBeVisible();
  // The browser logs that refused upload (415) as an error; it's the one we expect.
  const refused = errors.findIndex((message) => message.includes("415"));
  expect(refused).toBeGreaterThanOrEqual(0);
  errors.splice(refused, 1);
  // Saving without a logo or brand name points at both.
  await page.getByRole("button", { name: brand.launch.continue }).click();
  await expect(page.getByText(brand.packaging.errors.logo)).toBeVisible();
  await expect(page.getByText(brand.packaging.errors.brandName)).toBeVisible();

  await fileInput.setInputFiles(pngLogo);
  await expect(page.getByText(brand.packaging.logo.uploaded)).toBeVisible();
  await expect(page.getByRole("img", { name: brand.packaging.logo.previewAlt("") })).toBeVisible();
  await expect(page.getByRole("button", { name: brand.packaging.logo.replace })).toBeVisible();
  const form = page.getByRole("form", { name: brand.packaging.title });
  await form.getByLabel(brand.packaging.fields.brandName).fill("Asha Ayurveda");
  await form.getByLabel(brand.packaging.fields.tagline).fill("Classical care, made simple");
  await form.getByLabel(brand.packaging.fields.marketedByName).fill("Asha Wellness LLP");
  await form.getByLabel(brand.packaging.fields.marketedByAddress).fill("Flat 4, MG Road, Pune 411001");
  await form.getByLabel(brand.packaging.fields.contactPhone).fill("+91 98765 43210");
  await checkPage(page, errors);
  await form.getByRole("button", { name: brand.launch.continue }).click();
  await expect(page).toHaveURL("/launch?step=4");

  // Step 4: the summary, an address, then the test payment.
  await expect(page.getByRole("region", { name: brand.review.packaging })).toContainText("Asha Ayurveda");
  const reviewProducts = page.getByRole("region", { name: brand.review.products });
  await expect(reviewProducts).toContainText(brand.review.itemDetail(4, "jars", "₹260"));
  await expect(reviewProducts).toContainText(brand.review.itemDetail(50, "packs", "₹90"));
  await expect(page.getByRole("img", { name: brand.packaging.logo.previewAlt("Asha Ayurveda") })).toBeVisible();
  const address = page.getByRole("form", { name: checkout.address.formTitleNew });
  await address.getByLabel(fields.name).fill("Asha Rao");
  await address.getByLabel(fields.phone).fill("9876543210");
  await address.getByLabel(fields.line1).fill("Flat 4, Shanti Apartments");
  await address.getByLabel(fields.city).fill("Pune");
  await address.getByLabel(fields.state).selectOption({ label: "Maharashtra" });
  await address.getByLabel(fields.pincode).fill("411001");
  await address.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();
  await checkPage(page, errors);
  await page.getByRole("button", { name: brand.review.place }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);
  const orderId = page.url().split("/").pop()!;

  const order = await e2eDb().order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, brandDetails: true },
  });
  expect(order).toMatchObject({ type: "brand", totalPaise: 554_000, status: "pending_payment" });
  expect(
    order.items
      .sort((a, b) => a.id - b.id)
      .map((item) => ({ productId: item.productId, quantity: item.quantity, unitPaise: item.unitPaise })),
  ).toEqual([
    { productId: product.id, quantity: 4, unitPaise: 26_000 },
    { productId: bulk.id, quantity: 50, unitPaise: 9_000 },
  ]);
  // The cart is now empty.
  expect(await e2eDb().brandCartItem.count({ where: { userId: buyer.id } })).toBe(0);
  expect(order.brandDetails?.brandName).toBe("Asha Ayurveda");
  await expect(page.getByRole("link", { name: brand.checkout.backToMyBrand })).toBeVisible();

  // Failure first: the order waits, and "Try again" pays it.
  await page.getByRole("button", { name: checkout.pay.failure }).click();
  await expect(page).toHaveURL(`/checkout/failed/${orderId}`);
  await expect(page.getByText(brand.checkout.failedLine(order.number))).toBeVisible();
  await checkPage(page, errors);
  await page.getByRole("button", { name: checkout.failed.tryAgain }).click();
  await expect(page).toHaveURL(`/checkout/pay/${orderId}`);
  await page.getByRole("button", { name: checkout.pay.success }).click();
  await expect(page).toHaveURL(`/my-brand/${orderId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Asha Ayurveda");
  await expect(page.getByText(brand.detail.stageNext.awaiting_proof)).toBeVisible();
  await expect(page.getByText(brand.detail.testNote)).toBeVisible();
  const timeline = page.getByRole("list", { name: brand.detail.timelineLabel });
  await expect(timeline.getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("img", { name: brand.packaging.logo.previewAlt("Asha Ayurveda") })).toBeVisible();
  await checkPage(page, errors);
  // Made to order: the store's stock (2) didn't change.
  expect((await e2eDb().product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(2);
  expect((await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");

  // My Brand lists it; on phones the dock leads there.
  if (isMobile) {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: shell.dock.label })
      .getByRole("link", { name: shell.dock.myBrand })
      .click();
  } else {
    await page.goto("/my-brand");
  }
  await expect(page).toHaveURL("/my-brand");
  const list = page.getByRole("list", { name: brand.myBrand.listLabel });
  await expect(list).toContainText("Asha Ayurveda");
  await expect(list).toContainText(bulk.name);
  await expect(list.getByRole("link", { name: brand.myBrand.viewLabel(order.number) })).toHaveAttribute(
    "href",
    `/my-brand/${orderId}`,
  );
  await checkPage(page, errors);

  // The logo is the owner's (and admins'); someone else gets a 404.
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await signInAs(strangerPage, baseURL!, { role: "user" });
  expect((await strangerPage.request.get(`/api/brand-orders/${orderId}/logo`)).status()).toBe(404);
  expect((await strangerPage.request.get(`/my-brand/${orderId}`)).status()).toBe(404);
  await stranger.close();

  // An orders admin sees the order with the logo, label text and contact.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminErrors = collectErrors(adminPage);
  await adminPage.emulateMedia({ reducedMotion: "reduce" });
  await signInAs(adminPage, baseURL!, { role: "admin", adminRole: "orders" });
  await adminPage.goto(`/admin/brand-orders?q=${encodeURIComponent("Asha Ayurveda")}`);
  await adminPage.getByRole("link", { name: brand.admin.viewLabel(order.number) }).click();
  await expect(adminPage).toHaveURL(`/admin/brand-orders/${orderId}`);
  await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText("Asha Ayurveda");
  await expect(adminPage.getByText("Asha Wellness LLP, Flat 4, MG Road, Pune 411001")).toBeVisible();
  const adminProducts = adminPage.getByRole("list", { name: brand.admin.detail.products });
  await expect(adminProducts).toContainText(product.name);
  await expect(adminProducts).toContainText(bulk.name);
  await expect(adminPage.getByRole("link", { name: brand.admin.detail.downloadLogo })).toHaveAttribute(
    "href",
    `/api/brand-orders/${orderId}/logo?download=1`,
  );
  await expect(adminPage.getByRole("link", { name: buyer.email })).toBeVisible();
  const download = await adminPage.request.get(`/api/brand-orders/${orderId}/logo?download=1`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toMatch(/^attachment/);
  await checkPage(adminPage, adminErrors);
  await adminContext.close();
});

test("a catalogue admin imports brand terms from a CSV after a preview", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const slug = `${E2E_CONTENT_PREFIX}brand-import-${Date.now().toString(36)}${randomInt(10_000)}`;
  await db.product.create({
    data: {
      slug,
      name: `E2E Import Churna ${slug.slice(-6)}`,
      formId: form.id,
      description: "Made by the brand import e2e test.",
      packSize: "100 g",
      mrpPaise: 20_000,
      professionalPricePaise: 15_000,
      gstRate: 5,
      hsnCode: "30049011",
    },
  });
  await signInAs(page, baseURL!, { role: "admin", adminRole: "catalogue" });
  await page.goto("/admin/catalogue");
  await page.getByRole("link", { name: brand.catalogue.importLink }).click();
  await expect(page).toHaveURL("/admin/catalogue/brand-import");

  const file = page.getByLabel(brand.import.fileLabel);
  // A row with an error blocks the import.
  await file.setInputFiles({
    name: "terms.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`product,minimum,price,unit\n${slug},0,120,packs\n`),
  });
  await page.getByRole("button", { name: brand.import.preview }).click();
  await expect(page.getByText(brand.import.errors.minimum)).toBeVisible();
  await expect(page.getByRole("button", { name: brand.import.apply })).toHaveCount(0);

  await file.setInputFiles({
    name: "terms.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`product,minimum,price,unit\n${slug},25,120,packs\n`),
  });
  await page.getByRole("button", { name: brand.import.preview }).click();
  await expect(page.getByText(brand.import.summary(1, 0))).toBeVisible();
  await checkPage(page, errors);
  await page.getByRole("button", { name: brand.import.apply }).click();
  await expect(page.getByText(brand.import.applied(1))).toBeVisible();
  expect(await db.product.findUniqueOrThrow({ where: { slug } })).toMatchObject({
    brandEligible: true,
    brandMinQty: 25,
    brandUnitPricePaise: 12_000,
    brandUnitLabel: "packs",
  });
});

test("the brand catalogue filters by branded price and product type, like the store listing", async ({
  page,
  baseURL,
  isMobile,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const product = await makeBrandProduct();
  // Removed at the end, so the admin catalogue list in other specs stays on one page.
  await signInAs(page, baseURL!, { role: "user", userType: "customer" });
  const text = brand.product;
  const choices = page.getByRole("list", { name: text.listLabel });
  const q = encodeURIComponent(product.name);

  // A price range that leaves the ₹260 product out shows the empty state.
  await page.goto(`/launch?q=${q}&maxPrice=100`);
  await expect(page.getByText(text.empty)).toBeVisible();
  await page.getByRole("link", { name: text.clearAll }).click();
  await expect(page).toHaveURL("/launch");

  // The panel: open it on a phone, raise the lowest price and apply.
  await page.goto(`/launch?q=${q}`);
  if (isMobile) {
    await page.getByRole("button", { name: text.filters.toggle }).click();
  }
  const panel = page.getByRole("form", { name: text.filters.label });
  await expect(panel.getByRole("slider", { name: text.filters.priceMin })).toBeVisible();
  await panel.getByRole("slider", { name: text.filters.priceMin }).fill("200");
  await panel.getByRole("button", { name: text.filters.apply }).click();
  await expect(page).toHaveURL(/minPrice=200/);
  await expect(choices.getByRole("listitem")).toHaveCount(1);
  await expect(choices).toContainText(text.catalogueTag);
  await checkPage(page, errors);

  // The active chip drops just the price filter.
  await page.getByRole("link", { name: text.filters.remove(text.filters.priceFrom("₹200")) }).click();
  await expect(page).not.toHaveURL(/minPrice/);
  await expect(page).toHaveURL(/q=/);
  await expect(choices.getByRole("listitem")).toHaveCount(1);

  await e2eDb().product.delete({ where: { id: product.id } });
});
