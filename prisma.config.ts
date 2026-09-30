import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local for the app; the Prisma CLI needs it loaded here.
// Variables already set in the shell win, so scripts can point at another db.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Empty only on a fresh clone before .env.local exists; `prisma generate`
    // does not need a connection, and every other command will fail clearly.
    url: process.env.DATABASE_URL ?? "",
  },
});
