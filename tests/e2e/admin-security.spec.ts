import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin as adminCopy } from "../../src/content/admin";
import { authErrors } from "../../src/content/auth";
import { adminSecurity } from "../../src/content/admin-security";
import { signIn } from "../../src/content/sign-in";
import { E2E_EMAIL_DOMAIN, e2eDb, freshEmail, freshIp, signInAs, useFreshIp } from "./auth-helpers";
import { totpCode } from "../setup/totp";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Admin security (P1.11): two-factor at sign-in and setup, per-role access,
// and admin invites. Accounts are made in the database and removed by
// tests/e2e/cleanup.ts.

const copy = adminSecurity;

test.beforeEach(async ({ page }) => {
  await useFreshIp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("an admin without two-factor is sent to set it up, then gets in", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const { email, password } = await signInAs(page, baseURL!, { role: "admin", twoFactor: false });

  // No admin page before two-factor is on.
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/account\/two-factor$/);
  await expect(page.getByRole("heading", { name: copy.twoFactor.title })).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);

  // A wrong password gets no secret.
  await page.getByLabel(copy.twoFactor.passwordLabel).fill("not-the-password");
  await page.getByRole("button", { name: copy.twoFactor.start }).click();
  await expect(page.getByText(copy.errors.wrongPassword)).toBeVisible();
  const db = e2eDb();
  expect((await db.user.findUniqueOrThrow({ where: { email } })).twoFactorEnabled).toBe(false);

  // The right one shows the key and backup codes; a wrong code doesn't turn it on.
  await page.getByLabel(copy.twoFactor.passwordLabel).fill(password);
  await page.getByRole("button", { name: copy.twoFactor.start }).click();
  await expect(page.getByTestId("manual-key")).toBeVisible();
  await expect(page.getByTestId("backup-codes").locator("li")).toHaveCount(8);
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);

  await page.getByLabel(copy.twoFactor.codeLabel).fill("000000");
  await page.getByRole("button", { name: copy.twoFactor.confirm }).click();
  await expect(page.getByText(copy.errors.wrongCode)).toBeVisible();

  // Read the key like an authenticator app would, then confirm.
  const base32 = (await page.getByTestId("manual-key").innerText()).trim();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...base32.toUpperCase()].map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  await page.getByLabel(copy.twoFactor.codeLabel).fill(totpCode(key));
  await page.getByRole("button", { name: copy.twoFactor.confirm }).click();
  await expect(page.getByText(copy.twoFactor.done)).toBeVisible();
  await page.getByRole("link", { name: copy.twoFactor.openAdmin }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("#admin-main")).toBeVisible();

  const log = await db.adminLog.findFirst({ where: { action: "admin.2fa.enable", user: { email } } });
  expect(log).not.toBeNull();
  expect(errors.filter((error) => !/status of 4\d\d/.test(error))).toEqual([]);
});

test("signing in through the form asks for the authenticator code", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const db = e2eDb();
  // Make the admin, then come back signed out and use the real form.
  const { email, password, totp } = await signInAs(page, baseURL!, { role: "admin" });
  await page.context().clearCookies();
  await db.session.deleteMany({ where: { user: { email } } });
  await useFreshIp(page);

  await page.goto("/?auth=sign-in&next=%2Fadmin");
  const dialog = page.getByRole("dialog", { name: signIn.title });
  await dialog.getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog.getByRole("textbox", { name: signIn.email.email, exact: true }).fill(email);
  await dialog.getByLabel(signIn.email.password, { exact: true }).first().fill(password);
  await dialog.getByRole("button", { name: signIn.email.submit, exact: true }).click();

  // The password alone isn't enough.
  await expect(dialog.getByRole("heading", { name: copy.signIn.title })).toBeVisible();
  expect(await db.session.count({ where: { user: { email } } })).toBe(0);

  await dialog.getByLabel(copy.signIn.code).fill("000000");
  await dialog.getByRole("button", { name: copy.signIn.submit }).click();
  await expect(dialog.getByText(authErrors.TWO_FACTOR_INVALID)).toBeVisible();

  await dialog.getByLabel(copy.signIn.code).fill(totp.code());
  await dialog.getByRole("button", { name: copy.signIn.submit }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/admin");
  await expect(page.locator("#admin-main")).toBeVisible();
  expect(errors.filter((error) => !/status of 4\d\d/.test(error))).toEqual([]);
});

test("a backup code signs an admin in once", async ({ page, baseURL }) => {
  const { email, password } = await signInAs(page, baseURL!, { role: "admin" });
  await page.context().clearCookies();
  const attempt = async (code: string) => {
    const ip = freshIp();
    await page.request.post("/api/auth/sign-in/email", {
      headers: { origin: baseURL!, "x-forwarded-for": ip },
      data: { email, password },
    });
    return page.request.post("/api/auth/two-factor/verify-backup-code", {
      headers: { origin: baseURL!, "x-forwarded-for": ip },
      data: { code },
    });
  };
  expect((await attempt("e2ebackup1")).status()).toBe(200);
  await page.context().clearCookies();
  expect((await attempt("e2ebackup1")).status()).not.toBe(200);
  await page.context().clearCookies();
  expect((await attempt("e2ebackup2")).status()).toBe(200);
});

test("each role sees and reaches only its own area", async ({ page, baseURL, isMobile }) => {
  await signInAs(page, baseURL!, { role: "admin", adminRole: "catalogue" });
  await page.goto("/admin");
  await expect(page.locator("#admin-main")).toBeVisible();
  const visible = isMobile ? page.locator("header nav") : page.locator("aside nav");
  await expect(visible.getByRole("link", { name: adminCopy.nav.catalogue })).toBeVisible();
  await expect(visible.getByRole("link", { name: adminCopy.nav.users })).toHaveCount(0);
  await expect(visible.getByRole("link", { name: adminCopy.nav.settings })).toHaveCount(0);
  await expect(visible.getByRole("link", { name: copy.admins.nav })).toHaveCount(0);

  await page.goto("/admin/catalogue");
  await expect(page.locator("#admin-main")).toBeVisible();
  for (const path of [
    "/admin/users",
    "/admin/orders",
    "/admin/reports",
    "/admin/settings",
    "/admin/content/reels",
    "/admin/approvals",
    "/admin/database",
    "/admin/admins",
  ]) {
    await page.goto(path);
    await expect(page.locator("#admin-main"), path).toHaveCount(0);
  }
  expect((await page.request.get("/api/admin/tables/User")).status()).toBe(404);
  expect((await page.request.get("/admin/reports/export/orders")).status()).toBe(404);
});

test("an orders admin gets orders and reports, not content", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  await page.goto("/admin/orders");
  await expect(page.locator("#admin-main")).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.locator("#admin-main")).toBeVisible();
  await page.goto("/admin/content/reels");
  await expect(page.locator("#admin-main")).toHaveCount(0);
  await page.goto("/admin/catalogue");
  await expect(page.locator("#admin-main")).toHaveCount(0);
});

test("a super admin invites an admin, who joins and must set up two-factor", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const db = e2eDb();
  const { id } = await signInAs(page, baseURL!, { role: "admin" });
  const invited = freshEmail();

  await page.goto("/admin/admins");
  await expect(page.getByRole("heading", { name: copy.admins.title, level: 1 })).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);
  await page.getByLabel(copy.admins.inviteEmail, { exact: true }).fill(invited);
  await page.getByLabel(copy.admins.inviteRole, { exact: true }).selectOption("content");
  await page.getByRole("button", { name: copy.admins.inviteSubmit }).click();
  await expect(page.getByText(copy.admins.notices.invited)).toBeVisible();
  const invite = await db.adminInvite.findFirstOrThrow({ where: { email: invited } });
  expect(invite).toMatchObject({ adminRole: "content", invitedById: id });
  await expect(page.getByText(invited)).toBeVisible();

  // Emails aren't sent yet, so the page shows the one-time link to pass on.
  const link = await page.getByLabel(copy.admins.notices.inviteLinkLabel).inputValue();
  const token = link.split("/admin-invite/")[1]!;
  expect(createHash("sha256").update(token).digest("hex")).toBe(invite.tokenHash);
  expect(await axeViolations(page)).toEqual([]);
  await page.context().clearCookies();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole("heading", { name: copy.invite.page.title })).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);

  await page.getByLabel(copy.invite.page.name).fill("Invited Admin");
  await page.getByLabel(copy.invite.page.password, { exact: true }).fill("short");
  await page.getByLabel(copy.invite.page.confirm).fill("short");
  await page.getByRole("button", { name: copy.invite.page.submit }).click();
  await expect(page.getByText(copy.errors.password(12))).toBeVisible();

  const password = `Inv-${randomBytes(12).toString("base64url")}`;
  await page.getByLabel(copy.invite.page.password, { exact: true }).fill(password);
  await page.getByLabel(copy.invite.page.confirm).fill(password);
  await page.getByRole("button", { name: copy.invite.page.submit }).click();
  await expect(page.getByText(copy.invite.page.done)).toBeVisible();
  expect(await db.user.findUniqueOrThrow({ where: { email: invited } })).toMatchObject({
    role: "admin",
    adminRole: "content",
    twoFactorEnabled: false,
  });

  // The link is used up.
  await page.goto(`/admin-invite/${token}`);
  await expect(page.getByRole("heading", { name: copy.invite.page.invalidTitle })).toBeVisible();

  // Signing in works, but the panel waits for two-factor.
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL!, "x-forwarded-for": freshIp() },
    data: { email: invited, password },
  });
  expect(response.status()).toBe(200);
  await page.goto("/admin/content/reels");
  await expect(page).toHaveURL(/\/account\/two-factor$/);
  expect(invited.endsWith(E2E_EMAIL_DOMAIN)).toBe(true);
  expect(errors.filter((error) => !/status of 4\d\d/.test(error))).toEqual([]);
});

test("a made-up invitation link says so", async ({ page }) => {
  await page.goto("/admin-invite/not-a-real-token-0000000000");
  await expect(page.getByRole("heading", { name: copy.invite.page.invalidTitle })).toBeVisible();
});

test("only a super admin can use the Admins page", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  await page.goto("/admin/admins");
  await expect(page.locator("#admin-main")).toHaveCount(0);
});

