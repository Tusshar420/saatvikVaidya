import { stockCreate } from "../setup/stock-create";
import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { png } from "./brand-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Bulk photo upload: an admin searches for medicines, gives each photo a
// label variant and an image (one at a time and several at once), is stopped
// on a row without an image, and uploads the rest in one go. The products
// (slug "e2e-...") and their photos are removed by tests/e2e/cleanup.ts.

const text = admin.catalogue.bulkPhotos;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function makeProduct(token: string, name: string, brandEligible: boolean) {
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  return db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}bulk-${name.toLowerCase()}-${token}`,
      name: `E2E Bulk ${name} ${token}`,
      formId: form.id,
      description: "A product made by the bulk photo e2e test.",
      packSize: "60 g",
      mrpPaise: 20_000,
      professionalPricePaise: 15_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate(`E2E Bulk ${name}`, 2),
      ...(brandEligible
        ? { brandEligible: true, brandMinQty: 20, brandUnitPricePaise: 9_000, brandUnitLabel: "packs" }
        : {}),
    },
    select: { id: true, name: true },
  });
}

const file = (name: string) => ({ name, mimeType: "image/png", buffer: png });

test("an admin uploads many variant photos for several medicines at once", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  const jar = await makeProduct(token, "Jar", true);
  const plain = await makeProduct(token, "Plain", false);
  await signInAs(page, baseURL!, { role: "admin", adminRole: "catalogue" });

  // The product's images section links here with the product chosen.
  await page.goto(`/admin/catalogue/${jar.id}/edit`);
  await page.getByRole("link", { name: admin.catalogue.images.bulkLink }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/catalogue/photos\\?product=${jar.id}$`));
  const section = page.locator("#admin-main").getByRole("region", { name: text.rowsLabel });
  const row = (n: number) => section.getByRole("listitem", { name: text.row(n), exact: true });
  await expect(row(1).getByRole("combobox", { name: text.product(1) })).toHaveValue(jar.name);

  // Search picks the medicine; the variant list is that product's.
  await page.goto("/admin/catalogue/photos");
  const picker = row(1).getByRole("combobox", { name: text.product(1) });
  await picker.fill(`bulk jar ${token}`);
  const results = section.getByRole("listbox", { name: text.product(1) });
  await expect(results.getByRole("option")).toHaveCount(1);
  await results.getByRole("option", { name: jar.name }).click();
  await expect(picker).toHaveValue(jar.name);
  await row(1).getByLabel(text.variant(1)).selectOption({ label: "Saffron Glow" });
  await row(1).getByLabel(text.file(1), { exact: true }).setInputFiles(file("saffron.png"));
  await expect(row(1).getByText("saffron.png")).toBeVisible();

  // A new row keeps the medicine and moves on to the next variant.
  await section.getByRole("button", { name: text.addRow }).click();
  await expect(row(2).getByRole("combobox", { name: text.product(2) })).toHaveValue(jar.name);
  await expect(row(2).getByLabel(text.variant(2))).toHaveValue("royal-maroon");
  await row(2).getByLabel(text.file(2), { exact: true }).setInputFiles(file("maroon.png"));

  // Several images at once: one row each.
  await section.getByLabel(text.addMany).setInputFiles([file("white.png"), file("other.png")]);
  await expect(section.getByRole("listitem")).toHaveCount(4);
  await expect(row(3).getByLabel(text.variant(3))).toHaveValue("minimal-white");

  // Row 4 is for the other medicine (keyboard): no variants, so general.
  const picker4 = row(4).getByRole("combobox", { name: text.product(4) });
  await picker4.fill(`bulk plain ${token}`);
  await picker4.press("Enter");
  await expect(picker4).toHaveValue(plain.name);
  await expect(row(4).getByLabel(text.variant(4))).toBeDisabled();
  await expect(row(4).getByText(text.variantNone)).toBeVisible();
  await row(4).getByLabel(text.alt(4)).fill("Front of the plain pack");

  // A row with a medicine but no image stops the upload.
  await section.getByRole("button", { name: text.addRow }).click();
  await section.getByRole("button", { name: text.upload(4) }).click();
  await expect(row(5).getByText(text.errors.file)).toBeVisible();
  expect(await e2eDb().productImage.count({ where: { productId: jar.id } })).toBe(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  await section.getByRole("button", { name: text.remove(5) }).click();
  await section.getByRole("button", { name: text.upload(4) }).click();
  await expect(section.getByRole("status")).toHaveText(text.summary(4, 0));
  await expect(section.getByText(text.status.done, { exact: true })).toHaveCount(4);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  const images = await e2eDb().productImage.findMany({
    where: { productId: { in: [jar.id, plain.id] } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    select: { productId: true, variant: true, alt: true },
  });
  expect(images).toEqual([
    { productId: jar.id, variant: "saffron-glow", alt: `${jar.name}: Saffron Glow` },
    { productId: jar.id, variant: "royal-maroon", alt: `${jar.name}: Royal Maroon` },
    { productId: jar.id, variant: "minimal-white", alt: `${jar.name}: Minimal White` },
    { productId: plain.id, variant: null, alt: "Front of the plain pack" },
  ]);

  // Uploaded rows can be cleared, leaving a fresh row.
  await section.getByRole("button", { name: text.clearDone }).click();
  await expect(section.getByRole("listitem")).toHaveCount(1);
  expect(errors).toEqual([]);
});
