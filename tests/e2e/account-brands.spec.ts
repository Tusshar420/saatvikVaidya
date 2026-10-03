import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import { account } from "../../src/content/account";
import { brand } from "../../src/content/brand";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

const text = brand.profiles;

test("brand details on the account page: add, edit, set the default and delete saved brands, shared with Launch", async ({
  page,
  baseURL,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const db = e2eDb();
  const buyer = await signInAs(page, baseURL!, { role: "user", userType: "customer" });
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const token = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const product = await db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}acct-brand-${token}`,
      name: `E2E Account Brand ${token}`,
      formId: form.id,
      description: "Made by the account brand details e2e test.",
      packSize: "250 g",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stock: 2,
      brandEligible: true,
      brandMinQty: 4,
      brandUnitPricePaise: 26_000,
      brandUnitLabel: "jars",
    },
  });
  await db.brandCartItem.create({ data: { userId: buyer.id, productId: product.id, quantity: 4 } });
  const base = { userId: buyer.id, brandName: "Ayush Herbals", shortDescription: "Short.", longDescription: "Long." };
  await db.brandProfile.create({ data: { ...base, profileName: "Ayush range", isDefault: true } });
  await db.brandProfile.create({ data: { ...base, profileName: "Kesari range", brandName: "Kesari Care" } });

  // Reached from My account.
  await page.goto("/account");
  await page.getByRole("link", { name: new RegExp(account.shortcuts.brands.label) }).click();
  await expect(page).toHaveURL("/account/brands");
  await expect(page.getByRole("heading", { level: 1, name: account.brands.title })).toBeVisible();

  const brands = page.getByRole("list", { name: text.listLabel });
  const ayush = brands.getByRole("listitem").filter({ hasText: "Ayush range" });
  const kesari = brands.getByRole("listitem").filter({ hasText: "Kesari range" });
  await expect(ayush).toContainText(text.badgeDefault);
  // There is no order here, so no "use for this order".
  await expect(page.getByRole("button", { name: text.useLabel("Kesari range") })).toHaveCount(0);
  await expect(page.getByText(text.badgeSelected)).toHaveCount(0);

  // Add a brand.
  await page.getByRole("button", { name: text.add }).click();
  const newForm = page.getByRole("form", { name: text.form.newTitle });
  await newForm.getByLabel(text.fields.profileName, { exact: true }).fill("Tulsi range");
  await newForm.getByLabel(text.fields.brandName, { exact: true }).fill("Tulsi Naturals");
  await newForm.getByRole("button", { name: new RegExp(`${text.form.saveNew}|${text.form.save}`) }).click();
  await expect(page.getByText(text.messages.saved)).toBeVisible();
  expect(await db.brandProfile.count({ where: { userId: buyer.id } })).toBe(3);
  await page.getByRole("button", { name: text.form.cancel }).click();
  await expect(brands.getByRole("listitem")).toHaveCount(3);

  // Make another one the default, then edit it.
  await kesari.getByRole("button", { name: text.makeDefaultLabel("Kesari range") }).click();
  await expect(kesari).toContainText(text.badgeDefault);
  await expect(ayush).not.toContainText(text.badgeDefault);
  await kesari.getByRole("button", { name: text.editLabel("Kesari range") }).click();
  const editForm = page.getByRole("form", { name: text.form.editTitle("Kesari range") });
  await editForm.getByLabel(text.fields.brandName, { exact: true }).fill("Kesari Wellness");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  await editForm.getByRole("button", { name: text.form.save }).click();
  await expect(page.getByText(text.messages.saved)).toBeVisible();
  await expect(kesari).toContainText("Kesari Wellness");

  // Delete one, after a confirmation.
  await ayush.getByRole("button", { name: text.removeLabel("Ayush range") }).click();
  await ayush.getByRole("button", { name: text.removeYes }).click();
  await expect(page.getByText(text.messages.deleted)).toBeVisible();
  await expect(brands.getByRole("listitem")).toHaveCount(2);

  // Launch shows the same brands, with the changes.
  await page.goto("/launch?step=3");
  const launchBrands = page.getByRole("list", { name: text.listLabel });
  await expect(launchBrands.getByRole("listitem")).toHaveCount(2);
  await expect(launchBrands).toContainText("Kesari Wellness");
  await expect(launchBrands).not.toContainText("Ayush range");
  expect(errors).toEqual([]);
});
