# Saatvik Vaidya website

A mobile-first Ayurveda store and professional platform for the Saatvik Vaidya
firm. Work here is often done by unattended Octopus runs, one chunk at a time.

## Read first

1. `docs/PLAN.md`: scope, decisions, stack, data model and security rules.
   **Stage A is the current scope.**
2. `docs/DESIGN.md`: the design system. Every screen follows it.
3. `docs/PROGRESS.md`: what earlier chunks did and left behind.
4. `docs/CHUNKS.md`: the chunk list; each task names its chunk.
5. `docs/mockup/`: the client mockup (`index.html`, `styles.css`, `assets/`).
   Read-only reference; never edit it.

## Local setup

- Node 20+, pnpm.
- MySQL runs locally through Homebrew (`brew services start mysql`); `root` has
  no password. The client binaries are not on PATH, so use
  `/opt/homebrew/opt/mysql/bin/mysql`.
- `DATABASE_URL="mysql://root@localhost:3306/saatvik_vaidya"`. Tests use
  `saatvik_vaidya_test`.
- Secrets and local values go in `.env.local` (git-ignored). Every variable
  must be listed in `.env.example` with a safe placeholder.

## Commands

These scripts exist once chunk A1 is done; keep them working.

- `pnpm dev`: dev server on http://localhost:3000
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `pnpm test:e2e`
  (Playwright), `pnpm build`
- `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`

## Rules for every chunk

- Work on the `dev` branch. **Never push, never deploy,** never force-push, and
  never rewrite history.
- Stay inside the chunk's scope. Note anything else worth doing in
  `docs/PROGRESS.md` under "Later" instead of doing it.
- **No real integrations yet:**
  - No Razorpay, Shiprocket, MSG91, email provider, WhatsApp API or R2.
  - SMS and email go through `src/server/notify/`, whose dev implementation
    prints to the server log.
  - Unbuilt features show a clear "coming soon" state.
- Follow the security rules in `docs/PLAN.md`: Zod on every server input, no
  secrets in code, rate limits on auth, no account enumeration.
- Follow `docs/DESIGN.md`:
  - Use tokens only, never raw hex values in components.
  - Build phone-first.
  - Check every screen at 375 px and 1280 px (Playwright projects for both).
- Keep user-facing text in `src/content/` files, not inline, so Hindi can be
  added later.
- Content that the admin will later edit comes from the database (seeded), not
  hard-coded arrays in components.
- Keep TypeScript strict, and don't use `any` without a comment explaining why.
  Match the existing code style.
- Tests:
  - Server logic gets Vitest tests.
  - User flows get Playwright tests.
  - Don't delete or skip a failing test to get green; fix the cause.

## Definition of done for a chunk

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build`
   all pass.
2. Screens match `docs/DESIGN.md` and the mockup at 375 px and 1280 px.
3. `docs/PROGRESS.md` has a new entry: chunk id, what was built, decisions,
   known gaps and next steps.
4. One or more commits on `dev` with clear messages.

If a chunk starts and the app does not build or tests fail, fix that first and
say so in the progress entry. If something blocks the chunk and can't be solved
safely (for example MySQL is down), stop and write the blocker in
`docs/PROGRESS.md`. Don't work around it by weakening security or tests.
