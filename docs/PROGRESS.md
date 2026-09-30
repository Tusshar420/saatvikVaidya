# Progress log

Newest entry at the bottom. Each chunk adds an entry: chunk id, date, what was
built, decisions, known gaps and next steps.

## Setup (2026-09-30)

- Added CLAUDE.md, docs/PLAN.md, docs/DESIGN.md, docs/CHUNKS.md and the client
  mockup in docs/mockup/.
- Local MySQL (Homebrew) is running; root has no password.
- Stage A chunks A1–A9 are queued in The Den (project "SaatvikVaidya") to run
  in auto mode.

## A1. Scaffold and tooling (2026-09-30)

First chunk; nothing earlier to verify. Created the `dev` branch from `main`
and committed the docs and mockup there first.

**Built**
- Next.js 16.3.7 (App Router, Turbopack, `src/`, `@/*` alias), React 19.2,
  TypeScript 6.0 strict. Placeholder home page (`src/app/page.tsx`) with its
  strings in `src/content/site.ts`.
- Tailwind CSS v4 via `@tailwindcss/postcss`. The colour tokens from
  `docs/DESIGN.md` are already in `@theme` in `globals.css`, so the placeholder
  uses no raw hex. A2 adds fonts, type scale, radius, shadow, gradients and
  motion.
- ESLint 9 flat config (Next core-web-vitals + TypeScript + prettier) and
  Prettier with `prettier-plugin-tailwindcss`. `pnpm lint` fails on warnings.
- Vitest 5 with two projects: `server` (`src/**/*.test.ts`, node) and `dom`
  (`src/**/*.test.tsx`, jsdom + Testing Library + jest-dom).
- Playwright 1.63, Chromium only, projects `phone` (375×812, touch, mobile) and
  `desktop` (1280×800). The web server is a **production build** on port 3100
  (`pnpm build && pnpm start --port 3100`), so tests see the real CSP and a
  `pnpm dev` on :3000 can run alongside.
- Prisma 7.10 for MySQL: `prisma.config.ts` (loads `.env.local`),
  `prisma/schema.prisma` (no models yet), the `prisma-client` generator writing
  to `src/generated/prisma` (git-ignored, regenerated on `pnpm install`), and
  the `@prisma/adapter-mariadb` driver adapter. Client singleton in
  `src/server/db.ts`; env validated with Zod in `src/server/env.ts`.
- Test database: `TEST_DATABASE_URL` (`saatvik_vaidya_test`). Vitest's global
  setup runs `prisma migrate deploy` against it (creating it if missing), and
  `vitest.config.ts` forces `DATABASE_URL` to it. `tests/setup/test-database.ts`
  refuses any database name not ending in `_test`.
- Scripts: `dev`, `build`, `start`, `typecheck` (`next typegen && tsc`),
  `lint`, `format`, `format:check`, `test`, `test:e2e`, `db:generate`,
  `db:migrate`, `db:seed` (placeholder `prisma/seed.ts`, only checks the
  connection), `db:reset`, `db:test:prepare`.
- Security headers in `next.config.ts` from `src/lib/security-headers.ts`: CSP
  (Next's "without nonces" setup, with `'unsafe-eval'` and `ws:` only on the dev
  server, `upgrade-insecure-requests` only in production, `frame-ancestors
  'none'`, `object-src 'none'`), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy, COOP same-origin. `poweredByHeader` off.
- `src/server/notify/`: a `Notifier` interface and the dev sender that logs to
  the server console (A5 adds the OTP/reset messages).
- Folders: `src/components/ui`, `src/components/site` (empty, `.gitkeep`),
  `src/lib`, `src/content`, `src/server`, `tests/e2e`, `tests/setup`,
  `scripts/`.
- `.env.example` (DATABASE_URL, TEST_DATABASE_URL), `.env.local`, `.gitignore`.
  README has the local run steps.
- Tests: `src/lib/security-headers.test.ts`, `src/server/db.test.ts` (checks
  the client is on the test db), `src/app/page.test.tsx` (Testing Library), and
  `tests/e2e/home.spec.ts` (renders, headers present, no console errors or CSP
  violations, no horizontal scroll) on phone and desktop.

**Decisions**
- **Node 24 LTS via pnpm.** The system Node is 20.15, below what Prisma 7,
  ESLint 9.39 and Vitest 5 need (20.19+/22+), and Node 20 is end-of-life.
  Rather than change the machine's Node, `.npmrc` sets
  `use-node-version=24.21.0` and `engine-strict=true`; pnpm downloads it and
  runs every script with it. `package.json` has `engines.node >=24`. Always
  run tools through `pnpm` / `pnpm exec`.
- **Prisma 7.10.0, not "latest".** npm's `latest` tag for `prisma` currently
  points at `8.0.0-rc.19`; 7.10.0 is the newest stable.
- **TypeScript 6.0, not 7.0.** typescript-eslint (used by eslint-config-next)
  supports TS < 6.1.
- **ESLint 9, not 10.** eslint-plugin-react (in eslint-config-next) doesn't
  support ESLint 10 yet. ESLint 9 is marked unsupported upstream; see Later.
- `"type": "module"` in package.json (Vite 8's config loader wants ESM), and
  `allowImportingTsExtensions` so `vitest.config.ts` can import `.ts` files
  with the extension.
- `pnpm dev` is pinned to `--port 3000`: Octopus runs inherit `PORT=8787` (The
  Den's API port) and `next dev` would otherwise try to use it.
- AGENTS.md from create-next-app is committed: `next dev` re-creates it, and it
  points agents to the bundled Next 16 docs in `node_modules/next/dist/docs/`.
  CLAUDE.md is unchanged.

**Checks.** `pnpm typecheck`, `lint`, `test` (6 tests), `test:e2e` (2 tests)
and `build` pass. `pnpm dev` serves the placeholder on :3000 with no console
errors at 375 and 1280 px. `pnpm db:migrate` connected and created
`saatvik_vaidya`; `db:seed` and `db:test:prepare` work.

**Known gaps**
- `pnpm db:reset` is wired but not run: Prisma 7 blocks `migrate reset` when it
  detects an AI agent, unless the user gives explicit consent. A person can run
  it. **Octopus runs can't use `migrate reset`**, so A4's test-db resets should
  use `migrate deploy` plus truncating tables (or a person runs the reset).
- No migrations exist yet (no models); A4 creates the first one.
- The CSP allows `'unsafe-inline'` scripts (needed without nonces).

**Next:** A2, design tokens and UI primitives.

## Later

(Ideas and follow-ups outside the current chunk's scope go here.)

- Upgrade the machine's Node to 24 LTS (Node 20 is end-of-life), and confirm
  the Hostinger Node.js version before deploying.
- Move to ESLint 10 once eslint-config-next's plugins support it; TypeScript 7
  once typescript-eslint does; Prisma 8 once it's stable.
- A9: consider a nonce-based CSP via `src/proxy.ts` (drops `'unsafe-inline'`,
  but makes pages dynamic). Add HSTS at deployment. Razorpay will need
  `payment` in Permissions-Policy, its domains in the CSP, and probably
  `Cross-Origin-Opener-Policy: same-origin-allow-popups`. YouTube embeds
  (courses) will need `frame-src` entries.
