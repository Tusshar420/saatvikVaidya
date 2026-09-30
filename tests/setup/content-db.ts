import type { PrismaClient } from "@/generated/prisma/client";
import { testDatabaseUrl } from "./test-database";

/** Throws unless `db` is connected to the test database. */
export async function assertTestDatabase(db: PrismaClient): Promise<void> {
  const [{ name }] = await db.$queryRaw<
    { name: string }[]
  >`SELECT DATABASE() AS name`;
  const expected = new URL(testDatabaseUrl()).pathname.slice(1);
  if (name !== expected) {
    throw new Error(`Refusing to clear "${name}": not the test database.`);
  }
}

/**
 * Empties the admin log and the user, session, account, verification and
 * rate-limit tables.
 */
export async function clearAuthTables(db: PrismaClient): Promise<void> {
  await assertTestDatabase(db);
  await db.$transaction([
    db.adminLog.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verification.deleteMany(),
    db.authRateLimit.deleteMany(),
    db.user.deleteMany(),
  ]);
}

/**
 * Empties the settings, user-type and homepage tables (and the auth tables,
 * since users point at user types). Only ever runs against the test database
 * (checked, as well as vitest.config.ts forcing it).
 */
export async function clearContentTables(db: PrismaClient): Promise<void> {
  await clearAuthTables(db);
  await db.$transaction([
    db.settingHistory.deleteMany(),
    db.setting.deleteMany(),
    db.userType.deleteMany(),
    db.homeSection.deleteMany(),
    db.heroSlide.deleteMany(),
    db.statItem.deleteMany(),
    db.reel.deleteMany(),
    db.offer.deleteMany(),
    db.quickAction.deleteMany(),
    db.category.deleteMany(),
    db.brand.deleteMany(),
    db.courseTeaser.deleteMany(),
    db.liveSession.deleteMany(),
    db.feedback.deleteMany(),
    db.whyStep.deleteMany(),
    // Questions and options go with their quiz (onDelete: Cascade).
    db.quiz.deleteMany(),
  ]);
}
