import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import {
  test,
  expect,
  type Browser,
  type Page,
} from "@playwright/test";
import { admin } from "../../src/content/admin";
import { verification as copy } from "../../src/content/verification";
import { e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Professional document uploads (P1.2): the /account upload cards, the admin
// review page, and who may see the files. Accounts are e2e-marked and their
// files removed by tests/e2e/cleanup.ts.

const token = () => `${Date.now().toString(36)}${randomInt(1000)}`;

/** A small, valid one-page PDF. */
const pdf = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"),
);
const jpg = readFileSync("public/media/doctor-feedback-english.jpg");

const certificate = copy.documentTypes.registration_certificate.label;
const degree = copy.documentTypes.degree_certificate.label;
const collegeId = copy.documentTypes.college_id_card.label;
const aadhaar = copy.documentTypes.aadhaar_card.label;
const pan = copy.documentTypes.pan_card.label;
const licence = copy.documentTypes.drug_licence.label;
const gst = copy.documentTypes.gst_certificate.label;

const statusCard = (page: Page) =>
  page.getByRole("region", { name: "Professional verification" });
const documentCard = (page: Page, label: string) =>
  page.getByRole("listitem", { name: label });

/** Picks a file in a document card and uploads it through the UI. */
async function uploadThroughUi(
  page: Page,
  label: string,
  file: { name: string; mimeType: string; buffer: Buffer },
  picker: string = copy.choose,
) {
  const card = documentCard(page, label);
  await card.getByLabel(copy.fileFor(picker, label)).setInputFiles(file);
  await expect(card.getByText(copy.selected)).toBeVisible();
  await expect(card.getByText(file.name)).toBeVisible();
  await card.getByRole("button", { name: copy.uploadNamed(label) }).click();
  // The page refreshes with the file on record.
  await expect(card.getByRole("link", { name: copy.viewNamed(label) })).toBeVisible();
}

/** A second signed-in browser for the professional, at the test's size. */
async function professionalPage(
  browser: Browser,
  page: Page,
  baseURL: string,
  options: { name: string; userType: string },
) {
  const context = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    isMobile: test.info().project.use.isMobile,
    hasTouch: test.info().project.use.hasTouch,
  });
  const proPage = await context.newPage();
  const account = await signInAs(proPage, baseURL, {
    role: "user",
    verificationStatus: "pending",
    ...options,
  });
  return { proPage, account, context };
}

test("a doctor uploads their registration and degree and waits for review", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    name: `E2E Doctor ${token()}`,
    verificationStatus: "pending",
  });
  await page.goto("/account");
  await expect(statusCard(page)).toContainText(copy.state.needed.badge);
  const card = documentCard(page, certificate);
  await expect(card).toContainText(copy.missing);
  const picker = card.getByLabel(copy.fileFor(copy.choose, certificate));

  // The browser refuses the wrong type and files over 5 MB straight away.
  await picker.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a certificate"),
  });
  await expect(card.getByRole("alert")).toHaveText(copy.errors.fileType);
  await picker.setInputFiles({
    name: "huge.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(6 * 1024 * 1024, 0x25),
  });
  await expect(card.getByRole("alert")).toHaveText(copy.errors.tooLarge("5 MB"));

  // A PDF, checked on the server too: renamed text is refused there.
  await picker.setInputFiles({
    name: "sneaky.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<html>not a pdf</html>"),
  });
  await card.getByRole("button", { name: copy.uploadNamed(certificate) }).click();
  await expect(card.getByRole("alert")).toHaveText(copy.errors.fileType);
  await card.getByRole("button", { name: copy.cancel }).click();

  await uploadThroughUi(page, certificate, {
    name: "registration.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  // The degree is still missing, so the review hasn't started.
  await expect(statusCard(page)).toContainText(copy.state.needed.badge);
  await expect(documentCard(page, degree)).toContainText(copy.missing);
  await uploadThroughUi(page, degree, {
    name: "degree.jpg",
    mimeType: "image/jpeg",
    buffer: jpg,
  });
  await expect(statusCard(page)).toContainText(copy.state.review.badge);
  await expect(statusCard(page)).toContainText(/Submitted on \d{1,2} \w{3} \d{4}/);
  await expect(card).toContainText("registration.pdf");
  await expect(card.getByLabel(copy.fileFor(copy.replace, certificate))).toBeAttached();

  // The file opens for its owner.
  const href = await card
    .getByRole("link", { name: copy.viewNamed(certificate) })
    .getAttribute("href");
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);
  // Chrome logs the server's (expected) 415 for the renamed text file.
  expect(errors.filter((error) => !error.includes("status of 415"))).toEqual([]);
});

test("a pharmacy is submitted only once both documents are in", async ({
  page,
  baseURL,
}) => {
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "pharmacy",
    name: `E2E Pharmacy ${token()}`,
    verificationStatus: "pending",
  });
  await page.goto("/account");
  await uploadThroughUi(page, licence, {
    name: "drug-licence.jpg",
    mimeType: "image/jpeg",
    buffer: jpg,
  });
  await expect(statusCard(page)).toContainText(copy.state.needed.badge);
  await expect(documentCard(page, gst)).toContainText(copy.missing);

  await uploadThroughUi(page, gst, {
    name: "gst.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(statusCard(page)).toContainText(copy.state.review.badge);
});

test("a student is submitted with their college ID card", async ({
  page,
  baseURL,
}) => {
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "student",
    name: `E2E Student ${token()}`,
    verificationStatus: "pending",
  });
  await page.goto("/account");
  await expect(statusCard(page)).toContainText(copy.state.needed.badge);
  await uploadThroughUi(page, collegeId, {
    name: "college-id.jpg",
    mimeType: "image/jpeg",
    buffer: jpg,
  });
  await expect(statusCard(page)).toContainText(copy.state.review.badge);
});

test("a clinic gives its Aadhaar and PAN cards and a phone number", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "clinic",
    name: `E2E Clinic ${token()}`,
    verificationStatus: "pending",
  });
  await page.goto("/account");
  await uploadThroughUi(page, aadhaar, {
    name: "aadhaar.jpg",
    mimeType: "image/jpeg",
    buffer: jpg,
  });
  await uploadThroughUi(page, pan, {
    name: "pan.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  // Both cards are in, but the phone number is still missing.
  await expect(statusCard(page)).toContainText(copy.state.needed.badge);
  const phoneCard = documentCard(page, copy.phoneLabel);
  await expect(phoneCard).toContainText(copy.phone.missing);

  const field = phoneCard.getByLabel(copy.phone.field);
  await field.fill("12345");
  await phoneCard.getByRole("button", { name: copy.phone.save }).click();
  await expect(phoneCard).toContainText(copy.phone.invalid);

  await field.fill("98123 45678");
  await phoneCard.getByRole("button", { name: copy.phone.save }).click();
  await expect(phoneCard.getByRole("status")).toHaveText(copy.submitted);
  await expect(phoneCard).toContainText("+91 98123 45678");
  await expect(statusCard(page)).toContainText(copy.state.review.badge);

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("admin review: reject with a reason, re-upload, then approve", async ({
  page,
  browser,
  baseURL,
  isMobile,
}) => {
  test.slow();
  const name = `E2E Reviewed ${token()}`;
  const { proPage, account, context } = await professionalPage(
    browser,
    page,
    baseURL!,
    { name, userType: "doctor" },
  );
  const sent = await proPage.request.post("/api/account/documents", {
    headers: { origin: baseURL! },
    multipart: {
      documentType: "registration_certificate",
      file: { name: "blurred.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(await sent.json()).toEqual({ ok: true, complete: false });
  const second = await proPage.request.post("/api/account/documents", {
    headers: { origin: baseURL! },
    multipart: {
      documentType: "degree_certificate",
      file: { name: "degree.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(await second.json()).toEqual({ ok: true, complete: true });

  // The admin finds them in approvals and opens the review.
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, { role: "admin" });
  await page.goto("/admin/approvals");
  const row = page.locator("#admin-main").getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(admin.approvals.documentCount(2, 2));
  await row.getByRole("link", { name: admin.approvals.reviewNamed(name) }).click();

  const main = page.locator("#admin-main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(name);
  const document = main.getByRole("listitem", { name: certificate });
  await expect(document).toContainText("blurred.pdf");
  if (isMobile) {
    await expect(document.getByText(admin.review.pdfOnPhones)).toBeVisible();
  } else {
    await expect(
      document.locator(`iframe[title="${admin.review.previewTitle(certificate)}"]`),
    ).toBeVisible();
  }
  const download = await document
    .getByRole("link", { name: admin.review.downloadNamed(certificate) })
    .getAttribute("href");
  const saved = await page.request.get(download!);
  expect(saved.status()).toBe(200);
  expect(saved.headers()["content-disposition"]).toMatch(/^attachment; filename="blurred.pdf"/);
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);

  // Reject, with a reason the professional will see.
  const reason = "The registration number isn't readable.";
  await main.getByLabel(admin.userDetail.decide.noteLabel).fill(reason);
  await main.getByRole("button", { name: admin.approvals.rejectNamed(name) }).click();
  await expect(main.getByRole("status")).toContainText(admin.userDetail.decide.rejected);
  const history = main.getByRole("region", { name: admin.review.historyTitle });
  await expect(history).toContainText(reason);
  await expect(history).toContainText(admin.review.by("E2E Admin"));

  // The professional sees why, and uploads a corrected file.
  await proPage.goto("/account");
  await expect(statusCard(proPage)).toContainText(copy.state.rejected.badge);
  await expect(statusCard(proPage)).toContainText(reason);
  await expect(statusCard(proPage)).toContainText(copy.reuploadPrompt);
  await uploadThroughUi(
    proPage,
    certificate,
    { name: "clear-scan.jpg", mimeType: "image/jpeg", buffer: jpg },
    copy.replace,
  );
  await expect(statusCard(proPage)).toContainText(copy.state.review.badge);

  // The admin sees the new file (as an image) and approves.
  await page.reload();
  await expect(document).toContainText("clear-scan.jpg");
  await expect(
    document.getByRole("img", { name: admin.review.previewAlt(certificate) }),
  ).toBeVisible();
  await main.getByRole("button", { name: admin.approvals.approveNamed(name) }).click();
  await expect(main.getByRole("status")).toContainText(admin.userDetail.decide.approved);
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(document).toContainText(admin.review.verified);

  // Verified: no more uploads.
  await proPage.goto("/account");
  await expect(statusCard(proPage)).toContainText(copy.state.approved.badge);
  await expect(proPage.getByText(copy.documentsLocked)).toBeVisible();
  await expect(proPage.getByLabel(copy.fileFor(copy.replace, certificate))).toHaveCount(0);
  await expect(documentCard(proPage, certificate)).toContainText(copy.verifiedBadge);

  const decisions = await e2eDb().verificationComment.findMany({
    where: { userId: account.id },
    orderBy: { id: "asc" },
  });
  expect(decisions.map((item) => [item.decision, item.comment])).toEqual([
    ["rejected", reason],
    ["approved", null],
  ]);
  expect(errors).toEqual([]);
  await context.close();
});

test("documents are private to their owner and admins", async ({
  page,
  browser,
  baseURL,
  playwright,
}) => {
  const { proPage, context } = await professionalPage(browser, page, baseURL!, {
    name: `E2E Private ${token()}`,
    userType: "doctor",
  });
  await proPage.request.post("/api/account/documents", {
    headers: { origin: baseURL! },
    multipart: {
      documentType: "registration_certificate",
      file: { name: "private.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  await proPage.goto("/account");
  const href = await documentCard(proPage, certificate)
    .getByRole("link", { name: copy.viewNamed(certificate) })
    .getAttribute("href");
  expect(href).toMatch(/^\/api\/documents\/\d+$/);

  // Another professional, and a visitor, get a 404.
  await signInAs(page, baseURL!, { role: "user", userType: "doctor" });
  expect((await page.request.get(href!)).status()).toBe(404);
  const visitor = await playwright.request.newContext({ baseURL });
  expect((await visitor.get(href!)).status()).toBe(404);

  // Uploads: refused cross-site, signed out, and for customers.
  const upload = {
    documentType: "registration_certificate",
    file: { name: "x.pdf", mimeType: "application/pdf", buffer: pdf },
  };
  expect(
    (
      await proPage.request.post("/api/account/documents", {
        headers: { origin: "https://evil.example" },
        multipart: upload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await visitor.post("/api/account/documents", {
        headers: { origin: baseURL! },
        multipart: upload,
      })
    ).status(),
  ).toBe(401);
  await signInAs(page, baseURL!, { role: "user" });
  expect(
    (
      await page.request.post("/api/account/documents", {
        headers: { origin: baseURL! },
        multipart: upload,
      })
    ).status(),
  ).toBe(403);

  // The file route may only be framed by the site itself.
  const own = await proPage.request.get(href!);
  expect(own.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(own.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");

  await visitor.dispose();
  await context.close();
});
