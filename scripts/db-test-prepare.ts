// `pnpm db:test:prepare`: create and migrate the test database by hand.
// `pnpm test` also does this automatically before each run.
import { existsSync } from "node:fs";
import { prepareTestDatabase } from "../tests/setup/test-database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
prepareTestDatabase();
