import { test, expect, type Page } from "@playwright/test";
import { admin as adminCopy } from "../../src/content/admin";
import { brand } from "../../src/content/brand";
import { e2eDb, signInAs } from "./auth-helpers";
import { makePaidBrandOrder, png } from "./brand-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Build Your Brand stages (P2.2), end to end on phone and desktop: the
// admin's one "Update status" button taking a paid brand order through to
// delivery; a proof sent through the upload route still reaching the
// customer (changes, a new version, approval); and a cancel before
// production with its test refund. The order is written straight
// into the database (as in order-helpers.ts); the customer and the admin
// each use their own browser, as in real life. Fixtures: brand-helpers.ts.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

const proofText = brand.proof;
const detail = brand.detail;
const adminText = brand.admin.detail;

test("the admin moves a paid order through each status with one button", async ({ page, browser, baseURL }) => {
  const errors = collectErrors(page);
  const customer = await signInAs(page, baseURL!, { role: "user", name: "Asha Rao" });
  const order = await makePaidBrandOrder(customer.id);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminErrors = collectErrors(adminPage);
  await adminPage.emulateMedia({ reducedMotion: "reduce" });
  await signInAs(adminPage, baseURL!, { role: "admin", adminRole: "orders" });

  // A paid order is confirmed; no proof is promised.
  await page.goto(`/my-brand/${order.id}`);
  await expect(page.getByText(detail.stageNext.awaiting_proof)).toBeVisible();
  await expect(page.getByRole("heading", { name: proofText.title })).toHaveCount(0);
  const steps = page.getByRole("list", { name: detail.timelineLabel });
  await expect(steps.getByRole("listitem")).toHaveCount(4);
  await expect(steps.getByRole("listitem").first()).toContainText(detail.timeline.confirmed);
  await expect(steps.getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await checkPage(page, errors);

  // The admin sees one status card with one button: no proofs, production
  // or history sections.
  await adminPage.goto(`/admin/brand-orders/${order.id}`);
  await expect(adminPage.getByRole("heading", { name: adminText.status, exact: true })).toBeVisible();
  await expect(adminPage.getByRole("form", { name: adminText.uploadTitle })).toHaveCount(0);
  for (const removed of ["Label proofs", "Production", "Stage history"]) {
    await expect(adminPage.getByRole("heading", { name: removed, exact: true })).toHaveCount(0);
  }
  await expect(adminPage.getByRole("textbox")).toHaveCount(0);
  await checkPage(adminPage, adminErrors);

  for (const step of ["in_production", "quality_check", "dispatched", "delivered"] as const) {
    const label = detail.stageLabels[step];
    await adminPage.getByRole("button", { name: adminText.updateStatus(label) }).click();
    // The last step removes the button (and its message) with it.
    if (step === "delivered") await expect(adminPage.getByText(adminText.finished)).toBeVisible();
    else await expect(adminPage.getByText(adminText.results.moved(label))).toBeVisible();
    await page.reload();
    await expect(page.getByText(detail.stageNext[step])).toBeVisible();
  }
  // Delivered: every step is done, the courier is shown, and the history is kept.
  await expect(steps.getByRole("listitem").nth(3)).not.toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { name: proofText.tracking })).toBeVisible();
  await expect(page.getByText(/tracking number/)).toBeVisible();
  await expect(page.getByRole("heading", { name: proofText.history })).toBeVisible();
  await checkPage(page, errors);
  await adminPage.reload();
  await expect(adminPage.getByText(adminText.finished)).toBeVisible();
  await expect(adminPage.getByRole("button", { name: /^Update status/ })).toHaveCount(0);
  await checkPage(adminPage, adminErrors);

  const saved = await e2eDb().order.findUniqueOrThrow({
    where: { id: order.id },
    include: { brandDetails: { include: { proofs: true } }, shipment: true },
  });
  expect(saved.status).toBe("delivered");
  expect(saved.shipment?.status).toBe("delivered");
  expect(saved.brandDetails?.proofs).toEqual([]);
  await adminContext.close();
});

test("a proof already sent still reaches the customer, and its files stay private", async ({ page, browser, baseURL }) => {
  const errors = collectErrors(page);
  const customer = await signInAs(page, baseURL!, { role: "user", name: "Asha Rao" });
  const order = await makePaidBrandOrder(customer.id);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signInAs(adminPage, baseURL!, { role: "admin", adminRole: "orders" });
  // The admin page has no upload form any more; the route still takes a file.
  await adminPage.goto(`/admin/brand-orders/${order.id}`);
  const sendProof = (name: string, mimeType: string, buffer: Buffer, note?: string) =>
    adminPage.request.post(`/api/brand-orders/${order.id}/proofs`, {
      headers: { origin: baseURL! },
      multipart: { file: { name, mimeType, buffer }, ...(note ? { note } : {}) },
    });
  expect((await sendProof("proof-v1.png", "image/png", png, "First draft of your label")).status()).toBe(200);
  // A file that isn't a PDF or image is refused (the type comes from its bytes).
  expect((await sendProof("fake.png", "image/png", Buffer.from("not really an image"))).status()).toBe(415);

  // The customer sees it and asks for changes (a comment is required).
  await page.goto(`/my-brand/${order.id}`);
  await expect(page.getByText(detail.stageNext.proof_sent)).toBeVisible();
  await expect(page.getByRole("heading", { name: proofText.version(1) })).toBeVisible();
  await expect(page.getByText("First draft of your label")).toBeVisible();
  await expect(page.getByRole("img", { name: new RegExp(proofText.version(1)) })).toBeVisible();
  await checkPage(page, errors);
  const decision = page.getByRole("form", { name: proofText.changes });
  await decision.getByRole("button", { name: proofText.send }).click();
  await expect(page.getByText(proofText.errors.comment).first()).toBeVisible();
  await decision.getByLabel(proofText.commentLabel).fill("Please make the logo bigger");
  await decision.getByRole("button", { name: proofText.send }).click();
  await expect(page.getByText(detail.stageNext.changes_requested)).toBeVisible();
  await expect(decision).toHaveCount(0);

  // Version 2 (a PDF), which the customer approves. Earlier versions stay listed.
  expect((await sendProof("proof-v2.pdf", "application/pdf", pdf)).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: proofText.version(2) })).toBeVisible();
  await expect(page.getByRole("heading", { name: proofText.version(1) })).toBeVisible();
  await page.getByRole("form", { name: proofText.changes }).getByRole("button", { name: proofText.approve }).click();
  await expect(page.getByText(detail.stageNext.proof_approved)).toBeVisible();
  await checkPage(page, errors);

  // The admin's button takes it on from there.
  await adminPage.reload();
  await adminPage.getByRole("button", { name: adminText.updateStatus(detail.stageLabels.in_production) }).click();
  await expect(adminPage.getByText(adminText.results.moved(detail.stageLabels.in_production))).toBeVisible();

  const saved = await e2eDb().order.findUniqueOrThrow({
    where: { id: order.id },
    include: { brandDetails: { include: { proofs: { orderBy: { version: "asc" } } } } },
  });
  expect(saved.status).toBe("processing");
  expect(saved.brandDetails?.proofs.map((proof) => proof.status)).toEqual(["changes_requested", "approved"]);

  // Proof files are the owner's and admins' only.
  expect((await page.request.get(`/api/brand-orders/${order.id}/proofs/1`)).status()).toBe(200);
  expect((await adminPage.request.get(`/api/brand-orders/${order.id}/proofs/2?download=1`)).headers()["content-disposition"]).toMatch(/^attachment/);
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await signInAs(strangerPage, baseURL!, { role: "user" });
  expect((await strangerPage.request.get(`/api/brand-orders/${order.id}/proofs/1`)).status()).toBe(404);
  // A customer can't use the admin's upload route either.
  expect(
    (await strangerPage.request.post(`/api/brand-orders/${order.id}/proofs`, {
      headers: { origin: baseURL! },
      multipart: { file: { name: "p.png", mimeType: "image/png", buffer: png } },
    })).status(),
  ).toBe(404);
  // And a request from another site is refused before anything is read.
  expect(
    (await adminPage.request.post(`/api/brand-orders/${order.id}/proofs`, {
      headers: { origin: "https://evil.example" },
      multipart: { file: { name: "p.png", mimeType: "image/png", buffer: png } },
    })).status(),
  ).toBe(403);
  await stranger.close();
  await adminContext.close();
});

test("an admin cancels before production and the payment is refunded", async ({ page, browser, baseURL }) => {
  const errors = collectErrors(page);
  const customer = await signInAs(page, baseURL!, { role: "user", name: "Asha Rao" });
  const order = await makePaidBrandOrder(customer.id);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminErrors = collectErrors(adminPage);
  await adminPage.emulateMedia({ reducedMotion: "reduce" });
  await signInAs(adminPage, baseURL!, { role: "admin", adminRole: "orders" });

  // The generic orders page sends brand orders to their own page for delivery.
  await adminPage.goto(`/admin/orders/${order.id}`);
  await expect(adminPage.getByText(adminCopy.orderDetail.brandShipment)).toBeVisible();

  await adminPage.goto(`/admin/brand-orders/${order.id}`);
  await adminPage.getByRole("button", { name: adminCopy.orderDetail.cancel }).click();
  await adminPage.getByRole("dialog").getByLabel(adminCopy.orderDetail.cancelNote).fill("Customer changed their mind");
  await adminPage.getByRole("button", { name: adminCopy.orderDetail.cancelConfirm }).click();
  await expect(adminPage.getByText(adminCopy.orderDetail.cancelled(false))).toBeVisible();

  const saved = await e2eDb().order.findUniqueOrThrow({
    where: { id: order.id },
    include: { payments: true, brandDetails: true },
  });
  expect(saved.status).toBe("cancelled");
  expect(saved.brandDetails?.stage).toBe("cancelled");
  expect(saved.payments[0]?.refundReference).toMatch(/^test_refund_/);

  await adminPage.reload();
  await expect(adminPage.getByText(adminText.cancelled)).toBeVisible();
  await expect(adminPage.getByText(adminText.cancelNotAllowed)).toBeVisible();
  await checkPage(adminPage, adminErrors);

  await page.goto(`/my-brand/${order.id}`);
  await expect(page.getByText(detail.stageNext.cancelled).first()).toBeVisible();
  await checkPage(page, errors);
  await adminContext.close();
});
