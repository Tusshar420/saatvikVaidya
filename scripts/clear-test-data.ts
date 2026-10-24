// `pnpm db:clear-test-data`: before launch, removes everything the team made
// while testing: all orders (with their payments, shipments, invoices and
// uploaded files) and all non-admin accounts (with their addresses, carts,
// coins, quiz attempts, threads, notifications and uploaded documents).
// Admin accounts, the catalogue, content, settings and stock levels stay.
//
// It only counts what it would remove unless you add --yes. Point it at the
// right database first: the name and host are printed. Stock is NOT put back
// (sold units stay sold), so set the real stock in Admin > Inventory after.
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const apply = process.argv.includes("--yes");
const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main() {
  const where = new URL(url as string);
  console.info(`Database: ${where.pathname.slice(1)} on ${where.hostname}`);

  const people = { role: { not: "admin" as const } };
  const users = await db.user.findMany({ where: people, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const counts = {
    orders: await db.order.count(),
    invoices: await db.invoice.count(),
    accounts: userIds.length,
    threads: await db.thread.count({ where: { authorId: { in: userIds } } }),
    bugReports: await db.bugReport.count(),
    errorOccurrences: await db.errorOccurrence.count(),
  };
  console.info("Would remove:", counts);
  console.info(`Kept: ${await db.user.count({ where: { role: "admin" } })} admin account(s), catalogue, content, settings, stock levels.`);
  if (!apply) {
    console.info("Nothing was changed. Run again with --yes to remove them.");
    return;
  }

  // Files on disk (STORAGE_DIR) that belong to what is being removed.
  const keys = [
    ...(await db.invoice.findMany({ select: { fileKey: true } })),
    ...(await db.professionalDocument.findMany({ where: { userId: { in: userIds } }, select: { fileKey: true } })),
    ...(await db.brandProfile.findMany({ where: { userId: { in: userIds } }, select: { logoKey: true } })).map((r) => ({ fileKey: r.logoKey })),
    ...(await db.brandOrderDetails.findMany({ select: { logoKey: true } })).map((r) => ({ fileKey: r.logoKey })),
    ...(await db.brandProof.findMany({ select: { fileKey: true } })),
  ].flatMap(({ fileKey }) => (fileKey ? [fileKey] : []));

  await db.$transaction(
    [
      // Credit notes point at invoices, and invoices block deleting their order.
      db.invoice.deleteMany({ where: { kind: "credit_note" } }),
      db.invoice.deleteMany({}),
      db.order.deleteMany({}),
      db.bugReport.deleteMany({}),
      db.errorOccurrence.deleteMany({}),
      // Sessions, addresses, carts, coins, quiz attempts, threads, notifications
      // and documents go with their account (onDelete: Cascade).
      db.user.deleteMany({ where: people }),
      // Codes and rate-limit counters from test sign-ins.
      db.verification.deleteMany({}),
      db.authRateLimit.deleteMany({}),
      db.cart.deleteMany({ where: { userId: null } }),
    ],
    { timeout: 120_000 },
  );

  const storageDir = resolve(process.env.STORAGE_DIR ?? "storage");
  for (const key of keys) {
    const path = resolve(storageDir, key);
    if (path.startsWith(`${storageDir}${sep}`)) await rm(path, { force: true });
  }
  console.info(`Done. Removed ${keys.length} file(s) from ${storageDir}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
