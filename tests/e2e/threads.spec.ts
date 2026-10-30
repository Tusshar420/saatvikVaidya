import { test, expect } from "@playwright/test";
import { threads as copy } from "../../src/content/threads";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Dr. Talk threads: a verified doctor posts, replies and likes; a customer
// reads and likes but cannot post or reply; signed-out visitors are asked to
// sign in.

test("signed-out visitors are asked to sign in", async ({ page }) => {
  await page.goto("/doctor-talk");
  await expect(page.getByRole("heading", { name: copy.signedOutTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: copy.signIn })).toBeVisible();
});

test("a verified doctor posts, replies and likes", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    verificationStatus: "approved",
    name: "Dr E2E Thread",
  });
  const title = `E2E thread ${Date.now()}`;

  await page.goto("/doctor-talk");
  await page.getByRole("button", { name: copy.ask }).click();
  await page.getByLabel(copy.form.title).fill(title);
  await page.getByLabel(copy.form.body).fill("How do you manage chronic gastritis in practice?");
  await page.getByRole("button", { name: copy.form.submit }).click();

  await expect(page).toHaveURL(/\/doctor-talk\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByLabel(copy.reply.label).fill("I start with Avipattikar churna.");
  await page.getByRole("button", { name: copy.reply.submit }).click();
  await expect(page.getByText("I start with Avipattikar churna.")).toBeVisible();

  await page.getByRole("button", { name: new RegExp(copy.likeAction) }).click();
  await expect(page.getByRole("button", { name: new RegExp(copy.unlikeAction) })).toBeVisible();

  await page.goto("/doctor-talk");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByText(copy.reply.count(1)).first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a customer can read and like threads but not post or reply", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const author = await signInAs(page, baseURL!, {
    role: "user",
    userType: "doctor",
    verificationStatus: "approved",
  });
  const thread = await e2eDb().thread.create({
    data: { authorId: author.id, kind: "question", title: "E2E readable thread", body: "A question for the doctors." },
  });
  await page.context().clearCookies();
  await signInAs(page, baseURL!, { role: "user" });

  await page.goto(`/doctor-talk/${thread.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "E2E readable thread" })).toBeVisible();
  await expect(page.getByLabel(copy.reply.label)).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp(copy.likeAction) }).click();
  await expect(page.getByRole("button", { name: new RegExp(copy.unlikeAction) })).toBeVisible();
  await expect(page.getByText(copy.like(1))).toBeVisible();
  await page.goto("/doctor-talk");
  await expect(page.getByText(copy.readOnlyNote)).toBeVisible();
  await expect(page.getByRole("button", { name: copy.ask })).toHaveCount(0);
});
