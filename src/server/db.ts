import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/server/env";

// One client per process. In development, hot reload re-runs this module, so
// the client is kept on globalThis to avoid opening a new pool each time.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

// The MariaDB driver talks to the server in a binary collation unless told
// otherwise. MySQL 8 copes, but MariaDB (Hostinger) refuses to compare that
// with the tables' utf8mb4_unicode_ci in LIKE searches ("Illegal mix of
// collations"). So the connection asks for utf8mb4_unicode_ci, like the tables.
function connectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("collation")) {
      parsed.searchParams.set("collation", "UTF8MB4_UNICODE_CI");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function createClient(): PrismaClient {
  const adapter = new PrismaMariaDb(connectionString(serverEnv().DATABASE_URL));
  return new PrismaClient({ adapter });
}

export const db = globalForDb.db ?? createClient();

if (serverEnv().NODE_ENV !== "production") globalForDb.db = db;
