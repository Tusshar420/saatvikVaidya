import { test, expect, type Page } from "@playwright/test";
import { admin as adminCopy } from "../../src/content/admin";
import { brand } from "../../src/content/brand";
import { e2eDb, signInAs } from "./auth-helpers";
import { makePaidBrandOrder, png } from "./brand-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Launch Your Brand label proof and production (P2.2), end to end on phone
// and desktop: a paid brand order, a proof from the team, changes requested,
// a new proof, approval, then production through to delivery; and a cancel
// before production with its test refund. The order is written straight
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

test("proof, changes, a new proof, approval, production and delivery", async ({ page, browser, baseURL }) => {
  const errors = collectErrors(page);
  const customer = await signInAs(page, baseURL!, { role: "user", name: "Asha Rao" });
  const order = await makePaidBrandOrder(customer.id);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminErrors = collectErrors(adminPage);
  await adminPage.emulateMedia({ reducedMotion: "reduce" });
  await signInAs(adminPage, baseURL!, { role: "admin", adminRole: "orders" });

  // Before any proof: the customer waits, the admin can send one.
  await page.goto(`/my-brand/${order.id}`);
  await expect(page.getByText(detail.stageNext.awaiting_proof)).toBeVisible();
  await expect(page.getByText(proofText.none)).toBeVisible();
  const steps = page.getByRole("list", { name: detail.timelineLabel });
  await expect(steps.getByRole("listitem")).toHaveCount(4);
  await expect(steps.getByRole("listitem").first()).toContainText(detail.timeline.confirmed);
  await expect(steps.getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await checkPage(page, errors);

  await adminPage.goto(`/admin/brand-orders/${order.id}`);
  await expect(adminPage.getByText(adminText.noProofs)).toBeVisible();
  await expect(adminPage.getByText(adminText.needProof)).toBeVisible();
  await checkPage(adminPage, adminErrors);

  // The team sends version 1.
  const upload = adminPage.getByRole("form", { name: adminText.uploadTitle });
  await upload.getByLabel(adminText.fileLabel).setInputFiles({ name: "proof-v1.png", mimeType: "image/png", buffer: png });
  await upload.getByLabel(adminText.noteLabel).fill("First draft of your label");
  await upload.getByRole("button", { name: adminText.upload }).click();
  await expect(adminPage.getByText(adminText.uploaded(1))).toBeVisible();
  await expect(adminPage.getByRole("heading", { name: proofText.version(1) })).toBeVisible();
  // A file that isn't a PDF or image is refused (the type comes from its bytes).
  await upload.getByLabel(adminText.fileLabel).setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not really an image"),
  });
  await upload.getByRole("button", { name: adminText.upload }).click();
  await expect(adminPage.getByText(adminText.results.fileType)).toBeVisible();
  // The browser logs that refused upload (415); it's the one we expect.
  const refused = adminErrors.findIndex((message) => message.includes("415"));
  expect(refused).toBeGreaterThanOrEqual(0);
  adminErrors.splice(refused, 1);

  // The customer sees it and asks for changes (a comment is required).
  await page.reload();
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

  // The admin sees the comment and sends version 2 (a PDF).
  await adminPage.reload();
  await expect(adminPage.getByText("Please make the logo bigger", { exact: true })).toBeVisible();
  const second = adminPage.getByRole("form", { name: adminText.uploadTitle });
  await second.getByLabel(adminText.fileLabel).setInputFiles({ name: "proof-v2.pdf", mimeType: "application/pdf", buffer: pdf });
  await second.getByRole("button", { name: adminText.upload }).click();
  await expect(adminPage.getByText(adminText.uploaded(2))).toBeVisible();
  // Production can't start before approval: there's no button for it.
  await expect(adminPage.getByRole("button", { name: adminText.steps.in_production })).toHaveCount(0);

  // The customer approves version 2. Earlier versions stay listed.
  await page.reload();
  await expect(page.getByRole("heading", { name: proofText.version(2) })).toBeVisible();
  await expect(page.getByRole("heading", { name: proofText.version(1) })).toBeVisible();
  await page.getByRole("form", { name: proofText.changes }).getByRole("button", { name: proofText.approve }).click();
  await expect(page.getByText(detail.stageNext.proof_approved)).toBeVisible();
  await checkPage(page, errors);

  // Production, one step at a time.
  await adminPage.reload();
  for (const [step, label] of [
    ["in_production", detail.stageLabels.in_production],
    ["quality_check", detail.stageLabels.quality_check],
    ["dispatched", detail.stageLabels.dispatched],
    ["delivered", detail.stageLabels.delivered],
  ] as const) {
    await adminPage.getByRole("button", { name: adminText.steps[step] }).click();
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
  await checkPage(adminPage, adminErrors);

  const db = e2eDb();
  const saved = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { brandDetails: { include: { proofs: { orderBy: { version: "asc" } } } }, shipment: true },
  });
  expect(saved.status).toBe("delivered");
  expect(saved.shipment?.status).toBe("delivered");
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
