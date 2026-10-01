// `pnpm db:seed`: idempotent seed data (user types, default settings and
// homepage content). The data and logic live in src/server/seed/.
import { existsSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDatabase } from "../src/server/seed";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });
const database = new URL(url).pathname.slice(1);

async function main(): Promise<void> {
  const summary = await seedDatabase(db);
  console.info(
    [
      `Seeded ${database}:`,
      `${summary.userTypes} user types,`,
      `${summary.homeSections} homepage sections,`,
      `${summary.contentRows} content rows,`,
      `${summary.productsCreated} sample products created;`,
      summary.settingsCreated.length > 0
        ? `created settings ${summary.settingsCreated.join(", ")}.`
        : "settings already present (left unchanged).",
    ].join(" "),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
