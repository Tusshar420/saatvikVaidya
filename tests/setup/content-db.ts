import type { PrismaClient } from "@/generated/prisma/client";
import { testDatabaseUrl } from "./test-database";

/**
 * Empties the settings, user-type and homepage tables. Only ever runs against
 * the test database (checked, as well as vitest.config.ts forcing it).
 */
export async function clearContentTables(db: PrismaClient): Promise<void> {
  const [{ name }] = await db.$queryRaw<
    { name: string }[]
  >`SELECT DATABASE() AS name`;
  const expected = new URL(testDatabaseUrl()).pathname.slice(1);
  if (name !== expected) {
    throw new Error(`Refusing to clear "${name}": not the test database.`);
  }

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
  ]);
}
