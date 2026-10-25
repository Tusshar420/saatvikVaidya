import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { testishName } from "@/server/site-check";

// Clearing the test address's database before launch (`pnpm
// db:clear-test-data`, scripts/clear-test-data.ts). Everything the team made
// while testing goes: every order (with its payments, delivery, invoices and
// stock holds), every quiz attempt and Super Coin entry, the error log and bug
// reports, notifications, and every account that is not an admin (with its
// addresses, carts, Launch drafts, brand profiles, threads and documents),
// and the courses those accounts made in the doctor's course area.
//
// Kept: admin accounts (staff), the catalogue and stock levels, quizzes,
// e-books, staff-made courses, home page content, settings and the admin log.
// Course purchases and paid e-books are orders and go with them.
//
// Refuses to touch a database unless it is plainly a test one (see
// clearTargetProblem). No "server-only" import: it runs under tsx.

/** The settings it reads; process.env fits (hence the index signature). */
type Env = {
  DATABASE_URL?: string;
  BETTER_AUTH_URL?: string;
  STAGING_ACCESS_PASSWORD?: string;
  [name: string]: string | undefined;
};

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The database name in DATABASE_URL, or null if it can't be read. */
export function databaseNameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1)) || null;
  } catch {
    return null;
  }
}

/**
 * Why this script must not run with these settings, or null when it may: the
 * database name must contain "test" or "staging" (the same rule as the site's
 * start-up check), and settings for a site on a server must be the test
 * address's (team password set), never the live site's.
 */
export function clearTargetProblem(env: Env = process.env): string | null {
  const name = databaseNameOf(env.DATABASE_URL);
  if (!name) return "DATABASE_URL is not set or names no database.";
  if (!testishName.test(name)) {
    return `"${name}" is not a test database (its name has no "test" or "staging"). This only ever clears the test address's database.`;
  }
  let host = "";
  try {
    host = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).hostname : "";
  } catch {
    host = "";
  }
  if (host && !localHosts.has(host) && !env.STAGING_ACCESS_PASSWORD) {
    return `These are the live site's settings (${host}, no team password). This only ever runs in the test address's folder.`;
  }
  return null;
}

type Db = PrismaClient;

/** Accounts that are not admins: the ones the team made while testing. */
const testAccounts = { role: { not: "admin" as const } };
/** Stock held for orders; every order is removed, so every hold goes. */
const orderHolds = { status: "active" as const, refType: { in: ["order", "brand_order"] } };

export type TestDataCounts = {
  database: string;
  remove: {
    accounts: number;
    accountsByType: Record<string, number>;
    orders: number;
    brandOrders: number;
    invoices: number;
    payments: number;
    quizAttempts: number;
    coinEntries: number;
    threads: number;
    /** Courses made by test doctor accounts (B2). */
    courses: number;
    notifications: number;
    bugReports: number;
    errorGroups: number;
    stockHolds: number;
    files: number;
  };
  keep: {
    adminEmails: string[];
    products: number;
    quizzes: number;
    ebooks: number;
    courseTeasers: number;
  };
};

/** The database the client is really connected to. */
export async function connectedDatabase(db: Db): Promise<string> {
  const [row] = await db.$queryRaw<{ name: string | null }[]>`SELECT DATABASE() AS name`;
  return row?.name ?? "";
}

/** Throws unless the client is connected to a test database. */
async function assertTestTarget(db: Db): Promise<string> {
  const name = await connectedDatabase(db);
  if (!testishName.test(name)) {
    throw new Error(`Refusing to clear "${name}": not a test database.`);
  }
  return name;
}

async function testAccountIds(db: Db): Promise<string[]> {
  return (await db.user.findMany({ where: testAccounts, select: { id: true } })).map((user) => user.id);
}

/** Storage keys of the uploaded files that belong to what is removed. */
async function fileKeys(db: Db, userIds: string[]): Promise<string[]> {
  const people = { userId: { in: userIds } };
  const keys = [
    ...(await db.invoice.findMany({ select: { fileKey: true } })).map((row) => row.fileKey),
    ...(await db.professionalDocument.findMany({ where: people, select: { fileKey: true } })).map((row) => row.fileKey),
    ...(await db.brandProfile.findMany({ where: people, select: { logoKey: true } })).map((row) => row.logoKey),
    ...(await db.brandOrderDetails.findMany({ select: { logoKey: true } })).map((row) => row.logoKey),
    ...(await db.brandProof.findMany({ select: { fileKey: true } })).map((row) => row.fileKey),
    ...(await db.bugReport.findMany({ select: { screenshotKey: true } })).map((row) => row.screenshotKey),
  ];
  return [...new Set(keys.flatMap((key) => (key ? [key] : [])))];
}

/** What clearTestData would remove and keep. Changes nothing. */
export async function countTestData(db: Db): Promise<TestDataCounts> {
  const database = await assertTestTarget(db);
  const userIds = await testAccountIds(db);
  const byType = await db.user.groupBy({ by: ["userTypeId"], where: testAccounts, _count: { _all: true } });
  const types = await db.userType.findMany({ select: { id: true, label: true } });
  const accountsByType: Record<string, number> = {};
  for (const row of byType) {
    const label = types.find((type) => type.id === row.userTypeId)?.label ?? `type ${row.userTypeId}`;
    accountsByType[label] = row._count._all;
  }
  const admins = await db.user.findMany({ where: { role: "admin" }, select: { email: true }, orderBy: { email: "asc" } });
  return {
    database,
    remove: {
      accounts: userIds.length,
      accountsByType,
      orders: await db.order.count(),
      brandOrders: await db.order.count({ where: { type: "brand" } }),
      invoices: await db.invoice.count(),
      payments: await db.payment.count(),
      quizAttempts: await db.quizAttempt.count(),
      coinEntries: await db.coinLedger.count(),
      threads: await db.thread.count({ where: { authorId: { in: userIds } } }),
      courses: await db.courseTeaser.count({ where: { authorId: { in: userIds } } }),
      notifications: await db.notification.count(),
      bugReports: await db.bugReport.count(),
      errorGroups: await db.errorGroup.count(),
      stockHolds: await db.stockReservation.count({ where: orderHolds }),
      files: (await fileKeys(db, userIds)).length,
    },
    keep: {
      adminEmails: admins.map((admin) => admin.email),
      products: await db.product.count(),
      quizzes: await db.quiz.count(),
      ebooks: await db.ebook.count(),
      courseTeasers: await db.courseTeaser.count({
        where: { OR: [{ authorId: null }, { authorId: { notIn: userIds } }] },
      }),
    },
  };
}

/**
 * Removes the test data (see the top of this file) in one transaction, then
 * the files that belonged to it from `storageDir`. Stock that test orders held
 * is given back; stock that paid test orders took stays taken, so the real
 * counts are set in Admin > Inventory afterwards.
 */
export async function clearTestData(db: Db, storageDir: string): Promise<{ filesRemoved: number }> {
  await assertTestTarget(db);
  const userIds = await testAccountIds(db);
  const keys = await fileKeys(db, userIds);

  await db.$transaction(
    async (tx) => {
      // Give back stock held for orders, as cancelling them would. Done
      // directly (not through src/server/inventory, which is server-only).
      const holds = await tx.stockReservation.findMany({ where: orderHolds, orderBy: [{ itemId: "asc" }, { id: "asc" }] });
      for (const hold of holds) {
        await tx.stockReservation.update({ where: { id: hold.id }, data: { status: "released" } });
        if (hold.batchId) {
          await tx.stockBatch.update({ where: { id: hold.batchId }, data: { qtyReserved: { decrement: hold.quantity } } });
        }
        const item = await tx.stockItem.update({
          where: { id: hold.itemId },
          data: { reserved: { decrement: hold.quantity } },
          select: { onHand: true },
        });
        await tx.stockMovement.create({
          data: {
            itemId: hold.itemId,
            batchId: hold.batchId,
            type: "release",
            quantity: hold.quantity,
            onHandDelta: 0,
            reservedDelta: -hold.quantity,
            onHandAfter: item.onHand,
            reason: "Test data cleared before launch",
            refType: hold.refType,
            refId: hold.refId,
          },
        });
      }
      // Credit notes point at invoices, and invoices block deleting their
      // order. Items, payments, deliveries and brand details go with orders.
      await tx.invoice.deleteMany({ where: { kind: "credit_note" } });
      await tx.invoice.deleteMany({});
      await tx.order.deleteMany({});
      await tx.quizAttempt.deleteMany({});
      await tx.coinLedger.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.bugReport.deleteMany({});
      // Occurrences and bug-report links go with their group.
      await tx.errorGroup.deleteMany({});
      // Their courses would outlive them (onDelete: SetNull), so they go first.
      await tx.courseTeaser.deleteMany({ where: { authorId: { in: userIds } } });
      // Sessions, addresses, carts, drafts, brand profiles, threads, replies,
      // likes and documents go with their account (onDelete: Cascade).
      await tx.user.deleteMany({ where: testAccounts });
      // Codes and rate-limit counters from test sign-ins, and guest carts.
      await tx.verification.deleteMany({});
      await tx.authRateLimit.deleteMany({});
      await tx.cart.deleteMany({ where: { userId: null } });
    },
    { timeout: 120_000 },
  );

  const root = resolve(storageDir);
  let filesRemoved = 0;
  for (const key of keys) {
    const path = resolve(root, key);
    if (!path.startsWith(`${root}${sep}`)) continue;
    await rm(path, { force: true });
    filesRemoved += 1;
  }
  return { filesRemoved };
}
