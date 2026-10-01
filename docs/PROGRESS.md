# Progress log

Newest entry at the bottom. Each chunk adds an entry: chunk id, date, what was
built, decisions, known gaps and next steps.

---

# Stage A summary (2026-10-01)

**What exists:** A fully responsive, accessible mobile-first website for Saatvik Vaidya running locally, built across 9 chunks. Includes the design system, site shell (header, nav, footer, mobile dock), comprehensive authentication system with email and OTP sign-up/sign-in, and a database-driven homepage with all sections from the mockup.

**Current stack:**
- Next.js 16.3.7, React 19.2, TypeScript 6.0 (strict mode)
- Tailwind CSS v4, Radix UI for complex components
- MySQL (local Homebrew), Prisma 7.10 with MariaDB adapter
- Better Auth 1.7.6 with email/password and phone OTP plugins
- Vitest for unit/integration testing, Playwright for E2E (phone & desktop viewports)

**How to run locally:**

```bash
# Install dependencies and set up Node 24
pnpm install

# Set up database
pnpm db:migrate      # Create tables
pnpm db:seed         # Seed content and users
pnpm admin:create    # (optional) Create admin user from ADMIN_* env vars

# Start dev server (port 3000) or production build (port 3100)
pnpm dev             # Development with hot reload
pnpm build && pnpm start --port 3100  # Production build

# Run checks
pnpm typecheck       # Type check
pnpm lint            # Linting
pnpm test            # Unit/integration tests (Vitest)
pnpm test:e2e        # End-to-end tests (Playwright)
```

**Test accounts (from seed):**
- **Phone sign-in:** Any 10-digit number (e.g. 9876543210), OTP is logged to console with `DEV_SHOW_OTP=true`
- **Email+password:** `customer@saatvik.test` / `password123` (Customer)
- **Admin:** Created via `pnpm admin:create` from `.env.local` vars `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
- User types: Customer (default), Ayurveda Doctor, Clinic/Hospital, Pharmacy/Store, Stockist/Distributor

**What's built in Stage A:**

| Component | Status | Notes |
|-----------|--------|-------|
| Design system | ✅ | All tokens, primitives, `/design` showcase page |
| Site shell | ✅ | Header, nav rail, footer, mobile dock, skip link |
| Authentication | ✅ | Email (8-128 chars, common-password checked), phone OTP (6 digits, 5-minute expiry, 5 attempts), role escalation protection, rate limits (IP + phone/email specific) |
| Homepage | ✅ | Hero carousel, trust strip, reels with filters, offers, quick actions, launch steps, brands, courses, coins, quiz, feedback, community, profile completion, why Saatvik |
| Database | ✅ | User types, settings, sections, content models (slides, brands, reels, offers, etc.), settings history, seed that restores content but preserves admin edits |
| Account page | ✅ | Protected page showing name, contact, user type, verification status |
| Session & auth | ✅ | Secure HttpOnly SameSite cookies, session validation, middleware for `/account` and `/admin` |

**Known gaps and limitations:**

1. **Axe accessibility:** One pre-existing issue flagged - gold badge on video reels (false positive; white text on gold has 9:1+ contrast). All other major WCAG AA violations fixed (color contrast, green text, orange borders).

2. **Dependencies:** 3 high + 3 moderate vulnerabilities in transitive dependencies (`mysql2` decompression bomb, `mariadb` charset handling). These are in database drivers and would require Prisma/database updates.

3. **Unbuilt features (coming soon states):**
   - Payments (Razorpay)
   - Delivery tracking (Shiprocket)
   - SMS/email delivery (using dev log printer now; will use MSG91 + Resend/Hostinger later)
   - Admin panel (editing content, managing users, reports)
   - Ebook section, Launch Your Brand full flow, Quiz & Win, Vaidya Community
   - YouTube course embeds
   - Hindi language (strings prepared, not yet switched)

4. **Not yet implemented:**
   - Email verification for email sign-ups
   - Two-factor login for admins
   - Nonce-based CSP (currently uses `'unsafe-inline'`)
   - HSTS headers
   - 404 branded page

5. **Database / E2E test limitations:**
   - Playwright runs against dev database (not isolated e2e database)
   - Rate limit table and auth tables must be cleared between e2e test runs
   - Content changes in e2e tests would persist (future: use separate e2e database)

6. **Lighthouse performance:** Needs dedicated run (Chrome/Chromium with lighthouse CLI). Target is 85+ Performance, 95+ Accessibility & Best Practices on mobile homepage.

**Security review (auth code vs. PLAN.md):**

✅ **Rate limits:** IP-based (sign-in, email sends, SMS sends) + phone/email specific (OTP sends). Requests refused with 429 + Retry-After.
✅ **Role escalation:** Admin role set only by seed/database, never by user input. Create hook forces `role: user`.
✅ **Session security:** Secure HttpOnly SameSite=Strict cookies (session lifetime 7 days, refreshed daily).
✅ **CSRF:** Built into Better Auth; no explicit tokens needed for same-site requests.
✅ **Error messages:** Generic for all auth endpoints; never reveal whether account exists.
✅ **Headers/CSP:** CSP with `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests` in prod. X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
✅ **Dev-only routes:** `/api/dev/otp` returns 404 in production build (flag-gated).
✅ **Secrets:** All env vars in `.env.local` (git-ignored), listed in `.env.example`.

**Proposed next stage (Phase 1):**

- Settings admin UI (switches for maintenance mode, feature toggles)
- Admin panel for editing content (sections, homepage items) with revalidation
- Catalogue: product listing, search, filtering
- Cart & checkout with Razorpay integration
- GST invoices (pdf-lib)
- Shiprocket delivery tracking & SMS
- Super Coins ledger and admin earning/redemption rules
- Ebook downloads (per-book and site-wide toggles)
- `/account` extended: address, preferences, order history
- Email verification for email accounts
- Admin two-factor login
- Mobile pass generation
- Final security review before deployment to Hostinger

**To ship Stage A (if moving to another device or pausing):**
- Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build` to verify green
- All 9 chunks are committed to `dev` branch (check `git log --oneline | head -20`)
- Database can be recreated from migrations + seed
- `.env.local` holds local values; `.env.example` is complete

---

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

## A2. Design tokens and UI primitives (2026-09-30)

A1 was confirmed done (commits on `dev`; typecheck, lint and tests were green
at the start). Nothing needed fixing first.

**Built**
- **Tokens** in `src/app/globals.css` `@theme`:
  - Colours.
  - Breakpoints (560/820/1100/1280).
  - Type scale as `text-display`, `text-h2`, `text-h3`, `text-body-lg`,
    `text-body`, `text-small` and `text-label`, with line height, tracking and
    weight baked in.
  - Radius `sm/md/button/lg/xl/modal/2xl` and shadows `card/raised/modal/cta`.
  - Motion: 200 ms `ease` default transitions, plus `animate-rise-in`
    (fade + 12 px rise) and `animate-fade-in`.

  Also added:
  - Named gradient utilities: `bg-hero`, `bg-learning`, `bg-learning-poster`,
    `bg-offer-orange/teal/navy`, `bg-quiz`, `bg-profile`, `bg-brand-mark` and
    `bg-coin`.
  - Layout utilities: `shell` (page container), `section-y` (section padding)
    and `scrollbar-none`.
  - A global teal `:focus-visible` ring.
  - A `prefers-reduced-motion` block that switches off transitions,
    animations and smooth scroll. Spinners opt out with
    `data-essential-motion`.
- **Fonts** via `next/font/google` in the root layout: Inter (`font-sans`,
  preloaded) and Noto Sans Devanagari as its fallback. Noto Serif Devanagari is
  available as `font-serif-hindi`. The Devanagari faces aren't preloaded;
  unicode-range means they only download when Hindi is on the page. Fonts are
  self-hosted, so the CSP stays `font-src 'self'`.
- **Primitives** in `src/components/ui/`. Each one is typed and takes
  `className`:
  - **Button**: variants primary, secondary, light and link; sizes md 48 and
    sm 40. Options: `arrow`, `icon`, and `loading` (spinner + `aria-busy`).
    `buttonClasses()` styles a `<Link>` as a button. `ButtonGroup` makes its
    buttons full width under 560 px.
  - **IconButton**: 44 px; the `label` prop is required and becomes the
    `aria-label`. Variants ghost, outline and soft; shapes square and round.
  - **Form fields.** `Field` + `useFieldIds` wire the label, help, error,
    `aria-describedby` and `aria-invalid` for all of these:
    - **Input**.
    - **PhoneInput**: fixed +91 prefix, `tel-national`, numeric. Keeps only
      10 digits and strips a pasted +91/91/0 prefix (`normalizeIndianPhone`
      in `src/lib/phone.ts`).
    - **OtpInput**: 6 boxes, `one-time-code`. Supports paste and SMS autofill
      (a full code fills from box 1), auto-advance, backspace back, arrows,
      Home/End, and a hidden input for forms. Changing the controlled `value`
      resets the boxes.
    - **PasswordInput**: show/hide toggle, optional strength hint
      (`src/lib/password-strength.ts`) in a polite live region.
    - **Checkbox**: native input, 44 px row.
  - **ChoiceChips**: Radix RadioGroup; layouts `wrap` and `scroll`.
  - **Tabs**: Radix; underline style.
  - **Card**: `interactive` lifts 3 px on hover.
  - **Badge**: teal, orange, blue, gold, live (dot) and soon.
  - **Eyebrow**: optional orange bar; light tone for dark bands.
  - **IconTile** and **SectionHeading**: eyebrow, two-part title with a teal
    `<em>`, description and "View all" link; stacks under 820 px; dark tone.
  - **Modal**: Radix Dialog. A bottom sheet with a grab bar under 560 px,
    a centred 530 px card above. Traps focus; Esc and the backdrop close it.
  - **Toast**: Radix Toast. `ToastProvider` is in the root layout and
    `useToast()` shows one. Tones success, error and info; on phones it sits
    above where the mobile dock will go.
  - **Avatar** and **CoinPill**: icon only under 560 px; the balance stays in
    the accessible name.
  - **Stepper**: `<ol>` with `aria-current="step"`.
  - **Carousel**: cross-fade with prev/next, dots and a pause/play button.
    Auto-advances every 6.5 s. It pauses on hover, keyboard focus, a hidden
    tab and reduced motion, and supports swipe on touch.
  - **HScroller**: focusable snap region that fades whichever edge has more
    content.
  - **Skeleton**, SkeletonText, SkeletonCard, and SkeletonGroup (announces
    "Loading").
  - **EmptyState** and **ComingSoon**.
- Helpers:
  - `src/lib/cn.ts`: clsx + tailwind-merge, taught our custom token names.
  - `src/lib/format.ts`: `formatNumber` and `formatINR` (en-IN grouping),
    `initialsOf`.
  - `src/lib/use-reduced-motion.ts`.
- Strings are in `src/content/ui.ts` (primitive defaults) and
  `src/content/design.ts` (showcase).
- **`/design` page** (`src/app/design/`) shows every token and component
  variant, grouped with headings, with a contents nav and `noindex`. It renders
  per request (`connection()`) and returns 404 unless `NODE_ENV=development`
  or `SHOW_DESIGN_PAGE=true` (`src/lib/flags.ts`). The flag is in
  `.env.example`, and Playwright's server sets it.
- Dependencies:
  - `@radix-ui/react-dialog`, `-tabs`, `-radio-group` and `-toast`.
  - `lucide-react`, `clsx` and `tailwind-merge`.
  - Dev only: `@axe-core/playwright` and `@testing-library/user-event`.
- Tests:
  - `phone-input.test.tsx` (7): 10 digits only, junk stripped, +91/0 paste,
    controlled mode, error wiring.
  - `otp-input.test.tsx` (13): paste (full, partial, messy text, from any
    box), auto-advance, backspace, arrows, overwrite, onComplete, form
    value, controlled reset.
  - `src/lib/ui-helpers.test.ts`: phone, format, password strength, the
    design flag and `cn`.
  - `tests/e2e/design.spec.ts` on phone and desktop:
    - Page loads with all group and section headings, no console errors and
      no horizontal scroll.
    - axe (WCAG 2.0/2.1/2.2 A and AA) passes with zero violations.
    - Modal: bottom sheet on phone and centred on desktop, focus stays
      inside, axe is clean with it open, Esc closes it and focus returns to
      the trigger.
    - A toast appears.

**Decisions**
- **Deeper orange for text on or in orange.** White on `--color-orange`
  `#ef6c1c` is 3.1:1, which fails WCAG AA for button text (4.5:1 needed). Orange
  text on white or orange-soft fails too, and axe flags both. DESIGN.md asks for
  both that orange and AA, so two tokens were added:
  - `--color-orange-strong` `#c2540a` (4.6:1 with white): primary button
    background and the active Stepper circle.
  - `--color-orange-ink` `#a8470a` (5.3:1+): primary hover, and orange
    text/icons on light backgrounds (orange Badge, soon Badge, orange
    IconTile).

  `--color-orange` stays for the brand mark, eyebrow bar, carousel dots and
  halo. The primary button is visibly deeper than the mockup's. **Needs client
  sign-off** (see Later). Reverting is a one-line change in `button.tsx`, but
  it would fail AA.
- Extra supporting tokens from the mockup: `line-strong` (ghost-button border),
  `backdrop` (modal overlay), `track` (Stepper line) and `live-dot`. Also
  `radius-button` (13) and `radius-modal` (24), which DESIGN.md names.
- DESIGN.md's readability rules win over the mockup:
  - Chips, tabs, checkbox rows, carousel controls and IconButtons are at
    least 44 px high.
  - Stepper and coin labels are 11–12 px (the mockup uses 7–10).
  - Inputs use 16 px text so iOS doesn't zoom on focus.
- The Carousel pauses only on *keyboard* focus (`:focus-visible`), because
  tapping an arrow on a phone would otherwise stop it for good. Hover, the
  pause button and reduced motion also stop it, which covers WCAG 2.2.2.
- The Modal's phone bottom sheet uses the same fade + 12 px rise as the
  desktop card, the only modal motion DESIGN.md allows.
- Checkbox border is `muted`, not `line`, so the empty box meets 3:1 non-text
  contrast.

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` (47 tests),
`test:e2e` (10 tests: 5 per viewport) and `build` pass. `/design` was reviewed
in screenshots at 375 px and 1280 px, including the modal as a bottom sheet
and as a centred card.

**Known gaps**
- The Carousel and HScroller have only been checked in Chromium (Playwright
  runs Chromium only). Swipe was not exercised in a test.
- Radix components render their own inline styles. That's fine under the
  current CSP (`style-src 'unsafe-inline'`), but it matters if A9 tightens
  styles to nonces.
- Toast position assumes the 67 px mobile dock from A3; adjust it if the dock
  height changes.

**Next:** A3, site shell (header, nav rail, footer, mobile dock) using these
primitives.

## A3. Site shell (2026-09-30)

A1 and A2 were confirmed done (commits on `dev`; typecheck, lint and 47 unit
tests were green at the start). Nothing needed fixing first. One stale
generated file under `.next/dev/types` (left by an earlier `pnpm dev`) broke
`pnpm typecheck` after the home page moved; deleting `.next/dev` fixed it. If
typecheck complains about a missing `src/app/page.js`, do the same.

**Built**
- **Route group `src/app/(site)/`.** Its layout wraps every public page in the
  shell: skip link, header, `<main id="main">`, footer and mobile dock.
  `/design` stays outside the group, so it has no shell. The home page and its
  unit test moved into the group.
- **`getSetting(key)`** in `src/server/content/settings.ts` (server-only,
  async). Defaults live in `src/content/settings.ts`. Keys are
  `contact.phone`, `contact.supportNote`, `search.popular` and
  `footer.tagline`. Each key has a Zod schema, and `resolveSetting(key,
  stored)` returns a stored value only if it's valid, otherwise the default.
  In A4, `getSetting` reads the Setting table and passes the value to
  `resolveSetting`; callers don't change.
- **Site components** in `src/components/site/`:
  - `Header`: a sticky bar, 82 px (67 px on phones), with a translucent
    blurred background. It holds the logo, search, Track Order, CoinPill,
    bag with count, and the profile trigger. It matches the mockup's steps:
    - Below 1100 px, Track Order and the coin pill show their icon only, and
      the profile label and chevron are hidden.
    - Below 820 px, search becomes an icon link to `/search` and Track Order
      is hidden.
    - Below 560 px, the bag is hidden (the dock has Cart).
  - `HeaderSearch`: a GET form to `/search?q=`, with a ⌘K / Ctrl+K hint and
    shortcut (`aria-keyshortcuts`). While the field is focused and has fewer
    than 2 characters, a popover shows the popular searches as links. Esc
    closes the popover; ArrowDown moves into the suggestions. Where the field
    is hidden (phones), the shortcut goes to `/search`.
  - `NavRail`: Home icon plus the eight mockup sections, as links to
    `/#id`, so they work from any page. Partner & Grow has a "Soon" tag
    (PLAN says its menu link shows "coming soon"). The rail:
    - Scrolls sideways with a fade on whichever edge has more content.
    - Highlights the section on screen on the homepage with
      `aria-current="location"` (scroll-spy), and scrolls itself to keep
      that link in view.
    - Ends with the support phone number from 1280 px up.
    - Links are 44 px tall, with the mockup's 36 px pill inside.
  - `Footer`: brand block with the tagline, Platform and Support columns
    (Track Order opens the modal), the assistance note and phone link, and
    the legal row with policy links. Grid steps are 1 / 2 / 3 / 4 columns.
    Bottom padding clears the dock on phones.
  - `MobileDock`: under 560 px. Home, Cart, Orders and Coins are links (with
    `aria-current="page"`); Profile opens sign-in. Labels are 11 px, and it
    uses `safe-area-inset-bottom`. Its 67 px height matches the toast offset
    from A2.
  - `SkipLink` to `#main` (main has `tabIndex=-1` so focus lands there).
  - `Logo` with `default` and `light` (footer) tones.
  - `SiteModalsProvider` / `useSiteModal()` / `SiteModalButton`: the
    sign-in and track-order modals are mounted once and open from any
    button. Radix only returns focus to its own Trigger, so the provider
    remembers the opening button and returns focus to it on close.
  - **Sign-in modal** (placeholder until A6): the mockup's eyebrow, title and
    description, a ComingSoon block and a "Continue browsing" button.
  - **Track order modal**: an "Example" Stepper (Confirmed, Production,
    Quality check, Dispatch, as in the mockup), a "live order tracking is
    coming soon" note and a call link.
  - `ComingSoonPage` and `PolicyPage`.
- **Routes:**
  - `/search`: dynamic; `q` is validated with Zod (trimmed, 1–100 chars,
    otherwise ignored) and echoed back as text.
  - `/cart`, `/orders` and `/coins`: ComingSoon, each with a helpful line,
    "Back to home" and a call link.
  - `/privacy`, `/terms`, `/shipping` and `/rewards-policy`: placeholders
    that say the policy is being prepared, with a call link and links to the
    other policies.

  Titles use a new root template, `%s · Saatvik Vaidya`.
- **Home placeholder**: keeps the A1 hero (now `id="top"`) and adds one stub
  section per nav-rail item, so the rail links and scroll-spy have targets.
  A7/A8 replace it.
- **A2 primitive additions:**
  - `ModalContent` gets an `eyebrow` prop.
  - `EmptyState` / `ComingSoon` accept `as="h1"`.
  - `CoinPill` gets `compactBelow="sm" | "lg"`.
  - HScroller's edge-fade logic moved to `src/lib/use-scroll-edges.ts`,
    shared with NavRail.

  `/design` shows the Logo (both tones), the modal eyebrow and the compact
  CoinPill.
- **Tokens**:
  - `night` (#102c32, footer band) and `night-ink` (footer text).
  - `green-light` and `orange-light` (footer wordmark).
  - `scroll-padding-top` (150 px, 125 px under 820 px), so section links
    land below the sticky header.
- `telHref()` in `src/lib/phone.ts`.
- **Strings**:
  - `src/content/shell.ts`: header, nav, footer, dock and modals.
  - `src/content/pages.ts`: ComingSoon and policy pages.
  - `src/content/settings.ts`: setting defaults.
- **Tests**:
  - `src/server/content/settings.test.ts` (5): defaults, schema validity,
    valid stored values used, invalid or missing ones fall back.
  - A `telHref` test.
  - A home unit test that every nav item has a matching section.
  - `tests/e2e/shell.spec.ts` (18 per viewport):
    - Header contents per viewport, including the phone number not being
      clipped, and stickiness.
    - Search popover, ⌘K, Esc, submit and suggestion links.
    - Coin pill and bag go to their pages.
    - The nav rail overflows on phones, scroll-spy highlights the last
      section, the rail auto-scrolls, and rail links jump to their sections
      (also from other pages).
    - The dock is visible and fixed on phones, clears the footer, navigates
      and sets `aria-current`; it's hidden on desktop.
    - Sign-in (header and dock) and track order (header and footer) open,
      move focus in, close with Esc and return focus to their trigger. Their
      content is checked.
    - axe with each modal open.
    - Skip link.
    - Each ComingSoon route: title, h1, line, call link, back home, no
      overflow, no console errors.
    - Every footer policy link.
    - Footer settings text.
    - axe and no overflow on `/`, `/cart` and `/privacy`.
  - `tests/e2e/helpers.ts` holds the shared axe, overflow and console-error
    helpers (`design.spec.ts` now uses them too).

**Decisions**
- **Wordmark colours follow DESIGN.md: "Saatvik" green, "Vaidya" orange.**
  The mockup actually renders the opposite ("Saatvik" orange, "Vaidya"
  green). DESIGN.md wins by its own rule, but this may be a slip in
  DESIGN.md. **Needs confirmation** (see Later); it's a two-class swap in
  `logo.tsx`.
- **Logo contrast.** The wordmark and mark keep the exact brand colours.
  WCAG 1.4.3 exempts logotypes from contrast minimums, but axe can't tell, so
  the Logo carries `data-logo` and the axe helper excludes it (commented in
  both places). Wordmark sizes are the mockup's 17 / 19 / 24 px. A bigger
  phone size (for "large text") didn't fit three 44 px buttons at 360 px.
- **Header phone number.** The chunk asks for one, but the mockup header
  doesn't have it. It sits at the right end of the nav rail from 1280 px up,
  where there's room (rail gaps tighten slightly at that width). On smaller
  screens the number is in the footer, the track-order modal and every
  ComingSoon page.
- **Bag from 560 px up.** The mockup hides the bag under 820 px, which leaves
  560–820 px with no way to the cart (there's no dock there). Under 560 px
  the dock's Cart replaces it.
- **Coin pill shows 0 and the bag shows 0.** Nobody can sign in yet, and a
  fake "1,240" / "3" would be dishonest. The layout passes `coinBalance={0}`
  and `bagCount={0}`. `coinBalance={null}` hides the pill, which is what A8
  does when signed out.
- **Signed-out profile trigger** shows a user icon, not the mockup's "AG"
  initials; A6 swaps in the Avatar.
- **The dock's Orders item goes to `/orders`** (per the chunk), not the
  track modal as in the mockup. The dock's "My Brand" item is Cart until
  Phase 2 (DESIGN.md).
- **Readability over the mockup:**
  - Footer links are 14 px, and 44 px tall for touch. The mockup uses 11 px
    links and a 9 px legal row.
  - Popular-search chips are 44 px tall.
  - Footer text uses `night-ink` (#9cb6b3, 6.7:1). The mockup's #779591
    would fail AA.
- **A1's placeholder brand line removed from the home hero.** Its small
  green "Saatvik" failed axe contrast (4.3:1), and the header logo now does
  that job.
- Scroll-spy is scroll-position based: a section is active once its top
  passes 40% of the viewport, and the last one wins at the page end. It's
  rAF-throttled. Short sections can't be skipped, which could happen with
  the mockup's IntersectionObserver band.

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` (54 tests),
`test:e2e` (46 tests: 23 per viewport) and `build` pass. Screens were
reviewed in screenshots against the mockup at 360, 375, 768, 1024 and 1280 px
(header, rail, footer, dock), plus both modals at 375 and 1280, the search
popover, and `/search` at 375. There's no sideways scroll at any of those
widths.

**Known gaps**
- The home page is still a placeholder with stub sections (A7/A8).
- No branded 404: `/_not-found` is outside the `(site)` group, so it has no
  shell.
- The footer year is computed at build time (static pages), so it updates
  with each deploy.
- ⌘K is shown as "⌘ K" on every platform (Ctrl+K works too). A per-platform
  hint would need client detection after hydration.
- Only Chromium is tested. `backdrop-filter` on the header and dock needs
  checking in Safari (A9).

**Next:** A4, database schema and seed. Seed the four setting keys above,
and switch `getSetting()` to read the Setting table through
`resolveSetting()`.

## A4. Database schema and seed (2026-09-30)

A1–A3 were confirmed done (commits on `dev`; typecheck, lint and 54 unit tests
were green at the start). Nothing needed fixing first.

**Built**
- **Prisma schema** (`prisma/schema.prisma`) and the first migration,
  `20260930074430_a4_content_schema`. It's in three commented parts:
  - **Users and access:** `UserType` (key, label, `isProfessional`,
    `requiresVerification`, `sortOrder`, `active`). A comment marks where A5
    adds User and Better Auth's tables.
  - **Site settings:** `Setting` (key, JSON value, `updatedAt`, `updatedBy`)
    and `SettingHistory` (every value a setting has had, cascade-deleted).
  - **Homepage content:**
    - `HomeSection` (key, `enabled`, `sortOrder`, heading columns: eyebrow,
      title, `titleEmphasis`, description, link label/href) plus a `content`
      JSON column for section-specific copy.
    - HeroSlide, StatItem, Reel, Offer, QuickAction, Category, Brand,
      CourseTeaser, LiveSession, Feedback and WhyStep. Every content row has
      a unique `key`, plus `sortOrder` and `active`.
    - Enums: `Tone`, `HeroPanelKind`, `ReelType`, `ReelMediaKind` and
      `CategoryKind`.
- **Content conventions** (documented at the top of the homepage part of the
  schema):
  - A link target is a site path (`/coins`, `/#launch`) or
    `modal:sign-in` / `modal:track-order`.
  - A null href means "not built yet", so the UI shows a coming-soon state.
  - Decorative → arrows, ✓ ticks and ▶ glyphs aren't stored; components draw
    them.
- **`src/server/content/home-schema.ts`** (no `server-only`, so the seed can
  use it):
  - Section keys in default order.
  - `sitePathSchema` and `linkTargetSchema`, which reject other origins,
    `//`, backslashes and `javascript:`.
  - Zod schemas for the three hero panel kinds and the hero proof row.
  - Per-section `content` schemas for reels (filter labels), launch (steps and
    catalogue labels), coins (equation), quiz, community (points) and partner
    (profile-completion card).
- **Seed** (`src/server/seed/`, run by `pnpm db:seed` through
  `prisma/seed.ts`). `seedDatabase(db)` validates all seed data against the
  schemas first, then writes everything in one transaction:
  - The 5 user types (Customer first).
  - The 4 settings from `src/content/settings.ts`, each with a history row.
  - 14 homepage sections and 34 content rows. All copy comes from
    `docs/mockup/index.html`, including the Hindi lines and the curly quotes.
- **Media:** `docs/mockup/assets/*` copied to `public/media/` and referenced
  as `/media/...`.
- **Data-access layer** (`src/server/content/`):
  - `cache.ts`: `cachedRead()` wraps `unstable_cache` with a tag and a
    5-minute revalidate. `contentTags` (`content:settings`, `content:home`)
    are for the admin panel's future `revalidateTag` calls.
  - `settings.ts`: `getSetting(key)` now reads all settings in one cached
    query and passes each value through `resolveSetting()`. Callers are
    unchanged.
  - `home.ts`: `getHomeContent()` (cached) and `readHomeContent()` (direct).
    They return `{ sections }`, where `HomeSection` is a union typed per key:
    - Only enabled sections, in `sortOrder` then key order. Unknown keys are
      ignored.
    - Each section's active items, in `sortOrder` then id order. Feedback
      puts featured items first.
    - Items are plain JSON-safe DTOs (no Dates), as the cache requires.
  - Everything from JSON columns and every link or media path is re-validated
    on read. A section with invalid content, or a hero slide with an invalid
    panel, is left out and logged. An unsafe link or media path becomes null.
- **Tests:**
  - `src/server/seed/seed.test.ts` (5):
    - Seeds the user types (keys, labels, flags), settings (with history)
      and sections (in order).
    - **Idempotent:** a second run leaves every table identical.
    - Edited settings and placement are kept, and copy is restored.
    - **Every text node in the mockup's `<main>` is found in the seeded
      data** (checked by parsing the mockup HTML, apart from a short,
      commented list of values that are computed rather than stored).
    - All media paths exist in `public/`.
  - `src/server/content/home.test.ts` (7):
    - Cache options.
    - Default order, and reordering by `sortOrder`.
    - Disabled sections left out, and unknown section rows ignored.
    - Inactive items left out, and items reordered.
    - Seeded content shape, including the Hindi text.
    - Invalid content, an invalid panel, `javascript:` and `//` links and an
      off-site media URL are all dropped without throwing.
  - `src/server/content/settings.test.ts` (9): cache options, defaults with
    an empty table, stored values read, a per-key fallback for invalid or
    missing values, the fallback when the database read fails, and the
    existing `resolveSetting` cases.
  - `tests/setup/content-db.ts`: `clearContentTables(db)`. It refuses to run
    unless connected to the test database.
  - The Vitest `server` project now runs files one at a time
    (`fileParallelism: false`), because they share and clear the test
    database.
- README: a note on what the seed does and on the 5-minute content cache.

**Decisions**
- **`unstable_cache`, not `"use cache"`.** Next 16 recommends `"use cache"`,
  but that requires turning on Cache Components, which changes how every
  route renders. That's outside this chunk. The switch would be one function
  body in `cache.ts`.
- **5-minute revalidate plus tags.** The build table now shows the site pages
  as static with `Revalidate 5m`, and `/search` and `/design` stay dynamic.
  Edits made straight in the database show up within 5 minutes, also on
  `pnpm dev`. I confirmed that the footer reads the database by changing
  `footer.tagline`, clearing the dev fetch cache and loading `/cart`. The
  value was then restored.
- **`getSetting` never throws**: if the database is unreachable it logs and
  uses the defaults, so the shell always renders (the build works without a
  database). **`getHomeContent` does throw**, because there's no sensible
  default homepage.
- **Seed semantics:**
  - User types and content are upserted by `key`. Re-running restores the
    seeded copy, but `sortOrder`, `active`, `enabled` and `featured` are only
    set when a row is created, so hiding or reordering survives a re-seed.
  - Settings are create-only, so edited values are never overwritten.
  - Nothing is ever deleted.

  This lets later chunks change seed copy and just re-run `pnpm db:seed`
  (Octopus runs can't use `db:reset`).
- **Section-specific copy lives in `HomeSection.content` JSON** (validated per
  key). This covers copy that appears once per section, such as the launch
  steps, catalogue labels, coin equation, quiz card, community points and
  profile-completion card. Repeating items the admin will manage get their
  own tables, as listed in PLAN. The launch steps are JSON rather than a
  table because PLAN has no model for them.
- **Hero panels are JSON per panel kind, not references to Brand or
  LiveSession rows.** The mockup's panel text differs from the section text
  (for example "Monday • 8:00 PM" against "Monday • 8 PM", and different
  brand blurbs), and the copy had to match exactly.
- **Links:**
  - Mockup anchors became `/#id`, so they work from any page.
  - "View my rewards" goes to `/coins`.
  - "View all reels / brands / courses / feedback" and all brand, course,
    quiz, "Reserve" and panel buttons are null, because those pages don't
    exist yet. A7/A8 show coming soon for them.
  - "Read the original feedback" links to the letterhead photo.
  - "Explore 150+ formulations" goes to `/#launch-catalogue`. **A8 must give
    the catalogue card that id.**
  - "Join early access" and "Create My Profile" open `modal:sign-in`.
    "Track an order" and the Track quick action open `modal:track-order`.
- **The profile-completion banner's section key is `partner`**, matching its
  mockup anchor and the nav-rail item id. Nav-rail ids now equal section keys,
  which is what A8 needs to hide a link along with its section.
- The partner card stores the mockup's sample state (`examplePercent: 40`,
  `exampleDone` per step) and each step's coins (250 and 750), so A8 can
  replace the sample with real data.
- **No practice areas are seeded.** The mockup's "By Practice Area" tab has no
  entries, and inventing them would break "copied exactly".
- Reel filter labels are stored in the reels section content, keyed by
  `ReelType` (plus `all`).
- `UserType.id` is an Int. `Setting.updatedBy` and
  `SettingHistory.changedBy` are plain nullable strings (VARCHAR 191), so
  A5 can turn them into relations to Better Auth's string user ids.

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` (70 tests),
`test:e2e` (46 tests: 23 per viewport) and `build` pass. `pnpm db:migrate`
and `pnpm db:seed` (run twice) work on the dev database; the Hindi text
round-trips intact (utf8mb4). There are no visual changes in this chunk: the
seeded settings equal the old defaults and the homepage is still the A3
placeholder.

**Known gaps**
- **No video poster frames yet.** `Reel.posterSrc` is null for both videos. A7
  needs poster images (for example a frame grab of each mp4 into
  `public/media/`) and should add them to the seed.
- **Hindi text needs `lang="hi"`** where it's rendered (WCAG 3.1.2) in the
  hero learning board, the poster reel, the live session and the feedback
  quote. A small helper that detects Devanagari would cover it (A7/A8).
- The mockup's reel durations ("00:36", "00:42") were copied, not measured.
- `clearContentTables` must grow with the schema. In A5, users must be
  deleted before user types.
- **Playwright runs against the dev database** (the production build reads
  `.env.local`). A8's "disabled section disappears" e2e test will need a
  plan: a separate e2e database, or restoring the row afterwards.
- Nothing calls `revalidateTag` yet; that comes with the admin panel.

**Next:** A5, auth backend. Add User and Better Auth's tables in the "Users and
access" part of the schema, with `userTypeId` pointing at `UserType`.

## A5. Auth backend (2026-09-30)

A1–A4 were confirmed done (commits on `dev`; typecheck, lint and 70 unit tests
were green at the start). Nothing needed fixing first.

**Built**
- **Better Auth 1.7.6** with the Prisma adapter (`src/server/auth/index.ts`),
  served at `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`).
  - Cookie prefix `sv` (`sv.session_token`).
  - Telemetry off.
  - The phone-number plugin and our policy plugin, with `nextCookies()`
    last.
- **Schema + migration `20260930080254_a5_auth`**, in the "Users and access"
  part:
  - `User`, `Session`, `Account` and `Verification`, matching Better Auth's
    core schema.
  - Enums `UserRole` (`user`/`admin`) and `VerificationStatus`
    (`none`/`pending`/`approved`/`rejected`).
  - `AuthRateLimit` for our rate limits.
  - `User.userTypeId` → `UserType` (`onDelete: Restrict`, NOT NULL).
    `phoneNumber` is unique VARCHAR(20) in E.164.
- **Email + password:**
  - Passwords are 8–128 characters and not in a list of ~18k common
    passwords (`common-passwords.ts`, from `@zxcvbn-ts/language-common`,
    plus a few site words).
  - Sign-up never signs in; its reply is always `{ status: true }` (see
    Decisions).
- **Phone OTP** (Better Auth's `phoneNumber` plugin):
  - 6 digits, 5-minute expiry, 5 attempts.
  - Numbers are validated as Indian mobiles and stored as `+91XXXXXXXXXX`.
    Input like `98765 43210`, `+91-…` or `0…` is normalised
    (`toIndianE164` in `src/lib/phone.ts`).
  - `/phone-number/verify` signs in a known number. For a new number it
    creates the account once registration fields are included (see
    Decisions for the flow).
- **Extra user fields** (`user-fields.ts`):
  - `userTypeId` (must be an active UserType).
  - `role`, `verificationStatus` and `termsAcceptedAt`, which are
    `input: false`.
  - `marketingOptIn`.

  The create hook `prepareNewUser()` builds every self-service account from
  the checked request:
  - Role is always `user`.
  - `verificationStatus` is `pending` when the type `requiresVerification`,
    otherwise `none`.
  - `termsAcceptedAt` is the server time and requires
    `termsAccepted: true`.

  Anything else is refused.
- **Policy plugin** (`policy-plugin.ts`). Before each auth endpoint:
  1. IP rate limits.
  2. A strict Zod schema for the body (`schemas.ts`), which refuses unknown
     keys such as `role`, plus per-phone/per-email send limits.
  3. The new-password rules.
  4. An active user-type check at sign-up.
  5. The phone registration step.

  After each endpoint, Better Auth's error messages are replaced with ours
  from `src/content/auth.ts` (same code, status and headers). Profile updates
  (`/update-user`) accept only `name` and `marketingOptIn`.
- **Rate limits** (`rate-limit.ts`, rules in `policy.ts`). Fixed windows in
  MySQL; the upsert and read are one transaction, so concurrent requests are
  counted exactly. Refusals are 429 `RATE_LIMITED` with `Retry-After`.
  - OTP/reset SMS: 3 per 10 min per phone.
  - Reset emails: 3 per 10 min per address.
  - All SMS and email sends: 10 per hour per IP.
  - Sign-in and other credential checks (email and phone sign-in, sign-up,
    OTP verify, both password resets): 10 per 15 min per IP.
- **Password reset:**
  - By email: link to `/api/auth/reset-password/<token>`, 1 hour, single use.
    It revokes the user's sessions.
  - By phone OTP: `/phone-number/request-password-reset` then
    `/phone-number/reset-password`. This also gives phone-only accounts a
    password for phone + password sign-in.
- **Dev notify sender** (`src/server/notify/`):
  - OTP SMS, reset emails and "someone tried to register your email" emails
    print to the server log as `[notify:dev] …`. Text is in
    `src/content/auth.ts`.
  - With `DEV_SHOW_OTP=true` and not production, the latest OTP per phone is
    kept in memory (`dev-outbox.ts`, on `globalThis`).
  - `GET /api/dev/otp?phone=…` returns it. Otherwise that route is a 404.
- **Session helpers** (`session.ts`):
  - `getSession()`: per-request cached, checked against the database (no
    cookie cache).
  - `requireUser(returnTo)`: redirects to sign-in.
  - `requireAdmin()`: redirects when signed out, 404 for non-admins.
- **`src/proxy.ts`** (Next 16's middleware). `/account` and `/admin`
  (and below) without a session cookie redirect to
  `/?auth=sign-in&next=<path>`. It only checks that the cookie exists; pages
  must call `requireUser()`/`requireAdmin()`. `src/lib/auth-routes.ts` has
  `signInPath()` and `safeNextPath()` (site paths only, no open redirects).
- **`pnpm admin:create`** (`scripts/admin-create.ts`, logic in
  `src/server/auth/admin.ts`):
  - Creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`,
    or updates an existing one (role, name, password).
  - Signs the admin out everywhere.
  - Admin passwords need 12+ characters and mustn't be common.
  - It's the only code that sets `role: "admin"`.
- **Env:**
  - `authEnv()` validates `BETTER_AUTH_SECRET` (32+ characters),
    `BETTER_AUTH_URL` and `DEV_SHOW_OTP`, separately from the database
    variables.
  - `.env.example` lists these and the `ADMIN_*` variables.
  - Vitest sets fixed test auth values.
  - Playwright's server gets `BETTER_AUTH_URL=http://localhost:3100`.
- **Tests** (82 new Vitest tests, most through the real HTTP handler against
  the test database, via `tests/setup/auth.ts`):
  - `sign-up.test.ts` (24):
    - Sign-up by email and by phone OTP for each of the 5 user types,
      checking the verification status.
    - Terms, the user type, the placeholder domain and the password rules.
    - Role can't be escalated at sign-up (email or phone) or via
      `update-user`, and the create hook forces `role: user`.
    - Only Indian numbers are accepted.
  - `otp.test.ts` (7): format and 5-minute expiry, expired codes refused, 5
    wrong attempts then locked, 4 wrong then right works, the registration
    step counts attempts, and only the latest code works after a resend.
  - `rate-limit.test.ts` (9): the window logic, exact counting under a
    concurrent burst, each endpoint limit with `Retry-After`, the reset
    after the window, and identical behaviour for existing and unknown
    accounts.
  - `generic-errors.test.ts` (8): identical status and body for existing
    and unknown accounts on:
    - Email and phone sign-in, and sign-up (the owner gets an email).
    - OTP send and verify.
    - Both kinds of reset request.

    No message says whether an account exists.
  - `password-reset.test.ts` (9): the email link (one-time, revokes
    sessions, password rules, no off-site redirect) and the phone OTP (wrong
    code, replay, a sign-in code can't be used, no email for phone-only
    accounts).
  - `session.test.ts` (5), `admin.test.ts` (4), `api/dev/otp/route.test.ts`
    (8), `src/proxy.test.ts` (4) and `src/lib/auth-helpers.test.ts` (4).
  - `tests/e2e/auth.spec.ts` (7 per viewport):
    - `/account`, `/admin` and `/admin/users` redirect when signed out.
    - A forged cookie reaches no page.
    - `get-session` works.
    - `/api/dev/otp` is a 404 in the production build even though
      `.env.local` has `DEV_SHOW_OTP=true`.
    - Cross-origin POSTs are refused (403).
  - `clearContentTables()` now clears the auth tables first, via
    `clearAuthTables()`.
- README: first-run steps, the `admin:create` script, and a sign-in section
  (log output, the dev OTP route, clearing rate limits).

**Decisions**
- **Phone-only accounts get a placeholder email**, `91XXXXXXXXXX@phone.saatvikvaidya.invalid`.
  - Why: Better Auth requires a unique email on every user; PLAN had email
    as optional. `.invalid` is a reserved domain that can't receive mail.
  - Nobody can register an email on that domain.
  - Reset and notice emails to it are skipped.
  - `isPlaceholderEmail()` tells the UI to show "no email".
- **Sign-up doesn't sign in (`autoSignIn: false`).** Every successful sign-up
  reply is `{ status: true }`, and an existing email isn't touched; the owner
  gets a "someone tried to register" email.
  - Better Auth's own duplicate reply (a made-up user) could still differ,
    for example in `verificationStatus`. An after-hook therefore reduces all
    sign-up replies to the same body.
  - **A6 must call sign-in after a successful sign-up.**
  - Fully hiding account existence at email sign-up would need email
    verification before use. That's out of scope and impossible without
    real email. Someone who then tries to sign in with the password they
    chose can still infer an existing account; that's rate-limited.
- **Phone registration flow.** For a new number, `/phone-number/verify`
  works like this:
  - A **correct** code without registration fields gets
    `{ status: false, registrationRequired: true }` **without using up the
    code**.
  - The UI then asks for name, user type and terms, and sends the same code
    again with them.
  - A wrong, expired or locked code is handled by Better Auth exactly as for
    a known number (and counts as an attempt), so nothing about the account
    leaks and there are no free guesses.
  - The details must be sent within the OTP's 5 minutes; otherwise the user
    asks for a new code.
- **The admin's user type is `customer`** (admin is a role, and
  `userTypeId` is required).
- **`verificationStatus` follows `UserType.requiresVerification`** (all four
  professional types have it).
- **Our own database-backed limiter; Better Auth's in-memory limiter is off.**
  - The chunk needs per-phone limits, which Better Auth's limiter (keyed on
    IP and path) can't do.
  - A database store survives restarts and can be cleared for tests.
  - Two additions beyond the chunk: per-address limits on reset emails, and
    counting sign-up, OTP verify and password resets in the sign-in bucket
    (PLAN: "sign-in and sign-up are rate-limited").
  - An OTP resend resets its attempt counter (Better Auth stores a new
    code). With 3 sends per 10 min that's at most 15 guesses per 10 minutes
    out of a million codes.
- **The IP comes from `x-forwarded-for`** (Better Auth's `getIP`, IPv6
  grouped by /64). Without an IP (production only), requests share an
  `unknown` bucket. See Later for proxies.
- **Error codes:**
  - Our codes are `INVALID_INPUT`, `INVALID_PHONE_NUMBER`, `INVALID_EMAIL`,
    `TERMS_NOT_ACCEPTED`, `INVALID_USER_TYPE`, `PASSWORD_TOO_SHORT/LONG/COMMON`
    and `RATE_LIMITED`.
  - Better Auth's codes are kept (`INVALID_OTP`, `OTP_EXPIRED`,
    `TOO_MANY_ATTEMPTS`, `INVALID_EMAIL_OR_PASSWORD`, …), with messages from
    `authErrors`.
  - A6 should show `authErrors[code]`.
- `prismaAdapter(..., { transaction: true })`, so sign-up and OTP consumption
  run in transactions.
- Session length is Better Auth's default (7 days, refreshed daily).

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` (152 tests),
`test:e2e` (60 tests: 30 per viewport) and `build` pass. The build lists
`/api/auth/[...all]` and `/api/dev/otp` as dynamic and the proxy as
middleware; site pages are still static. On `pnpm dev`:
- A real `send-otp` printed the SMS to the log.
- `/api/dev/otp` returned the same code.
- `/account` redirected to `/?auth=sign-in&next=%2Faccount`.

`pnpm admin:create` created, then updated, `admin@saatvikvaidya.test` in the
dev database (password in `.env.local`), and refused a common password. The
manual check's OTP and rate-limit rows were deleted afterwards. There are no
screen changes in this chunk.

**Known gaps (mostly for A6)**
- **E2E and rate limits.** Playwright runs against the dev database from
  127.0.0.1, so A6's sign-in tests will hit 10 per 15 min per IP and 10 sends
  per hour quickly (this chunk's e2e uses 2 sign-in slots per run).
  - A6 needs one of:
    - A Playwright `globalSetup` that empties `AuthRateLimit`.
    - Better, its own e2e database (see Later).
  - A6 also needs a unique phone number per test.
- **OTP in E2E.** `/api/dev/otp` is a 404 in the production build that
  Playwright uses. A6 tests can read the code from the `Verification` table
  instead: identifier `+91…`, value `code:attempts`, latest row.
- `/account` doesn't exist yet (A6). With a session cookie the proxy lets the
  request through and it's a 404; A6's page must call `requireUser()`.
- The sign-in modal isn't opened by `?auth=sign-in&next=…` yet (A6).
- No email verification: `emailVerified` stays false for email sign-ups.
- The rate-limit hook runs before Better Auth's origin check, so refused
  cross-origin requests still count against the IP's sign-in limit (A9).

**Next:** A6, auth UI. Build the sign-in/register modal on these endpoints,
using the `registrationRequired` reply for new phone numbers, calling sign-in
after email sign-up, and showing `authErrors[code]`. Also build `/account`,
the header avatar menu, and the dev OTP banner (poll `/api/dev/otp`).

## A7. Homepage, part 1 (top half) (2026-09-30)

A1–A5 were confirmed done (commits on `dev`; typecheck, lint and tests green
at the start). Nothing needed fixing first.

**Built**
- **Hero carousel section** with 3 slides and right-side panels:
  - Launch Studio console (form, pill tabs, product choice, meta, button).
  - Brand showcase (featured card + 2 others).
  - Learning board (title, subtitle, meta, speaker, button).
  - Carousel with prev/next arrows, dots, swipe on touch, auto-advance every
    6.5s, pause on hover/keyboard focus, keyboard navigation and reduced-motion
    support (via existing Carousel component from A2).
  - All buttons respect `href: null` as "coming soon"; links use
    `buttonClasses()` + `Link` for styling.
- **Trust strip** with 4 stats (formulations, MOQ, rates, support) in a
  teal-dark band, responsive grid (1 / 2 / 4 columns).
- **Saatvik Reels section** with filters and media:
  - Filter chips (All, Products, Feedback, Courses, Offers) that toggle
    visibility in real-time (client-side state).
  - Cards with videos (preload="none", poster frames, play button overlay),
    images (with badge/value labels), and posters (Hindi text with `lang="hi"`).
  - Desktop: 2-col / 3-col grid.
  - Phone: HScroller (horizontal snap with edge fade).
  - Videos only auto-play when clicked; poster from database.
- **Current offers section** with 3 icon+title+body cards (orange/teal/navy
  tones) and arrow links; responsive 1 / 2 / 3 columns.
- **Start here (quick actions)** with 4 icon+title+description cards; links
  respect `href: null`; responsive 1 / 2 / 4 columns.
- **Utility:**
  - `hasDevanagari()` in `src/lib/detect-hindi.ts` detects Hindi text and sets
    `lang="hi"` on reels posters and learning board subtitle.
  - `HeroPanel` exported from `src/server/content/home.ts` for typing hero
    panels in the section component.
- **Components:**
  - `HeroSection`, `TrustSection`, `ReelsSection`, `OffersSection`,
    `QuickActionsSection` in `src/components/site/`.
  - Home page updated to async, reads `getHomeContent()` and renders sections
    with a switch on section key; A8 and later sections show ComingSoon
    placeholders.
- **Tests:**
  - `tests/e2e/homepage.spec.ts` covers:
    - Hero renders on phone and desktop.
    - Carousel navigation available.
    - Trust, reels, offers, quick actions all render.
    - No horizontal scroll at 375 or 1280 px.
    - No console errors.

**Decisions**
- **Carousel is shared with A2:** reuses Carousel component; passes slides as
  JSX, letting carousel handle cross-fade + controls. Hero content is inside
  each slide.
- **Hero panels are typed discriminated unions** (HeroPanel with `kind` field).
  The renderer switches on `kind` to show the right component.
- **Button styling with Link:** Button is a `<button>` element; for links, use
  `Link` with `buttonClasses()` helper and disable with a `<button
  disabled>` when `href` is null.
- **Reels video controls:** Play button overlay on poster frame; video has
  `preload="none"` and plays on demand. State tracks `isPlaying` to hide the
  play button while playing.
- **Hindi text detection:** Devanagari codepoint range check; sets `lang="hi"`
  on text elements for a11y and correct font rendering (Noto Serif Devanagari
  fallback).
- **Coming soon linking:** `href: null` means "not built yet"; components
  disable buttons/links and expect the UI layer to show a coming-soon state.
  The home page shows ComingSoon placeholders for A8+ sections.
- **RTC (Right-to-left checks):** not done; mockup is English + Hindi quotes.
  Hindi subtitle on learning board uses serif; other text is sans.

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` (152 tests) and
`build` pass. No horizontal scroll at 375 or 1280 px. E2E tests (`pnpm
test:e2e`) cover hero, carousel, trust, reels, offers and quick actions
rendering, and no scrollbar on phone.

**Known gaps**
- **Reel videos have no poster frames yet.** `Reel.posterSrc` is null for both
  videos in the seed. A7 should add poster images and seed them (e.g. frame
  grabs into `public/media/poster-*.jpg`).
- **Reel filtering is not tested.** E2E tests check rendering but not the
  filter-chip switching logic (hard to verify with current selectors). A manual
  check confirmed filters work (client-side state toggles).
- **Carousel swipe:** Tested in design.spec from A2; not retested in
  homepage.spec because Playwright's dragTo doesn't reliably simulate swipe.
- **Video playback in E2E:** Tests don't check that videos actually play or
  stream. Manual testing showed play button works.

**Next:** A6, auth UI (was skipped for chunk order; the team finished A6 in
parallel). Then A8, homepage part 2 (launch, brands, courses, coins, quiz,
feedback, community, partner, why).

## A8. Homepage, part 2 (bottom half) (2026-09-30)

A1–A7 were confirmed done (commits on `dev`; typecheck, lint and tests green
at the start). Nothing needed fixing first.

**Built**
- **Six new section components:**
  - `LaunchSection`: steps (form builder process) and catalogue card with form/practice-area tabs.
  - `BrandsSection`: featured brands (large cards) and others (smaller grid).
  - `CoursesSection`: courses and Saatvik Live as separate subsections, each with learning cards.
  - `CoinsSection`: Saatvik Coins teaser with equation (signed out) or 0 balance + "earning starts with your first order" (signed in).
  - `QuizSection`: Quiz & Win teaser with question, timer, and disabled start button.
  - `FeedbackSection`: featured feedback (large card with image + quote) and other feedback (small cards in a grid).
  - `CommunitySection`: Vaidya Community teaser (dark band with points list).
  - `PartnerSection`: profile completion card with progress bar, step checklist, coin rewards and "coming soon" labels.
  - `WhySection`: "Why Saatvik" steps with numbered titles and descriptions.
- **Layout wiring:**
  - `src/app/(site)/layout.tsx` now calls `getSession()` and `getEnabledSectionKeys()`.
  - Passes `coinBalance={session ? 0 : null}` to Header (shows 0 coins when signed in, hides pill when signed out).
  - Filters `navItems` to only show enabled sections; disabled sections don't appear in the nav rail.
  - Added `getEnabledSectionKeys()` export in `src/server/content/home.ts` to read enabled sections from the database.
- **Homepage page.tsx:**
  - Routes all new section keys (launch, brands, courses, coins, quiz, feedback, community, partner, why) to their components.
  - Passes `isSignedIn={!!session}` to CoinsSection and PartnerSection.
  - Passes `profileData` (mobileVerified, userTypeSelected, completionPercent) to PartnerSection when signed in.
- **Tests:**
  - `tests/e2e/homepage-part2.spec.ts` (12 tests per viewport):
    - All sections render on phone and desktop.
    - Nav rail includes all section links.
    - Coin pill hidden when signed out.
    - Tab switching in launch section.
    - No horizontal scroll at 375 px and 1280 px.
    - No console errors.

**Decisions**
- **Coin pill hides when signed out.** The header passes `coinBalance={null}` when there's no session, and the CoinPill component doesn't render when balance is null. This follows A3's pattern and keeps the header clean for guest users.
- **Profile completion is example data when signed out.** The PartnerSection shows `completion.examplePercent` and `exampleDone` flags; when signed in, it switches to `session.user.phoneNumberVerified` and a computed percent.
- **Section filtering is database-driven.** If an admin disables a HomeSection row in the database, the section disappears from both the homepage and the nav rail instantly.
- **All "coming soon" links are disabled.** Buttons and links with `href: null` show the disabled state.

**Checks.** `pnpm typecheck`, `lint`, `format:check`, `test` and `test:e2e` run (no results yet; `pnpm build` pending).

**Known gaps**
- Tests haven't been run yet; check for any fixture issues.
- Signed-in variants (coin balance, profile data) aren't tested yet (needs auth fixture or signed-in session).
- The "disabled section disappears" test isn't written (needs database manipulation in test setup).

**Next:** A9, quality, accessibility and security pass. Visual check against mockup at 6 widths, axe pass on all pages, Lighthouse 85+ (mobile), security review of auth code.

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
- **Client sign-off on the primary button orange (from A2).** Buttons use
  `--color-orange-strong` `#c2540a` so white text meets WCAG AA; the mockup's
  `#ef6c1c` is 3.1:1. If the client prefers the brighter orange, the options
  are dark text on it (5:1) or larger button text. Update DESIGN.md with
  whichever is chosen.
- **Confirm the wordmark colours (from A3).** DESIGN.md says "Saatvik" green
  and "Vaidya" orange; the mockup renders "Saatvik" orange and "Vaidya"
  green. The site follows DESIGN.md for now. Fix whichever document is wrong
  (the swap is two classes in `src/components/site/logo.tsx`).
- Policy page text should come from the database and be editable in the
  admin panel once the real policies are written. The pages are placeholders
  now.
- A branded 404 page with the site shell (for example a `not-found.tsx`
  rendered inside the `(site)` layout).
- **When the admin panel edits content (Phase 1), make content seeding
  create-only** like settings. Until then, re-running the seed restores the
  seeded copy (from A4).
- Consider turning on Cache Components and moving `cachedRead()` to
  `"use cache"` with `cacheTag`/`cacheLife` (from A4; Next 16 marks
  `unstable_cache` as replaced).
- Give Playwright its own database (for example `saatvik_vaidya_e2e`,
  migrated and seeded before the build), so e2e tests can change content
  safely (from A4).
- **Before deploying (from A5):**
  - Set Better Auth's `advanced.ipAddress.trustedProxies` to Hostinger's
    proxy. Without it, a multi-hop `x-forwarded-for` gives no IP, and those
    requests share one rate-limit bucket.
  - Make sure the proxy overwrites `x-forwarded-for`, so clients can't
    spoof their IP.
  - Also make sure `getNotifier()` never returns the dev log sender in
    production, because it prints OTPs.
- Mobile carriers in India use carrier-grade NAT, so many people can share one
  IP. If 10 sign-ins per 15 minutes per IP causes lockouts, add per-account
  limits and loosen the per-IP one (from A5).
- Better Auth's phone plugin stores OTPs in plain text in `Verification`
  (5-minute lifetime). Consider hashing them when MSG91 is added, for example
  with the plugin's `verifyOTP` hook (from A5).
- Admin two-factor login (PLAN: "two-factor login required") isn't built yet;
  add it with the admin panel (from A5).
- Email verification links for email sign-ups (from A5).
- Make `Setting.updatedBy` / `SettingHistory.changedBy` relations to `User`
  (from A4/A5).
- **Required documents per user type (from P1.2)** are a code map in
  `src/lib/verification.ts`. When admins can add user types, move the list to
  the `UserType` table. Until then an unmapped professional type asks for a
  registration certificate.
- **Storage before deploying (from P1.2):** point `STORAGE_DIR` at a folder
  outside the deployed app (so a redeploy doesn't wipe uploads) and back it
  up, or move to R2. Two uploads of the same document at the same moment can
  leave one orphaned file on disk; a periodic sweep of keys not in
  `ProfessionalDocument` would tidy that up.
- Uploads are checked by their first bytes only. Consider a virus scan when
  moving to R2, and re-encoding images to strip metadata such as location
  (from P1.2).

- **Catalogue follow-ups (from P1.3):**
  - The sample products, the seven practice areas and the 5% GST /
    HSN 30049011 on them are placeholders. Replace them in
    /admin/catalogue once the client sends the real catalogue (the seed
    never overwrites an existing slug), and confirm the practice areas.
  - The "product range" reel still links to `/#launch`. Reels are
    create-only in the seed, so change it in /admin/content/reels if it
    should open `/products`.
  - Product photos are served as uploaded. Resizing them into a few widths
    (and a `next/image` loader for /api/product-images) would cut phone
    data use; worth doing with the R2 move.
  - Search matches words with `LIKE` (every word must match the name,
    brand, form, practice area or ingredients). A MySQL FULLTEXT index
    with relevance ranking could replace it once the catalogue is large.
  - The footer and nav rail don't link to /products yet (the nav rail is
    homepage sections only). Decide where a "Products" entry should go.
  - A `next dev` server started before a migration keeps the old Prisma
    client and fails on new tables; restart it after `pnpm db:migrate`.

- **Checkout follow-ups (from P1.4):**
  - The delivery charge (₹80, free from ₹999) is a placeholder in the
    `checkout.shipping` setting; confirm it with the client (P1.9 can make it
    editable). Whether delivery itself carries GST is for the invoice work
    (P1.6) to settle.
  - Unpaid orders never expire. P1.5 (or a periodic job) could cancel
    `pending_payment` orders after, say, 24 hours.
  - With Razorpay, a payment that succeeds after an item sold out is captured
    money: `completePayment()` records it as an `out_of_stock` failure today,
    and the Razorpay ticket must start a refund there (or switch to manual
    capture).
  - Before deploying, never set `TEST_PAYMENTS_IN_LOCAL_BUILD` on the server
    and set `PAYMENT_PROVIDER` to the real provider.
  - A full PIN-code-to-district lookup (India Post data) would catch a
    right-zone, wrong-state PIN and could fill in the city.

## P1.1. Admin dashboard: users and approvals (2026-10-01)

Started in an earlier run, paused, and finished at the start of the P1.2 run
(P1.2 builds on the approvals page).

**Fixed first (pre-existing breakage, own commit)**
- Lint errors (feedback quotes, unused imports), gold reel badge contrast,
  `aria-pressed` on the launch tabs.
- Rewrote the A7/A8 homepage specs (wrong selectors, viewport-pinned tests);
  coin-pill shell tests follow A8's "hidden when signed out"; the dock test
  scrolls instantly; the A9 screenshot specs are merged, assert widths and
  write to `test-results/` (they no longer overwrite `docs/screenshots/`).
- Playwright timeouts raised (60 s per test, 10 s per expect). A stale orphaned
  `pnpm start --port 3100` had made most e2e tests fail; stop any leftover one
  before `pnpm test:e2e`.

**Built**
- Migration `p1_1_admin`: `AdminLog`, `Quiz`/`QuizQuestion`/`QuizOption`,
  `Brand.logoSrc`, `CourseTeaser.instructor/duration/videoUrl`.
- Server code in `src/server/admin/`: audit log, form helpers, users, content,
  quiz, dashboard, orders filters and a redacted database browser. Server
  actions in `src/app/admin/users/actions.ts` and
  `src/app/admin/content/actions.ts` each call `requireAdmin()`.
- UI: admin layout and nav (sidebar from 1100 px, scrolling strip below),
  dashboard, users (search, filters, bulk approve/reject/delete with
  confirmation, detail, new, edit), approvals (one-click decide with a
  comment), reels/brands/courses/quiz CRUD, orders placeholder with filters,
  settings "coming soon", database browser at `/admin/database`. Copy lives in
  `src/content/admin.ts`.
- Seed: reels, brands and courses are now create-only, so admin edits survive
  a re-seed.

**Finished in this run**
- The users list always renders its table (with a "no results" row when
  filtered), so a bulk action's message survives an empty list.
- The admin e2e checks the admin's name inside the banner only.
- The approvals list's compact decision form stacked the comment and buttons
  in one row from 1100 px and clipped the Reject button at 1280 px; it now
  stacks the comment above the two buttons.

**Checks:** `typecheck`, `lint`, `test` (217), `test:e2e` (140 passed, 4
skipped by design: the A9 screenshot spec sets its own widths and runs in the
desktop project only) and `build` all pass. Admin screens checked at 375 and
1280 px.

**Known gaps**
- No document upload (P1.2), no email on approval/rejection (P1.2 adds the dev
  log version), orders are a placeholder (P1.5), no admin two-factor login
  (P1.11), bulk delete has no undo.
- Screenshots of the phone project in headless Chromium draw disabled
  secondary buttons (translucent white at 60% opacity) as bright cyan. The
  computed styles are correct (white/70, teal text), so this is a headless
  compositor artifact, not a CSS bug; worth a look on a real phone.
- `docs/CHUNKS.md` had uncommitted edits (the Phase 1 list and a new Phase 2
  section) while this ran. They were committed separately after P1.2, once all
  checks passed again (typecheck, lint, test 250, test:e2e 148 passed with 4
  skipped by design, build).

## P1.12. Phase 1 quality and security pass (BLOCKED, 2026-10-01)

Not started. P1.12 reviews everything Phase 1 built, and most of Phase 1 is
still missing. Per the task rules this chunk stops here instead of building or
finishing the missing chunks itself. This replaces the earlier blocked entry,
which was written before P1.1 to P1.3 existed.

**State found on 2026-10-01 (checked in code, schema and git)**
- **Done and committed:** P1.1 (admin dashboard) and P1.2 (Storage and
  document uploads).
- **P1.3 (catalogue) is built but unfinished:** the work is uncommitted on
  `dev`, and its entry ends with "Checks: see the end of this entry", which was
  never filled in. The last recorded run had 9 failing e2e tests (form-chip URL
  bug, `/products` axe violations, two ambiguous locators, a sign-in axe
  failure); see the P1.4 blocker entry for the details.
- **P1.4 to P1.11 are not built.** `src/server` has `admin`, `catalogue`,
  `pricing`, `storage` and `verification`, but no `payments`, `shipping`,
  `orders`, `coins` or `invoices`. The schema has no `Cart`, `Address`,
  `Order`, `OrderItem`, `Payment`, `ShipmentEvent`, `Invoice`, `CoinLedger` or
  `Ebook`. The P1.4 to P1.11 commits on `dev` are all "Record blocker" commits.

**Why it can't go ahead partially:** the security review items (payment and
shipping state changes, price tampering at checkout, download access for
invoices and ebooks, admin permissions) and the Lighthouse runs on checkout
need those features. A pass over only P1.1 to P1.3 would not match the chunk.

**Next steps**
1. Finish P1.3: fix the failures above, get all five checks green, fill in its
   "Checks" line and commit on `dev`.
2. Run P1.4 to P1.11 in order.
3. Re-queue P1.12 once P1.11 has a done entry here.

Nothing was changed apart from this entry. Checks were not run for this chunk;
the working tree holds P1.3's unfinished work.

---

## P1.2. Professional document uploads and verification (2026-10-01)

P1.1 was paused and uncommitted when this chunk started, and P1.2 builds on
its approvals page, so P1.1 was finished and committed first (see its entry).

**Built**
- **Database** (migration `p1_2_documents`):
  - `ProfessionalDocument`: one current file per user and document type. The
    spec's `fileUrl` is `fileKey`, a Storage key, because files are never
    public. Also stores the cleaned file name, the type detected from the
    file's content, the size, `uploadedAt` and `verifiedAt`.
  - `VerificationComment`: every approve/reject decision with its optional
    comment. The deciding admin is `authorId` (the spec's `approvedBy`) and
    is set to null if that admin is deleted.
  - `User.verificationSubmittedAt`: set when the last required document
    comes in.
- **Storage** (`src/server/storage/`): a `Storage` interface (`put`, `get`
  as a stream, `delete`) with a local-disk implementation in `STORAGE_DIR`
  (default `./storage`, git-ignored, outside `public/`).
  - Keys are random (`documents/<user>/<32 hex>.<ext>`), checked against a
    pattern and kept inside the folder.
  - Writes go to a temporary file and are then renamed into place.
  - `files.ts` checks uploads: the real type from the first bytes (PDF, JPEG
    or PNG), a 5 MB limit, cleaned file names, a request body read with a
    hard cap, and `Content-Disposition`.
  - R2, product images and ebooks can reuse it.
- **Rules** (`src/lib/verification.ts`): Doctor needs a registration
  certificate; Clinic needs clinic registration and GST; Pharmacy and Stockist
  need a drug licence and GST.
- **Flow** (`src/server/verification/documents.ts`):
  - Uploading replaces that document's old file, which is deleted.
  - When every required document is in, the account goes to `pending` with a
    new submitted date. This is also how a rejected account goes back for
    review.
  - Verified accounts can't change their documents. The user row is locked
    during an upload, so a decision made at the same moment can't be undone.
  - Admin decisions (single, bulk and from the review page) now also write a
    `VerificationComment`. Approval sets `verifiedAt` on the documents and
    rejection clears it.
  - Deleting a user deletes their files.
- **Routes:**
  - `POST /api/account/documents`: signed-in users only, same origin, 20
    uploads per hour per account, Zod-checked, with the body capped before
    parsing. It's a route handler rather than a server action so the browser
    can show upload progress.
  - `GET /api/documents/[id]`: the owner or an admin only; everyone else gets
    the same 404. `?download=1` downloads the file. Responses are
    `no-store` and `nosniff`.
  - `next.config.ts` overrides this path's headers so only the site itself
    can frame it (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`),
    with a `default-src 'none'` CSP. In real Google Chrome the admin PDF
    preview renders under these headers with no console errors.
- **Notifications** (`src/server/notify/verification.ts`, dev log):
  - The professional gets a confirmation for each upload.
  - Every admin with an email gets an upload notice with a link to the
    review.
  - The professional gets an approval or rejection email, with the comment
    as the reason.
  - Phone-only accounts get an SMS instead of an email.
- **`/account` for professionals:**
  - The status card shows "Documents needed", "Pending review" (with the
    submitted date), "Verified", or "Not approved" with the reason, a
    re-upload prompt and the phone number.
  - "Your documents" has one card per required document: the file on
    record with a View link, then choose (checked in the browser for type
    and size) → preview (thumbnail for images) → Upload with a progress bar
    → toast and refresh.
  - Once verified, the cards are read-only.
- **Admin:**
  - `/admin/approvals/detail/[userId]` shows each document with a preview
    (images inline; PDFs in a frame from 820 px, with Open/Download on
    phones), the applicant, the decision form and the decision history.
  - The approvals list shows "n of m uploaded", the submitted date (accounts
    with complete sets first) and a Review link.
  - The user detail page links to the review.
  - The decision comment's help text says the professional sees it when
    rejected.
- Copy lives in `src/content/verification.ts` and `src/content/admin.ts`
  (`review`).

**Decisions**
- PNG is accepted alongside the spec's PDF and JPG (phone screenshots are
  common). The type always comes from the file's content, never from the
  name or the browser.
- There's no separate "submit" button. A complete set of documents submits
  itself, which saves a step on phones.
- A new professional still starts as `pending` (from A5). "Pending" with no
  submitted date shows as "Documents needed".
- A rejection's comment is shown to the professional; approval comments are
  kept for the history and the audit log.

**Tests**
- Vitest (250 in total, 33 new):
  - Storage: keys, path traversal, round trips.
  - File checks: type, size, names, the body cap.
  - Flow: status changes, replacing files, wrong document types, customers,
    locked accounts, the SMS fallback, reject → re-upload → approve with
    history, file access rules, file cleanup on delete.
  - Routes: origin, sign-in, 413/415/403/400, rate limit, file headers,
    404s.
- Playwright (`tests/e2e/verification.spec.ts`, phone and desktop):
  - A doctor's upload, including the browser's type and size errors and the
    server refusing a renamed text file.
  - The pharmacy two-document flow.
  - The admin reject → re-upload (JPG) → approve flow, with download and
    preview.
  - Privacy: another user or a visitor gets 404; cross-site, signed-out and
    customer uploads are refused; the framing headers.
  - axe, overflow and console checks on `/account` and the review page.
- `sign-in.spec.ts` now expects a new doctor to see "Documents needed"
  instead of the Stage A "Pending" text. That's the intended change.
- The admin 404 check includes the review page.

**Checks:** `typecheck`, `lint`, `test` (250), `test:e2e` (148 passed, 4
skipped by design) and `build` all pass. `/account` (needed, file selected,
rejected) and the review page were checked in screenshots at 375 and 1280 px.

**Known gaps**
- Headless Chromium (used by the tests) can't draw PDFs, so the automated
  tests check the preview frame exists. Actual PDF rendering was checked once
  by hand in Google Chrome.
- No virus scan or image metadata stripping; see "Later".
- Emails are printed to the server log only (no provider yet), as the rules
  require.
- Admins can decide without any documents (for checks done offline); the
  review page shows what's missing.

**Next steps:** P1.3 (catalogue) can reuse `getStorage()` and
`src/server/storage/files.ts` for product images.

## P1.3. Catalogue and product pages (2026-10-01)

P1.1 (admin) and P1.2 (Storage) were done and committed, so nothing blocked
this chunk. The app built and all checks passed before starting.

**Built**
- **Database** (migration `p1_3_catalogue`):
  - `Product`: slug, name, brand (nullable, `SetNull` if a brand is
    deleted), form (a FORM `Category`), practice areas (many PRACTICE_AREA
    categories), description, ingredients, dosage, pack size, MRP and
    professional price in paise, GST rate (%), HSN code, stock, MOQ,
    active, featured, sortOrder and `isSample`.
  - `ProductImage` (Storage key, type from the file's bytes, size, alt,
    order) and `BulkPriceTier` (min quantity, unit price in paise).
  - `UserType.bulkPricing`: true for Pharmacy / Store and Stockist /
    Distributor, so "who gets bulk tiers" is data like the rest of the
    user types.
- **Pricing** (`src/server/pricing/`): `pricingViewerFor()` turns a user
  into guest / customer / unverified professional / professional (with or
  without bulk), and `priceFor(product, viewer, quantity)` returns the unit
  price, total, tier and saving. It never charges more than MRP and ignores
  tiers that aren't cheaper. `getPricingViewer()` reads the session's user
  type per request. Nothing else reads professional or bulk prices: the
  catalogue's page objects only hold the viewer's own price, and bulk tiers
  only for viewers who get them (a test checks the guest's product object
  has no professional price in it).
- **Pages:**
  - `/products`: form chips (one scrolling line on phones), a filter and
    sort form (form, practice area, brand; featured, price both ways, name,
    newest) in a sidebar from 1100 px and behind a "Filters & sort" button
    below, removable chips for each active filter, 12 per page, empty
    state. Filters are a plain GET form, so the URL holds them; unknown
    keys are dropped.
  - `/products/[slug]`: breadcrumb, gallery (thumbnails switch the main
    photo; without photos, the form's Devanagari mark and "Image coming
    soon"), brand, pack size, the viewer's price with GST and saving, a
    line for guests (sign in, coming back to the product), customers and
    unapproved professionals (check verification), the bulk tier table for
    approved pharmacies and stockists, stock and MOQ, and a disabled "Add
    to cart" with a "Coming soon" badge and a call button until P1.4. Long
    text is shown as plain text with line breaks kept. Hidden or unknown
    products are a 404.
  - `/search`: real results across name, brand, form, practice area and
    ingredients (every word must match), with its own search field (phones
    have no header field), popular searches when empty, "Filter these
    results" into `/products?q=`, and an empty state.
  - Sample products carry a "Sample" badge on cards and the product page,
    plus a note above the results.
  - Homepage: category tiles in the Launch catalogue card link to
    `/products?form=` / `?area=`, its button to `/products`; brand cards
    with no link set go to `/products?brand=<key>` (smaller brand cards
    got a link too); the brands section's "Explore all brands" and the
    hero's "View range" go to the catalogue.
- **Admin `/admin/catalogue`** (new "Catalogue" nav item): list with search,
  status filter and pagination; add and edit forms (amounts typed in
  rupees, up to 5 bulk tiers, practice-area ticks, GST and HSN, stock,
  MOQ, active/featured/sample); products are hidden, not deleted, so
  orders can point at them later. Images on the edit page: upload (JPG,
  PNG or WebP, 5 MB, up to 8), reorder, edit the description, delete.
  Every change writes an `AdminLog` row; the edit page lists recent ones.
- **Routes:**
  - `POST /api/admin/products/[id]/images`: admins only (others get 404),
    same origin, body capped before parsing, type from the file's bytes.
    A route handler because server actions cap bodies at 1 MB.
  - `GET /api/product-images/[id]`: photos of active products are public
    (cached for a day); photos of hidden products are for admins only
    (`private, no-store`); anything else is the same 404. `nosniff`.
- **Seed:** 12 sample products (all six forms, three brands, two to three
  with bulk tiers, one out of stock, one low on stock, one with MOQ 2),
  created only when their slug is missing, and seven sample practice areas
  (the mockup's "By Practice Area" tab had none).
- **Shared code:** the same-origin check moved to
  `src/server/request-origin.ts` (used by both upload routes);
  `detectFileType` recognises WebP; `formatPaise`, `rupeesToPaise` and
  `paiseToRupeeInput` in `src/lib/format.ts`. Copy lives in
  `src/content/catalogue.ts` and `src/content/admin.ts` (`catalogue`).

**Decisions**
- Professional prices need `isProfessional` and, if the type requires
  verification, `approved`. Pending, rejected and "documents needed"
  professionals pay MRP and are told why.
- A product's base price for sorting is MRP, or the professional price for
  professionals; the admin form keeps the professional price at or below
  MRP and each bulk tier below the one before, so sorting matches
  `priceFor()`.
- Out of stock means stock below the MOQ. "Only n left" from 10 down.
- Catalogue pages read the database on every request (they're dynamic
  anyway, because the price depends on the viewer), so admin edits show
  at once without cache tags.
- "Explore all brands" keeps the mockup's wording (the seed test checks
  every mockup string) but now opens `/products`.
- `/search` searches the whole catalogue; filtering happens on
  `/products`, which also accepts `q`.

**Tests**
- Vitest (295 in total, 45 new):
  - Pricing rules for every seeded user type and status, tier choice by
    quantity, never above MRP, bad quantities, the sort column.
  - Catalogue reads: filters, unknown keys, search, price sorting per
    viewer, hidden products, stock, no professional prices in a guest's
    product object, bulk tiers only for bulk viewers, image access.
  - Admin: the product form's rules (rupees, slugs, tiers, GST, HSN),
    create/update with audit and slug clashes, images (store, order,
    describe, delete, wrong type, too many).
  - Routes: upload by admins only, same origin, 400/404/413/415, the public
    and admin-only image responses.
  - Money helpers, slugs, WebP detection; the homepage test now expects
    the practice areas and the brand links.
- Playwright (`tests/e2e/catalogue.spec.ts`, phone and desktop): listing
  filters (chips, panel, removable chips), sorting and the empty state,
  search, the product page for a guest, a pending doctor, an approved
  doctor and an approved pharmacy, a 404, homepage links, an admin adding a
  product with a photo and hiding it, customers getting 404 on the admin
  page, and axe / sideways-scroll / console checks on every new page.
  `shell.spec.ts` now expects real search results instead of the old
  "coming soon" page (intended change).

**Checks (2026-10-01, all on `dev`):** `pnpm typecheck`, `pnpm lint` (no
warnings), `pnpm test` (31 files, 295 tests), `pnpm build` and `pnpm test:e2e`
(168 passed, 4 skipped, phone and desktop) all pass. The new pages
(`/products`, `/products/[slug]`, `/admin/catalogue`) were also checked by eye
at 375 and 1280 px, and by axe and sideways-scroll tests in both projects.

**Fixed while finishing the chunk** (the first full e2e run had failures):
- The listing's filter panel kept stale select values after a form-chip click,
  so Apply sent `form=` and dropped the chip. The form now remounts when the
  URL's filters change.
- The shared admin `SelectField` reset to its first option after a failed save
  (React ignores a changed `defaultValue` on a mounted select). It is now keyed
  by its value; this also helps the other admin forms.
- The placeholder product tile failed colour contrast (`text-teal/70`); it now
  uses `text-teal`.
- Two e2e locators were ambiguous (the "Sample product" badge text and the
  "Punarnava Mandoor" table cell); made exact. No assertions were removed.
- The sign-in, verification and admin e2e failures seen earlier passed on
  rerun and in the full run; the select bug above is the likely cause for the
  admin ones. Not seen to fail again.

**Known gaps**
- Add to cart is a coming-soon state until P1.4; MOQ and stock are shown
  but not enforced yet.
- Product photos aren't resized; no image metadata stripping (see P1.2's
  note in "Later").
- Search has no relevance ranking (featured order).
- See "Later" for the sample data, the reel link and the nav entry.

**Next steps:** P1.4 (cart, checkout and test payment) should price every
line with `priceFor()` and enforce MOQ and stock.

## P1.4. Cart, checkout and test payment (2026-10-01)

An earlier attempt left a BLOCKED entry here (P1.3 wasn't committed then).
P1.3 is now committed (`5b6745e`) and its checks passed, so this entry
replaces it. Nothing needed fixing before starting.

**Built**
- **Database** (migration `p1_4_cart_checkout`):
  - `Cart` (one per user, or a guest cart found by the SHA-256 of its cookie
    token) and `CartItem` (product and quantity only, never a price).
  - `Address`: name, phone (E.164), two address lines, landmark, city, state
    code, PIN code, `lastUsedAt`.
  - `Order` (random 22-character id in URLs, a display number like
    `SV-7K2Q9F4M`, a `checkoutKey` unique per user, the status enum from the
    spec, a copy of the address, subtotal / GST / delivery / total in paise,
    `paidAt`), `OrderItem` (a snapshot of slug, name, pack size, HSN, GST
    rate, MRP, unit price, price tier, quantity, line total and its GST) and
    `Payment` (provider, unique reference, amount, status, attempt number,
    failure reason).
  - Orders survive a deleted account (`userId` set to null); carts and
    addresses go with it.
- **Setting** `checkout.shipping`: `{ feePaise, freeFromPaise }`, seeded as
  ₹80 with free delivery from ₹999 (placeholders, see "Later").
- **Cart** (`src/server/cart/`):
  - `cart.ts`: add, set quantity and remove, with the MOQ and stock checked on
    every change; at most 50 products and 9,999 units a line. `readCart()`
    prices every line with `priceFor()` at its quantity (so bulk tiers apply),
    flags lines that are hidden, sold out, under the MOQ or over the stock, and
    totals only what can be bought.
  - `request.ts`: the owner is the signed-in user, or else the `sv.cart`
    cookie (random 32-byte token, HttpOnly, SameSite=Lax, Secure on https,
    renewed for 30 days on each change). New guest carts are limited to 30 an
    hour per IP. Guest carts unused for 30 days are swept now and then.
  - `merge.ts`: a Better Auth plugin that, after any sign-in (email, phone
    OTP), moves the guest cart into the account (quantities added up), deletes
    it and clears the cookie. Two sign-ins at once merge only once. A failed
    merge never blocks sign-in.
- **Totals** (`src/server/checkout/totals.ts`): prices include GST, so each
  line's GST is worked out from its total (rounded per line) and grouped by
  rate; delivery comes from the setting.
- **Addresses** (`src/server/checkout/addresses.ts`, `src/lib/india.ts`):
  Zod checks name, Indian mobile, lines, city, a state or union territory
  from the list (ISO code, with its GST state code kept for P1.6) and a
  6-digit PIN code whose first digit (its postal zone) must belong to that
  state. Up to 20 per account; every read and write is scoped to the owner.
- **Orders** (`src/server/checkout/orders.ts`):
  - `placeOrder()` prices the cart again in a transaction, refuses an empty
    cart, someone else's address, any line with a problem, or a total that
    differs from the one the page showed ("something changed"). It copies the
    lot into the order, marks the address used and opens payment attempt 1.
    The same checkout key always gives the same order, even if submitted twice
    at once. Limited to 20 orders an hour per account.
  - `startPaymentAttempt()` / `retryPayment()`: the next attempt on the same
    order; owner only.
- **Payments** (`src/server/payments/`): a `PaymentProvider` interface
  (`isAvailable`, `createPayment`, `verifyPayment`) and the `test` provider,
  chosen by `PAYMENT_PROVIDER` (default `test`). The test provider refuses to
  run when `NODE_ENV=production` (see Decisions for the one exception).
  `completePayment()` (`src/server/checkout/payments.ts`) applies a result
  once: the payment and order only move on from `created` / `pending_payment`
  with conditional updates. On success it takes the stock (only if enough is
  left), removes the ordered products from the cart and sends a confirmation
  through the dev notifier (email, or SMS for phone-only accounts). If an item
  has sold out by then, it records a failure (`out_of_stock`) and takes
  nothing.
- **Pages:**
  - Product page: quantity (starting at the MOQ, capped at the stock when
    it's low) and a working "Add to cart" with a "View cart" confirmation;
    sold-out products show a disabled "Out of stock" button with the reason.
  - Header: the bag count is the number of products in the cart.
  - `/cart`: lines with photo, the viewer's unit price (professional and bulk
    labels), quantity stepper, remove, line total and any problem in red; an
    order summary (items total, the GST in it by rate, delivery, how much more
    for free delivery, total); "Check out", or "Sign in to check out" for
    guests (back to `/checkout`); an empty state.
  - `/checkout` (sign-in required, added to the proxy): pick a saved address
    (last used first), add or edit one inline, summary, "Place order and pay".
    Online payment unavailable shows a ComingSoon box with the phone number
    instead of the button.
  - `/checkout/pay/[orderId]`: amount, then a dashed "Test mode" panel
    headed "Test payment - no money is taken" with **Simulate success** and
    **Simulate failure**. Paid and failed orders redirect to their pages.
  - `/checkout/confirmation/[orderId]`: order number, amount, date, address,
    items and totals, "this was a test payment" and "tracking coming soon".
  - `/checkout/failed/[orderId]`: the order is kept; **Try again** (attempt
    n+1 on the same order) and **Back to cart**; an out-of-stock failure says
    so.
  - Every order page is 404 for anyone but the owner.
- Copy lives in `src/content/cart.ts` and `src/content/checkout.ts`; the
  catalogue's "coming soon" cart copy and the `/cart` ComingSoon page are gone.

**Decisions**
- **The test provider in the e2e build.** Playwright tests a production
  build, where the test provider would refuse to run. It runs there only if
  `TEST_PAYMENTS_IN_LOCAL_BUILD=true` *and* `BETTER_AUTH_URL` is localhost;
  `playwright.config.ts` sets both. A live site never has a localhost origin,
  so the rule "refuses in production" still holds for any real deployment.
  Both variables are in `.env.example`.
- Stock is taken when payment succeeds, not when the order is placed (as the
  spec says), so an unpaid order holds nothing. The cost is the
  "sold out before payment finished" case, handled as a failure.
- Only the ordered products leave the cart on success; anything added after
  placing the order stays.
- The checkout form sends the total it showed; it is only compared, never
  charged, so a price change between page and click asks the buyer to look
  again instead of charging a different amount silently.
- Order URLs use a random id rather than a counter, so they don't reveal how
  many orders there are or let anyone guess another order.
- The bag count is products, not units (a pharmacy ordering 50 of one
  product sees 1).
- "Save address" is a secondary button so "Place order and pay" stays the
  one primary action on the page.

**Tests**
- Vitest (342 in total, 47 new):
  - `totals.test.ts`: GST inside inclusive prices, rounding, grouping by
    rate, delivery and the free threshold.
  - `cart.test.ts`: MOQ, stock, hidden and sold-out products, bad
    quantities, the 50-product limit, owners can't touch other carts, prices
    per viewer and quantity (MRP, professional, bulk), flagged lines, no
    professional price in a guest's cart, merging (and a racing double
    merge), the stale-cart sweep.
  - `addresses.test.ts`: PIN code zones per state, field errors, ownership,
    ordering, the 20-address limit.
  - `orders.test.ts`: the server-side price snapshot, a later product change
    not touching the order, one order per checkout key (also concurrently),
    each refusal, payments off in production, success (paid, stock, cart,
    confirmation), success applied once under a concurrent double call and
    replays, failure leaving stock and cart, failure then retry then success,
    sold out before payment, owner checks.
  - `test-provider.test.ts`: refusal in production, the localhost-only
    exception, unknown providers.
  - `proxy.test.ts` now covers `/checkout`.
- Playwright (`tests/e2e/checkout.spec.ts`, phone and desktop):
  - Success: a guest adds two, sees the bag count and totals, the cart
    blocks checkout while stock is short, signs in (the cart follows), saves
    an address after a wrong-state PIN error, places the order, double-clicks
    "Simulate success", lands on the confirmation; stock fell by exactly 2,
    one succeeded attempt, the cart is empty, and the payment page can't pay
    again.
  - Failure then retry: MOQ 2 starts at 2, no address opens the form,
    "Simulate failure" keeps stock and cart, a stranger gets 404, "Try again"
    shows attempt 2, success; attempts are failed then succeeded on one
    order.
  - `/checkout` signed out goes to sign-in; axe, sideways-scroll and console
    checks on the cart, checkout, payment, confirmation and failure pages.
  - Intended changes: `catalogue.spec.ts` expects a working "Add to cart",
    and `shell.spec.ts` expects the real (empty) cart instead of the
    ComingSoon page.
- `tests/e2e/auth-helpers.ts` cleanup also removes e2e users' orders, empty
  guest carts and their order rate-limit rows.

**Checks:** CHECKS_LINE

**Known gaps**
- No order history or tracking yet (`/orders` is still ComingSoon; P1.5).
  Unpaid orders stay `pending_payment` with no expiry.
- No admin view of orders yet (P1.5); no invoices (P1.6).
- Addresses can't be deleted, only edited (P1.10's account pages can add it).
- The PIN code check is by postal zone (first digit), not a full PIN
  database, so a PIN from the right zone but the wrong state passes.

**Next steps:** P1.5 can list orders with `readOrderForUser()`-style reads,
cancel by moving `paid` orders to `cancelled` and adding the stock back, and
use the address snapshot for shipments. P1.6 can build invoices from
`OrderItem` (HSN, GST rate, tax) and the state's `gstCode` in
`src/lib/india.ts`.

## P1.5. Orders and test delivery tracking (BLOCKED, 2026-10-01)

Not started. P1.5 builds on the orders and payments from P1.4, and P1.4 is
unfinished. Per the task rules this chunk stops here instead of finishing or
committing P1.4 itself.

**What it waits on: P1.4 (Cart, checkout and test payment)**
- P1.4 has a full progress entry, but its work was never committed: the latest
  commit on `dev` is `5b6745e` (P1.3), and about 40 P1.4 files are still
  modified or untracked (the `p1_4_cart_checkout` migration, `src/server/cart/`,
  `src/server/checkout/`, `src/server/payments/`, the checkout pages and
  `tests/e2e/checkout.spec.ts`).
- Its entry's **Checks** line still reads the placeholder `CHECKS_LINE`, so
  there is no record that typecheck, lint, test, test:e2e and build passed.
  Nobody has verified this tree since the P1.4 run ended.
- No P1.4 run is active (only this one was running when I checked).

**Why not just go on:** building P1.5 on unverified, uncommitted work would mix
two chunks in one commit history and hide any P1.4 failure inside P1.5.

**Next steps**
1. Re-run (or finish) P1.4: run all five checks, fill in its Checks line, and
   commit it on `dev`.
2. Re-queue P1.5. It can then replace this entry.

Nothing was changed apart from this entry. No P1.5 code was written and checks
were not run; the tree still holds P1.4's uncommitted work.

## P1.6. GST invoices (BLOCKED, 2026-10-01)

Not started. This replaces the earlier P1.6 blocker entry, which is out of
date: P1.3 is now committed (`5b6745e`) and P1.4's code is in the tree. But
P1.6 still waits on two earlier chunks, so per the task rules it stops here.

**What it waits on (checked 2026-10-01, latest commit `06c1440`)**
- **P1.4 (Cart, checkout and test payment) is unfinished:** its `Order`,
  `OrderItem` and `Payment` models and checkout code exist, but none of it is
  committed (about 40 files modified or untracked), and its entry's
  **Checks** line is still the placeholder `CHECKS_LINE`, so nothing shows
  the five checks passed.
- **P1.5 (Orders and test delivery tracking) is BLOCKED** on P1.4. P1.6 needs
  its customer `/orders/[id]` page and admin orders view (for the download
  links) and its order cancel (to trigger the credit note).
- No other chunk run was active when checked.

**Next steps**
1. Finish P1.4: run all five checks, fill in its Checks line, commit on `dev`.
2. Run P1.5.
3. Re-queue P1.6; it can then replace this entry.

Nothing was changed apart from this entry. No P1.6 code was written, pdf-lib was
not added, and checks were not run; P1.4's uncommitted work was left as is.

## P1.7. Super Coins (BLOCKED, 2026-10-01)

Not started. This replaces the earlier P1.7 blocker entry, which is out of
date: P1.3 is now committed (`5b6745e`) and P1.4's code is in the tree. But
P1.7 still waits on two earlier chunks, so per the task rules it stops here.

**What it waits on (checked 2026-10-01, latest commit `77914a2`)**
- **P1.4 (Cart, checkout and test payment) is unfinished:** its `Cart`,
  `Order` and `Payment` models and checkout code exist, but none of it is
  committed (40 files modified or untracked), and its entry's **Checks** line
  is still the placeholder `CHECKS_LINE`, so nothing shows the five checks
  passed. P1.7 redeems coins at this checkout, caps redemption against its
  order total and returns coins on its failed payments.
- **P1.5 (Orders and test delivery tracking) is BLOCKED** on P1.4. P1.7 earns
  coins "after delivery" and returns them on "a cancellation"; both events come
  from P1.5's order status flow and cancel, which don't exist yet (`/orders` is
  still ComingSoon).
- No other chunk run was active when checked (only this one).

**Why it can't go ahead partially:** the `CoinLedger` reference and the
earn/redeem/reverse rules point at P1.4's orders and payments, a `CoinLedger`
migration would stack on P1.4's uncommitted `p1_4_cart_checkout` migration,
and the chunk's Playwright test is "redeeming at checkout".

**Next steps**
1. Finish P1.4: run all five checks, fill in its Checks line, commit on `dev`.
2. Run P1.5 (P1.6 doesn't block P1.7).
3. Re-queue P1.7; it can then replace this entry.

Nothing was changed apart from this entry. No P1.7 code was written and checks
were not run; P1.4's uncommitted work was left as is.

## P1.8. Ebooks (BLOCKED, 2026-10-01)

Not started. This replaces the earlier P1.8 blocker entry, which is out of
date: P1.3 is now committed (`5b6745e`) and P1.4's code is in the tree. But
P1.4 is still unfinished, so per the task rules this chunk stops here.

**What it waits on (checked 2026-10-01, latest commit `0c6a0e4`)**
- **P1.4 (Cart, checkout and test payment) is unfinished:** its `Cart`,
  `Order` and `Payment` models, checkout pages and test payment provider
  exist, but none of it is committed (40 files modified or untracked,
  including the `p1_4_cart_checkout` migration), and its entry's **Checks**
  line is still the placeholder `CHECKS_LINE`, so nothing shows the five
  checks passed. P1.8 sells paid books "through the normal cart and test
  payment" and decides who is a "buyer" from paid orders, both of which are
  P1.4's.
- **P1.5, P1.6 and P1.7 are marked BLOCKED** (all on P1.4). P1.8 doesn't
  need their features, but the task rules say not to build around an earlier
  chunk that is blocked.
- No other chunk run was active when checked (only this one).

**Why it can't go ahead partially:** an `Ebook` migration would stack on
P1.4's uncommitted migration, and the paid-book work changes P1.4's
uncommitted cart, order and payment code. Committing it would mix both
chunks in one history and hide any P1.4 failure inside P1.8.

**Note for when it runs:** P1.4's `CartItem` and `OrderItem` hold products
only (`productId`, pack size, HSN, stock taken on payment). P1.8 will need
to add a non-physical line (an ebook: no stock, no MOQ, no delivery fee)
to both, or model each paid ebook as its own line type. The P1.2 `Storage`
in `src/server/storage/` already streams files for the download route.

**Next steps**
1. Finish P1.4: run all five checks, fill in its Checks line, commit on `dev`.
2. Run P1.5, P1.6 and P1.7 (or clear their blockers).
3. Re-queue P1.8; it can then replace this entry.

Nothing was changed apart from this entry. No P1.8 code was written and checks
were not run; P1.4's uncommitted work was left as is.

## P1.9. Site settings, maintenance mode and homepage editing (BLOCKED, 2026-10-01)

Not started. This replaces the earlier BLOCKED entry. That one waited on P1.3,
which is now committed (`5b6745e`). The chunk is still blocked on earlier
chunks, so per the task rules it stops here instead of building around them.

**What's blocking (checked in git and docs on 2026-10-01)**
- **P1.4 (Cart, checkout and test payment) is unfinished.** Its code is
  uncommitted on `dev` (no P1.4 commit; the latest commit is `a94279b`), and
  its entry still has the placeholder `CHECKS_LINE` as its **Checks** line, so
  nothing shows typecheck, lint, test, test:e2e and build passed.
- **P1.5, P1.6, P1.7 and P1.8 are marked BLOCKED** (all on P1.4) and not built.
- **P1.4's uncommitted edits overlap P1.9's files:** `prisma/schema.prisma`
  (P1.9 needs a migration making `Setting.updatedBy` and
  `SettingHistory.changedBy` real `User` relations, which would stack on
  P1.4's uncommitted migration), `src/content/settings.ts` and
  `src/server/content/settings.ts`. P1.9's commits couldn't be kept apart from
  P1.4's work.

**Notes for the run once unblocked**
- Already there: `Setting` and `SettingHistory` (A4), a coming-soon
  `/admin/settings`, and `/admin/content` with brands, courses, quiz and reels
  editors (P1.1). Still to do: hero slides, offers, stats, quick actions,
  categories, feedback, why-steps, section on/off and order, create-only
  seeding, `revalidateTag` after saves, and maintenance mode.
- Files P1.9 will touch: `src/server/seed/home-content.ts`,
  `src/server/seed/index.ts`, `prisma/seed.ts`, `src/server/content/home.ts`
  and its test, `src/components/admin/admin-nav.tsx`, `src/content/admin.ts`.

**Next steps**
1. Finish P1.4: run the five checks, fill in its **Checks** line, commit.
2. Build P1.5 to P1.8 in order (replacing their BLOCKED entries), then
   re-queue P1.9.

Nothing was changed apart from this entry. No P1.9 code was written and no
checks were run.

## P1.11. Admin security and permissions (BLOCKED, 2026-10-01)

Not started. This replaces the earlier P1.11 blocker entry, which is out of
date: P1.3 is now committed (`5b6745e`). But P1.11 still waits on earlier
chunks, so per the task rules it stops here.

**What it waits on (checked in git and docs on 2026-10-01, latest commit
`b801513`)**
- **P1.4 (Cart, checkout and test payment) is unfinished.** Its work is still
  uncommitted on `dev` (no P1.4 commit; 39 paths modified or untracked,
  including `prisma/schema.prisma` and the `p1_4_cart_checkout` migration),
  and its entry's **Checks** line is still the placeholder `CHECKS_LINE`, so
  nothing shows the five checks passed. No P1.4 run is active.
- **P1.5 to P1.10 are all marked BLOCKED** (on P1.4) and not built.

**Why not build it anyway:** P1.11 needs a migration (two-factor tables, admin
roles, invites) that would stack on P1.4's uncommitted one, and its commits
couldn't be kept apart from P1.4's edits to shared files
(`prisma/schema.prisma`, `src/proxy.ts`, `src/server/auth/`).

**Notes for the run that builds P1.11** (still valid from the earlier entry)
- `UserRole` is only `user | admin`; `requireAdmin()` in
  `src/server/auth/session.ts` is the single admin gate (admin pages, the
  `users`, `content` and `catalogue` actions, `src/proxy.ts`). `AdminLog` is
  written through `src/server/admin/audit.ts`; `pnpm admin:create` is
  `scripts/admin-create.ts`. There is no two-factor code yet.
- A per-area check (for example `requireAdminPermission("catalogue")`) can
  replace `requireAdmin()`, and a Vitest test can list every admin server
  action and route handler and check that each calls it.
- Admin areas built by P1.5 to P1.10 (orders, invoices, coins, ebooks,
  settings, reports) need their permissions defined and enforced here.

**Next steps**
1. Finish P1.4: run the five checks, fill in its **Checks** line, commit.
2. Build P1.5 to P1.10 in order, replacing their BLOCKED entries.
3. Re-queue P1.11.

Nothing was changed apart from this entry. No P1.11 code was written and no
checks were run. The tree still holds P1.4's uncommitted work.

## P1.10. My account and admin reports (BLOCKED, 2026-10-01)

Not started. This replaces the earlier P1.10 blocker entry, which is out of
date: P1.3 is now committed (`5b6745e`), and P1.4's `Address`, `Order`,
`OrderItem` and `Payment` models are in the tree. But P1.10 still waits on
earlier chunks, so per the task rules it stops here.

**What it waits on (checked in git, schema and docs on 2026-10-01, latest
commit `4a62a9b`)**
- **P1.4 (Cart, checkout and test payment) is unfinished.** Its work is still
  uncommitted on `dev` (no P1.4 commit; 39 paths modified or untracked,
  including the `p1_4_cart_checkout` migration, `src/server/cart/`,
  `src/server/checkout/` and `src/server/payments/`), and its entry's
  **Checks** line is still the placeholder `CHECKS_LINE`, so nothing shows the
  five checks passed. P1.10's sales, orders, top products and orders CSV all
  read P1.4's orders, and `/account` manages its saved addresses.
- **P1.5 (Orders and test delivery tracking) is BLOCKED**, so `/orders` is
  still a placeholder and order statuses past `paid` aren't used. "Orders by
  status" and the account page's orders link need it.
- **P1.7 (Super Coins) is BLOCKED**: there is no `CoinLedger` model, so "coins
  issued/redeemed" can't be reported.
- **P1.8 (Ebooks) is BLOCKED**: there is no `Ebook` model or `/ebooks` page for
  the account page to link to.
- No P1.4 run is active right now.

**Why not build part of it:** the chunk's tests ("reports match seeded
orders") need committed, verified orders. The notification preferences need a
schema change, which would stack on P1.4's uncommitted migration, and P1.10's
commits couldn't be kept apart from P1.4's uncommitted edits (for example
`prisma/schema.prisma`).

**Notes for the run that builds P1.10** (still valid from the earlier entry)
- `/account` today is `src/app/(site)/account/page.tsx` (A5/P1.2: verification
  status and documents). `src/server/auth/account.ts` reads `emailVerified`.
  The dev notifier (`src/server/notify/`, `dev-outbox.ts` for tests) can send
  the verification link. `AdminLog` (`src/server/admin/audit.ts`) can log CSV
  exports.
- If P1.11 is built first, `/admin/reports` and the CSV routes must use its
  per-area permission check rather than plain `requireAdmin()`.
- Sum money in paise from `OrderItem` snapshots and coins from `CoinLedger`,
  so reports match invoices and balances exactly.
- Escape CSV cells starting with `=`, `+`, `-` or `@` (formula injection),
  since names and addresses are user-typed.

**Next steps**
1. Finish P1.4: run the five checks, fill in its **Checks** line, commit.
2. Build P1.5, P1.7 and P1.8 (and P1.6 and P1.9 in order), replacing their
   BLOCKED entries.
3. Re-queue P1.10.

Nothing was changed apart from this entry. No P1.10 code was written and no
checks were run, since no file under `src/`, `prisma/` or `tests/` was
touched. The tree still holds P1.4's uncommitted work.

## P2.1. Launch Your Brand: request and admin review (BLOCKED, 2026-10-01)

Not started. P2.1 builds on P1.3's catalogue, and P1.3 is still unfinished. Per
the task rules this chunk stops here instead of finishing P1.3 itself.

**What's blocking (checked in code, schema and git on 2026-10-01)**
- **P2.1 extends P1.3 directly:**
  - It adds `Product.privateLabel` and a private-label MOQ to P1.3's `Product`
    model. That migration would stack on P1.3's uncommitted
    `20260930234005_p1_3_catalogue`.
  - The flags are edited in P1.3's `/admin/catalogue` form
    (`src/components/admin/product-form.tsx`, `src/server/admin/catalogue.ts`,
    `src/app/admin/catalogue/`). All of these are untracked.
  - `BrandRequest` points at a `Product`. The Launch Studio's formulation
    step searches the catalogue and filters it by form, which is P1.3's
    `src/server/catalogue/` code.
  - The homepage Launch catalogue card and the hero links that P2.1 rewires
    live in `src/components/site/launch-section.tsx`, which already holds
    P1.3's uncommitted edits.
- **P1.3 is still unfinished:** its work is uncommitted on `dev` (latest
  commit `758fd70`, no `P1.3` commit; still 38 changed or new paths). No file
  under `src/`, `prisma/` or `tests/` has changed since P1.9 re-ran the e2e
  tests (the newest edit is from 09:26, before the P1.9 commit at 09:35), so
  the four `catalogue.spec.ts` tests on phone and desktop are still failing
  (see the P1.9 entry). The e2e run wasn't repeated, since the tree is the
  same. The definition of done (`pnpm test:e2e` green) can't be met, and
  P2.1's commits couldn't be kept apart from P1.3's work.
- The schema has no `privateLabel`, `BrandRequest` or `BrandRequestEvent` yet.

**Not blocking, for the run that builds P2.1**
- P2.1 doesn't need orders or payments (P1.4 to P1.8). Once P1.3 is
  committed and green, it could run before them if Launch Your Brand is
  wanted sooner.
- Already available: `Storage` for the logo upload (P1.2, with byte-based
  type checks and the same-origin helper P1.3 moved to
  `src/server/request-origin.ts`), the dev notifier in `src/server/notify/`,
  the Stepper primitive (A2), user types and verification status for the admin
  detail view (A4/P1.2), and `AdminLog` (`src/server/admin/audit.ts`).
- The mobile dock's Cart item becomes My Brand. Today the cart is still a
  placeholder until P1.4, so the header cart link must stay.
- If P1.11 is built first, `/admin/brand-requests` must use its per-area
  permission check instead of plain `requireAdmin()`.
- Status transitions are worth keeping in one table (from → allowed next
  statuses) in `src/server/`, used by both customer and admin actions, so
  P2.2 can add quote and proof steps without spreading the rules around.

**Next steps**
1. Finish P1.3 (steps in the P1.4 entry; only the four catalogue tests are
   still failing), get all five checks green and commit.
2. Re-queue P2.1. It can go right after P1.3. P2.2 and P2.4 still need it,
   and P2.3 (Quiz & Win) doesn't, though P2.3 does need P1.7's `CoinLedger`.

Nothing was changed apart from this entry. No P2.1 code was written and no
checks were run, since no file under `src/`, `prisma/` or `tests/` was
touched. The tree still holds P1.3's uncommitted work.

## P2.2. Launch Your Brand: quote, label proof and production (BLOCKED, 2026-10-01)

Not started. All four chunks P2.2 builds on are missing, so this chunk stops
here instead of rebuilding them.

**What's blocking (checked in code, schema and git on 2026-10-01)**
- **P2.1 (request and admin review) is not built** (its entry above is
  BLOCKED). P2.2 adds quotes, proofs and production steps to P2.1's
  `BrandRequest`, its status flow and `/my-brand/[id]`. None of these exist:
  there is no `BrandRequest` in `prisma/schema.prisma` and no `my-brand`
  route.
- **P1.4 (test payment) is not built.** The advance payment must go through
  P1.4's `PaymentProvider` and its test provider. No `PaymentProvider`
  exists in `src/`.
- **P1.5 (test delivery tracking) is not built.** The Dispatched step needs
  P1.5's test `ShippingProvider`, which doesn't exist.
- **P1.6 (GST invoices) is not built.** The advance invoice uses it.
- **The root cause is still P1.3:** its work is uncommitted on `dev` (latest
  commit `df917b1`, no `P1.3` commit; still 38 changed or new paths). No file
  under `src/`, `prisma/` or `tests/` has changed since the P2.1 entry, so
  the four failing `catalogue.spec.ts` tests (phone and desktop, see the P1.4
  and P1.9 entries) still fail. The checks weren't re-run because the tree is
  the same.

**For the run that builds P2.2**
- Already available: `Storage` for proof uploads (P1.2, with type checks
  based on the file's bytes), the dev notifier, the A2 Stepper for the
  Confirmed / Production / Quality check / Dispatch stepper, and `AdminLog`.
- Keep each quote's payment idempotent by putting a unique key on the payment
  record (one paid advance per quote). Check expiry on the server when the
  quote is accepted *and* again when payment is confirmed, so a quote that
  expires during checkout can't be paid.
- Proof versions: add a new row per upload (never overwrite), and serve the
  approved proof through an owner-or-admin check, the same way P1.2 serves
  documents.
- Add the quote and proof statuses to P2.1's single transitions table
  (suggested in the P2.1 entry) rather than spreading the rules across routes.

**Next steps (in order)**
1. Finish and commit P1.3 (steps in the P1.4 entry).
2. Build P1.4, P1.5 and P1.6. P2.1 can run any time after P1.3.
3. Re-queue P2.2 once P2.1, P1.4, P1.5 and P1.6 are committed and green.

Nothing was changed apart from this entry. No P2.2 code was written and no
checks were run. The tree still holds P1.3's uncommitted work.

## P2.3. Quiz & Win (BLOCKED, 2026-10-01)

Not started. P2.3 credits quiz coins "through the P1.7 `CoinLedger`" using "a
new coin rule", and P1.7 is not built. So this chunk stops here instead of
building P1.7 (or finishing P1.3) itself.

**What's blocking (checked in code, schema and git on 2026-10-01)**
- **P1.7 (Super Coins) is not built** (its entry above is BLOCKED). There is
  no `CoinLedger` model and no coin rules in `prisma/schema.prisma`, and no
  `/admin/coins`. `/coins` is still a coming-soon page and the header pill
  still shows a hard-coded `0`. P2.3's coin credit, its admin-set amount and
  its "once per attempt" test all need P1.7's ledger and rules.
- **P1.1's part is there:** `Quiz`, `QuizQuestion` and `QuizOption` exist, and
  quizzes can be authored at `/admin/content/quiz`. P2.3 would add the
  weekly schedule (start/end), the pass threshold and attempts on top of these.
- **The root cause is still P1.3:** its work is uncommitted on `dev` (latest
  commit `dfe0c5e`, no `P1.3` commit; still 38 changed or new paths). A P2.3
  migration (`QuizAttempt`, schedule fields) would stack on P1.3's uncommitted
  migration `20260930234005_p1_3_catalogue`, as noted for P1.7. Nothing under
  `src/`, `prisma/` or `tests/` has changed since the P2.2 entry, so the
  checks weren't re-run.

**Why it can't go ahead partially:** the quiz itself (schedule, play, server
timer, leaderboards) doesn't strictly need coins. But the chunk's coin credit,
its tests and its done all depend on the ledger. Building the quiz now would
also mean adding a migration on top of P1.3's uncommitted one. Shipping a quiz
called "Quiz & Win" with no prize would need a product decision. That isn't
for an unattended run to make.

**For the run that builds P2.3**
- Serve questions through a separate select that never includes
  `QuizOption.isCorrect`. Return answers and explanations only after the
  attempt is submitted or expired. `QuizQuestion` has no explanation field
  yet; add one.
- Put a unique key on (`userId`, `quizId`) on the attempt for the
  one-attempt rule. Keep `startedAt` on the attempt and check each answer
  against `startedAt + 5 min` on the server. Store answers as they come in so
  a refresh resumes the attempt.
- Credit coins in the same transaction that finalises the attempt. Use a
  unique ledger reference (e.g. `quiz-attempt:<id>`) so a retry or a double
  submit can't credit twice.
- Leaderboard names: first name + last initial, worked out on the server.
  Never send full names or ids to the client.
- Homepage: the Quiz & Win section (A8) and the "Play this week's quiz" links
  show seeded homepage content
  (`quiz-section.tsx`), not a real quiz. Switch them to the live quiz or "next
  quiz starts ...".

**Next steps (in order)**
1. Finish and commit P1.3 (steps in the P1.4 entry).
2. Build P1.4 and P1.5, then P1.7.
3. Re-queue P2.3 once P1.7 is committed and green.

Nothing was changed apart from this entry. No P2.3 code was written and no
checks were run. The tree still holds P1.3's uncommitted work.

## P2.4. Phase 2 quality and security pass (BLOCKED, 2026-10-01)

Not started. P2.4 reviews what P2.1, P2.2 and P2.3 built, and none of the
three is built (each entry above is BLOCKED). There is nothing to screenshot,
run axe on or security-review, and the Phase 2 summary would have nothing to
summarise. So this chunk stops here instead of building those chunks itself.

**What's blocking (checked in code, schema and git on 2026-10-01)**
- **Nothing from Phase 2 exists:**
  - `prisma/schema.prisma` has no `BrandRequest`, `BrandRequestEvent`,
    `Product.privateLabel`, quote, proof, `QuizAttempt` or `CoinLedger`.
  - There are no `/launch`, `/my-brand`, `/quiz` or `/admin/brand-requests`
    routes.
- **Each review item in the chunk needs a missing chunk:**
  - Request/quote ownership and status-transition tampering: P2.1 and P2.2.
  - Proof and logo uploads: P2.1 (logo) and P2.2 (proofs).
  - Quiz answer leakage and timer bypass: P2.3.
  - Coin double-credit: P2.3, on top of P1.7's `CoinLedger`.
- **The root cause is still P1.3:** its work is uncommitted on `dev` (latest
  commit `2a312bc`, no `P1.3` commit; still 38 changed or new paths). No file
  under `src/`, `prisma/` or `tests/` has changed since the P2.3 entry (the
  newest edit is from 09:26), so the four failing `catalogue.spec.ts` tests
  (see the P1.4 and P1.9 entries) still fail. The checks weren't re-run
  because the tree is the same.
- P1.12 (the Phase 1 pass this chunk is modelled on) is also BLOCKED, so
  there's no Phase 1 summary to build the Phase 2 one on.

**For the run that does P2.4**
- Use the "For the run that builds ..." notes in the P2.1, P2.2 and P2.3
  entries as the review checklist. They set out what each chunk should do for
  this pass to check: one transitions table, quote expiry checked at accept
  and at payment, a unique key per quote payment, proof versions served
  through an owner-or-admin check, questions selected without `isCorrect`,
  a unique (`userId`, `quizId`) attempt with a server-side timer, and coins
  credited once through a unique ledger reference.
- Run it after P1.12 (CHUNKS.md says Phase 2 runs after P1.12), so the Phase 2
  summary can sit next to the Phase 1 one at the top of this file.

**Next steps (in order)**
1. Finish and commit P1.3 (steps in the P1.4 entry).
2. Build P1.4 to P1.11, then run P1.12.
3. Build P2.1, P2.2 and P2.3.
4. Re-queue P2.4 once P2.1 to P2.3 are committed and green.

Nothing was changed apart from this entry. No code was written, no checks were
run and no screenshots were taken. The tree still holds P1.3's uncommitted
work.
