import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/server/env";

// One client per process. In development, hot reload re-runs this module, so
// the client is kept on globalThis to avoid opening a new pool each time.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaMariaDb(serverEnv().DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const db = globalForDb.db ?? createClient();

if (serverEnv().NODE_ENV !== "production") globalForDb.db = db;
