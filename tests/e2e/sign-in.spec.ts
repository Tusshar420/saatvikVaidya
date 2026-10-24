import { expect, test, type Page } from "@playwright/test";
import { account } from "../../src/content/account";
import { authErrors } from "../../src/content/auth";
import { shell } from "../../src/content/shell";
import { signIn } from "../../src/content/sign-in";
import { verification } from "../../src/content/verification";
import {
  createEmailAccount,
  exhaustOtpSends,
  expireOtp,
  freshEmail,
  freshPhone,
  latestOtp,
  resetTokenFor,
  useFreshIp,
} from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// The sign-in / register modal, the signed-in header, /account and
// the reset-password page, on phone and desktop, against the real API.

/**
 * Console errors other than the browser's own "Failed to load resource"
 * note for 4xx replies, which these tests cause on purpose (a wrong
 * password, a common password).
 */
const unexpected = (errors: string[]) =>
  errors.filter(
    (error) =>
      !/^Failed to load resource: the server responded with a status of 4\d\d/.test(
        error,
      ),
  );

const header = (page: Page) => page.getByRole("banner");
const dialog = (page: Page) => page.getByRole("dialog", { name: signIn.title });
const profileButton = (page: Page) =>
  header(page).getByRole("button", { name: shell.header.profileTitle });
const accountMenu = (page: Page, name: string) =>
  header(page).getByRole("button", { name: signIn.menu.trigger(name) });
const phoneField = (page: Page) =>
  dialog(page).getByRole("textbox", { name: signIn.phone.label });
const firstDigit = (page: Page) =>
  dialog(page).getByRole("textbox", { name: "Digit 1 of 6" });
const otpGroup = (page: Page) =>
  dialog(page).getByRole("group", { name: signIn.otp.label });
/** The bell shows only when signed in, on every width. */
const bell = (page: Page) => page.getByTestId("notification-bell");
const youTab = (page: Page) =>
  page
    .getByRole("navigation", { name: shell.dock.label })
    .getByRole("link", { name: shell.dock.you });

/**
 * Under 560 px the header has no profile button or account menu: sign-in,
 * the account and signing out live on the dock's "You" tab (/account).
 */
const onPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 560;

async function openSignIn(page: Page) {
  if (onPhone(page)) {
    await youTab(page).click();
    await expect(page).toHaveURL(/\/account$/);
    await page
      .getByRole("main")
      .getByRole("button", { name: account.guest.signIn })
      .click();
  } else {
    await profileButton(page).click();
  }
  await expect(dialog(page)).toBeVisible();
  await expect(phoneField(page)).toBeFocused();
}

/** Phone step: number, then "Continue with OTP"; lands on the code step. */
async function requestCode(page: Page, phone: string) {
  await phoneField(page).fill(phone);
  await dialog(page).getByRole("button", { name: signIn.phone.submit }).click();
  await expect(
    dialog(page).getByRole("heading", { name: signIn.otp.heading }),
  ).toBeVisible();
  await expect(dialog(page)).toContainText(
    signIn.otp.sentTo(`+91 ${phone.slice(0, 5)} ${phone.slice(5)}`),
  );
  await expect(firstDigit(page)).toBeFocused();
}

/** Types a code the way a person would: one key at a time from box 1. */
async function typeCode(page: Page, code: string) {
  await firstDigit(page).click();
  await page.keyboard.type(code);
}

async function expectSignedIn(page: Page, name: string) {
  await expect(dialog(page)).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: signIn.welcome(name) }),
  ).toBeVisible();
  await expect(bell(page)).toBeVisible();
  if (onPhone(page)) return;
  await expect(accountMenu(page, name)).toBeVisible();
  await expect(profileButton(page)).toHaveCount(0);
}

async function expectSignedOut(page: Page) {
  await expect(bell(page)).toHaveCount(0);
  if (onPhone(page)) await expect(youTab(page)).toBeVisible();
  else await expect(profileButton(page)).toBeVisible();
}

/** Signs out from the account menu, or from /account's button on phones. */
async function signOutFromMenu(page: Page, name: string) {
  if (onPhone(page)) {
    if (!/\/account$/.test(page.url())) await youTab(page).click();
    await page
      .getByRole("main")
      .getByRole("button", { name: account.signOut })
      .click();
  } else {
    await accountMenu(page, name).click();
    await page.getByRole("menuitem", { name: signIn.menu.signOut }).click();
  }
  await expect(
    page.getByRole("status").filter({ hasText: signIn.menu.signedOut }),
  ).toBeVisible();
  await expectSignedOut(page);
  if (!onPhone(page)) await expect(profileButton(page)).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await useFreshIp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("register by phone as a doctor, sign out, then sign in with a code", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const phone = freshPhone();
  const name = "Dr Asha Verma";

  await page.goto("/");
  await openSignIn(page);
  await requestCode(page, phone);
  expect(await axeViolations(page)).toEqual([]);
  // Resend waits for its timer.
  await expect(
    dialog(page).getByRole("button", { name: /Resend code in 0:\d\d/ }),
  ).toBeDisabled();

  // A new number: the right code asks for the registration details.
  await typeCode(page, await latestOtp(phone));
  await expect(
    dialog(page).getByRole("heading", { name: signIn.register.heading }),
  ).toBeVisible();
  const nameField = dialog(page).getByRole("textbox", {
    name: signIn.register.name,
  });
  await expect(nameField).toBeFocused();

  // Nothing filled in: every required field says what's missing.
  const submit = dialog(page).getByRole("button", {
    name: signIn.register.submitPhone,
  });
  await submit.click();
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveAccessibleDescription(
    signIn.register.nameError,
  );
  await expect(dialog(page)).toContainText(signIn.register.userTypeError);
  await expect(dialog(page)).toContainText(signIn.register.termsError);

  // User types come from the database, Customer first.
  const types = dialog(page)
    .getByRole("radiogroup", { name: signIn.register.userType })
    .getByRole("radio");
  await expect(types).toHaveText([
    "Customer",
    "Ayurveda Doctor",
    "Clinic / Hospital",
    "Pharmacy / Store",
    "Stockist / Distributor",
  ]);

  await nameField.fill(name);
  await dialog(page).getByRole("radio", { name: "Ayurveda Doctor" }).click();
  await expect(dialog(page)).toContainText(signIn.register.professionalNote);
  await dialog(page)
    .getByRole("checkbox", { name: /I agree to the/ })
    .check();
  expect(await axeViolations(page)).toEqual([]);
  await submit.click();

  await expectSignedIn(page, name);
  if (!onPhone(page)) {
    // Focus lands on the new account button, not lost on the page.
    await expect(accountMenu(page, name)).toBeFocused();
    // The account page from the menu (phones signed in on it already).
    await accountMenu(page, name).click();
    await page.getByRole("menuitem", { name: signIn.menu.account }).click();
  }
  await expect(page).toHaveURL(/\/account$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText(name);
  await expect(main).toContainText(
    `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
  );
  await expect(main).toContainText("Ayurveda Doctor");
  // A new doctor is asked for their documents (P1.2).
  await expect(main).toContainText(verification.state.needed.badge);
  await expect(main).toContainText(verification.state.needed.text);
  await expect(
    main.getByRole("listitem", {
      name: verification.documentTypes.registration_certificate.label,
    }),
  ).toContainText(verification.missing);
  expect(await axeViolations(page)).toEqual([]);
  expect(await horizontalOverflow(page)).toBe(0);

  // Sign out from the menu (phones: /account's button): /account is left for
  // the homepage.
  await signOutFromMenu(page, name);
  await expect(page).toHaveURL(/\/$/);

  // Back in with a code: a known number signs straight in.
  await openSignIn(page);
  await requestCode(page, phone);
  await typeCode(page, await latestOtp(phone));
  await expectSignedIn(page, name);
  expect(unexpected(errors)).toEqual([]);
});

test("register by email as a customer, then sign in and sign out", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const email = freshEmail();
  const password = "Neem-leaf-tonic-2026";
  const name = "Ravi Kumar";

  await page.goto("/");
  await openSignIn(page);
  await dialog(page).getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog(page)
    .getByRole("button", { name: signIn.email.toRegisterLink })
    .click();
  const nameField = dialog(page).getByRole("textbox", {
    name: signIn.register.name,
  });
  await expect(nameField).toBeFocused();

  await nameField.fill(name);
  await dialog(page)
    .getByRole("textbox", { name: signIn.email.email })
    .fill(email);
  const passwordField = dialog(page).getByLabel(signIn.email.newPassword, {
    exact: true,
  });
  // A common password is refused by the server, shown on the field.
  await passwordField.fill("password123");
  await dialog(page).getByRole("radio", { name: "Customer" }).click();
  await expect(dialog(page)).not.toContainText(
    signIn.register.professionalNote,
  );
  await dialog(page)
    .getByRole("checkbox", { name: /I agree to the/ })
    .check();
  await dialog(page)
    .getByRole("checkbox", { name: signIn.register.marketing })
    .check();
  const submit = dialog(page).getByRole("button", {
    name: signIn.email.registerSubmit,
  });
  await submit.click();
  await expect(passwordField).toHaveAccessibleDescription(
    new RegExp(authErrors.PASSWORD_TOO_COMMON),
  );
  await expect(passwordField).toBeFocused();
  // The button is translucent while loading; check once it's back.
  await expect(submit).toBeEnabled();
  expect(await axeViolations(page)).toEqual([]);

  await passwordField.fill(password);
  await submit.click();
  await expectSignedIn(page, name);

  await signOutFromMenu(page, name);

  // Sign in with the same email and password.
  await openSignIn(page);
  await dialog(page).getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog(page)
    .getByRole("textbox", { name: signIn.email.email })
    .fill(email);
  await dialog(page)
    .getByLabel(signIn.email.password, { exact: true })
    .fill("wrong-password-1");
  await dialog(page).getByRole("button", { name: signIn.email.submit }).click();
  await expect(dialog(page).getByRole("alert")).toHaveText(
    authErrors.INVALID_EMAIL_OR_PASSWORD,
  );
  await dialog(page)
    .getByLabel(signIn.email.password, { exact: true })
    .fill(password);
  await dialog(page).getByRole("button", { name: signIn.email.submit }).click();
  await expectSignedIn(page, name);

  // The account page shows the email account; sign out from there.
  await page.goto("/account");
  const main = page.getByRole("main");
  await expect(main).toContainText(email);
  await expect(main).toContainText("Customer");
  await expect(main).toContainText(account.status.none.badge);
  await expect(main).toContainText(account.notAdded);
  await main.getByRole("button", { name: account.signOut }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectSignedOut(page);
  expect(unexpected(errors)).toEqual([]);
});

test("a wrong code, an expired code and too many sends each explain themselves", async ({
  page,
}) => {
  const phone = freshPhone();
  await page.goto("/");
  await openSignIn(page);
  await requestCode(page, phone);
  const code = await latestOtp(phone);

  // Wrong code: message under the boxes, boxes cleared, focus back on box 1.
  const wrong = code.slice(0, 5) + ((Number(code[5]) + 1) % 10);
  await typeCode(page, wrong);
  await expect(otpGroup(page)).toHaveAccessibleDescription(
    authErrors.INVALID_OTP,
  );
  await expect(firstDigit(page)).toHaveValue("");
  await expect(firstDigit(page)).toBeFocused();

  // Too short: asks for all 6 digits.
  await typeCode(page, "12");
  await dialog(page).getByRole("button", { name: signIn.otp.submit }).click();
  await expect(otpGroup(page)).toHaveAccessibleDescription(
    signIn.otp.incomplete,
  );

  // Expired code.
  await expireOtp(phone);
  await firstDigit(page).fill("");
  // Typed over what's left of "12", so a repeated digit must still advance.
  await typeCode(page, code);
  await expect(otpGroup(page)).toHaveAccessibleDescription(
    authErrors.OTP_EXPIRED,
  );

  // A number that has had too many codes: the send is refused and says
  // how long to wait.
  await dialog(page)
    .getByRole("button", { name: signIn.otp.changeNumber })
    .click();
  await expect(phoneField(page)).toBeFocused();
  await expect(phoneField(page)).toHaveValue(phone);
  const busyPhone = freshPhone();
  await exhaustOtpSends(busyPhone);
  await phoneField(page).fill(busyPhone);
  const send = dialog(page).getByRole("button", { name: signIn.phone.submit });
  await send.click();
  await expect(phoneField(page)).toHaveAccessibleDescription(
    `${authErrors.RATE_LIMITED} ${signIn.errors.retryIn(10)}`,
  );
  await expect(phoneField(page)).toBeFocused();
  // The button is translucent while loading; check once it's back.
  await expect(send).toBeEnabled();
  expect(await axeViolations(page)).toEqual([]);
});

test("a signed-in page sends a signed-out visitor to sign-in, then back", async ({
  page,
  request,
  baseURL,
}) => {
  const email = freshEmail();
  const password = "Tulsi-and-ginger-77";
  const name = "Meera Shah";
  await createEmailAccount(request, baseURL!, {
    name,
    email,
    password,
    userType: "clinic",
  });

  // Bare /account is open: a signed-out visitor gets a sign-in prompt there
  // (the dock's "You" tab), with nothing from any account.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText(account.guest.title);

  // Pages under it still need a session.
  await page.goto("/account/addresses");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/");
  expect(url.searchParams.get("auth")).toBe("sign-in");
  expect(url.searchParams.get("next")).toBe("/account/addresses");
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog(page)
    .getByRole("textbox", { name: signIn.email.email })
    .fill(email);
  await dialog(page)
    .getByLabel(signIn.email.password, { exact: true })
    .fill(password);
  await dialog(page).getByRole("button", { name: signIn.email.submit }).click();

  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toContainText(account.addresses.title);
  await expect(bell(page)).toBeVisible();
});

test("forgot password: the emailed link sets a new password", async ({
  page,
  request,
  baseURL,
}) => {
  const email = freshEmail();
  const name = "Kiran Rao";
  await createEmailAccount(request, baseURL!, {
    name,
    email,
    password: "Old-ashwagandha-11",
    userType: "customer",
  });

  await page.goto("/");
  await openSignIn(page);
  await dialog(page).getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog(page).getByRole("button", { name: signIn.email.forgot }).click();
  const emailField = dialog(page).getByRole("textbox", {
    name: signIn.email.email,
  });
  await expect(emailField).toBeFocused();
  await emailField.fill(email);
  await dialog(page)
    .getByRole("button", { name: signIn.email.forgotSubmit })
    .click();
  await expect(dialog(page).getByRole("status")).toHaveText(
    signIn.email.forgotSent(email),
  );
  await page.keyboard.press("Escape");

  // The link from the (logged) email.
  const token = await resetTokenFor(email);
  await page.goto(
    `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`,
  );
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await expect(
    page.getByRole("heading", { name: signIn.resetPage.title }),
  ).toBeVisible();
  const newPassword = "New-brahmi-leaf-22";
  await page
    .getByLabel(signIn.email.newPassword, { exact: true })
    .fill(newPassword);
  await page.getByRole("button", { name: signIn.resetPage.submit }).click();
  await expect(page.getByRole("status")).toContainText(signIn.resetPage.done);
  expect(await axeViolations(page)).toEqual([]);

  // Sign in with the new password.
  await page
    .getByRole("button", { name: signIn.resetPage.signIn, exact: true })
    .click();
  await dialog(page).getByRole("tab", { name: signIn.tabs.email }).click();
  await dialog(page)
    .getByRole("textbox", { name: signIn.email.email })
    .fill(email);
  await dialog(page)
    .getByLabel(signIn.email.password, { exact: true })
    .fill(newPassword);
  await dialog(page).getByRole("button", { name: signIn.email.submit }).click();
  await expectSignedIn(page, name);

  // The same link doesn't work twice.
  await page.goto(
    `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`,
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    signIn.resetPage.invalid,
  );
});
