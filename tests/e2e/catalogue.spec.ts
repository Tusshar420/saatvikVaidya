import { stockCreate } from "../setup/stock-create";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { cart } from "../../src/content/cart";
import { catalogue as copy } from "../../src/content/catalogue";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// The catalogue (P1.3): listing, filters, search, the product page's price
// for each kind of viewer, homepage links, and the admin catalogue. Runs
// against the seeded sample products in the dev database; products the admin
// test makes have an "e2e-" slug and are removed by tests/e2e/cleanup.ts.

const token = () => `${Date.now().toString(36)}${randomInt(1000)}`;
const jpg = readFileSync("public/media/saatvik-rewards.jpg");

const results = (page: Page) =>
  page.getByRole("main").getByRole("list", { name: /products?( for|$)/ });
const card = (page: Page, name: string) =>
  results(page).getByRole("link", { name: new RegExp(name) });

/** Opens the filter panel on phones (it's always open from 1100 px). */
async function openFilters(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: /^Filters & sort/ }).click();
  return page.getByRole("form", { name: copy.filters.label });
}

/** A second browser signed in as `options`, at the test's size. */
async function viewerPage(
  browser: Browser,
  page: Page,
  baseURL: string,
  options: { userType: string; verificationStatus: "pending" | "approved" },
) {
  const context = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    isMobile: test.info().project.use.isMobile,
    hasTouch: test.info().project.use.hasTouch,
  });
  const viewer = await context.newPage();
  await signInAs(viewer, baseURL, { role: "user", ...options });
  return { viewer, context };
}

test.describe("catalogue listing", () => {
  test("filters by form chip, panel filters and removable chips", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(copy.listing.title);
    await expect(card(page, "Punarnava Mandoor")).toBeVisible();
    await expect(page.getByText(copy.sampleNote)).toBeVisible();

    // A form chip filters straight away and is marked current.
    const forms = page.getByRole("navigation", { name: copy.filters.formsLabel });
    await forms.getByRole("link", { name: "Churna", exact: true }).click();
    await expect(page).toHaveURL(/\/products\?form=churna$/);
    await expect(forms.getByRole("link", { name: "Churna", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    // The real catalogue has more than one Triphala Churna, so take the first.
    await expect(card(page, "Triphala Churna").first()).toBeVisible();
    await expect(card(page, "Punarnava Mandoor")).toHaveCount(0);

    // The panel adds a brand on top.
    const panel = await openFilters(page, isMobile);
    await panel.getByLabel(copy.filters.brand).selectOption({ label: "Pranacharya" });
    await panel.getByRole("button", { name: copy.filters.apply }).click();
    await expect(page).toHaveURL(/form=churna/);
    await expect(page).toHaveURL(/brand=pranacharya/);
    await expect(results(page).getByRole("listitem")).toHaveCount(1);
    await expect(card(page, "Avipattikar Churna")).toBeVisible();

    // Each active filter is a chip that removes itself.
    await page.getByRole("link", { name: copy.filters.remove("Pranacharya") }).click();
    await expect(page).toHaveURL(/\/products\?form=churna$/);
    await expect(card(page, "Triphala Churna").first()).toBeVisible();
  });

  test("sorts by price and shows an empty state", async ({ page, isMobile }) => {
    await page.goto("/products");
    const panel = await openFilters(page, isMobile);
    await panel.getByLabel(copy.filters.sort).selectOption("price-asc");
    await panel.getByRole("button", { name: copy.filters.apply }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    // Whatever the catalogue holds, the MRPs must run from low to high.
    await expect(results(page).getByRole("listitem").first()).toBeVisible();
    const prices = (await results(page).getByRole("listitem").allInnerTexts()).map((text) =>
      Number(/MRP\s*₹([\d,]+)/.exec(text)?.[1]?.replaceAll(",", "")),
    );
    expect(prices.length).toBeGreaterThan(1);
    expect(prices.every((price) => Number.isFinite(price))).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    await page.goto("/products?form=churna&area=womens-health");
    await expect(page.getByRole("heading", { name: copy.listing.empty.title })).toBeVisible();
    await page.getByRole("link", { name: copy.listing.empty.action }).click();
    await expect(page).toHaveURL("/products");
  });
});

test("search finds products and says when nothing matches", async ({ page }) => {
  // Two products of our own with a one-off word, so the count doesn't depend
  // on what is in the catalogue.
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const word = `findme${token()}`;
  const make = (suffix: string) =>
    db.product.create({
      data: {
        slug: `${E2E_CONTENT_PREFIX}search-${suffix}-${token()}`,
        name: `E2E ${word} ${suffix}`,
        formId: form.id,
        description: "A product made by the catalogue e2e test.",
        packSize: "60 tablets",
        mrpPaise: 32_000,
        professionalPricePaise: 24_000,
        gstRate: 5,
        hsnCode: "30049011",
        stockItem: stockCreate(`${word} ${suffix}`, 5),
      },
      select: { name: true },
    });
  const first = await make("Vati");
  const second = await make("Churna");

  await page.goto("/search");
  const field = page.getByRole("main").getByRole("searchbox", { name: copy.search.label });
  await field.fill(word);
  await field.press("Enter");
  await expect(page).toHaveURL(`/search?q=${word}`);
  await expect(
    page.getByRole("heading", { name: copy.listing.resultsFor(2, word) }),
  ).toBeVisible();
  await expect(card(page, first.name)).toBeVisible();
  await expect(card(page, second.name)).toBeVisible();

  // "Filter these results" carries the words to the listing.
  await page.getByRole("link", { name: copy.search.refine }).click();
  await expect(page).toHaveURL(`/products?q=${word}`);
  await expect(
    page.getByRole("link", { name: copy.filters.remove(copy.filters.search(word)) }),
  ).toBeVisible();

  await page.goto("/search?q=zzqx");
  await expect(page.getByRole("heading", { name: copy.search.empty.title("zzqx") })).toBeVisible();
});

test("a listing card adds the minimum order to the cart", async ({ page }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const word = `Quickadd${token()}`;
  const make = (suffix: string, stock: number) =>
    db.product.create({
      data: {
        slug: `${E2E_CONTENT_PREFIX}quick-${suffix}-${token()}`,
        name: `${word} ${suffix}`,
        formId: form.id,
        description: "A product made by the catalogue e2e test.",
        packSize: "60 tablets",
        mrpPaise: 32_000,
        professionalPricePaise: 24_000,
        gstRate: 5,
        hsnCode: "30049011",
        stockItem: stockCreate(`${word} ${suffix}`, stock),
        moq: 3,
      },
      select: { name: true },
    });
  const inStock = await make("Vati", 20);
  const soldOut = await make("Churna", 0);

  await page.goto(`/search?q=${word}`);
  await expect(results(page).getByRole("listitem")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: cart.quickAdd.buttonLabel(soldOut.name) }),
  ).toHaveCount(0);
  await expect(results(page).getByRole("button", { name: cart.quickAdd.outOfStock })).toBeDisabled();

  await page.getByRole("button", { name: cart.quickAdd.buttonLabel(inStock.name) }).click();
  await expect(page.getByText(cart.quickAdd.addedLine(inStock.name))).toBeAttached();
  await expect(
    page.getByRole("button", { name: cart.quickAdd.addedLabel(inStock.name) }),
  ).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // The minimum order (3) is in the cart.
  await results(page).getByRole("link", { name: cart.quickAdd.viewCart }).click();
  await expect(page).toHaveURL("/cart");
  await expect(page.getByLabel(cart.line.quantityFor(inStock.name))).toHaveValue("3");
  expect(errors).toEqual([]);
});

test.describe("product page", () => {
  const url = "/products/punarnava-mandoor";
  const bulk = (page: Page) => page.getByRole("heading", { name: copy.product.price.bulkTitle });
  const priceBox = (page: Page) => page.getByRole("region", { name: copy.product.price.label });

  test("a guest sees MRP, a sign-in hint and can add to cart", async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Punarnava Mandoor");
    await expect(priceBox(page)).toContainText("MRP₹320");
    await expect(priceBox(page)).toContainText(copy.product.price.inclusive(5));
    await expect(priceBox(page)).toContainText(copy.product.hint.guest);
    await expect(priceBox(page)).not.toContainText("₹240");
    await expect(bulk(page)).toHaveCount(0);
    // P1.4: ordering is open (the checkout spec adds to the cart).
    await expect(page.getByRole("button", { name: cart.add.button })).toBeEnabled();
    await expect(page.getByText(copy.product.sampleBadge, { exact: true })).toBeVisible();

    // The sign-in link comes back to this product.
    const signIn = priceBox(page).getByRole("link", { name: copy.product.hint.guestAction });
    await expect(signIn).toHaveAttribute("href", /next=%2Fproducts%2Fpunarnava-mandoor/);
  });

  test("professional prices show only after approval, bulk tiers only for pharmacies", async ({
    browser,
    page,
    baseURL,
  }) => {
    const pending = await viewerPage(browser, page, baseURL!, {
      userType: "doctor",
      verificationStatus: "pending",
    });
    await pending.viewer.goto(url);
    await expect(priceBox(pending.viewer)).toContainText("MRP₹320");
    await expect(priceBox(pending.viewer)).toContainText(copy.product.hint.unverified);
    await expect(priceBox(pending.viewer)).not.toContainText("₹240");
    await pending.context.close();

    const doctor = await viewerPage(browser, page, baseURL!, {
      userType: "doctor",
      verificationStatus: "approved",
    });
    await doctor.viewer.goto(url);
    await expect(priceBox(doctor.viewer)).toContainText(copy.card.yourPrice);
    await expect(priceBox(doctor.viewer)).toContainText("₹240");
    await expect(priceBox(doctor.viewer)).toContainText(copy.product.price.save("₹80"));
    await expect(bulk(doctor.viewer)).toHaveCount(0);
    // Listing cards use the same price.
    await doctor.viewer.goto("/products?q=punarnava");
    await expect(card(doctor.viewer, "Punarnava Mandoor")).toContainText("₹240");
    await doctor.context.close();

    const pharmacy = await viewerPage(browser, page, baseURL!, {
      userType: "pharmacy",
      verificationStatus: "approved",
    });
    await pharmacy.viewer.goto(url);
    await expect(priceBox(pharmacy.viewer)).toContainText("₹240");
    await expect(bulk(pharmacy.viewer)).toBeVisible();
    const tiers = priceBox(pharmacy.viewer).getByRole("row");
    await expect(tiers).toHaveCount(3); // header (screen readers) + 2 tiers
    await expect(tiers.nth(1)).toContainText("10+ units");
    await expect(tiers.nth(1)).toContainText("₹225");
    await expect(tiers.nth(2)).toContainText("50+ units");
    await expect(tiers.nth(2)).toContainText("₹210");
    await pharmacy.context.close();
  });

  test("an unknown product is a 404", async ({ page }) => {
    const response = await page.goto("/products/no-such-product");
    expect(response?.status()).toBe(404);
  });
});

test("homepage catalogue links lead to the listing", async ({ page }) => {
  // v2 dropped the homepage's #launch-catalogue form links and the "Explore
  // range" brand links; the Top Brands section now shows top products with a
  // link to each, plus a link to the full listing.
  await page.goto("/");
  const brands = page.locator("#brands");
  await brands.scrollIntoViewIfNeeded();
  await brands.getByRole("heading", { level: 3 }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9-]+$/);

  await page.goto("/");
  await brands.scrollIntoViewIfNeeded();
  await brands.locator('a[href="/products"]').click();
  await expect(page).toHaveURL("/products");
});

test("catalogue pages: no axe issues, no sideways scroll, no console errors", async ({
  page,
}) => {
  const errors = collectErrors(page);
  for (const path of [
    "/products",
    "/products?form=churna&brand=pranacharya",
    "/products/punarnava-mandoor",
    "/search",
    "/search?q=churna",
  ]) {
    await page.goto(path);
    expect(await horizontalOverflow(page), path).toBe(0);
    expect(await axeViolations(page), path).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test.describe("admin catalogue", () => {
  const text = admin.catalogue;
  const main = (page: Page) => page.locator("#admin-main");

  test("an admin adds a product with a photo, then hides it", async ({
    page,
    baseURL,
    request,
  }) => {
    await signInAs(page, baseURL!, { role: "admin" });
    const id = token();
    const name = `E2E Test Churna ${id}`;
    const slug = `${E2E_CONTENT_PREFIX}test-${id}`;

    await page.goto("/admin/catalogue");
    await main(page).getByRole("link", { name: text.add }).click();
    await expect(page).toHaveURL("/admin/catalogue/new");

    const form = text.form;
    await main(page).getByLabel(form.name).fill(name);
    await main(page).getByLabel(form.slug).fill(slug);
    await main(page).getByLabel(form.brand, { exact: true }).selectOption({ label: "Flowgra" });
    await main(page).getByLabel(form.productForm, { exact: true }).selectOption({ label: "Churna" });
    await main(page).getByLabel("Digestive care").check();
    await main(page).getByLabel(form.packSize).fill("50 g");
    await main(page).getByLabel(form.description).fill("A product made by the e2e tests.");
    await main(page).getByLabel(form.mrp).fill("999");
    // More than MRP: refused, with the values kept.
    await main(page).getByLabel(form.professionalPrice).fill("1200");
    await main(page).getByLabel(form.tierMin(1)).fill("10");
    await main(page).getByLabel(form.tierPrice(1)).fill("700");
    await main(page).getByRole("button", { name: text.add }).click();
    await expect(main(page).getByText(text.errors.professionalPrice)).toBeVisible();
    await expect(main(page).getByLabel(form.name)).toHaveValue(name);

    await main(page).getByLabel(form.professionalPrice).fill("750");
    await main(page).getByRole("button", { name: text.add }).click();
    await expect(page).toHaveURL(/\/admin\/catalogue\/\d+\/edit\?notice=created/);
    await expect(main(page).getByText(admin.common.notices.created)).toBeVisible();

    // Add a photo.
    const images = main(page).getByRole("region", { name: text.images.title });
    await images.getByLabel(text.images.file, { exact: true }).setInputFiles({
      name: "pack.jpg",
      mimeType: "image/jpeg",
      buffer: jpg,
    });
    await images.getByLabel(text.images.alt).fill("Front of the test pack");
    await images.getByRole("button", { name: text.images.upload }).click();
    await expect(images.getByText(text.images.uploaded)).toBeVisible();
    await expect(images.getByRole("img", { name: "Front of the test pack" })).toBeVisible();
    const imageSrc = await images
      .getByRole("img", { name: "Front of the test pack" })
      .getAttribute("src");

    // It's on the site with its photo and prices.
    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByRole("img", { name: "Front of the test pack" })).toBeVisible();
    await expect(page.getByRole("region", { name: copy.product.price.label })).toContainText("₹999");
    expect((await request.get(imageSrc!)).status()).toBe(200);

    // Hide it: gone from the site, and its photo with it.
    await page.goBack();
    await main(page).getByLabel(form.active).uncheck();
    await main(page).getByRole("button", { name: admin.common.save }).click();
    await expect(page).toHaveURL("/admin/catalogue?notice=saved");
    expect((await request.get(`/products/${slug}`)).status()).toBe(404);
    expect((await request.get(imageSrc!)).status()).toBe(404);
    // An admin can still load it for the preview.
    expect((await page.request.get(imageSrc!)).status()).toBe(200);
  });

  test("the catalogue admin is a 404 for customers", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, { role: "user" });
    const response = await page.goto("/admin/catalogue");
    expect(response?.status()).toBe(404);
  });

  test("admin catalogue pages: no axe issues or sideways scroll", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, { role: "admin" });
    await page.goto("/admin/catalogue");
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);
    // Whatever products the database holds (demo seed or the real catalogue).
    await main(page).getByRole("link", { name: /^Edit / }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Edit /);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);
  });
});
