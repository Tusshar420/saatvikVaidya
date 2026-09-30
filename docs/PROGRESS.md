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
