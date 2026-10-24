# Site overview (for hosting)

A short summary of what the site is made of, how to run it, what Hostinger
needs and what could stop it running there. Written 2026-10-25 from the code on
`dev` (commit `b412c8b`). The step-by-step deploy guide is `docs/DEPLOY.md`;
the full plan is `docs/PLAN.md`.

## 1. Technology

The site is **one Node.js app**. It serves the pages and the server logic
together, so there is no separate frontend or backend to host.

| Part | What it uses |
| --- | --- |
| Pages (frontend) | Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS 4, Radix UI |
| Server (backend) | The same Next.js app: server actions and `src/app/api/` routes. Zod checks every input. |
| Sign-in | Better Auth (email + password; phone code waits for an SMS provider) |
| Database | MySQL through Prisma 7 (`@prisma/adapter-mariadb` driver, no native binaries) |
| Files | Uploaded files saved on the server's disk in `STORAGE_DIR` |
| PDFs and QR codes | `pdf-lib` (invoices), `qrcode` (UPI payment QR) |
| Tests | Vitest and Playwright |
| Tools | Node **24**, pnpm 9 |

Not connected yet (by decision): Razorpay, Shiprocket, SMS (MSG91), email
sending and cloud file storage. Payment at launch is by **UPI QR or bank
transfer** (`PAYMENT_PROVIDER=manual`), and an admin marks orders paid.

## 2. Build and run on a computer

Needs Node 24 (the `.npmrc` makes pnpm download 24.21.0 by itself), pnpm and
MySQL.

```
pnpm install                 # installs packages, then makes the database client
cp .env.example .env.local   # then fill in the values (section 4)
pnpm db:migrate              # creates the tables (computer only)
pnpm db:seed                 # sample content, catalogue and settings
pnpm admin:create            # first admin (uses ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm dev                     # http://localhost:3000
```

Production-style run: `pnpm build`, then `pnpm start`.
Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`.

## 3. What goes on Hostinger

**Upload** (or import from Git):

- `src/`: all the site's code.
- `public/`: images and brand files served as they are.
- `prisma/`: database layout (`schema.prisma`), table changes
  (`migrations/`) and the seed.
- `scripts/`: admin creation, catalogue load, clearing test data.
- `package.json`, `pnpm-lock.yaml`, `.npmrc`.
- `next.config.ts`, `prisma.config.ts`, `tsconfig.json`,
  `postcss.config.mjs`, `next-env.d.ts`.

**Do not upload:**

- `node_modules/` and `.next/`: rebuilt on the server.
- `src/generated/`: rebuilt on install.
- `.env.local`: your own computer's secrets.
- `storage/`: local test uploads.
- `test-results/`, `playwright-report/`, `tests/`.
- `docs/`, `.claude/`, `.git/`.

**Made on the server:**

- `node_modules/` (`pnpm install`, about 1.1 GB).
- `.next/` (`pnpm build`).
- The `STORAGE_DIR` folder for uploads. Put it **outside** the web folder, on
  disk that survives a redeploy, and back it up.

## 4. Settings (environment values)

Set these in the Node.js app's settings on Hostinger, never in the code. Each
address (test and live) gets its own values. Full list with comments:
`.env.example`. Per-address values: the table in `docs/DEPLOY.md`.

| Need | Setting | Notes |
| --- | --- | --- |
| Database connection | `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DATABASE`. A separate database for the test address. |
| Secret key | `BETTER_AUTH_SECRET` | 32+ random characters (`openssl rand -base64 32`). Different on each address. |
| Site address | `BETTER_AUTH_URL` | e.g. `https://test.yourdomain.com`. Used for links, the sign-in safety check and HSTS. |
| Uploads folder | `STORAGE_DIR` | Full path to a folder outside the web folder. |
| Payment | `PAYMENT_PROVIDER` | `manual` on both addresses. `test` refuses to run on a server. |
| Shipping | `SHIPPING_PROVIDER` | `test`. On a server, "Create shipment" stays off until Shiprocket. |
| Team password (test address only) | `STAGING_ACCESS_USER`, `STAGING_ACCESS_PASSWORD` | Leave empty on the live site. |
| First admin (remove after use) | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Only for `pnpm admin:create`. |
| Must stay off | `SHOW_DESIGN_PAGE=false`, `DEV_SHOW_OTP=false`; leave `TEST_PAYMENTS_IN_LOCAL_BUILD` and `TEST_SHIPPING_IN_LOCAL_BUILD` unset | |
| Optional | `APP_VERSION` | A label in the error log. Without Git on the server it shows "dev". |

**Email:** there are **no email settings yet**. Emails (verification, forgot
password, order messages) are only printed to the server log
(`src/server/notify/`). Real sending (Hostinger SMTP or a provider) is a later
ticket. Until then, testers sign in with email and password, and an admin helps
anyone who is locked out.

Set `DATABASE_URL` and `BETTER_AUTH_URL` **before** `pnpm build` too. The
build reads `BETTER_AUTH_URL` to decide the security headers.

## 5. Risks on shared Hostinger hosting

Check these on the Hostinger plan **before** the upload day. The first three
can stop the site from running at all.

1. **Node.js support and version.** The site needs a plan that runs Node.js
   apps (on Hostinger that is Business, Cloud or VPS, not the basic shared
   plans) with **Node 24**. `package.json` and `.npmrc` refuse older Node
   (`engine-strict`). If only Node 22 or lower is offered, stop and ask the
   developer.
   - The `.npmrc` line `use-node-version=24.21.0` makes pnpm download its own
     Node. If Hostinger blocks that download, or installs with npm instead of
     pnpm, the install fails. Check which package manager the Node.js app
     screen uses.
2. **Memory and time for the build.** `next build` is heavy: Next.js builds
   often need 1 GB or more of memory for a site this size (not measured
   here). Shared plans limit
   memory and process time, so the build may be killed. Fallback: build on a
   computer with the same Node version and upload the result. That is a
   developer decision.
3. **MariaDB instead of MySQL.** Hostinger shared databases are usually
   **MariaDB**. The site was only tested on MySQL. The tables use the
   `utf8mb4_unicode_ci` collation and JSON columns, which MariaDB supports,
   and the driver is the MariaDB one. Still, run `pnpm db:deploy` and the
   team checklist on the test address before trusting it.
4. **Uploads lost on redeploy.** If `STORAGE_DIR` is inside the app folder, a
   new upload or Git import can wipe doctors' documents, logos, label proofs
   and invoices. Keep it outside and include it in backups.
5. **File count and disk.** `node_modules` has well over 100,000 files. Shared
   plans cap the number of files ("inodes"), and two apps (test and live)
   double it. Check the plan's limit.
6. **Visitor address and rate limits.** Sign-in limits are stored in the
   database (good for shared hosting) but key on the first `x-forwarded-for`
   value. Hostinger's proxy must overwrite that header, or limits can be
   dodged. There is a test in `docs/DEPLOY.md` section 5.
7. **Database connections.** Shared MySQL limits connections per user. The
   app keeps a small pool per process. Fine for testing; watch it if
   Hostinger runs several copies of the app.
8. **Things that will not work on the server yet** (expected, not bugs): phone
   code sign-in, any email sending, and live delivery tracking.
9. **HTTPS first.** The team password is sent in plain text without https.
   Turn on SSL and "Force HTTPS" before sharing the address.

**Effect on dates:** the launch on 1 November (deadline 6 November) depends
on points 1 to 3. If the plan has no Node 24, cannot finish the build, or the
database misbehaves on MariaDB, the fix (a different plan, a VPS, or building
elsewhere) takes days. Check them first.
