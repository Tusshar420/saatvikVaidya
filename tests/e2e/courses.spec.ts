import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cart } from "../../src/content/cart";
import { checkout } from "../../src/content/checkout";
import { courses as copy } from "../../src/content/courses";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Courses (B1, B2), end to end: an approved doctor creates a course, staff
// approve it, and a buyer enrols, pays with the test payment and sees how to
// join. The course title starts "E2E", so its key starts "e2e-" and
// tests/e2e/cleanup.ts removes it.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const fields = copy.doctor.fields;
const addressFields = checkout.address.fields;

async function checkPage(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

test("a doctor's course is reviewed, bought and opened by the buyer", async ({ page, browser, baseURL }) => {
  test.slow();
  await useFreshIp(page);
  const errors = collectErrors(page);
  const title = `E2E Course ${Date.now().toString(36)}${randomInt(1000)}`;
  const access = "Join on Zoom: https://example.test/room";

  // The doctor creates the course: it waits for review.
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    verificationStatus: "approved",
    name: "Dr E2E Teacher",
  });
  await page.goto("/account");
  await page.getByRole("link", { name: copy.account.teachShortcut.label }).click();
  await expect(page).toHaveURL(/\/doctor\/courses$/);
  await expect(page.getByText(copy.doctor.empty)).toBeVisible();
  await checkPage(page, errors);
  await page.getByRole("link", { name: copy.doctor.newCourse }).click();
  // A missing title and a bad price are explained on their fields.
  await page.getByLabel(fields.price).fill("abc");
  await page.getByRole("button", { name: fields.submit }).click();
  await expect(page.getByText(copy.doctor.errors.title)).toBeVisible();
  await expect(page.getByText(copy.doctor.errors.price)).toBeVisible();
  // Check the errors where the user reads them. Left at the submit button, a
  // field peeks a few px out from under the sticky header and axe's
  // target-size rule flags it (it did once the rail lost its Home link).
  await page.getByText(copy.doctor.errors.title).scrollIntoViewIfNeeded();
  await checkPage(page, errors);
  await page.getByLabel(fields.title).fill(title);
  await page.getByLabel(fields.tag).fill("Panchakarma");
  await page.getByLabel(fields.format).fill("Live online, 4 sessions");
  await page.getByLabel(fields.body).fill("Four evening sessions on Panchakarma basics.");
  await page.getByLabel(fields.duration).fill("4 weeks");
  await page.getByLabel(fields.price).fill("999");
  await page.getByLabel(fields.accessDetails).fill(access);
  await page.getByRole("button", { name: fields.submit }).click();
  await expect(page.getByText(copy.doctor.saved)).toBeVisible();
  const card = page.getByRole("article", { name: title });
  await expect(card.getByText(copy.doctor.status.pending)).toBeVisible();
  await expect(card).toContainText("₹999");
  await checkPage(page, errors);
  const course = await e2eDb().courseTeaser.findFirstOrThrow({ where: { title } });
  expect(course.key.startsWith("e2e-course-")).toBe(true);

  // Not listed yet.
  const visitor = await browser.newContext({ baseURL });
  const visitorPage = await visitor.newPage();
  expect((await visitorPage.goto(`/courses/${course.key}`))?.status()).toBe(404);
  await visitorPage.goto("/courses");
  await expect(visitorPage.getByText(title)).toHaveCount(0);

  // Staff approve it.
  const staff = await browser.newContext({ baseURL });
  const staffPage = await staff.newPage();
  await signInAs(staffPage, baseURL!, { role: "admin" });
  await staffPage.goto(`/admin/content/courses/${course.id}/edit`);
  await expect(staffPage.getByText(copy.review.by("Dr E2E Teacher"))).toBeVisible();
  await staffPage.getByRole("button", { name: copy.review.approve }).click();
  await expect(staffPage.getByText(copy.review.approved)).toBeVisible();
  await staff.close();

  // A visitor finds it with its price; signing in is needed to enrol.
  await visitorPage.goto("/courses");
  await expect(visitorPage.getByRole("heading", { name: title })).toBeVisible();
  await visitorPage.goto(`/courses/${course.key}`);
  await expect(visitorPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(visitorPage.getByRole("link", { name: copy.page.signInToEnrol })).toBeVisible();
  await expect(visitorPage.getByText(access)).toHaveCount(0);
  await visitor.close();

  // A buyer enrols, checks out and pays.
  await page.context().clearCookies();
  await signInAs(page, baseURL!, { role: "user", name: "E2E Course Buyer" });
  await page.goto(`/courses/${course.key}`);
  await expect(page.getByText(access)).toHaveCount(0);
  // BUG-007: the round side buttons must not sit over the buy button's right end.
  const enrol = page.getByRole("button", { name: `${copy.page.enrol}: ${title}` });
  await enrol.scrollIntoViewIfNeeded();
  const covered = await enrol.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.right - 4, r.top + r.height / 2);
    return !(hit && el.contains(hit));
  });
  expect(covered, "something covers the right end of the Enrol button").toBe(false);
  await enrol.click();
  await expect(page.getByText(copy.page.addedLine(title))).toBeVisible();
  await checkPage(page, errors);
  await page.getByRole("link", { name: copy.page.goToCart }).click();
  const lines = page.getByRole("list", { name: copy.cartLine.listLabel });
  await expect(lines.getByRole("link", { name: title })).toBeVisible();
  const summary = page.getByRole("region", { name: cart.summary.title });
  await expect(summary).toContainText("₹999");
  await checkPage(page, errors);

  await page.goto("/checkout");
  // BUG-006: a course-only cart has nothing to deliver.
  await expect(page.getByRole("heading", { name: new RegExp(checkout.digitalTitleEmphasis) })).toBeVisible();
  const form = page.getByRole("form", { name: checkout.address.formTitleNew });
  await form.getByLabel(addressFields.name).fill("Asha Rao");
  await form.getByLabel(addressFields.phone).fill("9876543210");
  await form.getByLabel(addressFields.line1).fill("Flat 4, Shanti Apartments");
  await form.getByLabel(addressFields.city).fill("Pune");
  await form.getByLabel(addressFields.state).selectOption({ label: "Maharashtra" });
  await form.getByLabel(addressFields.pincode).fill("411001");
  await form.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByRole("radio", { name: /Asha Rao/ })).toBeChecked();
  await page.getByRole("button", { name: checkout.place.button }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\/[A-Za-z0-9_-]{22}$/);
  await page.getByRole("button", { name: checkout.pay.success }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmation\//);

  // Enrolled: the course page shows how to join, and My courses lists it.
  await page.goto(`/courses/${course.key}`);
  await expect(page.getByText(copy.page.enrolledTitle)).toBeVisible();
  await expect(page.getByText(access)).toBeVisible();
  // The meeting address can be tapped.
  await expect(page.getByRole("link", { name: "https://example.test/room" })).toHaveAttribute("href", "https://example.test/room");
  await checkPage(page, errors);
  await page.goto("/account#account-courses");
  const mine = page.getByRole("region", { name: copy.account.title });
  await expect(mine.getByText(title)).toBeVisible();
  await expect(mine.getByRole("link", { name: copy.account.open })).toHaveAttribute("href", `/courses/${course.key}`);
});

test("only approved doctors get the course area", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, { role: "user", userType: "doctor", verificationStatus: "pending" });
  await page.goto("/doctor/courses");
  await expect(page.getByRole("heading", { level: 1, name: copy.doctor.notDoctor.title })).toBeVisible();
  await page.goto("/doctor/courses/new");
  await expect(page.getByRole("heading", { level: 1, name: copy.doctor.notDoctor.title })).toBeVisible();
  await checkPage(page, errors);
  await page.goto("/account");
  await expect(page.getByRole("link", { name: copy.account.teachShortcut.label })).toHaveCount(0);
});

test("signed-out visitors are sent to sign in from the course area", async ({ page }) => {
  await page.goto("/doctor/courses");
  await expect(page).toHaveURL(/auth=sign-in/);
});
