// `pnpm db:seed`: idempotent seed data. Chunk A4 fills this with user types,
// settings and homepage content; for now it only checks the connection.
import { existsSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
  console.info("Seed: connected. Nothing to seed yet.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
