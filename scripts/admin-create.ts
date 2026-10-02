// `pnpm admin:create`: creates or updates the admin account from ADMIN_EMAIL,
// ADMIN_PASSWORD and ADMIN_NAME (optional) in .env.local. Run it again to
// change the admin's password; that also signs the admin out everywhere.
import { existsSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { adminInputSchema, upsertAdmin } from "../src/server/auth/admin";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

const input = adminInputSchema.safeParse(process.env);
if (!input.success) {
  console.error(
    `Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local:\n${z.prettifyError(input.error)}`,
  );
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

upsertAdmin(db, input.data)
  .then(({ email, created }) => {
    console.info(
      `${created ? "Created" : "Updated"} super admin ${email} in ${new URL(url).pathname.slice(1)}. Two-factor is set up at the first sign-in.`,
    );
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
