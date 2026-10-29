import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { inventory as copy } from "../../src/content/inventory";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";
import { stockCreate } from "../setup/stock-create";

// Admin Inventory: B2C (batches, receiving, adjusting, expiry) and B2B
// (components, recipes, what can be made) at 375 and 1280 px. Everything it
// makes is named "E2E ..." and removed by cleanup.

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

const main = (page: Page) => page.getByRole("main");

test("the admin manages finished goods in B2C Inventory", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  const name = `E2E Stock Vati ${token}`;
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const product = await db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}inv-${token}`,
      name,
      formId: form.id,
      description: "A product made by the inventory e2e test.",
      packSize: "60 tablets",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      stockItem: stockCreate(name, 0),
    },
    select: { id: true },
  });
  await signInAs(page, baseURL!, { role: "admin" });

  await page.goto("/admin/inventory");
  await expect(page).toHaveURL(/\/admin\/inventory\/b2c/);
  await expect(page.getByRole("link", { name: copy.tabs.b2b })).toBeVisible();
  await page.getByRole("searchbox", { name: copy.b2c.filters.search }).fill(name);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(main(page).getByText(name)).toBeVisible();
  await checkPage(page, errors);

  await page.getByRole("link", { name: copy.b2c.manageLabel(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Receive: a bad quantity first, then two batches.
  const receive = page.locator("form", { has: page.getByRole("heading", { name: copy.item.receive.title }) });
  await receive.getByLabel(copy.item.receive.quantity).fill("0");
  await receive.getByRole("button", { name: copy.item.receive.submit }).click();
  await expect(receive.getByText(copy.errors.quantity)).toBeVisible();
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  await receive.getByLabel(copy.item.receive.quantity).fill("30");
  await receive.getByLabel(copy.item.receive.batchNo).fill("LATE");
  await receive.getByLabel(copy.item.receive.expiryDate).fill(day(400));
  await receive.getByRole("button", { name: copy.item.receive.submit }).click();
  await expect(receive.getByText(copy.messages.received)).toBeVisible();
  await receive.getByLabel(copy.item.receive.quantity).fill("12");
  await receive.getByLabel(copy.item.receive.batchNo).fill("SOON");
  await receive.getByLabel(copy.item.receive.expiryDate).fill(day(20));
  await receive.getByRole("button", { name: copy.item.receive.submit }).click();
  await expect(receive.getByText(copy.messages.received)).toBeVisible();
  await expect(page.getByRole("cell", { name: "LATE" }).first()).toBeVisible();
  await expect(page.getByText(copy.item.batches.state.soon(20))).toBeVisible();

  // Adjust: needs a reason.
  const adjust = page.locator("form", { has: page.getByRole("heading", { name: copy.item.adjust.title }) });
  await adjust.getByLabel(copy.item.adjust.batch).selectOption({ label: "SOON (12 pcs)" });
  await adjust.getByLabel(copy.item.adjust.quantity).fill("2");
  await adjust.getByRole("button", { name: copy.item.adjust.submit }).click();
  await expect(adjust.getByText(copy.errors.reason)).toBeVisible();
  await adjust.getByLabel(copy.item.adjust.reason).fill("Damaged in the stock room");
  await adjust.getByRole("button", { name: copy.item.adjust.submit }).click();
  await expect(adjust.getByText(copy.messages.adjusted)).toBeVisible();
  await expect(page.getByText("Damaged in the stock room").first()).toBeVisible();
  await checkPage(page, errors);

  // The shop figure: 40 on sale (30 + 10).
  const item = await db.stockItem.findUniqueOrThrow({ where: { productId: product.id } });
  expect(item.onHand).toBe(40);
  const movements = await db.stockMovement.findMany({ where: { itemId: item.id }, orderBy: { id: "asc" } });
  expect(movements.map((movement) => movement.type)).toEqual(["receipt", "receipt", "adjustment"]);
  expect(movements.every((movement) => movement.userId !== null)).toBe(true);

  // Catalogue shows the shop figure.
  await page.goto(`/admin/catalogue?q=${encodeURIComponent(name)}`);
  await expect(main(page).getByText("Shop: 40 on sale")).toBeVisible();
});

test("the admin sets up components and a recipe in B2B Inventory", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  const db = e2eDb();
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM", active: true } });
  const product = await db.product.create({
    data: {
      slug: `${E2E_CONTENT_PREFIX}recipe-${token}`,
      name: `E2E Syrup ${token}`,
      formId: form.id,
      description: "A Launch product made by the inventory e2e test.",
      packSize: "200 ml",
      mrpPaise: 32_000,
      professionalPricePaise: 24_000,
      gstRate: 5,
      hsnCode: "30049011",
      brandEligible: true,
      brandMinQty: 10,
      brandUnitPricePaise: 20_000,
      brandUnitLabel: "bottles",
    },
    select: { id: true, name: true },
  });
  await signInAs(page, baseURL!, { role: "admin" });
  await page.goto("/admin/inventory/b2b");
  await expect(page.getByRole("heading", { name: copy.b2b.canMake.title })).toBeVisible();
  await checkPage(page, errors);

  // Two components.
  const bottleName = `E2E Bottle ${token}`;
  const baseName = `E2E Syrup base ${token}`;
  await page.getByRole("link", { name: copy.b2b.components.add }).first().click();
  await page.getByLabel(copy.newComponent.name).fill(bottleName);
  await page.getByLabel(copy.newComponent.threshold).fill("100");
  await page.getByRole("button", { name: copy.newComponent.submit }).click();
  await expect(page.getByRole("heading", { name: bottleName })).toBeVisible();
  await page.getByLabel(copy.item.receive.quantity).first().fill("500");
  await page.getByRole("button", { name: copy.component.receive.submit }).click();
  await expect(page.getByText(copy.messages.received)).toBeVisible();

  await page.goto("/admin/inventory/b2b/new");
  await page.getByLabel(copy.newComponent.kind).selectOption("base");
  await page.getByLabel(copy.newComponent.name).fill(baseName);
  await page.getByLabel(copy.newComponent.unit).selectOption("ml");
  await page.getByRole("button", { name: copy.newComponent.submit }).click();
  await expect(page.getByRole("heading", { name: baseName })).toBeVisible();
  await page.getByLabel(copy.item.receive.quantity).first().fill("30");
  await page.getByLabel(copy.unitLabel, { exact: true }).first().selectOption("L");
  await page.getByRole("button", { name: copy.component.receive.submit }).click();
  await expect(page.getByText(copy.messages.received)).toBeVisible();
  await checkPage(page, errors);

  // The recipe: 1 bottle + 200 ml of base per bottle of syrup.
  await page.goto(`/admin/inventory/b2b/recipes/${product.id}`);
  await expect(page.getByText(copy.recipe.empty)).toBeVisible();
  const recipe = page.locator("form");
  await recipe.getByLabel(copy.recipe.columns.component).selectOption({ label: `${bottleName} (pcs)` });
  await recipe.getByLabel(copy.recipe.addQuantity).fill("1");
  await recipe.getByRole("button", { name: copy.recipe.submit }).click();
  await expect(page.getByText(copy.messages.recipeSaved)).toBeVisible();
  await recipe.getByLabel(copy.recipe.columns.component).selectOption({ label: `${baseName} (ml)` });
  await recipe.getByLabel(copy.recipe.addQuantity).fill("200");
  await recipe.getByRole("button", { name: copy.recipe.submit }).click();
  await expect(page.getByText(copy.recipe.makeable(150, "units"))).toBeVisible();
  await checkPage(page, errors);

  // The "can make" view and the Launch catalogue show the same figure.
  await page.goto("/admin/inventory/b2b");
  const row = page.getByRole("row", { name: new RegExp(product.name) });
  await expect(row).toContainText(copy.b2b.canMake.units(150, "bottles"));
  await expect(row).toContainText(baseName);
});
