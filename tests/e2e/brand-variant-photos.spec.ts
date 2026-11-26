import { stockCreate } from "../setup/stock-create";
import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { brand } from "../../src/content/brand";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { png } from "./brand-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Build Your Brand variant photos: an admin uploads a general photo and one
// for the Saffron Glow label, and the product's page shows the Saffron photo
// when that variant is picked (other variants keep the drawn pack). Marking
// the general photo as Royal Maroon's later moves it there. The product
// (slug "e2e-...") and its photos are removed by tests/e2e/cleanup.ts.

const text = admin.catalogue.images;
const themes = brand.customise.themes;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function makeBrandProduct() {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({
    where: { kind: "FORM", active: true },
  });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}variant-${token}`,
      name: `E2E Variant Churna ${token}`,
      formId: form.id,
      description: "A product made by the variant photo e2e test.",
      packSize: "60 g",
      mrpPaise: 20_000,
      professionalPricePaise: 15_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate("E2E Variant", 2),
      brandEligible: true,
      brandMinQty: 20,
      brandUnitPricePaise: 9_000,
      brandUnitLabel: "packs",
    },
    select: { id: true, slug: true },
  });
}

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

async function upload(page: Page, alt: string, variant: string) {
  const images = page
    .locator("#admin-main")
    .getByRole("region", { name: text.title });
  await images
    .getByLabel(text.file, { exact: true })
    .setInputFiles({ name: "pack.png", mimeType: "image/png", buffer: png });
  await images.getByLabel(text.alt, { exact: true }).fill(alt);
  await images
    .getByLabel(text.variant, { exact: true })
    .selectOption({ label: variant });
  await images.getByRole("button", { name: text.upload }).click();
  await expect(images.getByRole("img", { name: alt })).toBeVisible();
}

test("an admin adds a photo per label variant and the page shows it for that variant", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const product = await makeBrandProduct();
  await signInAs(page, baseURL!, { role: "admin", adminRole: "catalogue" });

  await page.goto(`/admin/catalogue/${product.id}/edit`);
  const images = page
    .locator("#admin-main")
    .getByRole("region", { name: text.title });
  await expect(images.getByText(text.variantNote)).toBeVisible();
  await upload(page, "Front of the jar", text.variantGeneral);
  await upload(page, "Saffron label jar", themes["saffron-glow"]!);
  await expect(
    images.getByText(text.variantBadge(themes["saffron-glow"]!)),
  ).toBeVisible();
  await expect(images.getByText(text.main, { exact: true })).toHaveCount(1);
  await checkPage(page, errors);

  // The default variant (Classic Green) has no photo: the drawn pack.
  await page.goto(`/launch/${product.slug}`);
  const photo = (alt: string) => page.getByRole("img", { name: alt });
  await expect(
    page.getByRole("radio", { name: themes["classic-green"] }),
  ).toBeChecked();
  await expect(photo("Saffron label jar")).toHaveCount(0);
  await expect(photo("Front of the jar")).toHaveCount(0);

  await page.getByRole("radio", { name: themes["saffron-glow"] }).click();
  await expect(photo("Saffron label jar")).toBeVisible();
  await checkPage(page, errors);

  await page.getByRole("radio", { name: themes["royal-maroon"] }).click();
  await expect(photo("Saffron label jar")).toHaveCount(0);

  // Mark the general photo as Royal Maroon's: it moves to that variant.
  await page.goto(`/admin/catalogue/${product.id}/edit`);
  await images.getByLabel(text.variantFor(1), { exact: true }).selectOption({
    label: themes["royal-maroon"]!,
  });
  await images
    .getByRole("listitem", { name: text.item(1) })
    .getByRole("button", { name: text.saveAlt })
    .click();
  await expect(
    images.getByText(text.variantBadge(themes["royal-maroon"]!)),
  ).toBeVisible();
  await expect(images.getByText(text.main, { exact: true })).toHaveCount(0);

  await page.goto(`/launch/${product.slug}`);
  await page.getByRole("radio", { name: themes["royal-maroon"] }).click();
  await expect(photo("Front of the jar")).toBeVisible();
  expect(errors).toEqual([]);
});
