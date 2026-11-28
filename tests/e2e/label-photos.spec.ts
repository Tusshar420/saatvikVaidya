import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import { labelPhotos as text } from "../../src/content/label-photos";
import { stockCreate } from "../setup/stock-create";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// "Load label photos" on /admin/catalogue/photos: a catalogue admin loads the
// client's label photos. The test makes its own pack of a medicine in the
// photo list (Supari Pak, two label photos; slug "e2e-..."), so there is
// always something to load; tests/e2e/cleanup.ts removes it.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("an admin loads the client's label photos onto a medicine", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const product = await db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}label-photos-${token}`,
      name: "Supari Pak",
      formId: form.id,
      description: "A product made by the label photos e2e test.",
      packSize: `E2E ${token}`,
      mrpPaise: 33_000,
      professionalPricePaise: 19_800,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate(`E2E Label ${token}`, 2),
      brandEligible: true,
      brandMinQty: 20,
      brandUnitPricePaise: 19_800,
      brandUnitLabel: "packs",
    },
    select: { id: true },
  });

  await signInAs(page, baseURL!, { role: "admin", adminRole: "catalogue" });
  await page.goto("/admin/catalogue/photos");
  const card = page.getByRole("form", { name: text.title });
  await expect(card).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  await card.getByRole("button", { name: text.button }).click();
  await expect(card.getByText(/^Label photos loaded/)).toBeVisible();

  const variants = await db.productVariant.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
    select: { name: true },
  });
  expect(variants.map((variant) => variant.name)).toEqual(["Blue panel", "Blue wave"]);
  const images = await db.productImage.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
    select: { variant: true },
  });
  expect(images.map((image) => image.variant)).toEqual([null, "blue-panel", "blue-wave"]);

  // The Build Your Brand list card shows label 1 instead of the drawn pack.
  await page.goto("/launch?q=Supari+Pak");
  const photo = page.getByRole("img", { name: "Supari Pak label, Blue panel" }).first();
  await expect(photo).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // The whole card opens the product, not only its button.
  // (The stretched link covers the photo, so click the card itself.)
  await page.getByRole("listitem").filter({ has: photo }).first().click();
  await expect(page).toHaveURL(/\/launch\/[a-z0-9-]+$/);
  await expect(page.getByRole("radiogroup")).toBeVisible();
  expect(errors).toEqual([]);
});
