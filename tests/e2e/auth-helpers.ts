import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomBytes, randomInt } from "node:crypto";
import { hashPassword, symmetricEncrypt } from "better-auth/crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "../../src/generated/prisma/client";
import { rateLimitRules } from "../../src/server/auth/policy";
import { totpCode } from "../setup/totp";

// Helpers for the sign-in e2e tests. The production build that Playwright
// runs uses the dev database (.env.local), and there's no dev OTP route in
// production, so tests read codes from the Verification table directly.
//
// Everything a test creates is marked so it can be removed afterwards:
// - phones start +91 6999 (E2E_PHONE_PREFIX),
// - emails end @e2e.saatvikvaidya.test,
// - request IPs start 10.99. (sent as x-forwarded-for, so each test has its
//   own per-IP rate limits and the real limits stay untouched),
// - admin-panel content keys and product slugs start "e2e-", quiz titles
//   "E2E ",
// - orders belong to e2e users; guest carts end up empty once the e2e
//   products are gone.

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export const E2E_PHONE_PREFIX = "6999";
export const E2E_EMAIL_DOMAIN = "e2e.saatvikvaidya.test";
export const E2E_IP_PREFIX = "10.99.";

let client: PrismaClient | undefined;

/** A Prisma client on the dev database (the one the e2e server uses). */
export function e2eDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.local).");
  client ??= new PrismaClient({ adapter: new PrismaMariaDb(url) });
  return client;
}

/** 10 national digits, unique enough for one run. */
export function freshPhone(): string {
  return `${E2E_PHONE_PREFIX}${String(randomInt(1_000_000)).padStart(6, "0")}`;
}

export function freshEmail(): string {
  return `e2e-${Date.now()}-${randomInt(1_000_000)}@${E2E_EMAIL_DOMAIN}`;
}

export function freshIp(): string {
  return `${E2E_IP_PREFIX}${randomInt(256)}.${randomInt(1, 255)}`;
}

/** Gives the page's requests their own IP for the per-IP rate limits. */
export async function useFreshIp(page: Page): Promise<string> {
  const ip = freshIp();
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  return ip;
}

/** "+91" + digits, as stored. */
export const e164 = (phone: string) => `+91${phone}`;

/** The live OTP sent to `phone`, waiting for it to arrive. */
export async function latestOtp(phone: string, notCode?: string) {
  let code = "";
  await expect
    .poll(
      async () => {
        const row = await e2eDb().verification.findFirst({
          where: { identifier: e164(phone) },
          orderBy: { createdAt: "desc" },
        });
        code = row?.value.split(":")[0] ?? "";
        return code !== "" && code !== notCode;
      },
      { message: `an OTP for ${phone}` },
    )
    .toBe(true);
  return code;
}

/** Makes the phone's current OTP expired. */
export async function expireOtp(phone: string) {
  await e2eDb().verification.updateMany({
    where: { identifier: e164(phone) },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
}

/** Uses up the phone's OTP sends for this window (as if sent 3 times). */
export async function exhaustOtpSends(phone: string) {
  const rule = rateLimitRules.otpSendPerPhone;
  const key = `${rule.name}:${e164(phone)}`;
  const resetAtMs = BigInt(Date.now() + rule.windowSeconds * 1000);
  await e2eDb().authRateLimit.upsert({
    where: { key },
    create: { key, count: rule.max, resetAtMs },
    update: { count: rule.max, resetAtMs },
  });
}

/** The email reset token Better Auth stored for this user. */
export async function resetTokenFor(email: string) {
  let token = "";
  await expect
    .poll(async () => {
      const user = await e2eDb().user.findUnique({ where: { email } });
      if (!user) return false;
      const row = await e2eDb().verification.findFirst({
        where: {
          value: user.id,
          identifier: { startsWith: "reset-password:" },
        },
        orderBy: { createdAt: "desc" },
      });
      token = row?.identifier.slice("reset-password:".length) ?? "";
      return token !== "";
    })
    .toBe(true);
  return token;
}

/** Creates an email account through the real API (not signed in). */
export async function createEmailAccount(
  request: APIRequestContext,
  baseURL: string,
  account: { name: string; email: string; password: string; userType: string },
) {
  const type = await e2eDb().userType.findUniqueOrThrow({
    where: { key: account.userType },
  });
  const response = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL, "x-forwarded-for": freshIp() },
    data: {
      name: account.name,
      email: account.email,
      password: account.password,
      userTypeId: type.id,
      termsAccepted: true,
    },
  });
  expect(response.status()).toBe(200);
}

export const E2E_CONTENT_PREFIX = "e2e-";
export const E2E_QUIZ_PREFIX = "E2E ";

/** A made-up authenticator secret, and a way to read its current code. */
export function newTotpSecret() {
  const secret = randomBytes(15).toString("base64url");
  return { secret, code: (now?: number) => totpCode(Buffer.from(secret), now) };
}

/**
 * Creates an account straight in the database (role "user" or "admin") with
 * a password, then signs the page's browser context in as it through the
 * real sign-in endpoint. Admins get an admin role (default "super") and
 * two-factor already set up, so sign-in goes through the real second step
 * with a code from `totp`; `twoFactor: false` makes an admin who hasn't set
 * it up yet.
 */
export async function signInAs(
  page: Page,
  baseURL: string,
  options: {
    role: "user" | "admin";
    adminRole?: "super" | "catalogue" | "orders" | "content" | "approvals";
    twoFactor?: boolean;
    userType?: string;
    name?: string;
    verificationStatus?: "none" | "pending" | "approved" | "rejected";
  },
) {
  const db = e2eDb();
  const type = await db.userType.findUniqueOrThrow({
    where: { key: options.userType ?? "customer" },
  });
  const id = randomBytes(24).toString("base64url");
  const email = freshEmail();
  const password = `e2e-${randomBytes(12).toString("base64url")}`;
  const name = options.name ?? (options.role === "admin" ? "E2E Admin" : "E2E Customer");
  const isAdmin = options.role === "admin";
  const withTwoFactor = isAdmin && options.twoFactor !== false;
  const totp = newTotpSecret();
  await db.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      role: options.role,
      adminRole: isAdmin ? (options.adminRole ?? "super") : undefined,
      twoFactorEnabled: withTwoFactor,
      userTypeId: type.id,
      verificationStatus: options.verificationStatus,
      termsAcceptedAt: new Date(),
      accounts: {
        create: {
          id: randomBytes(24).toString("base64url"),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  if (withTwoFactor) {
    const key = process.env.BETTER_AUTH_SECRET!;
    await db.twoFactor.create({
      data: {
        id: randomBytes(24).toString("base64url"),
        userId: id,
        secret: await symmetricEncrypt({ key, data: totp.secret }),
        backupCodes: await symmetricEncrypt({ key, data: JSON.stringify(["e2ebackup1", "e2ebackup2"]) }),
      },
    });
  }
  const ip = freshIp();
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL, "x-forwarded-for": ip },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  if (withTwoFactor) {
    const second = await page.request.post("/api/auth/two-factor/verify-totp", {
      headers: { origin: baseURL, "x-forwarded-for": ip },
      data: { code: totp.code() },
    });
    expect(second.status()).toBe(200);
  }
  return { id, email, name, password, totp };
}

/** A professional account waiting for approval, made straight in the database. */
export async function createPendingProfessional(name: string, userType = "doctor") {
  const db = e2eDb();
  const type = await db.userType.findUniqueOrThrow({ where: { key: userType } });
  const id = randomBytes(24).toString("base64url");
  await db.user.create({
    data: {
      id,
      name,
      email: freshEmail(),
      userTypeId: type.id,
      verificationStatus: "pending",
      termsAcceptedAt: new Date(),
    },
  });
  return id;
}

/**
 * Deletes every user (with their uploaded files), code, rate-limit row, audit
 * row and piece of admin content the e2e tests made.
 */
export async function cleanUpE2eData() {
  const db = e2eDb();
  const phones = { startsWith: `+91${E2E_PHONE_PREFIX}` };
  const users = await db.user.findMany({
    where: {
      OR: [
        { phoneNumber: phones },
        { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
      ],
    },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  // Uploaded files live on disk (STORAGE_DIR), not in the database.
  const documents = await db.professionalDocument.findMany({
    where: { userId: { in: ids } },
    select: { fileKey: true },
  });
  // Products the catalogue tests made (slug "e2e-..."), with their photos.
  const productIds = (
    await db.product.findMany({
      where: { slug: { startsWith: E2E_CONTENT_PREFIX } },
      select: { id: true },
    })
  ).map((product) => String(product.id));
  const productImages = await db.productImage.findMany({
    where: { product: { slug: { startsWith: E2E_CONTENT_PREFIX } } },
    select: { fileKey: true },
  });
  // Track Order counts lookups per order number (P1.5).
  const orderNumbers = (
    await db.order.findMany({ where: { userId: { in: ids } }, select: { number: true } })
  ).map((order) => `track-order:number:${order.number.toLowerCase()}`);
  // Invoices and credit notes of e2e users' orders (P1.6), with their PDFs.
  const invoiceFiles = await db.invoice.findMany({
    where: { order: { userId: { in: ids } } },
    select: { fileKey: true },
  });
  // Ebooks the ebook tests made (slug "e2e-..."), with their PDFs and covers (P1.8).
  const ebooks = await db.ebook.findMany({
    where: { slug: { startsWith: E2E_CONTENT_PREFIX } },
    select: { id: true, fileKey: true, coverKey: true },
  });
  const ebookFiles = ebooks.flatMap((ebook) =>
    [ebook.fileKey, ebook.coverKey].flatMap((fileKey) => (fileKey ? [{ fileKey }] : [])),
  );
  // Launch Your Brand logos (P2.1): on e2e users' saved brands and brand orders.
  const brandLogos = [
    ...(await db.brandProfile.findMany({ where: { userId: { in: ids } }, select: { logoKey: true } })),
    ...(await db.brandOrderDetails.findMany({
      where: { order: { userId: { in: ids } } },
      select: { logoKey: true },
    })),
  ].flatMap(({ logoKey }) => (logoKey ? [{ fileKey: logoKey }] : []));
  // Label proofs (P2.2) of e2e users' brand orders.
  const brandProofs = await db.brandProof.findMany({
    where: { details: { order: { userId: { in: ids } } } },
    select: { fileKey: true },
  });
  const storageDir = resolve(process.env.STORAGE_DIR ?? "storage");
  for (const { fileKey } of [
    ...documents,
    ...productImages,
    ...invoiceFiles,
    ...ebookFiles,
    ...brandLogos,
    ...brandProofs,
  ]) {
    const path = resolve(storageDir, fileKey);
    if (path.startsWith(`${storageDir}${sep}`)) await rm(path, { force: true });
  }
  await db.$transaction([
    // Invoices block deleting their order: credit notes first (they point
    // at invoices), then invoices; their lines go with them.
    db.invoice.deleteMany({ where: { kind: "credit_note", order: { userId: { in: ids } } } }),
    db.invoice.deleteMany({ where: { order: { userId: { in: ids } } } }),
    // Orders of e2e users (their items, payments and shipments go with them). Orders
    // outlive a deleted account, so they're removed before the users.
    db.order.deleteMany({ where: { userId: { in: ids } } }),
    // Settings an e2e admin changed and left changed (a stopped run): deleting
    // the row puts the default back (and its history goes with it). Before the
    // users go, or the link to them would just be cleared.
    db.setting.deleteMany({ where: { updatedBy: { in: ids } } }),
    // Admin invitations the invite tests made.
    db.adminInvite.deleteMany({ where: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } } }),
    // Audit rows written by e2e admins, or about e2e users.
    db.adminLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { resourceId: { in: ids } }] },
    }),
    // Sessions and accounts go with their users (onDelete: Cascade).
    db.user.deleteMany({ where: { id: { in: ids } } }),
    db.adminLog.deleteMany({
      where: {
        resource: "Product",
        resourceId: { in: productIds },
      },
    }),
    // Images, tiers and area links go with the product (onDelete: Cascade).
    db.stockItem.deleteMany({ where: { product: { slug: { startsWith: E2E_CONTENT_PREFIX } } } }),
    db.product.deleteMany({ where: { slug: { startsWith: E2E_CONTENT_PREFIX } } }),
    // Components the inventory tests made (their recipes went with the products).
    db.stockItem.deleteMany({ where: { name: { startsWith: "E2E " }, kind: { in: ["packaging", "base"] } } }),
    db.adminLog.deleteMany({
      where: { resource: "Ebook", resourceId: { in: ebooks.map((ebook) => String(ebook.id)) } },
    }),
    // Cart lines go with the ebook; order lines keep their snapshot.
    db.ebook.deleteMany({ where: { slug: { startsWith: E2E_CONTENT_PREFIX } } }),
    db.reel.deleteMany({ where: { key: { startsWith: E2E_CONTENT_PREFIX } } }),
    db.offer.deleteMany({ where: { key: { startsWith: E2E_CONTENT_PREFIX } } }),
    db.brand.deleteMany({ where: { key: { startsWith: E2E_CONTENT_PREFIX } } }),
    db.courseTeaser.deleteMany({
      where: { key: { startsWith: E2E_CONTENT_PREFIX } },
    }),
    db.quiz.deleteMany({ where: { title: { startsWith: E2E_QUIZ_PREFIX } } }),
    db.verification.deleteMany({
      where: { OR: [{ identifier: phones }, { value: { in: ids } }] },
    }),
    // Guest carts the e2e tests left (their e2e products, and with them the
    // cart lines, are deleted above). Empty guest carts hold nothing.
    db.cart.deleteMany({ where: { userId: null, items: { none: {} } } }),
    db.authRateLimit.deleteMany({
      where: {
        OR: [
          // Per-account limits of e2e users (keys are lowercased).
          { key: { in: ids.map((id) => `order-place:user:${id.toLowerCase()}`) } },
          { key: { in: ids.map((id) => `ebook-download:user:${id.toLowerCase()}`) } },
          { key: { in: ids.map((id) => `brand-logo-upload:user:${id.toLowerCase()}`) } },
          { key: { in: ids.map((id) => `brand-proof-upload:user:${id.toLowerCase()}`) } },
          { key: { in: orderNumbers } },
          { key: { contains: `:+91${E2E_PHONE_PREFIX}` } },
          { key: { contains: `@${E2E_EMAIL_DOMAIN}` } },
          { key: { contains: `:${E2E_IP_PREFIX}` } },
        ],
      },
    }),
  ]);
}
