import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { makeBrandOrder } from "../../../tests/setup/brand";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser, stockOf } from "../../../tests/setup/shop";

const reservedOf = async (productId: number) =>
  (await db.stockItem.findUniqueOrThrow({ where: { productId }, select: { reserved: true } })).reserved;
import { clearTargetProblem, clearTestData, countTestData, databaseNameOf } from "./clear-test-data";

// Clearing the test address before launch: which settings it refuses, that
// the dry run changes nothing, and that a real run removes the test accounts,
// orders, quiz attempts and coins while keeping admins and the catalogue.

const storageDir = join(tmpdir(), "saatvik-vaidya-clear-test-data");

const testAddress = {
  DATABASE_URL: "mysql://u1_test:pw@db.host:3306/u1_saatvik_test",
  BETTER_AUTH_URL: "https://test.yourdomain.com",
  STAGING_ACCESS_PASSWORD: "a-long-team-password",
};

describe("which database it may clear", () => {
  it("allows the test address and a local test copy", () => {
    expect(clearTargetProblem(testAddress)).toBeNull();
    expect(clearTargetProblem({ ...testAddress, DATABASE_URL: "mysql://u:p@h:3306/u1_STAGING" })).toBeNull();
    expect(
      clearTargetProblem({ DATABASE_URL: "mysql://root@localhost:3306/saatvik_vaidya_copy_test", BETTER_AUTH_URL: "http://localhost:3000" }),
    ).toBeNull();
  });

  it("refuses a database without test or staging in its name", () => {
    expect(clearTargetProblem({ ...testAddress, DATABASE_URL: "mysql://u:p@h:3306/u1_saatvik_live" })).toMatch(/not a test database/);
    expect(clearTargetProblem({ DATABASE_URL: "mysql://root@localhost:3306/saatvik_vaidya" })).toMatch(/not a test database/);
  });

  it("refuses missing or unreadable settings", () => {
    expect(clearTargetProblem({})).toMatch(/DATABASE_URL/);
    expect(clearTargetProblem({ DATABASE_URL: "not a url" })).toMatch(/DATABASE_URL/);
    expect(clearTargetProblem({ DATABASE_URL: "mysql://u:p@h:3306/" })).toMatch(/DATABASE_URL/);
  });

  it("refuses the live site's settings even with a test-named database", () => {
    expect(clearTargetProblem({ ...testAddress, BETTER_AUTH_URL: "https://yourdomain.com", STAGING_ACCESS_PASSWORD: "" })).toMatch(
      /live site's settings/,
    );
  });

  it("reads the database name", () => {
    expect(databaseNameOf("mysql://u:p@h:3306/u1_saatvik_test")).toBe("u1_saatvik_test");
    expect(databaseNameOf(undefined)).toBeNull();
  });

  it("checks the connection itself, not only the setting", async () => {
    const other = { $queryRaw: vi.fn().mockResolvedValue([{ name: "saatvik_live" }]) } as unknown as PrismaClient;
    await expect(countTestData(other)).rejects.toThrow(/not a test database/);
    await expect(clearTestData(other, storageDir)).rejects.toThrow(/not a test database/);
  });
});

describe("clearing the test data", () => {
  let adminId: string;
  let quizId: number;

  beforeAll(async () => {
    await clearContentTables(db);
    await seedDatabase(db);
  });

  beforeEach(async () => {
    await clearAuthTables(db);
    await db.bugReport.deleteMany();
    await db.errorGroup.deleteMany();
    await db.quiz.deleteMany();
    captureMessages();
    adminId = await makeAdmin(db);
    quizId = (await db.quiz.create({ data: { title: "Weekly quiz" } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function makeTestData() {
    const paid = await makeOrder(db, { quantity: 2 });
    const unpaid = await makeOrder(db, { pay: false, quantity: 3 });
    const brand = await makeBrandOrder(db);
    const doctor = await makeUser(db, { type: "doctor" });
    await db.quizAttempt.create({ data: { userId: doctor, quizId, answers: [], submittedAt: new Date(), score: 8 } });
    await db.coinLedger.create({ data: { userId: doctor, amount: 50, reason: "earn_quiz", reference: "quiz-attempt:1" } });
    await db.thread.create({ data: { authorId: doctor, title: "A case", body: "Details" } });
    await db.thread.create({ data: { authorId: adminId, title: "Welcome, doctors", body: "Rules" } });
    // A course the test doctor made (B2) goes; staff-made (seeded) ones stay.
    await db.courseTeaser.create({
      data: {
        key: `test-course-${doctor}`,
        tag: "Panchakarma",
        title: "Doctor's test course",
        body: "Summary",
        metaLabel: "Format",
        metaValue: "Online",
        linkLabel: "View course",
        authorId: doctor,
        status: "pending",
      },
    });
    const screenshot = "bug-reports/x/abc123.png";
    await mkdir(dirname(join(storageDir, screenshot)), { recursive: true });
    await writeFile(join(storageDir, screenshot), "png");
    await db.bugReport.create({ data: { description: "Button overlaps", userId: doctor, screenshotKey: screenshot } });
    await db.errorGroup.create({ data: { fingerprint: "f".repeat(64), source: "server", message: "Boom", route: "/x" } });
    return { paid, unpaid, brand, doctor, screenshot };
  }

  it("the dry run counts what would go and changes nothing", async () => {
    const { unpaid } = await makeTestData();
    const before = await db.order.count();

    const counts = await countTestData(db);

    expect(counts.database).toMatch(/_test$/);
    expect(counts.remove).toMatchObject({
      accounts: 4,
      orders: 3,
      brandOrders: 1,
      quizAttempts: 1,
      coinEntries: 1,
      threads: 1,
      courses: 1,
      bugReports: 1,
      errorGroups: 1,
    });
    expect(counts.remove.accountsByType).toMatchObject({ "Ayurveda Doctor": 1 });
    expect(counts.remove.stockHolds).toBeGreaterThanOrEqual(1);
    expect(counts.remove.files).toBeGreaterThanOrEqual(2);
    expect(counts.keep.adminEmails).toHaveLength(1);
    expect(counts.keep.quizzes).toBe(1);
    expect(await db.order.count()).toBe(before);
    expect(await db.stockReservation.count({ where: { refId: unpaid.orderId, status: "active" } })).toBeGreaterThan(0);
  });

  it("removes test accounts, orders, attempts and coins and keeps admins and the catalogue", async () => {
    const { paid, unpaid, doctor, screenshot } = await makeTestData();
    const products = await db.product.count();
    const paidStock = await stockOf(db, paid.productId);
    const unpaidStock = await stockOf(db, unpaid.productId);
    expect(await reservedOf(unpaid.productId)).toBe(unpaid.quantity);

    const { filesRemoved } = await clearTestData(db, storageDir);

    expect(await db.user.findMany({ select: { id: true } })).toEqual([{ id: adminId }]);
    expect(await db.user.findUnique({ where: { id: doctor } })).toBeNull();
    for (const count of [
      db.order.count(),
      db.invoice.count(),
      db.payment.count(),
      db.quizAttempt.count(),
      db.coinLedger.count(),
      db.notification.count(),
      db.bugReport.count(),
      db.errorGroup.count(),
      db.address.count(),
      db.cart.count(),
      db.brandProfile.count(),
    ]) {
      expect(await count).toBe(0);
    }
    expect(await db.thread.findMany({ select: { authorId: true } })).toEqual([{ authorId: adminId }]);
    expect(await db.courseTeaser.count({ where: { key: `test-course-${doctor}` } })).toBe(0);
    expect(await db.courseTeaser.count()).toBeGreaterThan(0);
    expect(await db.quiz.count()).toBe(1);
    expect(await db.product.count()).toBe(products);
    // The unpaid order's hold is given back; the paid order's sale stays.
    expect(await db.stockReservation.count({ where: { status: "active" } })).toBe(0);
    expect(await reservedOf(unpaid.productId)).toBe(0);
    expect(await stockOf(db, unpaid.productId)).toBe(unpaidStock);
    expect(await stockOf(db, paid.productId)).toBe(paidStock);
    expect(filesRemoved).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(storageDir, screenshot))).toBe(false);

    // Running it again finds nothing more to remove.
    const again = await countTestData(db);
    expect(again.remove.accounts + again.remove.orders + again.remove.stockHolds).toBe(0);
  });
});
