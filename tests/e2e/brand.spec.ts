import { stockCreate } from "../setup/stock-create";
import { randomBytes, randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { brand } from "../../src/content/brand";
import { checkout } from "../../src/content/checkout";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { png, writeStorageFile } from "./brand-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Build Your Brand (P2.1) with the Launch cart, end to end on phone and
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
      description: "A product made by the Build Your Brand e2e test.",
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

  // Signed out, /launch shows the catalogue with a sign-in prompt; a product's
  // page asks to sign in before it can be customised, and any later step
  // asks to sign in first.
  await page.goto("/launch");
  await expect(page.getByRole("heading", { name: brand.launch.guest.title })).toBeVisible();
  await expect(
    page.getByRole("link", { name: brand.launch.guest.signIn }),
  ).toHaveAttribute("href", /next=%2Flaunch/);
  await page.goto(`/launch/${product.slug}`);
  await expect(page.getByRole("link", { name: brand.customise.signIn })).toHaveAttribute(
    "href",
    new RegExp(`next=%2Flaunch%2F${product.slug}`),
  );
  await page.goto("/launch?step=2");
  await expect(page).toHaveURL(/next=%2Flaunch%3Fstep%3D2/);

  // Any account type can order: here a doctor still waiting for approval.
  const buyer = await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    verificationStatus: "pending",
  });

  // Step 1: eligible products only, with their minimum, branded and bulk price.
  await page.goto("/launch");
  const steps = page.getByRole("list", { name: brand.launch.stepsLabel });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await page.getByRole("searchbox", { name: brand.product.searchLabel }).fill(product.name);
  await page.getByRole("button", { name: brand.product.search }).click();
  const choices = page.getByRole("list", { name: brand.product.listLabel });
  await expect(choices.getByRole("listitem")).toHaveCount(1);
  await expect(choices).toContainText(brand.product.minimum(4, "jars"));
  await expect(choices).toContainText(brand.product.price("₹260"));
  // The brand details can't be opened yet; the empty cart shows instead.
  await page.goto("/launch?step=3");
  await expect(page).toHaveURL("/launch?step=2");
  await expect(page.getByRole("heading", { name: brand.cart.empty.title })).toBeVisible();

  // "View & customise" opens the product's page: pick a label theme, and
  // "Continue — choose quantity" puts it in the cart (at its minimum) on step 2.
  await page.goto(`/launch?q=${encodeURIComponent(product.name)}`);
  await checkPage(page, errors);
  await page.getByRole("link", { name: brand.customise.viewLabel(product.name) }).click();
  await expect(page).toHaveURL(`/launch/${product.slug}`);
  await expect(page.getByRole("heading", { name: product.name, level: 2 })).toBeVisible();
  const variants = page.getByRole("radiogroup", { name: brand.customise.variantLabel });
  await expect(variants.getByRole("radio", { name: brand.customise.themes["classic-green"]! })).toBeChecked();
  await variants.getByRole("radio", { name: brand.customise.themes["royal-maroon"]! }).click();
  await expect(variants.getByRole("radio", { name: brand.customise.themes["royal-maroon"]! })).toBeChecked();
  await checkPage(page, errors);
  await page.getByRole("button", { name: brand.customise.continue }).click();
  await expect(page).toHaveURL("/launch?step=2");
  expect(await e2eDb().brandCartItem.findFirstOrThrow({ where: { userId: buyer.id } })).toMatchObject({
    quantity: 4,
    labelTheme: "royal-maroon",
  });
  // Two more products come the same way, each with its default theme.
  for (const other of [bulk, extra]) {
    await page.goto(`/launch/${other.slug}`);
    await page.getByRole("button", { name: brand.customise.continue }).click();
    await expect(page).toHaveURL("/launch?step=2");
  }
  await page.goto(`/launch?q=${encodeURIComponent(product.name)}`);
  await expect(choices).toContainText(brand.product.inCart);
  const cartBar = page.getByRole("region", { name: brand.product.cartBar.label });
  // 4 × ₹260 + 10 × ₹100 + 4 × ₹260
  await expect(cartBar).toContainText(brand.product.cartBar.summary(3, 18, "₹3,080"));
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
  await expect(summary).toContainText("₹3,080");

  // − and + move by each product's minimum.
  const first = page.getByLabel(brand.cart.quantityFor(product.name, "jars"));
  await expect(first).toHaveValue("4");
  await expect(page.getByRole("button", { name: brand.cart.decrease(product.name, 4) })).toBeDisabled();
  await page.getByRole("button", { name: brand.cart.increase(product.name, 4) }).click();
  await expect(first).toHaveValue("8");
  await expect(summary).toContainText("₹4,120");
  // A typed number moves up to the next multiple of 4, with a note.
  await first.fill("9");
  await first.blur();
  await expect(first).toHaveValue("12");
  await expect(page.getByText(brand.cart.snapped(12, 4))).toBeVisible();
  await page.getByRole("button", { name: brand.cart.decrease(product.name, 4) }).click();
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

  // Brand details on the same step: the button waits until everything is filled in.
  const details = page.getByRole("form", { name: brand.brandStep.detailsTitle });
  const goOn = page.getByRole("button", { name: brand.brandStep.continue });
  await expect(goOn).toBeDisabled();
  await expect(page.getByText(brand.brandStep.hint)).toBeVisible();
  await details.getByLabel(brand.brandStep.brandName).fill("Asha Ayurveda");
  await details.getByLabel(brand.brandStep.mrpLabel(product.name)).fill("399");
  // An MRP below the net rate (₹100 per pack of the bulk product) is refused by the server.
  await details.getByLabel(brand.brandStep.mrpLabel(bulk.name)).fill("90");
  await details.getByLabel(brand.brandStep.address).fill("Flat 4, MG Road, Pune 411001");
  await details.locator('input[type="file"]').setInputFiles(pngLogo);
  await expect(page.getByRole("complementary", { name: brand.launch.preview.labelTitle })).toContainText("Asha Ayurveda");
  await checkPage(page, errors);
  await expect(goOn).toBeEnabled();
  await goOn.click();
  await expect(page.getByText(brand.brandStep.errors.mrp.low("₹100"))).toBeVisible();
  await expect(page).toHaveURL("/launch?step=2");
  await details.getByLabel(brand.brandStep.mrpLabel(bulk.name)).fill("150");
  await goOn.click();
  await expect(page).toHaveURL("/launch?step=3");

  // Step 3: the summary, an address, then the test payment.
  await expect(page.getByRole("region", { name: brand.review.packaging })).toContainText("Asha Ayurveda");
  const reviewProducts = page.getByRole("region", { name: brand.review.products });
  await expect(reviewProducts).toContainText(brand.review.itemDetail(4, "jars", "₹260"));
  await expect(reviewProducts).toContainText(brand.review.itemDetail(50, "packs", "₹90"));
  await expect(reviewProducts).toContainText(brand.review.themeMrp("Royal Maroon", "₹399"));
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
    marketedByAddress: "Flat 4, MG Road, Pune 411001",
  });
  // The label as approved is saved on each line, with its theme and the MRP typed for it.
  const [firstItem, secondItem] = order.items.sort((a, b) => a.id - b.id);
  expect(firstItem?.labelDetails).toMatchObject({
    spec: { key: "general", widthMm: 80, heightMm: 50 },
    values: { brandName: "Asha Ayurveda" },
    overridden: [],
    theme: "royal-maroon",
    packMrpPaise: 39_900,
  });
  expect(secondItem?.labelDetails).toMatchObject({ theme: "classic-green", packMrpPaise: 15_000 });
  // The brand is saved for the next order.
  expect(await e2eDb().brandProfile.findMany({ where: { userId: buyer.id } })).toMatchObject([
    { profileName: brand.brandStep.profileName, brandName: "Asha Ayurveda", isDefault: true },
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
  await expect(ordered).toContainText(`${brand.labels.theme}: Royal Maroon`);
  await expect(ordered).toContainText(`${brand.labels.packMrp}: ₹399`);
  await expect(ordered).toContainText(brand.labels.area("General pack", 80, 50));
  await checkPage(page, errors);
  // Made to order: the store's stock (2) didn't change.
  expect((await e2eDb().stockItem.findUniqueOrThrow({ where: { productId: product.id } })).onHand).toBe(2);
  expect((await e2eDb().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");

  // My Brand lists it (the v2 dock has Launch, not My Brand).
  await page.goto("/my-brand");
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
  await expect(adminPage.getByText("Asha Ayurveda, Flat 4, MG Road, Pune 411001")).toBeVisible();
  const adminProducts = adminPage.getByRole("list", { name: brand.admin.detail.products });
  await expect(adminProducts).toContainText(product.name);
  await expect(adminProducts).toContainText(bulk.name);
  await expect(adminPage.getByRole("region", { name: brand.admin.detail.labelsTitle })).toContainText(`${brand.labels.packMrp}: ₹399`);
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

test("a returning buyer's saved brand fills the brand details, and changing it keeps one brand", async ({
  page,
  baseURL,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const db = e2eDb();
  const tube = await makeBrandProduct({ label: "Ointment" });
  const buyer = await signInAs(page, baseURL!, { role: "user", userType: "customer" });
  await db.brandCartItem.create({ data: { userId: buyer.id, productId: tube.id, quantity: 4, labelTheme: "minimal-white" } });
  const key = `brand-logos/ayush-${randomBytes(12).toString("hex")}.png`;
  await writeStorageFile(key, png);
  await db.brandProfile.create({
    data: {
      userId: buyer.id,
      profileName: "Ayush range",
      isDefault: true,
      brandName: "Ayush Herbals",
      marketedByName: "Ayush Herbals LLP",
      marketedByAddress: "Plot 9, Station Road, Nagpur 440001",
      logoKey: key,
      logoName: "logo.png",
      logoContentType: "image/png",
      logoSizeBytes: png.byteLength,
    },
  });

  // Step 2 starts from the saved brand: name, address and logo are already there.
  await page.goto("/launch?step=2");
  const details = page.getByRole("form", { name: brand.brandStep.detailsTitle });
  await expect(details.getByLabel(brand.brandStep.brandName)).toHaveValue("Ayush Herbals");
  await expect(details.getByLabel(brand.brandStep.address)).toHaveValue("Plot 9, Station Road, Nagpur 440001");
  await expect(details.getByRole("button", { name: brand.brandStep.replaceLogo })).toBeVisible();
  const preview = page.getByRole("complementary", { name: brand.launch.preview.labelTitle });
  await expect(preview).toContainText("Ayush Herbals");
  const goOn = page.getByRole("button", { name: brand.brandStep.continue });
  // Only the MRP is missing.
  await expect(goOn).toBeDisabled();
  await details.getByLabel(brand.brandStep.mrpLabel(tube.name)).fill("320");
  // The brand name can be changed; the preview follows it as it is typed.
  await details.getByLabel(brand.brandStep.brandName).fill("Ayush Wellness");
  await expect(preview).toContainText("Ayush Wellness");
  await checkPage(page, errors);
  await goOn.click();
  await expect(page).toHaveURL("/launch?step=3");

  // The same brand was changed (not a second one added) and the details are confirmed.
  expect(await db.brandProfile.findMany({ where: { userId: buyer.id } })).toMatchObject([
    { profileName: "Ayush range", brandName: "Ayush Wellness", isDefault: true },
  ]);
  expect(await db.brandDraft.findUniqueOrThrow({ where: { userId: buyer.id } })).toMatchObject({ packagingDone: true });
  expect(await db.brandCartItem.findFirstOrThrow({ where: { userId: buyer.id } })).toMatchObject({
    packMrpPaise: 32_000,
    labelTheme: "minimal-white",
  });
  await expect(page.getByRole("region", { name: brand.review.packaging })).toContainText("Ayush Wellness");

  // Going back to step 2 shows what was saved, MRP included.
  await page.goto("/launch?step=2");
  await expect(page.getByLabel(brand.brandStep.mrpLabel(tube.name))).toHaveValue("320");
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
  await expect(choices).toContainText(brand.launch.preview.yourBrand);
  await checkPage(page, errors);

  // The active chip drops just the price filter.
  await page.getByRole("link", { name: text.filters.remove(text.filters.priceFrom("₹200")) }).click();
  await expect(page).not.toHaveURL(/minPrice/);
  await expect(page).toHaveURL(/q=/);
  await expect(choices.getByRole("listitem")).toHaveCount(1);

  await e2eDb().product.delete({ where: { id: product.id } });
});
