// `pnpm db:clear-test-data`: before launch, removes everything the team made
// on the test address: all orders, quiz attempts, coins, the error log and
// bug reports, and every account that is not an admin (details in
// src/server/launch/clear-test-data.ts). Admin accounts, the catalogue, stock
// levels, quizzes, e-books, courses, content and settings stay.
//
//   pnpm db:clear-test-data             dry run: only shows what would go
//   pnpm db:clear-test-data --dry-run   the same
//   pnpm db:clear-test-data --delete    shows it, asks you to type the
//                                       database name, then removes it
//
// It refuses to run unless DATABASE_URL names a test database ("test" or
// "staging" in the name) and the settings are not the live site's.
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  clearTargetProblem,
  clearTestData,
  connectedDatabase,
  countTestData,
  databaseNameOf,
  type TestDataCounts,
} from "../src/server/launch/clear-test-data";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const options = process.argv.slice(2).filter((arg) => arg !== "--");
const unknown = options.filter((arg) => arg !== "--dry-run" && arg !== "--delete");
if (unknown.length > 0 || (options.includes("--dry-run") && options.includes("--delete"))) {
  console.error(`Unknown or clashing option: ${options.join(" ")}\nUse --dry-run (only show) or --delete (remove, after you confirm).`);
  process.exit(1);
}
const remove = options.includes("--delete");

const problem = clearTargetProblem(process.env);
if (problem) {
  console.error(`Stopped, nothing was changed. ${problem}`);
  process.exit(1);
}
const url = process.env.DATABASE_URL as string;
const name = databaseNameOf(url) as string;
const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

function report(counts: TestDataCounts): void {
  const { remove: r, keep: k } = counts;
  const types = Object.entries(r.accountsByType).map(([type, n]) => `${n} ${type}`).join(", ");
  console.info(`
Would remove:
  Accounts (not admins):  ${r.accounts}${types ? ` (${types})` : ""}
  Orders:                 ${r.orders} (${r.brandOrders} Launch Your Brand), with ${r.payments} payment(s) and ${r.invoices} invoice(s)
  Quiz attempts:          ${r.quizAttempts}
  Super Coin entries:     ${r.coinEntries}
  Threads by them:        ${r.threads}
  Notifications:          ${r.notifications}
  Bug reports:            ${r.bugReports}
  Error log entries:      ${r.errorGroups}
  Stock holds given back: ${r.stockHolds}
  Uploaded files:         ${r.files}

Keeps:
  Admin accounts:         ${k.adminEmails.length}${k.adminEmails.length ? ` (${k.adminEmails.join(", ")})` : ""}
  Products:               ${k.products}, with their stock levels
  Quizzes:                ${k.quizzes}
  E-books:                ${k.ebooks}
  Courses:                ${k.courseTeasers}
  Content, settings and the admin log.`);
}

async function confirmed(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("Stopped: --delete needs someone at the terminal to confirm.");
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`\nThis cannot be undone. To remove it all, type the database name (${name}): `);
    return answer.trim() === name;
  } finally {
    prompt.close();
  }
}

async function main(): Promise<void> {
  // The connection itself must be the test database, not only the setting.
  const connected = await connectedDatabase(db);
  if (connected !== name) throw new Error(`Stopped: connected to "${connected}", expected "${name}".`);
  const where = new URL(url);
  console.info(`Database: ${name} on ${where.hostname}`);

  report(await countTestData(db));
  if (!remove) {
    console.info("\nDry run: nothing was changed. Run with --delete to remove it.");
    return;
  }
  if (!(await confirmed())) {
    console.info("Cancelled: nothing was changed.");
    process.exitCode = 1;
    return;
  }
  const storageDir = process.env.STORAGE_DIR ?? "storage";
  const { filesRemoved } = await clearTestData(db, storageDir);
  console.info(`Done. Removed the test data and ${filesRemoved} file(s) from ${storageDir}.`);
  console.info("Next: set the real stock in Admin > Inventory, and remove any admin account made only for testing.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
