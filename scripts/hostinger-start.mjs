// The start command on Hostinger (`pnpm start:hostinger`). Hostinger's Business
// plan has no terminal, so the database set-up that a person would type by
// hand runs here, every time the app starts, then the site starts.
//
//   1. `prisma migrate deploy`: creates or updates the tables (safe to repeat).
//   2. The first start only: `db:seed` and `db:seed:catalogue` (settings, home
//      page content, user types and the product list). Re-running `db:seed`
//      resets the user types, so it is not repeated on every restart.
//   3. `admin:create` when ADMIN_EMAIL and ADMIN_PASSWORD are set, once per
//      admin email. Delete both ADMIN_ lines after the first sign-in.
//   4. `next start`.
//
// What was done is recorded in `.setup/` inside STORAGE_DIR (the uploads
// folder, outside the website folder), so it survives a redeploy. Delete that
// folder with the File Manager to run the first-start steps again. If a step
// fails the site does not start, and the log shows why.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function run(label, args) {
  console.info(`[setup] ${label}`);
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[setup] "${label}" failed, so the site was not started.`);
    process.exit(result.status ?? 1);
  }
}

const storage = process.env.STORAGE_DIR;
if (!storage) {
  console.error("[setup] STORAGE_DIR is not set, so the site was not started.");
  process.exit(1);
}
const marks = join(storage, ".setup");
mkdirSync(marks, { recursive: true });
const done = (name) => existsSync(join(marks, name));
const mark = (name) => writeFileSync(join(marks, name), `${new Date().toISOString()}\n`);

run("Updating the database tables", ["db:deploy"]);

if (!done("seeded")) {
  run("Loading the settings and home page content", ["db:seed"]);
  run("Loading the product list", ["db:seed:catalogue"]);
  mark("seeded");
}

const email = process.env.ADMIN_EMAIL;
if (email && process.env.ADMIN_PASSWORD) {
  const name = `admin-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`;
  if (!done(name)) {
    run("Creating the admin account", ["admin:create"]);
    mark(name);
  } else {
    console.info("[setup] The admin account was already created. Remove the ADMIN_ lines.");
  }
}

console.info("[setup] Starting the site");
const server = spawn("pnpm", ["start"], { stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
