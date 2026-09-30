# Saatvik Vaidya

A mobile-first Ayurveda store and professional platform for the Saatvik Vaidya
firm. Built with Next.js (App Router), TypeScript, Tailwind CSS v4, Prisma and
MySQL.

Project docs live in `docs/`: the plan (`PLAN.md`), the design system
(`DESIGN.md`), the chunk list (`CHUNKS.md`) and the progress log
(`PROGRESS.md`). The client mockup is in `docs/mockup/`.

## Requirements

- **pnpm 9** (`npm i -g pnpm@9`).
- **Node 24 LTS.** You don't need to install it yourself: `.npmrc` sets
  `use-node-version`, so pnpm downloads Node 24 and runs every `pnpm` command
  with it, whatever your system Node is. Run tools through `pnpm` (for example
  `pnpm exec prisma ...`), not with a bare `node` or `npx`.
- **MySQL** running locally. On macOS: `brew install mysql` then
  `brew services start mysql`. The default setup expects user `root` with no
  password.

## First run

```bash
pnpm install                  # also generates the Prisma client
cp .env.example .env.local    # then adjust values if your MySQL differs,
                              # set BETTER_AUTH_SECRET (openssl rand -base64 32)
                              # and ADMIN_EMAIL / ADMIN_PASSWORD
pnpm exec playwright install chromium
pnpm db:migrate               # creates the saatvik_vaidya database
pnpm db:seed
pnpm admin:create             # the admin account, from .env.local
pnpm dev                      # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm typecheck` | Generate route types and run `tsc` |
| `pnpm lint` | ESLint (Next config), no warnings allowed |
| `pnpm format` | Prettier (with Tailwind class sorting) |
| `pnpm test` | Vitest unit tests; prepares the test database first |
| `pnpm test:e2e` | Playwright on `phone` (375×812) and `desktop` (1280×800); builds and starts the app on port 3100 itself |
| `pnpm db:migrate` | Create/apply migrations to the dev database |
| `pnpm db:seed` | Seed the dev database (idempotent) |
| `pnpm db:reset` | Drop and recreate the dev database, then seed |
| `pnpm db:test:prepare` | Create and migrate the test database by hand |
| `pnpm admin:create` | Create the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, or update its password (signs it out everywhere) |

## Databases

- Dev: `saatvik_vaidya`, from `DATABASE_URL`.
- Tests: `saatvik_vaidya_test`, from `TEST_DATABASE_URL`. Vitest always points
  server code at it and refuses any database name that doesn't end in `_test`.

`pnpm db:seed` adds the user types, default settings and all homepage content
(from `src/server/seed/`). Re-running it restores seeded text but never
overwrites a setting that already exists. Settings and homepage content are
read through a cache (`src/server/content/`), so a change made straight in the
database shows up within 5 minutes, even on `pnpm dev`. To see it at once,
restart the server after deleting `.next/dev/cache/fetch-cache` (or
`.next/cache/fetch-cache` for `pnpm start`).

## Sign-in (auth)

Better Auth, in `src/server/auth/`, with email + password and phone OTP
(Indian mobiles). Endpoints are under `/api/auth/*`; server code uses
`getSession()`, `requireUser()` and `requireAdmin()` from
`src/server/auth/session.ts`.

- There's no real SMS or email yet. OTPs and reset links are printed to the
  `pnpm dev` log as `[notify:dev] ...`.
- With `DEV_SHOW_OTP=true` (never in production), `GET
  /api/dev/otp?phone=98XXXXXXXX` returns the latest OTP for that number.
- Rate limits are stored in the `AuthRateLimit` table. If you lock yourself
  out while testing locally, empty it:
  `/opt/homebrew/opt/mysql/bin/mysql -uroot saatvik_vaidya -e "DELETE FROM AuthRateLimit"`.

## Environment

All variables are listed in `.env.example`. Local values go in `.env.local`,
which is git-ignored. Never commit secrets.
