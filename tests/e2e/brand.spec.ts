import { stockCreate } from "../setup/stock-create";
import { randomBytes, randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { brand } from "../../src/content/brand";
import { checkout } from "../../src/content/checkout";
import { shell } from "../../src/content/shell";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { labelSpecSeed } from "../../src/server/seed/label-specs";
import { png, writeStorageFile } from "./brand-helpers";
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
      stockItem: stockCreate("E2E Brand", 2),
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

  // Step 3: no saved brand yet. A new one needs a name; its logo comes next.
  await expect(page.getByText(brand.profiles.empty.title)).toBeVisible();
  await page.getByRole("button", { name: brand.profiles.addFirst }).click();
  const brandForm = page.getByRole("form", { name: brand.profiles.form.newTitle });
  await brandForm.getByRole("button", { name: brand.profiles.form.saveNew }).click();
  await expect(page.getByText(brand.profiles.errors.profileName)).toBeVisible();
  await expect(page.getByText(brand.profiles.errors.brandName)).toBeVisible();
  const pf = brand.profiles.fields;
  await brandForm.getByLabel(pf.profileName).fill("Asha main");
  await brandForm.getByLabel(pf.brandName, { exact: true }).fill("Asha Ayurveda");
  await brandForm.getByLabel(pf.tagline).fill("Classical care, made simple");
  await brandForm.getByLabel(pf.shortDescription).fill("Classical Ayurveda for every home.");
  await brandForm.getByLabel(pf.longDescription).fill("Classical Ayurvedic formulations made to traditional recipes and packed with care.");
  await brandForm.getByLabel(pf.marketedByName).fill("Asha Wellness LLP");
  await brandForm.getByLabel(pf.marketedByAddress).fill("Flat 4, MG Road, Pune 411001");
  await brandForm.getByLabel(pf.contactPhone).fill("+91 98765 43210");
  await brandForm.getByLabel(pf.licenceNumbers).fill("Lic. No. AYU/2024/118");
  await checkPage(page, errors);
  await brandForm.getByRole("button", { name: brand.profiles.form.saveNew }).click();

  // The new brand carries on as its edit form, now with the logo: an SVG is refused; a PNG shows.
  const editForm = page.getByRole("form", { name: brand.profiles.form.editTitle("Asha main") });
  await expect(editForm).toBeVisible();
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
  await fileInput.setInputFiles(pngLogo);
  await expect(page.getByText(brand.packaging.logo.uploaded)).toBeVisible();
  await expect(page.getByRole("img", { name: brand.packaging.logo.previewAlt("Asha Ayurveda") })).toBeVisible();
  await expect(page.getByRole("button", { name: brand.packaging.logo.replace })).toBeVisible();
  await page.getByRole("button", { name: brand.profiles.form.save }).click();
  await expect(page.getByText(brand.profiles.messages.saved)).toBeVisible();
  const brands = page.getByRole("list", { name: brand.profiles.listLabel });
  await expect(brands).toContainText("Asha main");
  await expect(brands).toContainText(brand.profiles.badgeDefault);
  await expect(brands).toContainText(brand.profiles.badgeSelected);

  // Each product's label starts from the brand, fitted to its pack (no pack type: the general one).
  const labels = page.getByRole("form", { name: brand.labels.title });
  const labelOf = (name: string) => labels.getByRole("listitem").filter({ hasText: name });
  const firstLabel = labelOf(product.name);
  await expect(firstLabel.getByLabel(brand.labels.fields.brandName, { exact: true })).toHaveValue("Asha Ayurveda");
  await expect(firstLabel.getByLabel(brand.labels.fields.tagline, { exact: true })).toHaveValue("Classical care, made simple");
  await expect(firstLabel.getByLabel(brand.labels.fields.description, { exact: true })).toHaveValue("Classical Ayurveda for every home.");
  await expect(firstLabel).toContainText(brand.labels.area("General pack", 80, 50));
  await expect(labelOf(bulk.name).getByLabel(brand.labels.fields.tagline, { exact: true })).toHaveValue("Classical care, made simple");
  await checkPage(page, errors);

  // Text too long for the pack is warned about at once and blocks the step.
  const tagline = firstLabel.getByLabel(brand.labels.fields.tagline, { exact: true });
  await tagline.fill("x".repeat(90));
  await expect(firstLabel.getByText(brand.labels.over(10, 80))).toBeVisible();
  await expect(firstLabel.getByText(brand.labels.overBadge, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: brand.launch.continue }).click();
  await expect(page.getByText(brand.packaging.errors.labels)).toBeVisible();
  await expect(page).toHaveURL("/launch?step=3");
  // Fix it for this product only: the other product and the saved brand are unchanged.
  await tagline.fill("Made for the first jar");
  await expect(firstLabel.getByRole("button", { name: brand.labels.resetLabel(brand.labels.fields.tagline, product.name) })).toBeVisible();
  await expect(firstLabel.getByText(brand.labels.changedBadge, { exact: true })).toBeVisible();
  await expect(labelOf(bulk.name).getByLabel(brand.labels.fields.tagline, { exact: true })).toHaveValue("Classical care, made simple");
  // Typing in a field that is already on screen doesn't scroll, so on phones
  // the tagline can sit half under the sticky header; axe would then read it
  // as an obscured target. Bring it into view, as a user would.
  await tagline.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await checkPage(page, errors);
  await page.getByRole("button", { name: brand.launch.continue }).click();
  await expect(page).toHaveURL("/launch?step=4");

  // Step 4: the summary, an address, then the test payment.
  await expect(page.getByRole("region", { name: brand.review.packaging })).toContainText("Asha Ayurveda");
  const reviewLabels = page.getByRole("region", { name: brand.labels.review.title });
  await expect(reviewLabels).toContainText(product.name);
  await expect(reviewLabels).toContainText(brand.labels.review.edited);
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
  expect(order.brandDetails).toMatchObject({
    brandName: "Asha Ayurveda",
    licenceNumbers: "Lic. No. AYU/2024/118",
    shortDescription: "Classical Ayurveda for every home.",
  });
  // The label as approved is saved on each line; only the first product's tagline was changed.
  const [firstItem, secondItem] = order.items.sort((a, b) => a.id - b.id);
  expect(firstItem?.labelDetails).toMatchObject({
    spec: { key: "general", widthMm: 80, heightMm: 50 },
    values: { brandName: "Asha Ayurveda", tagline: "Made for the first jar" },
    overridden: ["tagline"],
  });
  expect(secondItem?.labelDetails).toMatchObject({
    values: { tagline: "Classical care, made simple" },
    overridden: [],
  });
  // The saved brand is kept for the next order, and still has the original tagline.
  expect(await e2eDb().brandProfile.findMany({ where: { userId: buyer.id } })).toMatchObject([
    { profileName: "Asha main", tagline: "Classical care, made simple", isDefault: true },
  ]);
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
  const ordered = page.getByRole("region", { name: brand.detail.labelsTitle });
  await expect(ordered).toContainText("Made for the first jar");
  await expect(ordered).toContainText(brand.labels.area("General pack", 80, 50));
  await checkPage(page, errors);
  // Made to order: the store's stock (2) didn't change.
  expect((await e2eDb().stockItem.findUniqueOrThrow({ where: { productId: product.id } })).onHand).toBe(2);
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
  await expect(adminPage.getByRole("region", { name: brand.admin.detail.labelsTitle })).toContainText("Made for the first jar");
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

test("saved brands: pick, set the default, edit and delete them, and each pack gets its own label details", async ({
  page,
  baseURL,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const db = e2eDb();
  // A tube takes the short description, a bottle the long one, ingredients and usage.
  for (const spec of labelSpecSeed.filter((row) => row.key === "tube" || row.key === "bottle")) {
    await db.labelSpec.upsert({ where: { key: spec.key }, create: spec, update: {} });
  }
  const tubeSpec = await db.labelSpec.findUniqueOrThrow({ where: { key: "tube" } });
  const bottleSpec = await db.labelSpec.findUniqueOrThrow({ where: { key: "bottle" } });
  const tube = await makeBrandProduct({ label: "Ointment" });
  const bottle = await makeBrandProduct({ label: "Syrup", brandUnitLabel: "bottles" });
  await db.product.update({ where: { id: tube.id }, data: { labelSpecId: tubeSpec.id } });
  await db.product.update({
    where: { id: bottle.id },
    data: { labelSpecId: bottleSpec.id, ingredients: "Haritaki, Amalaki, Bibhitaki", dosage: "1 tsp twice a day." },
  });

  const buyer = await signInAs(page, baseURL!, { role: "user", userType: "customer" });
  await db.brandCartItem.createMany({
    data: [
      { userId: buyer.id, productId: tube.id, quantity: 4 },
      { userId: buyer.id, productId: bottle.id, quantity: 4 },
    ],
  });
  const logoKey = (name: string) => `brand-logos/${name}-${randomBytes(12).toString("hex")}.png`;
  const keys = [logoKey("ayush"), logoKey("kesari")];
  for (const key of keys) await writeStorageFile(key, png);
  const profile = (name: string, brandName: string, key: string, isDefault: boolean) => ({
    userId: buyer.id,
    profileName: name,
    isDefault,
    brandName,
    tagline: `${brandName} tagline`,
    shortDescription: `${brandName} short text.`,
    longDescription: `${brandName} long text that goes on a bottle and tells the whole story.`,
    marketedByName: `${brandName} LLP`,
    contactPhone: "+91 98765 43210",
    primaryColour: "#1f6f5c",
    logoKey: key,
    logoName: "logo.png",
    logoContentType: "image/png",
    logoSizeBytes: png.byteLength,
  });
  await db.brandProfile.create({ data: profile("Ayush range", "Ayush Herbals", keys[0]!, true) });
  await db.brandProfile.create({ data: profile("Kesari range", "Kesari Care", keys[1]!, false) });

  await page.goto("/launch?step=3");
  const brands = page.getByRole("list", { name: brand.profiles.listLabel });
  const ayush = brands.getByRole("listitem").filter({ hasText: "Ayush range" });
  const kesari = brands.getByRole("listitem").filter({ hasText: "Kesari range" });
  // The default brand is used until another is picked.
  await expect(ayush).toContainText(brand.profiles.badgeDefault);
  await expect(ayush).toContainText(brand.profiles.badgeSelected);
  await expect(kesari).not.toContainText(brand.profiles.badgeSelected);
  await expect(page.getByRole("img", { name: brand.packaging.logo.previewAlt("Ayush Herbals") })).toBeVisible();

  // Different packs, different label details.
  const labels = page.getByRole("form", { name: brand.labels.title });
  const tubeLabel = labels.getByRole("listitem").filter({ hasText: tube.name });
  const bottleLabel = labels.getByRole("listitem").filter({ hasText: bottle.name });
  const text = brand.labels;
  await expect(tubeLabel).toContainText(text.area("Tube", 90, 40));
  await expect(tubeLabel.getByLabel(text.fields.description, { exact: true })).toHaveValue("Ayush Herbals short text.");
  await expect(tubeLabel.getByLabel(text.fields.ingredients, { exact: true })).toHaveCount(0);
  await expect(tubeLabel).toContainText(text.notPrinted("ingredients, how to use, marketed by: address"));
  await expect(bottleLabel).toContainText(text.area("Syrup or tablet bottle", 100, 60));
  await expect(bottleLabel.getByLabel(text.fields.description, { exact: true })).toHaveValue(
    "Ayush Herbals long text that goes on a bottle and tells the whole story.",
  );
  await expect(bottleLabel.getByLabel(text.fields.ingredients, { exact: true })).toHaveValue("Haritaki, Amalaki, Bibhitaki");
  await expect(bottleLabel.getByLabel(text.fields.usage, { exact: true })).toHaveValue("1 tsp twice a day.");
  await checkPage(page, errors);

  // A long description is too long for the tube: it can be shortened there only.
  const tubeDescription = tubeLabel.getByLabel(text.fields.description, { exact: true });
  await tubeDescription.fill("y".repeat(100));
  await expect(tubeLabel.getByText(text.over(10, 90))).toBeVisible();
  await tubeDescription.fill("Short tube text");
  await tubeLabel.getByLabel(text.fields.tagline, { exact: true }).fill("Tube only");
  await page.getByRole("button", { name: brand.launch.continue }).click();
  await expect(page).toHaveURL("/launch?step=4");
  const saved = await db.brandCartItem.findMany({ where: { userId: buyer.id }, orderBy: { id: "asc" } });
  expect(saved.map((line) => line.labelOverrides)).toEqual([
    { tagline: "Tube only", description: "Short tube text" },
    null,
  ]);
  await checkPage(page, errors);

  // Back on step 3 the changes are there, and one field can go back to the brand.
  await page.goto("/launch?step=3");
  await expect(tubeLabel.getByLabel(text.fields.tagline, { exact: true })).toHaveValue("Tube only");
  await expect(tubeLabel.getByText(text.changedBadge, { exact: true })).toBeVisible();
  await tubeLabel.getByRole("button", { name: text.resetLabel(text.fields.tagline, tube.name) }).click();
  await expect(tubeLabel.getByLabel(text.fields.tagline, { exact: true })).toHaveValue("Ayush Herbals tagline");

  // Pick the other brand: the labels start from it (the tube keeps its own description).
  await kesari.getByRole("button", { name: brand.profiles.useLabel("Kesari range") }).click();
  await expect(page.getByText(brand.profiles.messages.chosen)).toBeVisible();
  await expect(kesari).toContainText(brand.profiles.badgeSelected);
  await expect(ayush).not.toContainText(brand.profiles.badgeSelected);
  await expect(bottleLabel.getByLabel(text.fields.brandName, { exact: true })).toHaveValue("Kesari Care");
  await expect(bottleLabel.getByLabel(text.fields.tagline, { exact: true })).toHaveValue("Kesari Care tagline");
  await expect(tubeLabel.getByLabel(text.fields.description, { exact: true })).toHaveValue("Short tube text");
  // Make it the default.
  await kesari.getByRole("button", { name: brand.profiles.makeDefaultLabel("Kesari range") }).click();
  await expect(kesari).toContainText(brand.profiles.badgeDefault);
  await expect(ayush).not.toContainText(brand.profiles.badgeDefault);

  // Edit it: change the brand name.
  await kesari.getByRole("button", { name: brand.profiles.editLabel("Kesari range") }).click();
  const editForm = page.getByRole("form", { name: brand.profiles.form.editTitle("Kesari range") });
  await editForm.getByLabel(brand.profiles.fields.brandName, { exact: true }).fill("Kesari Wellness");
  await checkPage(page, errors);
  await editForm.getByRole("button", { name: brand.profiles.form.save }).click();
  await expect(page.getByText(brand.profiles.messages.saved)).toBeVisible();
  await expect(kesari).toContainText("Kesari Wellness");
  await expect(bottleLabel.getByLabel(text.fields.brandName, { exact: true })).toHaveValue("Kesari Wellness");

  // Delete the first one (after a confirmation); orders aren't affected.
  await ayush.getByRole("button", { name: brand.profiles.removeLabel("Ayush range") }).click();
  await ayush.getByRole("button", { name: brand.profiles.removeNo }).click();
  await expect(ayush).toHaveCount(1);
  await ayush.getByRole("button", { name: brand.profiles.removeLabel("Ayush range") }).click();
  await ayush.getByRole("button", { name: brand.profiles.removeYes }).click();
  await expect(page.getByText(brand.profiles.messages.deleted)).toBeVisible();
  await expect(brands.getByRole("listitem")).toHaveCount(1);
  expect(await db.brandProfile.count({ where: { userId: buyer.id } })).toBe(1);
  await checkPage(page, errors);
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
